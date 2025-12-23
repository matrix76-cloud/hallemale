/* eslint-disable */
// src/services/authService.js
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { ensureUserDoc, updateUserProfile } from "./userService";

/** 회원가입 (Email/Password) + users 문서 ensure */
export const signUpWithEmail = async ({
  email,
  password,
  nickname,
  consents, // { privacy, terms, marketing }
}) => {
  if (!email) throw new Error("email is required");
  if (!password) throw new Error("password is required");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred?.user?.uid;

  await ensureUserDoc({ uid, email });

  // 가입 화면에서 닉네임을 받는 구조라면 → 바로 저장 + onboardingDone true
  if (nickname) {
    await updateUserProfile({
      uid,
      nickname,
      onboardingDone: true,
      privacyConsent: !!consents?.privacy,
      termsConsent: !!consents?.terms,
      marketingConsent: !!consents?.marketing,
    });
  }

  return { uid, user: cred.user };
};

/**
 * ✅ 로그인 (Email/Password) + 로그인 유지(keepLogin) 지원
 * - keepLogin=true  → 브라우저를 껐다 켜도 유지(local)
 * - keepLogin=false → 탭/브라우저 닫으면 해제(session)
 */
export const signInWithEmail = async ({ email, password, keepLogin = false }) => {
  if (!email) throw new Error("email is required");
  if (!password) throw new Error("password is required");

  await setPersistence(
    auth,
    keepLogin ? browserLocalPersistence : browserSessionPersistence
  );

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred?.user?.uid;

  // 로그인 시에도 users 문서가 없으면 생성
  await ensureUserDoc({ uid, email: cred?.user?.email || email });

  return { uid, user: cred.user };
};

/** 비밀번호 재설정 메일 */
export const sendPasswordReset = async ({ email }) => {
  if (!email) throw new Error("email is required");
  await sendPasswordResetEmail(auth, email);
  return true;
};

/** 로그아웃 */
export const signOutUser = async () => {
  await signOut(auth);
  return true;
};

/**
 * Auth 상태 구독
 * - 로그인 시 users 문서 ensure까지 보장
 */
export const watchAuthState = (onChange) => {
  return onAuthStateChanged(auth, async (user) => {
    try {
      if (user?.uid) {
        await ensureUserDoc({ uid: user.uid, email: user.email || "" });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[authService] ensureUserDoc failed:", e?.message || e);
    }
    onChange(user || null);
  });
};
