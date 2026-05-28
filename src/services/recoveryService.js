/* eslint-disable */
// src/services/recoveryService.js
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * =========================================================
 * Recovery Service (SSOT)
 * - Find ID: phone -> OTP -> users_by_phone -> email
 * - Reset Password (Proxy): server(Admin SDK) -> updateUser(uid, { password })
 * =========================================================
 */

/** ✅ SMS OTP 프록시 (기존 아이디 찾기에서 사용) */
const SMS_PROXY_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/sendSmsProxy";
const SMS_PROXY_KEY = "sms-gateway-shared-key-2025";

/** ✅ 비밀번호 재설정 프록시 (이번에 배포된 함수 URL) */
const RESET_PASSWORD_PROXY_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/resetPasswordViaProxy";
const RESET_PASSWORD_PROXY_KEY = "sms-gateway-shared-key-2025";

function safeStr(v) {
  return String(v ?? "").trim();
}

function onlyDigits(s = "") {
  return safeStr(s).replace(/\D+/g, "");
}

export function toE164KR(raw) {
  const d = onlyDigits(raw);
  if (!d) return "";
  const local = d.startsWith("0") ? d.slice(1) : d;
  return `+82${local}`;
}

export function formatKRPhone(raw) {
  let d = onlyDigits(raw);
  if (d.startsWith("82")) d = "0" + d.slice(2);
  if (d.length >= 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
  if (d.length >= 10)
    return d.startsWith("02")
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
  if (d.length > 7) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d;
}

export function genOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * ✅ OTP 문자 발송 (아이디 찾기에서 사용)
 */
export async function sendOtpViaProxy({ phone, app = "halle", code }) {
  const to = onlyDigits(phone);
  if (!to) throw new Error("phone is required");
  if (!code) throw new Error("code is required");

  const resp = await fetch(SMS_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SMS_PROXY_KEY}`,
    },
    body: JSON.stringify({
      to,
      templateId: "VERIFY_CODE",
      app,
      variables: { code },
    }),
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg =
      (data && (data.error || data.message || data.data?.error || data.data?.result?.message)) ||
      `발송 실패(${resp.status})`;
    throw new Error(msg);
  }

  if (data?.ok === false) {
    const msg =
      data?.error ||
      data?.message ||
      data?.data?.error ||
      data?.data?.result?.message ||
      "발송 실패";
    throw new Error(msg);
  }

  return data;
}

/**
 * ✅ phoneE164 → email 조회 (아이디 찾기에서 사용)
 */
export async function findEmailByPhoneE164(phoneE164) {
  const p = safeStr(phoneE164);
  if (!p) return null;

  const ref = doc(db, "users_by_phone", p);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  const email = safeStr(data.email);
  return email || null;
}

export function maskEmail(email) {
  const e = safeStr(email);
  if (!e.includes("@")) return e;

  const [id, domain] = e.split("@");
  const safeId = safeStr(id);
  const safeDomain = safeStr(domain);

  if (safeId.length <= 2) return `${safeId[0] || "*"}***@${safeDomain}`;
  return `${safeId.slice(0, 2)}***@${safeDomain}`;
}

/**
 * ✅ 비밀번호 재설정 (Cloud Functions / Admin SDK)
 * - 서버에서 admin.auth().updateUser(uid, { password: newPassword }) 수행
 *
 * ⚠️ 여기서는 uid를 받는 버전으로 고정.
 *    만약 서버가 phoneE164를 받도록 되어있으면, 호출부에서 phoneE164를 uid로 넘기면 안되고
 *    서버 바디 스펙에 맞춰 key를 바꿔야 함.
 */
export async function resetPasswordViaProxy({ uid, newPassword, app = "halle" }) {
  const _uid = safeStr(uid);
  const pw = safeStr(newPassword);

  if (!_uid) throw new Error("uid is required");
  if (!pw) throw new Error("newPassword is required");

  const resp = await fetch(RESET_PASSWORD_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESET_PASSWORD_PROXY_KEY}`,
    },
    body: JSON.stringify({
      uid: _uid,
      newPassword: pw,
      app,
    }),
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg = safeStr(data?.error || data?.message) || `요청 실패(${resp.status})`;
    throw new Error(msg);
  }

  if (data?.ok === false) {
    const msg = safeStr(data?.error || data?.message) || "요청 실패";
    throw new Error(msg);
  }

  return data;
}

export async function findUidByPhoneE164(phoneE164) {
  const p = safeStr(phoneE164);
  if (!p) return null;

  const ref = doc(db, "users_by_phone", p);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  const uid = safeStr(data.uid);
  return uid || null;
}


/**
 * ✅ 로그인 성공 시 users_by_phone/{phoneE164} 업서트
 * - 없으면 생성, 있으면 갱신 (merge)
 * - createdAt은 최초 1회만 들어가고, 이후엔 updatedAt만 갱신됨
 */
export async function upsertUsersByPhoneOnLogin({
  phoneE164,
  uid,
  email = "",
  phoneVerified = true,
}) {
  const p = safeStr(phoneE164);
  const u = safeStr(uid);
  const em = safeStr(email);

  if (!p) throw new Error("upsertUsersByPhoneOnLogin: phoneE164 is required");
  if (!u) throw new Error("upsertUsersByPhoneOnLogin: uid is required");

  const ref = doc(db, "users_by_phone", p);
  const snap = await getDoc(ref);

  const payload = {
    phoneE164: p,
    uid: u,
    email: em,
    phoneVerified: !!phoneVerified,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
  return { ok: true };
}