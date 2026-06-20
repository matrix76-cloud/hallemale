/* eslint-disable */
// src/services/withdrawService.js
// 회원탈퇴 — Apple App Store Guideline 5.1.1(v) 대응
// - Firestore users 문서 삭제
// - user_blocks 차단 데이터 삭제
// - phones 매핑에서 uid 제거 (best-effort)
// - Firebase Auth 계정 삭제 (마지막)

import { auth, db } from "./firebase";
import {
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { reassignOrDisbandOwnedClubsOnWithdraw } from "./clubLeaderService";

async function safeDelete(ref, label) {
  try {
    await deleteDoc(ref);
  } catch (e) {
    console.warn(`[withdraw] delete ${label} failed:`, e?.message || e);
  }
}

async function cleanupPhones({ phoneE164, uid }) {
  const phone = String(phoneE164 || "").trim();
  if (!phone) return;
  try {
    const ref = doc(db, "phones", phone);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const primary = String(data.primaryUid || "");
    const linked = Array.isArray(data.linkedUids) ? data.linkedUids.map(String) : [];
    const isPrimary = primary === String(uid);
    const nextLinked = linked.filter((u) => u !== String(uid));
    if (isPrimary && nextLinked.length === 0) {
      await safeDelete(ref, `phones/${phone}`);
    } else {
      await updateDoc(ref, {
        primaryUid: isPrimary ? (nextLinked[0] || "") : primary,
        linkedUids: nextLinked,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("[withdraw] cleanupPhones failed:", e?.message || e);
  }
}

async function cleanupFcmTokens(uid) {
  try {
    const col = collection(db, "fcmTokens");
    const q = query(col, where("uid", "==", String(uid)));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => safeDelete(d.ref, `fcmTokens/${d.id}`)));
  } catch (e) {
    console.warn("[withdraw] cleanupFcmTokens failed:", e?.message || e);
  }
}

/**
 * 회원탈퇴 — 호출 전 비밀번호 재확인 등 UI 단계에서 확인 받을 것
 *
 * 예외:
 *  - "requires-recent-login": Firebase Auth가 최근 로그인을 요구할 때 (재로그인 후 다시 시도 안내)
 */
export async function withdrawAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인 상태가 아닙니다.");
  const uid = String(user.uid);

  // 1) Firestore users 문서 정보 가져오기 (phoneE164 등 정리에 사용)
  let phoneE164 = "";
  let userDocId = uid;
  try {
    const myDocRef = doc(db, "users", uid);
    const mySnap = await getDoc(myDocRef);
    if (mySnap.exists()) {
      const d = mySnap.data() || {};
      phoneE164 = String(d.phoneE164 || "").trim();
    } else {
      // 소셜 연결된 경우 linkedSocialUid로 한 번 더 조회
      const linkedQ = query(
        collection(db, "users"),
        where("linkedSocialUid", "==", uid)
      );
      const linkedSnap = await getDocs(linkedQ);
      if (!linkedSnap.empty) {
        const ex = linkedSnap.docs[0];
        userDocId = ex.id;
        const d = ex.data() || {};
        phoneE164 = String(d.phoneE164 || "").trim();
      }
    }
  } catch (e) {
    console.warn("[withdraw] read user doc failed:", e?.message || e);
  }

  // 2) 내가 팀장인 팀 자동 처리 (다른 멤버에게 위임 / 혼자면 해체)
  //    - users 문서 삭제 전에 실행해야 권한이 유효함
  //    - best-effort: 내부에서 에러 흡수하여 탈퇴를 막지 않음
  try {
    const r = await reassignOrDisbandOwnedClubsOnWithdraw({ uid: userDocId });
    console.log("[withdraw] clubs handled:", r);
  } catch (e) {
    console.warn("[withdraw] reassign clubs failed:", e?.message || e);
  }

  // 3) 차단/숨김 데이터 삭제
  await safeDelete(doc(db, "user_blocks", uid), "user_blocks");

  // 4) FCM 토큰 삭제
  await cleanupFcmTokens(uid);
  if (userDocId !== uid) await cleanupFcmTokens(userDocId);

  // 5) phones 매핑 정리
  if (phoneE164) await cleanupPhones({ phoneE164, uid: userDocId });

  // 6) users 문서 삭제
  await safeDelete(doc(db, "users", userDocId), `users/${userDocId}`);
  if (userDocId !== uid) await safeDelete(doc(db, "users", uid), `users/${uid}`);

  // 7) 마지막으로 Firebase Auth 계정 삭제 — requires-recent-login 가능
  await deleteUser(user);
}
