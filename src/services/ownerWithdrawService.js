/* eslint-disable */
// src/services/ownerWithdrawService.js
// 구장주 자격 해지("회원탈퇴") — 오너 데이터만 제거.
//
// ⚠️ 오너 로그인 uid는 사용자 앱과 같은 Firebase 프로젝트를 공유한다.
//    그래서 여기서는 Firebase Auth 계정을 삭제하지 않는다.
//    (계정을 지우면 같은 소셜 계정으로 쓰던 '선수' 데이터까지 사라짐)
//    삭제 대상:
//      - 내 구장(venues, ownerUid==uid)
//      - 그 구장의 예약(venueReservations) / 막아둔 시간(venueBlocks)
//      - users/{uid}.role="owner" 플래그 해제 (문서 자체는 유지)
//    마지막으로 ownerAuth 세션만 로그아웃.

import { db, ownerAuth } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ownerSignOut } from "./ownerAuthService";

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

// 특정 필드값으로 컬렉션 문서 조회 후 전량 삭제 (단일 where)
async function deleteByField(col, field, value) {
  const v = s(value);
  if (!v) return 0;
  try {
    const snap = await getDocs(query(collection(db, col), where(field, "==", v)));
    await Promise.all(snap.docs.map((d) => safeDelete(d.ref, `${col}/${d.id}`)));
    return snap.size;
  } catch (e) {
    console.warn(`[ownerWithdraw] query ${col}.${field} failed:`, e?.message || e);
    return 0;
  }
}

/**
 * 구장주 자격 해지 — 오너 데이터 제거 + 로그아웃 (계정은 유지).
 * best-effort: 각 단계 독립 처리, 일부 실패해도 해지를 막지 않는다.
 */
export async function resignOwner() {
  const user = ownerAuth.currentUser;
  if (!user) throw new Error("로그인 상태가 아닙니다.");
  const uid = s(user.uid);

  // 1) 내 구장 목록 (ownerUid == uid)
  let venueIds = [];
  try {
    const snap = await getDocs(
      query(collection(db, "venues"), where("ownerUid", "==", uid))
    );
    venueIds = snap.docs.map((d) => d.id);
  } catch (e) {
    console.warn("[ownerWithdraw] list venues failed:", e?.message || e);
  }

  // 2) 각 구장의 예약 / 막아둔 시간 삭제
  for (const vid of venueIds) {
    await deleteByField("venueReservations", "venueId", vid);
    await deleteByField("venueBlocks", "venueId", vid);
  }
  // 2-1) ownerUid로 걸린 잔여 예약(레거시 venueId 누락 등) 정리
  await deleteByField("venueReservations", "ownerUid", uid);

  // 3) 구장 문서 삭제
  for (const vid of venueIds) {
    await safeDelete(doc(db, "venues", vid), `venues/${vid}`);
  }

  // 4) users 문서의 구장주 플래그 해제 (문서 자체는 유지 — 선수 계정 공유)
  try {
    await updateDoc(doc(db, "users", uid), {
      role: "user",
      isVenueOwner: false,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[ownerWithdraw] clear owner role failed:", e?.message || e);
  }

  // 5) ownerAuth 세션 로그아웃 (계정 삭제 아님)
  try {
    await ownerSignOut();
  } catch (e) {
    console.warn("[ownerWithdraw] signOut failed:", e?.message || e);
  }
}
