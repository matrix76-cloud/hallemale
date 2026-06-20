/* eslint-disable */
// src/services/bannersService.js
// 홈 히어로 배너 CRUD
// Firestore 컬렉션: banners
// 이미지 업로드는 mediaService.uploadCompressedImageMedia 재사용

import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { storage } from "./firebase";
import { ref, deleteObject } from "firebase/storage";
import { uploadCompressedImageMedia } from "./mediaService";

function safeStr(v) {
  return String(v || "").trim();
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
    title: safeStr(data.title),
    desc: safeStr(data.desc),
    imageUrl: safeStr(data.imageUrl),
    storagePath: safeStr(data.storagePath),
    linkUrl: safeStr(data.linkUrl),
    side: data.side === "right" ? "right" : "left",
    textAlign: data.textAlign === "right" ? "right" : "left",
    order: typeof data.order === "number" ? data.order : 0,
    active: data.active !== false, // 기본 true
    impressions: typeof data.impressions === "number" ? data.impressions : 0,
    clicks: typeof data.clicks === "number" ? data.clicks : 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function uploadBannerImage(file) {
  const item = await uploadCompressedImageMedia({
    scope: "banners",
    ownerId: "admin",
    file,
    kind: "highlight",
  });
  return { imageUrl: item.url, storagePath: item.storagePath };
}

export async function createBanner({
  title,
  desc,
  imageUrl,
  storagePath,
  linkUrl = "",
  side = "left",
  textAlign = "left",
  order = 0,
  active = true,
}) {
  if (!safeStr(imageUrl)) throw new Error("이미지가 필요합니다.");

  const ref = await addDoc(collection(db, "banners"), {
    title: safeStr(title),
    desc: safeStr(desc),
    imageUrl: safeStr(imageUrl),
    storagePath: safeStr(storagePath),
    linkUrl: safeStr(linkUrl),
    side: side === "right" ? "right" : "left",
    textAlign: textAlign === "right" ? "right" : "left",
    order: Number(order) || 0,
    active: active !== false,
    impressions: 0,
    clicks: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateBanner(id, patch) {
  const bid = safeStr(id);
  if (!bid) throw new Error("id가 비어있습니다.");
  const update = { updatedAt: serverTimestamp() };
  if (patch.title !== undefined) update.title = safeStr(patch.title);
  if (patch.desc !== undefined) update.desc = safeStr(patch.desc);
  if (patch.imageUrl !== undefined) update.imageUrl = safeStr(patch.imageUrl);
  if (patch.storagePath !== undefined) update.storagePath = safeStr(patch.storagePath);
  if (patch.linkUrl !== undefined) update.linkUrl = safeStr(patch.linkUrl);
  if (patch.side !== undefined) update.side = patch.side === "right" ? "right" : "left";
  if (patch.textAlign !== undefined) update.textAlign = patch.textAlign === "right" ? "right" : "left";
  if (patch.order !== undefined) update.order = Number(patch.order) || 0;
  if (patch.active !== undefined) update.active = patch.active !== false;

  await updateDoc(doc(db, "banners", bid), update);
}

export async function deleteBanner({ id, storagePath }) {
  const bid = safeStr(id);
  if (!bid) throw new Error("id가 비어있습니다.");

  // Storage 이미지 삭제 (실패해도 doc 삭제 진행)
  if (safeStr(storagePath)) {
    try {
      await deleteObject(ref(storage, safeStr(storagePath)));
    } catch (e) {
      console.warn("[deleteBanner] storage delete failed:", e?.message || e);
    }
  }
  await deleteDoc(doc(db, "banners", bid));
}

// 배너 노출 +1 (광고주용 트래픽 집계)
export async function incrementBannerImpression(id) {
  const bid = safeStr(id);
  if (!bid) return;
  try {
    await updateDoc(doc(db, "banners", bid), { impressions: increment(1) });
  } catch (e) {
    console.warn("[incrementBannerImpression] failed:", e?.message || e);
  }
}

// 배너 클릭 +1 (광고주용 트래픽 집계)
export async function incrementBannerClick(id) {
  const bid = safeStr(id);
  if (!bid) return;
  try {
    await updateDoc(doc(db, "banners", bid), { clicks: increment(1) });
  } catch (e) {
    console.warn("[incrementBannerClick] failed:", e?.message || e);
  }
}

// 어드민용 — 모든 배너
export async function listAllBanners() {
  const snap = await getDocs(query(collection(db, "banners")));
  const rows = [];
  snap.forEach((d) => rows.push(rowFromSnap(d)));
  rows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return ta - tb;
  });
  return rows;
}

// 사용자 측 — 활성 배너만
export async function listActiveBanners() {
  const snap = await getDocs(
    query(collection(db, "banners"), where("active", "==", true))
  );
  const rows = [];
  snap.forEach((d) => rows.push(rowFromSnap(d)));
  rows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return ta - tb;
  });
  return rows;
}
