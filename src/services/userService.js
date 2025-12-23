/* eslint-disable */
// src/services/userService.js
import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * users/{uid} 최소 스키마 보장
 * ✅ 신규: activeTeamId는 "" (무소속 SSOT)
 */
export const ensureUserDoc = async ({ uid, email }) => {
  if (!uid) throw new Error("ensureUserDoc: uid is required");

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
        intro: "",
        careers: [],

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

  if (typeof nickname === "string") payload.nickname = nickname;
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
