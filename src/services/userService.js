/* eslint-disable */
// src/services/userService.js
import { db } from "./firebase";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getNameChangeStatus } from "../utils/nameChange";
import { clearNotificationsForUser } from "./notificationService";

/**
 * 닉네임 중복 여부 확인
 * - 공백 정규화 후 동일한 닉네임을 가진 다른 사용자가 있으면 true
 * - exceptUid: 본인은 제외
 */
export async function isNicknameTaken(nickname, exceptUid = "") {
  const target = String(nickname || "").trim().replace(/\s+/g, " ");
  if (!target) return false;

  const qy = query(collection(db, "users"), where("nickname", "==", target), limit(2));
  const snap = await getDocs(qy);
  return snap.docs.some((d) => d.id !== String(exceptUid || "").trim());
}

/**
 * users/{uid} 최소 스키마 보장
 * ✅ 신규: activeTeamId는 "" (무소속 SSOT)
 */
export const ensureUserDoc = async ({ uid, email, provider = "", phoneE164 = "", phoneVerified = false }) => {
  if (!uid) throw new Error("ensureUserDoc: uid is required");

  // ✅ 소셜 UID가 이미 기존 사용자에게 연결되어 있으면 빈 문서 생성 스킵
  try {
    const linkedQ = query(
      collection(db, "users"),
      where("linkedSocialUid", "==", uid),
      limit(1)
    );
    const linkedSnap = await getDocs(linkedQ);
    if (!linkedSnap.empty) {
      const existing = linkedSnap.docs[0];
      await updateDoc(existing.ref, { updatedAt: serverTimestamp() });
      return { uid: existing.id, created: false, linked: true };
    }
  } catch (e) {
    console.warn("[userService] linkedSocialUid lookup failed (non-critical):", e?.message);
  }

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        uid,
        email: email || "",
        nickname: "",
        avatarUrl: null,

        onboardingDone: false,

        // ✅ 지역(2단계 + 합본)
        regionSido: null,
        regionGu: null,
        region: null,

        // ✅ 팀/클럽 연결
        // - clubId: 레거시/호환용(없으면 null)
        // - activeTeamId: SSOT (무소속은 "")
        clubId: null,
        activeTeamId: "",

        // 프로필(선택)
        mainPosition: null,
        skillLevel: null,
        heightCm: null,
        weightKg: null,
        birthYear: null,
        intro: "",
        careers: [],

        // ✅ 전화번호 / 로그인 provider
        phoneE164: phoneE164 || "",
        phoneVerified: !!phoneVerified,
        provider: provider || "",

        // 약관/마케팅 (옵션)
        marketingConsent: null,
        termsConsent: null,
        privacyConsent: null,

        // 팀 역할 표시용(샘플 데이터)
        roleInTeam: null,
        isTeamCaptain: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ 신규 계정(재가입 포함) — 예전 알림 잔존 정리.
    //    카카오 uid가 고정이라, 탈퇴 시 best-effort 정리가 실패했으면
    //    같은 uid로 재가입 시 예전 알림(targetIds에 uid 잔존)이 다시 뜬다.
    //    문서가 없다가 새로 만들어진 이 순간에 한 번 더 비워 깨끗한 상태를 보장한다.
    try {
      await clearNotificationsForUser({ uid });
    } catch (e) {
      console.warn("[userService] clear stale notifications failed (non-critical):", e?.message);
    }

    return { uid, created: true };
  }

  await updateDoc(ref, { updatedAt: serverTimestamp() });
  return { uid, created: false };
};

export const getUserDoc = async (uid) => {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: uid, ...snap.data() };
};

/**
 * ✅ 약관·개인정보·연령(만 14세 이상) 동의 저장
 * 최초 로그인 후 1회 동의 게이트에서 호출. 마케팅 수신은 선택.
 */
