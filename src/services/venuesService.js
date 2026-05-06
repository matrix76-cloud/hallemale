/* eslint-disable */
// src/services/venuesService.js
// 구장(venues) CRUD
// Firestore 컬렉션: venues
// 이미지 업로드는 mediaService.uploadCompressedImageMedia 재사용 (scope=venues)

import { db, storage } from "./firebase";
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

export async function uploadVenueImage(file) {
  const item = await uploadCompressedImageMedia({
    scope: "venues",
    ownerId: "admin",
    file,
    kind: "highlight",
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

export async function deleteVenue({ id, storagePath }) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");

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
