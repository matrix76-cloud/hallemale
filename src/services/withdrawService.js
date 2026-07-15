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
import { deleteUser, signOut } from "firebase/auth";
import {
  reassignOrDisbandOwnedClubsOnWithdraw,
  removeMembershipsOnWithdraw,
} from "./clubLeaderService";
import { clearNotificationsForUser } from "./notificationService";

const DELETE_ACCOUNT_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/deleteAccount";

/**
 * Auth 계정 삭제 — 서버(Admin SDK) 우선, 실패 시 클라이언트 폴백.
 * 서버 경로는 requires-recent-login 제약이 없어 안정적이다.
 * (함수 미배포 등으로 실패하면 기존 클라이언트 deleteUser 로 폴백 → 회귀 없음)
 */
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
      // 서버가 계정을 지웠으므로 클라이언트 세션만 정리
      await signOut(auth).catch(() => {});
      return;
    }
    console.warn("[withdraw] server deleteAccount failed, fallback:", r.status);
  } catch (e) {
    console.warn("[withdraw] server deleteAccount error, fallback:", e?.message || e);
  }
  // 폴백: 클라이언트 삭제 (requires-recent-login 가능)
  await deleteUser(user);
}

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

  // 0) 서버(Admin) 경로 우선 — 서버가 Firestore 전량 정리 + Auth 삭제까지 한 번에 처리한다.
  //    성공하면 클라이언트 정리가 불필요하고, "데이터만 지워지고 계정은 남는" 불일치 위험이 없다.
  //    (requires-recent-login 제약도 서버엔 없음. 서버 미배포/오류일 때만 아래 클라 best-effort 폴백)
  try {
    const idToken = await user.getIdToken();
    const r = await fetch(DELETE_ACCOUNT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    });
    if (r.ok) {
      await signOut(auth).catch(() => {});
      return;
    }
    console.warn("[withdraw] server path failed, client fallback:", r.status);
  } catch (e) {
    console.warn("[withdraw] server path error, client fallback:", e?.message || e);
  }

  // 1) Firestore users 문서 정보 가져오기 (phoneE164·소속 팀 등 정리에 사용)
  let phoneE164 = "";
  let userDocId = uid;
  const teamIds = []; // 소속 팀(멤버십 정리 대상)
  try {
    const myDocRef = doc(db, "users", uid);
    const mySnap = await getDoc(myDocRef);
    let d = null;
    if (mySnap.exists()) {
      d = mySnap.data() || {};
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
        d = ex.data() || {};
      }
    }
    if (d) {
      phoneE164 = String(d.phoneE164 || "").trim();
      const t1 = String(d.activeTeamId || "").trim();
      const t2 = String(d.clubId || "").trim();
      if (t1) teamIds.push(t1);
      if (t2 && t2 !== t1) teamIds.push(t2);
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

  // 2-1) 내가 팀원으로 소속된 팀에서 멤버십 제거 (팀장이 아닌 팀)
  //      - members 서브컬렉션 doc + clubs.members 배열 정리
  //      - 카카오 uid 고정이라 정리 안 하면 재가입 시 예전 팀에 데이터가 남음
  try {
    const r2 = await removeMembershipsOnWithdraw({ uid: userDocId, clubIds: teamIds });
    console.log("[withdraw] memberships removed:", r2);
  } catch (e) {
    console.warn("[withdraw] remove memberships failed:", e?.message || e);
  }

  // 2-2) 내게 온 알림 정리 — 모든 알림 targetIds 에서 내 uid 제거
  //      (카카오 uid 고정이라, 정리 안 하면 재가입 시 예전 알림이 그대로 뜬다)
  try {
    await clearNotificationsForUser({ uid: userDocId });
    if (uid !== userDocId) await clearNotificationsForUser({ uid });
  } catch (e) {
    console.warn("[withdraw] clear notifications failed:", e?.message || e);
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

  // 7) 마지막으로 Firebase Auth 계정 삭제 (서버 우선 / 클라이언트 폴백)
  await deleteAuthAccount(user);
}
