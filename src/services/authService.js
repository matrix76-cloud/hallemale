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
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import {
  ensureUserDoc,
  updateUserProfile,
  upsertUserPhoneIndex,
} from "./userService";
import { linkPhoneToUid } from "./phoneService";
import {
  isInWebView,
  postToApp,
  onceFromApp,
} from "../bridge/webviewBridge";
import { signInWithCustomToken } from "firebase/auth";

function safeTrim(v) {
  return String(v ?? "").trim();
}

/** 회원가입 (Email/Password) + users 문서 ensure + phoneE164 저장 */
export const signUpWithEmail = async ({
  email,
  password,
  nickname,
  consents, // { privacy, terms, marketing }
  phoneE164 = "",
  phoneVerified = false,
}) => {
  const safeEmail = safeTrim(email);
  if (!safeEmail) throw new Error("email is required");
  if (!password) throw new Error("password is required");

  const cred = await createUserWithEmailAndPassword(auth, safeEmail, password);
  const uid = cred?.user?.uid;

  await ensureUserDoc({
    uid,
    email: safeEmail,
    phoneE164: safeTrim(phoneE164),
    phoneVerified: !!phoneVerified,
    provider: "email",
  });

  // 가입 화면에서 닉네임을 받는 구조라면 → 바로 저장 + onboardingDone true
  if (nickname) {
    await updateUserProfile({
      uid,
      nickname,
      onboardingDone: true,
      privacyConsent: !!consents?.privacy,
      termsConsent: !!consents?.terms,
      marketingConsent: !!consents?.marketing,
      phoneE164: safeTrim(phoneE164),
      phoneVerified: !!phoneVerified,
    });
  }

  // ✅ phoneE164 → uid/email 인덱스 저장(아이디찾기용)
  if (safeTrim(phoneE164)) {
    await upsertUserPhoneIndex({
      phoneE164: safeTrim(phoneE164),
      uid,
      email: safeEmail,
      phoneVerified: !!phoneVerified,
    });

    // ✅ phones 컬렉션에도 저장 (계정 연동용)
    try {
      await linkPhoneToUid({
        uid,
        phoneE164: safeTrim(phoneE164),
        provider: "email",
        email: safeEmail,
      });
    } catch (e) {
      console.warn("[authService] linkPhoneToUid failed (non-critical):", e?.message);
    }
  }

  return { uid, user: cred.user };
};

/**
 * ✅ 로그인 (Email/Password) + 로그인 유지(keepLogin) 지원
 * - keepLogin=true  → 브라우저를 껐다 켜도 유지(local)
 * - keepLogin=false → 탭/브라우저 닫으면 해제(session)
 */
export const signInWithEmail = async ({ email, password, keepLogin = false }) => {
  const safeEmail = safeTrim(email);
  if (!safeEmail) throw new Error("email is required");
  if (!password) throw new Error("password is required");

  await setPersistence(
    auth,
    keepLogin ? browserLocalPersistence : browserSessionPersistence
  );

  const cred = await signInWithEmailAndPassword(auth, safeEmail, password);
  const uid = cred?.user?.uid;

  // 로그인 시에도 users 문서가 없으면 생성
  await ensureUserDoc({ uid, email: cred?.user?.email || safeEmail });

  return { uid, user: cred.user };
};

/** 비밀번호 재설정 메일 */
export const sendPasswordReset = async ({ email }) => {
  const safeEmail = safeTrim(email);
  if (!safeEmail) throw new Error("email is required");
  await sendPasswordResetEmail(auth, safeEmail);
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
      console.warn("[authService] ensureUserDoc failed:", e?.message || e);
    }
    onChange(user || null);
  });
};

/* ================= Social Login ================= */

function isPopupBlockedError(e) {
  const code = String(e?.code || "").toLowerCase();
  const msg = String(e?.message || "").toLowerCase();
  return (
    code.includes("auth/popup-blocked") ||
    code.includes("auth/popup-closed-by-user") ||
    code.includes("auth/cancelled-popup-request") ||
    msg.includes("popup") ||
    msg.includes("blocked")
  );
}

