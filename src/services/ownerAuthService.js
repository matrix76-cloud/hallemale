/* eslint-disable */
// src/services/ownerAuthService.js
// 구장 관리자(구장주) 전용 인증 — 사용자 앱과 분리된 ownerAuth 인스턴스 사용.
// 사용자 앱 로그인과 세션이 섞이지 않는다.
import { ownerAuth } from "./firebase";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { ensureUserDoc } from "./userService";
import { isInWebView, postToApp, onceFromApp } from "../bridge/webviewBridge";

const KAKAO_CUSTOM_TOKEN_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/kakaoCustomToken";
const WEB_KAKAO_REST_KEY = "25dbce8c048d516861332a9f6b682f35";
const LS_KAKAO_KEEP = "hm.ownerKakaoKeep";
// 카카오 콜백(/oauth/kakao)에서 "구장주 로그인 흐름"인지 식별
export const LS_OWNER_KAKAO_FLOW = "hm.ownerKakaoFlow";

function s(v) { return String(v ?? "").trim(); }
function isMobileBrowser() {
  try { return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || ""); }
  catch { return false; }
}

/** ownerAuth 상태 구독 */
export function watchOwnerAuth(onChange) {
  return onAuthStateChanged(ownerAuth, (user) => onChange(user || null));
}

export async function ownerSignOut() {
  await signOut(ownerAuth);
  return true;
}

/* ============================================================
 * 이메일/비밀번호 로그인 (구장주 전용)
 *  - 사용자 앱은 소셜 로그인, 구장주 앱은 아이디(이메일)/비번으로 분리.
 *  - 소셜과 uid 네임스페이스가 분리되어, 구장주 회원탈퇴 시 계정을 통삭제해도
 *    같은 사람의 '선수' 소셜 계정에는 영향이 없다.
 * ========================================================== */

const OWNER_PW_MIN = 6;

function ownerAuthErrorMessage(code) {
  switch (String(code || "")) {
    case "auth/invalid-email": return "이메일 형식이 올바르지 않아요.";
    case "auth/email-already-in-use": return "이미 가입된 이메일이에요. 로그인해주세요.";
    case "auth/weak-password": return `비밀번호는 ${OWNER_PW_MIN}자 이상이어야 해요.`;
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "이메일 또는 비밀번호가 올바르지 않아요.";
    case "auth/too-many-requests": return "시도가 너무 많아요. 잠시 후 다시 시도해주세요.";
    case "auth/network-request-failed": return "네트워크 오류예요. 연결을 확인해주세요.";
    default: return "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
  }
}

/** 구장주 이메일 회원가입 → users 문서 보장 + role=owner 마킹은 로그인 화면에서 처리 */
export async function ownerSignUpEmail({ email, password, keepLogin = true }) {
  const em = s(email).toLowerCase();
  const pw = s(password);
  if (!em) return { success: false, error_message: "이메일을 입력해주세요." };
  if (pw.length < OWNER_PW_MIN) return { success: false, error_message: `비밀번호는 ${OWNER_PW_MIN}자 이상이어야 해요.` };
  try {
    await setPersistence(ownerAuth, keepLogin ? browserLocalPersistence : browserSessionPersistence);
    const cred = await createUserWithEmailAndPassword(ownerAuth, em, pw);
    const uid = s(cred?.user?.uid);
    if (!uid) return { success: false, error_code: "no_uid" };
    await ensureUserDoc({ uid, email: em, provider: "password" });
    return { success: true, uid };
  } catch (e) {
    return { success: false, error_code: e?.code, error_message: ownerAuthErrorMessage(e?.code) };
  }
}

