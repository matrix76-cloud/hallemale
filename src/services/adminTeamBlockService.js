/* eslint-disable */
// src/services/adminTeamBlockService.js
// 관리자가 팀(clubs)을 차단/해제하고 차단 목록을 조회
// Firestore: clubs/{clubId} 문서에 blocked / blockedAt / blockedReason / blockedBy 필드 사용

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

export async function blockTeam({ clubId, reason, byAdmin }) {
  const id = safeString(clubId);
  const r = safeString(reason);
  if (!id) throw new Error("clubId가 비어있습니다.");
  if (!r) throw new Error("차단 사유를 입력해주세요.");

  const ref = doc(db, "clubs", id);
  await updateDoc(ref, {
    blocked: true,
    blockedAt: serverTimestamp(),
    blockedReason: r,
    blockedBy: safeString(byAdmin) || "admin",
  });
  return { clubId: id, reason: r };
}

export async function unblockTeam({ clubId }) {
  const id = safeString(clubId);
  if (!id) throw new Error("clubId가 비어있습니다.");

  const ref = doc(db, "clubs", id);
  await updateDoc(ref, {
    blocked: false,
    blockedAt: deleteField(),
    blockedReason: deleteField(),
    blockedBy: deleteField(),
  });
  return { clubId: id };
}

export async function listBlockedTeams() {
  const q = query(collection(db, "clubs"), where("blocked", "==", true));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      clubId: d.id,
      name: safeString(data.name) || "(이름없음)",
      logoUrl: safeString(data.logoUrl),
      region:
        [safeString(data.regionSido), safeString(data.regionGu)]
          .filter(Boolean)
          .join(" ") || safeString(data.region),
      blockedAt: toDate(data.blockedAt),
      blockedReason: safeString(data.blockedReason),
      blockedBy: safeString(data.blockedBy),
    });
  });

  rows.sort((a, b) => {
    const ta = a.blockedAt ? a.blockedAt.getTime() : 0;
    const tb = b.blockedAt ? b.blockedAt.getTime() : 0;
    return tb - ta;
  });

  return rows;
}
