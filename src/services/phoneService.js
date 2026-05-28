/* eslint-disable */
// src/services/phoneService.js
import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { upsertUserPhoneIndex } from "./userService";

/**
 * phones/{phoneE164} 컬렉션 — 전화번호 기반 계정 연동 (Phone-as-SSOT)
 *
 * 스키마:
 * {
 *   phoneE164: "+821012345678",
 *   primaryUid: "abc123",
 *   linkedUids: ["abc123", "kakao:456"],
 *   createdAt, updatedAt
 * }
 */

/**
 * 전화번호를 UID에 연결
 * - phones/{phoneE164} 생성/업데이트 (transaction)
 * - users/{uid} 에 phoneE164, phoneVerified, provider 필드 세팅
 * - users_by_phone/{phoneE164} 호환 업서트
 */
export async function linkPhoneToUid({ uid, phoneE164, provider = "", email = "" }) {
  if (!uid) throw new Error("linkPhoneToUid: uid is required");
  if (!phoneE164) throw new Error("linkPhoneToUid: phoneE164 is required");

  const phoneRef = doc(db, "phones", phoneE164);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (tx) => {
    const phoneSnap = await tx.get(phoneRef);

    // 이미 이 uid가 linkedUids에 있으면 중복 연결 스킵 (users 업데이트만)
    if (phoneSnap.exists()) {
      const d = phoneSnap.data() || {};
      const linked = Array.isArray(d.linkedUids) ? d.linkedUids : [];
      if (linked.includes(uid)) {
        tx.update(userRef, {
          phoneE164,
          phoneVerified: true,
          updatedAt: serverTimestamp(),
          ...(provider ? { provider } : {}),
        });
        return;
      }
    }

    if (!phoneSnap.exists()) {
      // 신규 생성: 이 uid가 primaryUid
      tx.set(phoneRef, {
        phoneE164,
        primaryUid: uid,
        linkedUids: [uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // 기존 문서: linkedUids에 uid 추가 (중복 방지는 arrayUnion)
      tx.update(phoneRef, {
        linkedUids: arrayUnion(uid),
        updatedAt: serverTimestamp(),
      });
    }

    // users/{uid} 에 phone 정보 세팅
    const payload = {
      phoneE164,
      phoneVerified: true,
      updatedAt: serverTimestamp(),
    };
    if (provider) payload.provider = provider;

    tx.update(userRef, payload);
  });

  // users_by_phone 호환 업서트 (트랜잭션 밖 — 실패해도 핵심 로직은 완료)
  try {
    await upsertUserPhoneIndex({ phoneE164, uid, email, phoneVerified: true });
  } catch (e) {
    console.warn("[phoneService] upsertUserPhoneIndex failed (non-critical):", e?.message);
  }

  return { ok: true };
}

/**
 * 전화번호로 primaryUid 조회
 */
export async function getPrimaryUidByPhone(phoneE164) {
  if (!phoneE164) return null;

  const ref = doc(db, "phones", phoneE164);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return snap.data()?.primaryUid || null;
}
