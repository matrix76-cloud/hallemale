/* eslint-disable */
// src/services/venuesService.js
// 구장(venues) CRUD
// Firestore 컬렉션: venues
// 이미지 업로드는 mediaService.uploadCompressedImageMedia 재사용 (scope=venues)

import { db, storage, ownerStorage } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { uploadCompressedImageMedia } from "./mediaService";

function safeStr(v) {
  return String(v || "").trim();
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowFromSnap(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    name: safeStr(data.name),
    address: safeStr(data.address),
    addressDetail: safeStr(data.addressDetail),
    lat: toNum(data.lat),
    lng: toNum(data.lng),
    imageUrl: safeStr(data.imageUrl),
    storagePath: safeStr(data.storagePath),
    type: data.type === "outdoor" ? "outdoor" : "indoor", // indoor | outdoor
    cost: data.cost === "paid" ? "paid" : "free", // free | paid
    memo: safeStr(data.memo),
    order: typeof data.order === "number" ? data.order : 0,
    active: data.active !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/**
 * 구장 사진·서류 업로드. 구장주(/owner/*)와 어드민이 함께 쓴다.
 * 구장주는 asOwner:true — Storage 도 세션이 묶인 앱을 따라가므로, 안 넘기면
 * storage.rules(request.auth != null)에 걸려 업로드가 거부된다.
 */
export async function uploadVenueImage(file, { asOwner = false } = {}) {
  const item = await uploadCompressedImageMedia({
    scope: "venues",
    ownerId: "admin",
    file,
    kind: "highlight",
    ...(asOwner ? { storageRef: ownerStorage } : {}),
  });
  return { imageUrl: item.url, storagePath: item.storagePath };
}

export async function createVenue({
  name,
  address,
  addressDetail,
  lat,
  lng,
  imageUrl,
  storagePath,
  type = "indoor",
  cost = "free",
  memo,
  order = 0,
  active = true,
}) {
  if (!safeStr(name)) throw new Error("구장명이 필요합니다.");
  if (!safeStr(address)) throw new Error("주소가 필요합니다.");

  const ref = await addDoc(collection(db, "venues"), {
    name: safeStr(name),
    address: safeStr(address),
    addressDetail: safeStr(addressDetail),
    lat: toNum(lat),
    lng: toNum(lng),
    imageUrl: safeStr(imageUrl),
    storagePath: safeStr(storagePath),
    type: type === "outdoor" ? "outdoor" : "indoor",
    cost: cost === "paid" ? "paid" : "free",
    memo: safeStr(memo),
    order: Number(order) || 0,
    active: active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateVenue(id, patch) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  const update = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) update.name = safeStr(patch.name);
  if (patch.address !== undefined) update.address = safeStr(patch.address);
  if (patch.addressDetail !== undefined)
    update.addressDetail = safeStr(patch.addressDetail);
  if (patch.lat !== undefined) update.lat = toNum(patch.lat);
  if (patch.lng !== undefined) update.lng = toNum(patch.lng);
  if (patch.imageUrl !== undefined) update.imageUrl = safeStr(patch.imageUrl);
  if (patch.storagePath !== undefined)
    update.storagePath = safeStr(patch.storagePath);
  if (patch.type !== undefined)
    update.type = patch.type === "outdoor" ? "outdoor" : "indoor";
  if (patch.cost !== undefined)
    update.cost = patch.cost === "paid" ? "paid" : "free";
  if (patch.memo !== undefined) update.memo = safeStr(patch.memo);
  if (patch.order !== undefined) update.order = Number(patch.order) || 0;
  if (patch.active !== undefined) update.active = patch.active !== false;

  await updateDoc(doc(db, "venues", vid), update);
}

// 아직 끝나지 않은 예약 — 구장주 탈퇴(ownerWithdrawService)와 같은 기준을 쓴다.
const ACTIVE_RESERVATION_STATUSES = ["requested", "pending", "confirmed"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 삭제해도 되는 구장인지 — 걸려 있는 예약·결제를 센다.
 *
 * 구장 문서만 지우면 예약(venueReservations)·결제(payments)는 그대로 남는다.
 * 남은 예약은 이용자의 "내 예약"에서 상세가 깨지고, 남은 결제는 정산(10-26) 지급 대상에
 * 계속 잡힌다 — 없는 구장에 돈이 나간다. 그래서 삭제 전에 세어서 막는다.
 *
 * @returns {{ activeReservations: number, livePayments: number, totalReservations: number }}
 */
export async function getVenueDeleteBlockers(id) {
  const vid = safeStr(id);
  const out = { activeReservations: 0, livePayments: 0, totalReservations: 0 };
  if (!vid) return out;

  const resvSnap = await getDocs(
    query(collection(db, "venueReservations"), where("venueId", "==", vid))
  );
  const today = todayStr();
  const reservationIds = [];
  resvSnap.forEach((d) => {
    const data = d.data() || {};
    out.totalReservations += 1;
    reservationIds.push(d.id);
    if (ACTIVE_RESERVATION_STATUSES.includes(safeStr(data.status)) && safeStr(data.date) >= today) {
      out.activeReservations += 1;
    }
  });

  // 취소되지 않은 결제 원장 = 아직 정산에 잡히는 돈. 예약 수만큼 in 쿼리를 30개씩 끊어 센다.
  for (let i = 0; i < reservationIds.length; i += 30) {
    const chunk = reservationIds.slice(i, i + 30);
    const paySnap = await getDocs(
      query(collection(db, "payments"), where("reservationId", "in", chunk), where("cancelled", "==", false))
    );
    out.livePayments += paySnap.size;
  }

  return out;
}

export async function deleteVenue({ id, storagePath }) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");

  // 예약·결제가 살아 있으면 지우지 않는다. 노출만 끊으려면 "비활성"(active=false)을 쓴다.
  const blockers = await getVenueDeleteBlockers(vid);
  if (blockers.activeReservations > 0 || blockers.livePayments > 0) {
    const parts = [];
    if (blockers.activeReservations > 0) parts.push(`진행 중 예약 ${blockers.activeReservations}건`);
    if (blockers.livePayments > 0) parts.push(`정산 전 결제 ${blockers.livePayments}건`);
    throw new Error(
      `${parts.join(" · ")}이(가) 남아 있어 삭제할 수 없습니다.\n` +
      `예약을 먼저 취소·환불 처리하거나, 노출만 막으려면 '비활성'으로 바꿔주세요.`
    );
  }

  if (safeStr(storagePath)) {
    try {
      await deleteObject(ref(storage, safeStr(storagePath)));
    } catch (e) {
      console.warn("[deleteVenue] storage delete failed:", e?.message || e);
    }
  }
  await deleteDoc(doc(db, "venues", vid));
}

// 단건 조회
export async function getVenueById(id) {
  const vid = safeStr(id);
  if (!vid) return null;
  const snap = await getDoc(doc(db, "venues", vid));
  if (!snap.exists()) return null;
  return rowFromSnap(snap);
}

// 어드민용 — 모든 구장
export async function listAllVenues() {
  const snap = await getDocs(query(collection(db, "venues")));
  const rows = [];
  snap.forEach((d) => rows.push(rowFromSnap(d)));
  rows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return rows;
}

// 사용자 측 — 활성 구장만
export async function listActiveVenues() {
  const snap = await getDocs(
    query(collection(db, "venues"), where("active", "==", true))
  );
  const rows = [];
  snap.forEach((d) => rows.push(rowFromSnap(d)));
  rows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return rows;
}
