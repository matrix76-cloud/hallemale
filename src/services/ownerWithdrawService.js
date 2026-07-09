/* eslint-disable */
// src/services/ownerWithdrawService.js
// 구장주 회원탈퇴 — 계정 영구 삭제 (Apple 5.1.1(v) / Google Play 대응).
//
// 구장주 계정은 이메일/비밀번호 로그인이라 uid가 사용자 앱(소셜)과 분리된다.
// 따라서 계정을 통삭제해도 같은 사람의 '선수' 데이터에는 영향이 없다.
//
// 순서:
//   1) 오너 데이터 삭제(구장·예약·차단) — 계정 삭제 전, 아직 인증이 살아있을 때
//   2) 서버(deleteAccount, Admin SDK)로 users 문서 + Auth 계정 삭제 (requires-recent-login 없음)
//      실패 시 클라이언트 deleteUser 폴백

import { db, ownerAuth } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { deleteUser, signOut } from "firebase/auth";

const DELETE_ACCOUNT_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/deleteAccount";

function s(v) {
  return String(v ?? "").trim();
}

async function safeDelete(ref, label) {
  try {
    await deleteDoc(ref);
  } catch (e) {
    console.warn(`[ownerWithdraw] delete ${label} failed:`, e?.message || e);
  }
}

// 단일 where 조회 후 전량 삭제
async function deleteByField(col, field, value) {
  const v = s(value);
  if (!v) return;
  try {
    const snap = await getDocs(query(collection(db, col), where(field, "==", v)));
    await Promise.all(snap.docs.map((d) => safeDelete(d.ref, `${col}/${d.id}`)));
  } catch (e) {
    console.warn(`[ownerWithdraw] query ${col}.${field} failed:`, e?.message || e);
  }
}

/** 내 구장·예약·차단 데이터 삭제 (계정 삭제 전 실행) */
async function purgeOwnerData(uid) {
  let venueIds = [];
  try {
    const snap = await getDocs(
      query(collection(db, "venues"), where("ownerUid", "==", uid))
    );
    venueIds = snap.docs.map((d) => d.id);
  } catch (e) {
    console.warn("[ownerWithdraw] list venues failed:", e?.message || e);
  }
  for (const vid of venueIds) {
    await deleteByField("venueReservations", "venueId", vid);
    await deleteByField("venueBlocks", "venueId", vid);
  }
  // ownerUid로 걸린 잔여 예약(venueId 누락 등) 정리
  await deleteByField("venueReservations", "ownerUid", uid);
  for (const vid of venueIds) {
    await safeDelete(doc(db, "venues", vid), `venues/${vid}`);
  }
}

/** Auth 계정 삭제 — 서버(Admin SDK) 우선, 실패 시 클라이언트 폴백 */
async function deleteAuthAccount(user) {
  try {
    const idToken = await user.getIdToken();
    const r = await fetch(DELETE_ACCOUNT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (r.ok) {
      await signOut(ownerAuth).catch(() => {});
      return;
    }
    console.warn("[ownerWithdraw] server deleteAccount failed, fallback:", r.status);
  } catch (e) {
    console.warn("[ownerWithdraw] server deleteAccount error, fallback:", e?.message || e);
  }
  // 폴백: 클라이언트 삭제 (requires-recent-login 가능 → 상위에서 안내)
  await deleteUser(user);
}

/**
 * 구장주 회원탈퇴 — 오너 데이터 삭제 + 계정 영구 삭제.
 *
 * 예외:
 *  - "auth/requires-recent-login": 서버 삭제 실패 + 클라 폴백도 최근 로그인 요구 시
 */
export async function withdrawOwnerAccount() {
  const user = ownerAuth.currentUser;
  if (!user) throw new Error("로그인 상태가 아닙니다.");
  const uid = s(user.uid);

  // 1) 오너 데이터 삭제 (계정 살아있을 때)
  await purgeOwnerData(uid);

  // 2) Auth 계정 + users 문서 삭제 (서버 우선 / 클라 폴백)
  await deleteAuthAccount(user);
}
