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

/** 모바일 브라우저 여부 (팝업이 불안정하므로 redirect 방식 우선) */
function isMobileBrowser() {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  } catch {
    return false;
  }
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
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // ✅ 모바일 브라우저: 구글 OAuth 팝업이 팝업차단·서드파티쿠키 차단으로 거의 실패한다.
  //    authDomain 이 기본 도메인(halle-bf789.firebaseapp.com)이라 redirect 핸들러가 항상 등록돼 있어
  //    운영 환경에서 redirect 는 안전하다. 복귀 결과는 AuthContext.consumeRedirectResultIfAny() 가
  //    소비 → onAuthStateChanged 발화 → 로그인 완료. (localhost+커스텀도메인 이슈는 배포 환경엔 무관)
  if (isMobileBrowser()) {
    try {
      await setPersistence(
        auth,
        keepLogin ? browserLocalPersistence : browserSessionPersistence
      );
    } catch {}
    await signInWithRedirect(auth, provider);
    // 페이지가 인가 화면으로 이동하므로 아래 코드는 실행되지 않는다.
    return { success: true, provider: "google", strategy: "web_redirect_started" };
  }

  // 데스크톱: 팝업으로 통일. (제스처 유지를 위해 setPersistence 없이 즉시 호출)
  // signInWithPopup 앞에 await 를 두면 클릭 제스처가 끊겨 팝업이 차단된다.

  // ⚠️ 데스크톱 팝업: signInWithPopup 앞에 await(setPersistence 등)를 두면
  //    사용자 클릭 제스처가 끊겨 팝업이 차단되고 → redirect 폴백 → localhost+커스텀 authDomain
  //    조합에서 세션이 안 붙는 버그가 난다. 그래서 팝업을 "제스처와 같은 틱"에서 먼저 호출한다.
  //    웹 기본 지속성이 LOCAL 이므로 keepLogin=true 면 setPersistence 생략해도 유지된다.
  try {
    // 팝업이 결과를 못 돌려주고 영원히 멈추는 경우(서드파티 저장소 차단 등)를 대비한 타임아웃 가드.
    const popupPromise = signInWithPopup(auth, provider);
    const userCred = await Promise.race([
      popupPromise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject({ code: "popup_timeout", message: "팝업 응답이 없습니다(서드파티 쿠키 차단 가능성). 브라우저 설정을 확인하세요." }),
          25000
        )
      ),
    ]);
    const uid = safeTrim(userCred?.user?.uid);
    const email = safeTrim(userCred?.user?.email || "");

    if (!uid) return { success: false, provider: "google", error_code: "no_uid" };

    // 로그인 성공 후, 비유지(keepLogin=false)면 세션 지속성으로 전환.
    if (!keepLogin) {
      try { await setPersistence(auth, browserSessionPersistence); } catch {}
    }

    await ensureUserDoc({ uid, email, provider: "google" });
    return { success: true, provider: "google", uid, user: userCred.user };
  } catch (e) {
    // ⚠️ redirect 폴백 제거: localhost + 커스텀 authDomain 조합에서 redirect는 세션이 안 붙고
    //    페이지만 떠나버려서 진짜 에러를 못 본다. 실패 코드를 그대로 올려서 처리/표시한다.
    return { success: false, provider: "google", error_code: e?.code, error_message: e?.message };
  }
}

/* ===================== 웹 카카오 로그인 (redirect/code 방식) ===================== */

// 할래말래 전용 카카오 앱(ID 1485029) REST API 키.
const WEB_KAKAO_REST_KEY = "25dbce8c048d516861332a9f6b682f35";
const KAKAO_CUSTOM_TOKEN_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/kakaoCustomToken";
const LS_KAKAO_KEEP = "hm.kakaoWebKeepLogin";

/** 웹: 카카오 인가 페이지로 리다이렉트 (복귀는 /oauth/kakao 콜백) */
async function webSignInWithKakao({ keepLogin }) {
  try {
    window.localStorage.setItem(LS_KAKAO_KEEP, keepLogin ? "1" : "0");
  } catch {}

  const redirectUri = `${window.location.origin}/oauth/kakao`;
  const url =
    `https://kauth.kakao.com/oauth/authorize?client_id=${WEB_KAKAO_REST_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  window.location.href = url;
  // 리다이렉트되므로 이 함수는 사실상 값을 반환하지 않음
  return { success: true, provider: "kakao", strategy: "web_redirect_started" };
}

/** 웹: /oauth/kakao 콜백에서 code → customToken → Firebase 로그인 */
export async function completeWebKakaoLogin(code) {
  const safeCode = safeTrim(code);
  if (!safeCode) return { success: false, provider: "kakao", error_code: "no_code" };

  let keepLogin = true;
  try {
    keepLogin = window.localStorage.getItem(LS_KAKAO_KEEP) !== "0";
  } catch {}

  await setPersistence(
    auth,
    keepLogin ? browserLocalPersistence : browserSessionPersistence
  );

  const redirectUri = `${window.location.origin}/oauth/kakao`;

  try {
    const fnRes = await fetch(KAKAO_CUSTOM_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: safeCode, redirectUri }),
    });

    const data = await fnRes.json().catch(() => ({}));
    if (!fnRes.ok || !data.customToken) {
      return {
        success: false,
        provider: "kakao",
        error_code: "custom_token_failed",
        error_message: data?.error || `HTTP ${fnRes.status}`,
      };
    }

    const userCred = await signInWithCustomToken(auth, data.customToken);
    const uid = safeTrim(userCred?.user?.uid);
    if (!uid) return { success: false, provider: "kakao", error_code: "no_uid" };

    await ensureUserDoc({ uid, email: "", provider: "kakao" });
    return { success: true, provider: "kakao", uid, user: userCred.user };
  } catch (e) {
    return {
      success: false,
      provider: "kakao",
      error_code: e?.code || "kakao_web_auth_error",
      error_message: e?.message || String(e),
    };
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
    if (p === "kakao") return await webSignInWithKakao({ keepLogin });
    return {
      success: false,
      provider: p,
      error_code: "web_unsupported",
      error_message: "지원하지 않는 로그인 방식입니다.",
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