/** 구장주 이메일 로그인 */
export async function ownerSignInEmail({ email, password, keepLogin = true }) {
  const em = s(email).toLowerCase();
  const pw = s(password);
  if (!em || !pw) return { success: false, error_message: "이메일과 비밀번호를 입력해주세요." };
  try {
    await setPersistence(ownerAuth, keepLogin ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(ownerAuth, em, pw);
    const uid = s(cred?.user?.uid);
    if (!uid) return { success: false, error_code: "no_uid" };
    await ensureUserDoc({ uid, email: em, provider: "password" });
    return { success: true, uid };
  } catch (e) {
    return { success: false, error_code: e?.code, error_message: ownerAuthErrorMessage(e?.code) };
  }
}

/** 구장주 비밀번호 재설정 메일 발송 */
export async function ownerSendPasswordReset(email) {
  const em = s(email).toLowerCase();
  if (!em) return { success: false, error_message: "이메일을 입력해주세요." };
  try {
    await sendPasswordResetEmail(ownerAuth, em);
    return { success: true };
  } catch (e) {
    return { success: false, error_code: e?.code, error_message: ownerAuthErrorMessage(e?.code) };
  }
}

/** 구글 redirect 복귀 결과 소비(모바일 브라우저) */
export async function consumeOwnerRedirectResult() {
  if (isInWebView()) return { success: true, consumed: false };
  try {
    const res = await getRedirectResult(ownerAuth);
    if (!res || !res.user) return { success: true, consumed: false };
    const uid = s(res.user.uid);
    if (!uid) return { success: false, consumed: true, error_code: "no_uid" };
    await ensureUserDoc({ uid, email: s(res.user.email), provider: "google" });
    return { success: true, consumed: true, uid };
  } catch (e) {
    return { success: false, consumed: false, error_code: e?.code, error_message: e?.message };
  }
}

/** 웹: 구글 — 사용자 앱과 동일하게 PC/모바일 모두 팝업으로 통일 */
async function ownerWebGoogle({ keepLogin }) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // ⚠️ signInWithPopup 앞에 await(setPersistence)를 두면 클릭 제스처가 끊겨 팝업이 차단되고,
  //    redirect 로 빠지면 localhost+커스텀 authDomain 에서 세션이 안 붙는다.
  //    그래서 팝업을 제스처와 같은 틱에서 먼저 호출한다. (웹 기본 지속성이 LOCAL)
  try {
    // 팝업 응답이 영원히 안 오는 경우(서드파티 저장소 차단 등) 대비 타임아웃 가드
    const cred = await Promise.race([
      signInWithPopup(ownerAuth, provider),
      new Promise((_, reject) =>
        setTimeout(() => reject({ code: "popup_timeout", message: "팝업 응답이 없습니다. 잠시 후 다시 시도해주세요." }), 25000)
      ),
    ]);
    const uid = s(cred?.user?.uid);
    if (!uid) return { success: false, provider: "google", error_code: "no_uid" };
    if (!keepLogin) {
      try { await setPersistence(ownerAuth, browserSessionPersistence); } catch {}
    }
    await ensureUserDoc({ uid, email: s(cred?.user?.email), provider: "google" });
    return { success: true, provider: "google", uid, user: cred.user };
  } catch (e) {
    return { success: false, provider: "google", error_code: e?.code, error_message: e?.message };
  }
}

