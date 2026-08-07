/* eslint-disable */
// src/services/adminUserBlockService.js
// 관리자가 회원을 차단/해제하고 차단 목록을 조회하는 서비스
// Firestore: users/{uid} 문서에 blocked / blockedAt / blockedReason / blockedBy 필드 사용

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
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

/**
 * 이 회원으로 로그인할 수 있는 모든 uid.
 *
 * 전화번호로 통합된 계정은 소셜 로그인 시 Auth uid 가 users 문서 id 와 다르다
 * (userService.linkSocialToExistingUser 가 대표 문서에 linkedSocialUid 를 적고
 *  빈 소셜 문서는 지운다). 제재 표식은 "로그인 uid" 로 찍혀야 규칙이 잡아내므로
 * 둘 다 모아서 찍는다 — 대표 uid 만 찍으면 소셜 계정으로 로그인해 그대로 활동한다.
 */
async function loginUidsOf(profileUid) {
  const uids = [profileUid];
  try {
    const snap = await getDoc(doc(db, "users", profileUid));
    const linked = safeString(snap.data()?.linkedSocialUid);
    if (linked && linked !== profileUid) uids.push(linked);
  } catch (e) {
    console.warn("[adminUserBlock] linkedSocialUid 조회 실패:", e?.message || e);
  }
  return uids;
}

export async function blockUser({ uid, reason, byAdmin }) {
  const id = safeString(uid);
  const r = safeString(reason);
  if (!id) throw new Error("uid가 비어있습니다.");
  if (!r) throw new Error("차단 사유를 입력해주세요.");

  const by = safeString(byAdmin) || "admin";

  // 1) 실제 쓰기 차단 — 규칙(notBanned)이 보는 표식. 화면 표시보다 이게 먼저다.
  //    표식이 먼저 서야 "차단은 됐는데 아직 글이 써지는" 틈이 안 생긴다.
  const loginUids = await loginUidsOf(id);
  for (const u of loginUids) {
    await setDoc(doc(db, "banned", u), {
      uid: u,
      profileUid: id,
      reason: r,
      by,
      at: serverTimestamp(),
    });
  }

  // 2) 화면 표시용(BlockedAuthGate) — users 문서 플래그
  await updateDoc(doc(db, "users", id), {
    blocked: true,
    blockedAt: serverTimestamp(),
    blockedReason: r,
    blockedBy: by,
  });
  return { uid: id, reason: r, bannedUids: loginUids };
}

export async function unblockUser({ uid }) {
  const id = safeString(uid);
  if (!id) throw new Error("uid가 비어있습니다.");

  // 해제는 반대 순서 — 표식을 마지막에 지워야 중간에 실패해도 제재가 남는다
  // (실패했는데 풀려 있는 것보다 실패했는데 잠겨 있는 편이 안전하다).
  await updateDoc(doc(db, "users", id), {
    blocked: false,
    blockedAt: deleteField(),
    blockedReason: deleteField(),
    blockedBy: deleteField(),
  });

  for (const u of await loginUidsOf(id)) {
    await deleteDoc(doc(db, "banned", u)).catch(() => {});
  }
  return { uid: id };
}

export async function listBlockedUsers() {
  const q = query(collection(db, "users"), where("blocked", "==", true));
  const snap = hasMock("blockedUsers") ? mockQuerySnap(mockData("blockedUsers")) : await getDocs(q);

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
