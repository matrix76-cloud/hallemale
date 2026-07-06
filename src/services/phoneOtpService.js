/* eslint-disable */
// src/services/phoneOtpService.js
// 전화번호 SMS 인증 (Solapi) — Cloud Functions 래퍼.
// 서버: functions/otp/phoneOtp.js (requestPhoneOtp / verifyPhoneOtp)

const CF_BASE = "https://asia-northeast3-halle-bf789.cloudfunctions.net";

/**
 * 국내 전화번호 → E.164 (+82) 변환
 *  "010-1234-5678" → "+821012345678"
 */
export function toE164Kr(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("82")) return "+" + d;
  return "+82" + d.replace(/^0/, "");
}

/**
 * 인증번호 발송 요청
 * @returns { ok, verificationId, smsStatus, expiresInSec, testCode? }
 */
export async function requestPhoneOtp(phone, purpose = "signup") {
  const normPhone = String(phone || "").replace(/\D/g, "");
  const res = await fetch(`${CF_BASE}/requestPhoneOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: normPhone, purpose }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || "인증번호 발송에 실패했습니다.");
    err.code = data?.code;
    throw err;
  }
  return data;
}

/**
 * 인증번호 검증
 * @returns { ok, verified, phone }
 */
export async function verifyPhoneOtp(phone, code) {
  const normPhone = String(phone || "").replace(/\D/g, "");
  const normCode = String(code || "").replace(/\D/g, "");
  const res = await fetch(`${CF_BASE}/verifyPhoneOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: normPhone, code: normCode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || "인증번호 확인에 실패했습니다.");
    err.code = data?.code;
    err.attemptsLeft = data?.attemptsLeft;
    throw err;
  }
  return data;
}
