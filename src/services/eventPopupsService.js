/* eslint-disable */
// src/services/eventPopupsService.js
// 이벤트 팝업 CRUD
// Firestore 컬렉션: event_popups

import { db, storage } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
    body: safeStr(data.body),
    imageUrl: safeStr(data.imageUrl),
    storagePath: safeStr(data.storagePath),
    linkUrl: safeStr(data.linkUrl),
    linkLabel: safeStr(data.linkLabel),
    order: typeof data.order === "number" ? data.order : 0,
    active: data.active !== false,
    startAt: toDate(data.startAt),
    endAt: toDate(data.endAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function uploadEventPopupImage(file) {
  const item = await uploadCompressedImageMedia({
    scope: "event_popups",
    ownerId: "admin",
    file,
    kind: "highlight",
  });
  return { imageUrl: item.url, storagePath: item.storagePath };
}

export async function createEventPopup({
  title,
  body,
  imageUrl,
  storagePath,
  linkUrl = "",
  linkLabel = "",
  order = 0,
  active = true,
  startAt = null,
  endAt = null,
}) {
  const docRef = await addDoc(collection(db, "event_popups"), {
    title: safeStr(title),
    body: safeStr(body),
    imageUrl: safeStr(imageUrl),
    storagePath: safeStr(storagePath),
    linkUrl: safeStr(linkUrl),
    linkLabel: safeStr(linkLabel),
    order: Number(order) || 0,
    active: active !== false,
    startAt: startAt instanceof Date && !Number.isNaN(startAt.getTime()) ? startAt : null,
    endAt: endAt instanceof Date && !Number.isNaN(endAt.getTime()) ? endAt : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id };
}

export async function updateEventPopup(id, patch) {
  const pid = safeStr(id);
  if (!pid) throw new Error("id가 비어있습니다.");
  const update = { updatedAt: serverTimestamp() };
  if (patch.title !== undefined) update.title = safeStr(patch.title);
  if (patch.body !== undefined) update.body = safeStr(patch.body);
  if (patch.imageUrl !== undefined) update.imageUrl = safeStr(patch.imageUrl);
  if (patch.storagePath !== undefined) update.storagePath = safeStr(patch.storagePath);
  if (patch.linkUrl !== undefined) update.linkUrl = safeStr(patch.linkUrl);
  if (patch.linkLabel !== undefined) update.linkLabel = safeStr(patch.linkLabel);
  if (patch.order !== undefined) update.order = Number(patch.order) || 0;
  if (patch.active !== undefined) update.active = patch.active !== false;
  if (patch.startAt !== undefined) {
    update.startAt =
      patch.startAt instanceof Date && !Number.isNaN(patch.startAt.getTime())
        ? patch.startAt
        : null;
  }
  if (patch.endAt !== undefined) {
    update.endAt =
      patch.endAt instanceof Date && !Number.isNaN(patch.endAt.getTime())
        ? patch.endAt
        : null;
  }
  await updateDoc(doc(db, "event_popups", pid), update);
}

export async function deleteEventPopup({ id, storagePath }) {
  const pid = safeStr(id);
  if (!pid) throw new Error("id가 비어있습니다.");
  if (safeStr(storagePath)) {
    try {
      await deleteObject(ref(storage, safeStr(storagePath)));
    } catch (e) {
      console.warn("[deleteEventPopup] storage delete failed:", e?.message || e);
    }
  }
  await deleteDoc(doc(db, "event_popups", pid));
}

// 어드민용 — 모든 팝업
export async function listAllEventPopups() {
  const snap = await getDocs(query(collection(db, "event_popups")));
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

// 사용자 측 — 현재 노출 가능한 팝업 (active + 기간 내)
export async function listVisibleEventPopups() {
  const snap = await getDocs(
    query(collection(db, "event_popups"), where("active", "==", true))
  );
  const now = Date.now();
  const rows = [];
  snap.forEach((d) => {
    const r = rowFromSnap(d);
    const startOk = !r.startAt || r.startAt.getTime() <= now;
    const endOk = !r.endAt || r.endAt.getTime() >= now;
    if (startOk && endOk) rows.push(r);
  });
  rows.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return rows;
}