/** RN WebView 안에서 SIGNIN_RESULT 대기 (글로벌 bridge 구독 사용) */
function waitForSigninResult(timeoutMs = 60000) {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      resolve({ success: false, error_code: "timeout", error_message: "로그인 시간 초과" });
    }, timeoutMs);

    const unsub = onceFromApp("SIGNIN_RESULT", (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function decodeJwtPayload(idToken) {
  try {
    const parts = String(idToken || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** 웹 전용: 구글 팝업 로그인 */
async function webSignInWithGoogle({ keepLogin }) {
  await setPersistence(auth, keepLogin ? browserLocalPersistence : browserSessionPersistence);

  const provider = new GoogleAuthProvider();

  try {
    const userCred = await signInWithPopup(auth, provider);
    const uid = safeTrim(userCred?.user?.uid);
    const email = safeTrim(userCred?.user?.email || "");

    if (!uid) return { success: false, provider: "google", error_code: "no_uid" };

    await ensureUserDoc({ uid, email, provider: "google" });
    return { success: true, provider: "google", uid, user: userCred.user };
  } catch (e) {
    if (isPopupBlockedError(e)) {
      await signInWithRedirect(auth, provider);
      return { success: true, provider: "google", strategy: "web_redirect_started" };
    }
    return { success: false, provider: "google", error_code: e?.code, error_message: e?.message };
  }
}

/** Redirect 결과 소비 (구글/애플 redirect 복귀 시) */
export async function consumeRedirectResultIfAny() {
  if (isInWebView()) return { success: true, consumed: false };

  try {
    const res = await getRedirectResult(auth);
    if (!res || !res.user) return { success: true, consumed: false };

    const uid = safeTrim(res.user.uid);
    const email = safeTrim(res.user.email || "");
    if (!uid) return { success: false, consumed: true, error_code: "no_uid" };

    await ensureUserDoc({ uid, email, provider: "google" });
    return { success: true, consumed: true, uid };
  } catch (e) {
    return { success: false, consumed: false, error_code: e?.code, error_message: e?.message };
  }
}

/**
 * 소셜 로그인 (구글/카카오)
 * - 웹: 구글만 popup/redirect 지원
 * - RN WebView: RN 네이티브로 위임 (START_SIGNIN → SIGNIN_RESULT)
 */
export async function signInWithSocial({ provider, keepLogin = true }) {
  const p = safeTrim(provider).toLowerCase();

  // 웹 브라우저 직접 접근 (RN 아님)
  if (!isInWebView()) {
    if (p === "google") return await webSignInWithGoogle({ keepLogin });
    return {
      success: false,
      provider: p,
      error_code: "web_unsupported",
      error_message: "웹에서는 구글 로그인만 지원합니다.",
    };
  }

  // RN WebView: 네이티브에 위임
  await setPersistence(auth, keepLogin ? browserLocalPersistence : browserSessionPersistence);

  const sent = postToApp("START_SIGNIN", { provider: p });
  if (!sent) {
    return { success: false, provider: p, error_code: "not_in_app" };
  }

  const res = await waitForSigninResult(60000);

  if (!res || res.success !== true) {
    return {
      success: false,
      provider: p,
      error_code: res?.error_code || "native_signin_failed",
      error_message: res?.error_message || "로그인 실패",
    };
  }

  // Google: idToken → signInWithCredential
  if (p === "google") {
    const idToken = safeTrim(res?.idToken || res?.tokens?.idToken || "");
    if (!idToken) return { success: false, provider: "google", error_code: "no_idToken" };

    const cred = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, cred);
    const uid = safeTrim(userCred?.user?.uid);
    const email = safeTrim(userCred?.user?.email || "");

    if (!uid) return { success: false, provider: "google", error_code: "no_uid" };
    await ensureUserDoc({ uid, email, provider: "google" });
    return { success: true, provider: "google", uid, user: userCred.user };
  }

  // Kakao: accessToken → Cloud Function → Firebase Custom Token
  if (p === "kakao") {
    const accessToken = safeTrim(res?.accessToken || "");
    if (!accessToken) {
      return { success: false, provider: "kakao", error_code: "no_accessToken" };
    }

    try {
      const fnRes = await fetch(
        "https://asia-northeast3-halle-bf789.cloudfunctions.net/kakaoCustomToken",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        }
      );

      if (!fnRes.ok) {
        const errBody = await fnRes.text();
        return {
          success: false,
          provider: "kakao",
          error_code: "custom_token_failed",
          error_message: errBody,
        };
      }

      const { customToken } = await fnRes.json();
      const userCred = await signInWithCustomToken(auth, customToken);
      const uid = safeTrim(userCred?.user?.uid);

      if (!uid) return { success: false, provider: "kakao", error_code: "no_uid" };
      await ensureUserDoc({ uid, email: "", provider: "kakao" });
      return { success: true, provider: "kakao", uid, user: userCred.user };
    } catch (e) {
      return {
        success: false,
        provider: "kakao",
        error_code: e?.code || "kakao_auth_error",
        error_message: e?.message || String(e),
      };
    }
  }

  // Apple: idToken → OAuthProvider credential
  if (p === "apple") {
    const idToken = safeTrim(res?.idToken || res?.tokens?.idToken || "");
    if (!idToken) return { success: false, provider: "apple", error_code: "no_idToken" };
    return await signInWithApple(idToken);
  }

  return { success: false, provider: p, error_code: "unknown_provider" };
}

/**
 * Apple 로그인 — RN 네이티브에서 받은 idToken을 Firebase credential로 교환
 */
export async function signInWithApple(idToken) {
  const token = safeTrim(idToken);
  if (!token) return { success: false, provider: "apple", error_code: "no_idToken" };

  try {
    const provider = new OAuthProvider("apple.com");
    const cred = provider.credential({ idToken: token });
    const userCred = await signInWithCredential(auth, cred);
    const uid = safeTrim(userCred?.user?.uid);
    const email = safeTrim(userCred?.user?.email || "");
    if (!uid) return { success: false, provider: "apple", error_code: "no_uid" };

    await ensureUserDoc({ uid, email, provider: "apple" });
    return { success: true, provider: "apple", uid, user: userCred.user };
  } catch (e) {
    return {
      success: false,
      provider: "apple",
      error_code: e?.code || "apple_auth_error",
      error_message: e?.message || String(e),
    };
  }
}
