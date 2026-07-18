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
import { ensureUserDoc, saveOwnerManagerInfo } from "./userService";
import { toE164Kr } from "./phoneOtpService";
import { isInWebView, postToApp, onceFromApp } from "../bridge/webviewBridge";

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

// 구장주 계정은 예약·매출 데이터를 다루므로 사용자앱보다 기준을 높인다.
export const OWNER_PW_MIN = 8;

/** 비밀번호 규칙: 8자 이상 + 영문·숫자 조합. 통과하면 null, 아니면 사유 문자열 */
export function validateOwnerPassword(pw) {
  const v = s(pw);
  if (v.length < OWNER_PW_MIN) return `비밀번호는 ${OWNER_PW_MIN}자 이상이어야 해요.`;
  if (!/[A-Za-z]/.test(v)) return "비밀번호에 영문을 포함해주세요.";
  if (!/[0-9]/.test(v)) return "비밀번호에 숫자를 포함해주세요.";
  return null;
}

/** 휴대폰번호(하이픈 없이 10~11자리)만 통과 */
export function validateOwnerPhone(phone) {
  const digits = s(phone).replace(/[^0-9]/g, "");
  if (!digits) return "휴대폰번호를 입력해주세요.";
  if (!/^01[0-9]{8,9}$/.test(digits)) return "휴대폰번호 형식이 올바르지 않아요.";
  return null;
}

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

/**
 * 구장주 이메일 회원가입 → users 문서 보장 + role=owner 마킹은 로그인 화면에서 처리
 * - managerName/managerPhone: 계정 담당자(사업자 대표와 다를 수 있음). 예약 문의·구장 승인 연락처
 * - 휴대폰은 가입 폼에서 SMS 인증(phoneOtpService)을 마친 번호만 넘어온다.
 *   본인확인이 SMS로 끝나므로 이메일 인증은 따로 받지 않는다(이메일은 로그인 ID + 비밀번호 재설정용).
 */
export async function ownerSignUpEmail({
  email,
  password,
  managerName,
  managerPhone,
  phoneVerified = false,
  keepLogin = true,
}) {
  const em = s(email).toLowerCase();
  const pw = s(password);
  const name = s(managerName);
  const phone = s(managerPhone).replace(/[^0-9]/g, "");

  if (!em) return { success: false, error_message: "이메일을 입력해주세요." };

  const pwErr = validateOwnerPassword(pw);
  if (pwErr) return { success: false, error_message: pwErr };

  if (!name) return { success: false, error_message: "담당자 이름을 입력해주세요." };

  const phoneErr = validateOwnerPhone(phone);
  if (phoneErr) return { success: false, error_message: phoneErr };

  if (!phoneVerified) {
    return { success: false, error_message: "휴대폰 인증을 완료해주세요." };
  }

  try {
    await setPersistence(ownerAuth, keepLogin ? browserLocalPersistence : browserSessionPersistence);
    const cred = await createUserWithEmailAndPassword(ownerAuth, em, pw);
    const uid = s(cred?.user?.uid);
    if (!uid) return { success: false, error_code: "no_uid" };

    await ensureUserDoc({
      uid,
      email: em,
      provider: "password",
      phoneE164: toE164Kr(phone),
      phoneVerified: true,
    });
    await saveOwnerManagerInfo({ uid, name, phone });

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

  // ⛔ 카카오는 구장주에서 지원하지 않는다.
  //    카카오 uid는 kakao:{회원번호}로 결정론적이라, 같은 계정으로 사용자앱에 로그인하면
  //    uid가 동일해져 알림이 뒤섞이고 구장주 탈퇴가 선수 계정까지 지운다.
  if (p === "kakao") return { success: false, provider: p, error_code: "kakao_not_supported" };

  if (!isInWebView()) {
    if (p === "google") return await ownerWebGoogle({ keepLogin });
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
