/* eslint-disable */
// src/services/phoneOtpService.js
// 전화번호 SMS 인증 (Solapi) — Cloud Functions 래퍼.
// 서버: functions/otp/phoneOtp.js (requestPhoneOtp / verifyPhoneOtp)

import { auth } from "./firebase";

const CF_BASE = "https://asia-northeast3-halle-bf789.cloudfunctions.net";

// 서버(functions/otp/phoneOtp.js)의 KR_MOBILE_RE 와 동일해야 함.
const KR_MOBILE_RE = /^01[016789]\d{7,8}$/;

/** 국내 휴대폰 번호인지 검사 ("010-1234-5678" / "01012345678" 모두 허용) */
export function isKrMobile(phone) {
  return KR_MOBILE_RE.test(String(phone || "").replace(/\D/g, ""));
}

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
 *
 * 로그인 상태면 ID 토큰을 같이 보낸다 — 서버가 "이 uid 가 이 번호를 인증했다"는 증빙
 * (phone_proofs)을 남기고, 보안규칙이 그 증빙을 요구한다. 토큰을 안 보내면 증빙이 안 생겨
 * 이후 phones 연결·phoneVerified 갱신이 규칙에 막힌다.
 * (구장주 가입은 로그인 전에 인증하므로 토큰이 없다 — 그쪽은 계정 생성 시점에 처리된다)
 *
 * @returns { ok, verified, phone, proof }
 */
export async function verifyPhoneOtp(phone, code) {
  const normPhone = String(phone || "").replace(/\D/g, "");
  const normCode = String(code || "").replace(/\D/g, "");
  const headers = { "Content-Type": "application/json" };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch (e) {}
  const res = await fetch(`${CF_BASE}/verifyPhoneOtp`, {
    method: "POST",
    headers,
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