/** 웹: 카카오 (인가 페이지로 redirect, 복귀는 /oauth/kakao) */
async function ownerWebKakao({ keepLogin }) {
  try {
    window.localStorage.setItem(LS_KAKAO_KEEP, keepLogin ? "1" : "0");
    window.localStorage.setItem(LS_OWNER_KAKAO_FLOW, "1"); // 콜백에서 ownerAuth 사용하도록 표시
  } catch {}
  const redirectUri = `${window.location.origin}/oauth/kakao`;
  window.location.href =
    `https://kauth.kakao.com/oauth/authorize?client_id=${WEB_KAKAO_REST_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  return { success: true, provider: "kakao", strategy: "web_redirect_started" };
}

/** 웹 카카오 콜백: code → customToken → ownerAuth 로그인 */
export async function completeOwnerWebKakaoLogin(code) {
  const safeCode = s(code);
  if (!safeCode) return { success: false, provider: "kakao", error_code: "no_code" };
  let keepLogin = true;
  try { keepLogin = window.localStorage.getItem(LS_KAKAO_KEEP) !== "0"; } catch {}
  await setPersistence(ownerAuth, keepLogin ? browserLocalPersistence : browserSessionPersistence);
  const redirectUri = `${window.location.origin}/oauth/kakao`;
  try {
    const res = await fetch(KAKAO_CUSTOM_TOKEN_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: safeCode, redirectUri }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.customToken) return { success: false, provider: "kakao", error_code: "custom_token_failed", error_message: data?.error || `HTTP ${res.status}` };
    const cred = await signInWithCustomToken(ownerAuth, data.customToken);
    const uid = s(cred?.user?.uid);
    if (!uid) return { success: false, provider: "kakao", error_code: "no_uid" };
    await ensureUserDoc({ uid, email: "", provider: "kakao" });
    return { success: true, provider: "kakao", uid };
  } catch (e) {
    return { success: false, provider: "kakao", error_code: e?.code || "kakao_web_auth_error", error_message: e?.message };
  } finally {
    try { window.localStorage.removeItem(LS_OWNER_KAKAO_FLOW); } catch {}
  }
}

/** RN WebView(네이티브 구장주 앱) SIGNIN_RESULT 대기 */
function waitForSigninResult(timeoutMs = 60000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; unsub(); resolve({ success: false, error_code: "timeout" }); } }, timeoutMs);
    const unsub = onceFromApp("SIGNIN_RESULT", (payload) => { if (!settled) { settled = true; clearTimeout(timer); resolve(payload); } });
  });
}

/** 구장주 소셜 로그인 (ownerAuth) */
export async function ownerSignInWithSocial({ provider, keepLogin = true }) {
  const p = s(provider).toLowerCase();

  if (!isInWebView()) {
    if (p === "google") return await ownerWebGoogle({ keepLogin });
    if (p === "kakao") return await ownerWebKakao({ keepLogin });
    return { success: false, provider: p, error_code: "web_unsupported" };
  }

  // RN WebView(구장주 네이티브 앱): 네이티브에 위임 → 토큰 받아 ownerAuth로 로그인
  await setPersistence(ownerAuth, keepLogin ? browserLocalPersistence : browserSessionPersistence);
  if (!postToApp("START_SIGNIN", { provider: p })) return { success: false, provider: p, error_code: "not_in_app" };
  const res = await waitForSigninResult(60000);
  if (!res || res.success !== true) return { success: false, provider: p, error_code: res?.error_code || "native_signin_failed", error_message: res?.error_message };

  try {
    if (p === "google") {
      const idToken = s(res?.idToken || res?.tokens?.idToken);
      if (!idToken) return { success: false, provider: "google", error_code: "no_idToken" };
      const cred = await signInWithCredential(ownerAuth, GoogleAuthProvider.credential(idToken));
      const uid = s(cred?.user?.uid);
      await ensureUserDoc({ uid, email: s(cred?.user?.email), provider: "google" });
      return { success: true, provider: "google", uid };
    }
    if (p === "kakao") {
      const accessToken = s(res?.accessToken);
      if (!accessToken) return { success: false, provider: "kakao", error_code: "no_accessToken" };
      const fnRes = await fetch(KAKAO_CUSTOM_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
      if (!fnRes.ok) return { success: false, provider: "kakao", error_code: "custom_token_failed", error_message: await fnRes.text() };
      const { customToken } = await fnRes.json();
      const cred = await signInWithCustomToken(ownerAuth, customToken);
      const uid = s(cred?.user?.uid);
      await ensureUserDoc({ uid, email: "", provider: "kakao" });
      return { success: true, provider: "kakao", uid };
    }
    if (p === "apple") {
      const idToken = s(res?.idToken || res?.tokens?.idToken);
      if (!idToken) return { success: false, provider: "apple", error_code: "no_idToken" };
      const op = new OAuthProvider("apple.com");
      const cred = await signInWithCredential(ownerAuth, op.credential({ idToken }));
      const uid = s(cred?.user?.uid);
      await ensureUserDoc({ uid, email: s(cred?.user?.email), provider: "apple" });
      return { success: true, provider: "apple", uid };
    }
  } catch (e) {
    return { success: false, provider: p, error_code: e?.code || "auth_error", error_message: e?.message };
  }
  return { success: false, provider: p, error_code: "unknown_provider" };
}