export const saveUserConsents = async ({
  uid,
  terms,
  privacy,
  ageOver14,
  marketing = false,
}) => {
  if (!uid) throw new Error("saveUserConsents: uid is required");
  if (!terms || !privacy || !ageOver14) {
    throw new Error("필수 항목(이용약관·개인정보처리방침·만 14세 이상)에 모두 동의해야 합니다.");
  }
  const ref = doc(db, "users", uid);
  // setDoc(merge): 문서가 없는 엣지(소셜-기존계정 연동 등)에서도 실패하지 않도록 보강
  await setDoc(
    ref,
    {
      termsConsent: true,
      privacyConsent: true,
      ageOver14Consent: true,
      marketingConsent: !!marketing,
      consentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { uid };
};

/**
 * ✅ 구장 관리자(구장주) 동의 저장
 * 구장주는 회원(선수)과 별도 약관(구장 관리자 이용약관)에 동의한다.
 * ownerAuth uid는 사용자 앱 uid와 네임스페이스가 분리되므로 같은 users 컬렉션에 저장해도 충돌하지 않는다.
 */
export const saveOwnerConsents = async ({
  uid,
  ownerTerms,
  privacy,
  adult,
  marketing = false,
}) => {
  if (!uid) throw new Error("saveOwnerConsents: uid is required");
  if (!ownerTerms || !privacy || !adult) {
    throw new Error("필수 항목(구장 관리자 이용약관·개인정보처리방침·만 19세 이상)에 모두 동의해야 합니다.");
  }
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      ownerTermsConsent: true,
      ownerPrivacyConsent: true,
      ownerAdultConsent: true,
      ownerMarketingConsent: !!marketing,
      ownerConsentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { uid };
};

/**
 * ✅ 구장주 계정 담당자 정보 저장 (가입 시점)
 * - 사업자 정보(상호·사업자번호·대표자명)는 온보딩에서 따로 받는다.
 *   여기 담당자는 "이 계정을 실제로 쓰는 사람"으로, 대표자와 다를 수 있다.
 */
export const saveOwnerManagerInfo = async ({ uid, name, phone }) => {
  if (!uid) throw new Error("saveOwnerManagerInfo: uid is required");
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      ownerManagerName: String(name || "").trim(),
      ownerManagerPhone: String(phone || "").replace(/[^0-9]/g, ""),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { uid };
};

/**
 * ✅ 회원가입 완료 화면 노출 완료 표시 — 이후 재노출 방지
 */
export const markWelcomeSeen = async ({ uid }) => {
  if (!uid) throw new Error("markWelcomeSeen: uid is required");
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      welcomeSeen: true,
      welcomeSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { uid };
};

/**
 * ✅ 리퍼럴 귀속 — 초대 링크로 들어온 신규 유저에게 초대자(referrerUid)를 기록.
 *    본인 초대(자기 참조)나 빈 값은 무시. 신규 가입 완료 시점(1회)에만 호출된다.
 */
export const attachReferrer = async ({ uid, referrerUid } = {}) => {
  const rid = String(referrerUid || "").trim();
  if (!uid || !rid || rid === uid) return false;
  await setDoc(
    doc(db, "users", uid),
    { referredBy: rid, referredAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );
  return true;
};

/**
 * ✅ 프로필 업데이트 (MyProfileEditPage에서 쓰는 필드 전부 지원)
 */
export const updateUserProfile = async ({
  uid,

  nickname,
  avatarUrl,

  onboardingDone,

  // ✅ 지역
  regionSido,
  regionGu,
  region,

  mainPosition,
  skillLevel,
  heightCm,
  weightKg,
  birthYear,

  intro,
  careers,

  // ✅ 경기 소개 · 사진/동영상
  media,

  // 약관/마케팅 (옵션)
  marketingConsent,
  termsConsent,
  privacyConsent,

  // 팀/클럽 (옵션)
  clubId,
  activeTeamId,

  // 팀 역할 표시용(샘플 데이터)
  roleInTeam,
  isTeamCaptain,
}) => {
  if (!uid) throw new Error("updateUserProfile: uid is required");

  const ref = doc(db, "users", uid);

  const payload = {
    updatedAt: serverTimestamp(),
  };

  if (typeof nickname === "string") {
    const nextNick = nickname.trim().replace(/\s+/g, " ");

    // 현재 닉네임과 비교 — 변경될 때만 중복/쿨다운 검사
    const curSnap = await getDoc(ref);
    const cur = curSnap.exists() ? curSnap.data() || {} : {};
    const curNick = String(cur.nickname || "").trim().replace(/\s+/g, " ");

    if (nextNick && nextNick !== curNick) {
      // ✅ 쿨다운 가드: 한번 정하면 90일 후 변경 가능
      const { locked, remainingDays } = getNameChangeStatus(cur.nicknameUpdatedAt);
      if (locked) {
        throw new Error(`닉네임은 ${remainingDays}일 후에 변경할 수 있어요.`);
      }

      // ✅ 중복 가드
      if (await isNicknameTaken(nextNick, uid)) {
        throw new Error("이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.");
      }

      payload.nickname = nextNick;
      payload.nicknameUpdatedAt = serverTimestamp();
    } else {
      payload.nickname = nextNick;
    }
  }
  if (typeof avatarUrl === "string" || avatarUrl === null) payload.avatarUrl = avatarUrl;

  if (typeof onboardingDone === "boolean") payload.onboardingDone = onboardingDone;

  // ✅ 지역 저장
  if (typeof regionSido === "string" || regionSido === null) payload.regionSido = regionSido;
  if (typeof regionGu === "string" || regionGu === null) payload.regionGu = regionGu;
  if (typeof region === "string" || region === null) payload.region = region;

  if (typeof mainPosition === "string" || mainPosition === null) payload.mainPosition = mainPosition;
  if (typeof skillLevel === "string" || skillLevel === null) payload.skillLevel = skillLevel;

  if (typeof heightCm === "number" || heightCm === null) payload.heightCm = heightCm;
  if (typeof weightKg === "number" || weightKg === null) payload.weightKg = weightKg;
  if (typeof birthYear === "number" || birthYear === null) payload.birthYear = birthYear;

  if (typeof intro === "string") payload.intro = intro;
  if (Array.isArray(careers)) payload.careers = careers;

  // ✅ 미디어 저장
  if (Array.isArray(media)) payload.media = media;

  if (typeof marketingConsent === "boolean") payload.marketingConsent = marketingConsent;
  if (typeof termsConsent === "boolean") payload.termsConsent = termsConsent;
  if (typeof privacyConsent === "boolean") payload.privacyConsent = privacyConsent;

  if (typeof clubId === "string" || clubId === null) payload.clubId = clubId;
  if (typeof activeTeamId === "string" || activeTeamId === null) payload.activeTeamId = activeTeamId;

  if (typeof roleInTeam === "string") payload.roleInTeam = roleInTeam;
  if (typeof isTeamCaptain === "boolean") payload.isTeamCaptain = isTeamCaptain;

  await updateDoc(ref, payload);
};




function safeTrim(v) {
  return String(v ?? "").trim();
}

/**
 * ✅ phoneE164 → uid/email 인덱스 저장(아이디 찾기용)
 * 문서 경로: users_by_phone/{phoneE164}
 */
/**
 * ✅ uid로 사용자 프로필 조회 (3단계)
 *   1) users/{uid} 직접 조회 (authUid === docId인 일반 케이스)
 *   2) linkedSocialUid === uid 로 쿼리 (소셜 UID가 기존 사용자에 연결된 케이스)
 *   3) 위 둘 다 실패 시 null
 */
export async function getUserProfileByUid(uid) {
  const u = safeTrim(uid);
  if (!u) return null;

  // 1) authUid 직접
  const directSnap = await getDoc(doc(db, "users", u));
  if (directSnap.exists()) {
    return { id: directSnap.id, ...directSnap.data() };
  }

  // 2) linkedSocialUid
  try {
    const q = query(
      collection(db, "users"),
      where("linkedSocialUid", "==", u),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (e) {
    console.warn("[userService] getUserProfileByUid linkedSocialUid lookup failed:", e?.message);
  }

  return null;
}

/**
 * ✅ 소셜 UID를 기존 사용자 문서에 연결 + 빈 소셜 문서 삭제
 * - existingUid: phones/users_by_phone 에서 찾은 기존 사용자 docId
 * - socialUid: Firebase Auth 현재 UID (소셜 로그인 결과)
 */
export async function linkSocialToExistingUser({ existingUid, socialUid, provider = "" }) {
  const eu = safeTrim(existingUid);
  const su = safeTrim(socialUid);
  if (!eu || !su) throw new Error("linkSocialToExistingUser: existingUid & socialUid required");
  if (eu === su) return { ok: true, noop: true };

  // 기존 사용자 문서에 linkedSocialUid 기록
  const existingRef = doc(db, "users", eu);
  const payload = {
    linkedSocialUid: su,
    updatedAt: serverTimestamp(),
  };
  if (provider) payload.provider = provider;
  await updateDoc(existingRef, payload);

  // 빈 소셜 문서(이름/역할 없는 임시 문서) 삭제
  try {
    const socialRef = doc(db, "users", su);
    const socialSnap = await getDoc(socialRef);
    if (socialSnap.exists()) {
      const d = socialSnap.data() || {};
      const isEmpty = !safeTrim(d.nickname) && !d.onboardingDone;
      if (isEmpty) {
        await deleteDoc(socialRef);
      }
    }
  } catch (e) {
    console.warn("[userService] delete empty social doc failed (non-critical):", e?.message);
  }

  return { ok: true };
}

export async function upsertUserPhoneIndex({ phoneE164, uid, email, phoneVerified = false }) {
  const p = safeTrim(phoneE164);
  const u = safeTrim(uid);
  const e = safeTrim(email);

  if (!p) return false;
  if (!u && !e) return false;

  const ref = doc(db, "users_by_phone", p);

  await setDoc(
    ref,
    {
      phoneE164: p,
      uid: u,
      email: e,
      phoneVerified: !!phoneVerified,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}
