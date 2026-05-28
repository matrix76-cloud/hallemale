/* eslint-disable */
// src/services/adminUserBlockService.js
// 관리자가 회원을 차단/해제하고 차단 목록을 조회하는 서비스
// Firestore: users/{uid} 문서에 blocked / blockedAt / blockedReason / blockedBy 필드 사용

import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  deleteField,
} from "firebase/firestore";

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeString(v) {
  return String(v || "").trim();
}

export async function blockUser({ uid, reason, byAdmin }) {
  const id = safeString(uid);
  const r = safeString(reason);
  if (!id) throw new Error("uid가 비어있습니다.");
  if (!r) throw new Error("차단 사유를 입력해주세요.");

  const ref = doc(db, "users", id);
  await updateDoc(ref, {
    blocked: true,
    blockedAt: serverTimestamp(),
    blockedReason: r,
    blockedBy: safeString(byAdmin) || "admin",
  });
  return { uid: id, reason: r };
}

export async function unblockUser({ uid }) {
  const id = safeString(uid);
  if (!id) throw new Error("uid가 비어있습니다.");

  const ref = doc(db, "users", id);
  await updateDoc(ref, {
    blocked: false,
    blockedAt: deleteField(),
    blockedReason: deleteField(),
    blockedBy: deleteField(),
  });
  return { uid: id };
}

export async function listBlockedUsers() {
  const q = query(collection(db, "users"), where("blocked", "==", true));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      uid: d.id,
      nickname: safeString(data.nickname) || safeString(data.name) || "(이름없음)",
      avatarUrl: safeString(data.avatarUrl || data.photoUrl),
      region:
        [safeString(data.regionSido), safeString(data.regionGu)]
          .filter(Boolean)
          .join(" ") || "",
      phone: safeString(data.phoneE164 || data.phone),
      blockedAt: toDate(data.blockedAt),
      blockedReason: safeString(data.blockedReason),
      blockedBy: safeString(data.blockedBy),
    });
  });

  // 최신 차단 순
  rows.sort((a, b) => {
    const ta = a.blockedAt ? a.blockedAt.getTime() : 0;
    const tb = b.blockedAt ? b.blockedAt.getTime() : 0;
    return tb - ta;
  });

  return rows;
}
