/* eslint-disable */
// functions/payments/payoutsApi.js
// 토스페이먼츠 **지급대행(payouts)** API 저수준 래퍼 — 셀러 등록/조회, 잔액 조회, 지급 요청/취소.
//
// 왜 결제(toss.js)와 파일을 나눴나:
//   ① 인증 키가 다르다 — 지급대행은 "API 개별 연동 키"의 시크릿 키 + **보안 키(JWE)** 를 따로 쓴다.
//   ② 보안 등급이 다르다 — Request Body 가 있는 POST 는 전부 JWE 암호화가 강제된다.
//      결제 코드에 섞으면 "이 요청은 암호화 대상인가"를 매번 헷갈리게 된다.
//   ③ 돈이 나가는 방향이 반대다. 결제는 받는 쪽, 지급대행은 **보내는 쪽**이라 사고의 성질이 다르다.
//      토스도 "지급한 정산금은 회수하기 어렵다"고 경고한다 → 호출부를 좁게 유지한다.
//
// ⚠️ 지급대행은 PG 계약이 구조적 선행조건이다. 지급 재원이 "매출은 일어났지만 토스페이먼츠로부터
//    아직 정산받지 않은 금액"이고, 지급 시점도 토스와 계약한 정산 주기를 따른다.
//    그래서 PG 가맹 심사가 끝나기 전에는 이 모듈이 아예 켜지지 않는다(PAYOUTS_ENABLED).
//
// 필요한 시크릿 (firebase functions:secrets:set):
//   TOSS_PAYOUT_SECRET_KEY  — 지급대행용 API 개별 연동 키의 시크릿 키 (Basic 인증)
//   TOSS_PAYOUT_SECURITY_KEY— 개발자센터 > API 키 > API 개별 키 > 보안 키 (64자 hex, JWE)
//
// 문서: https://docs.tosspayments.com/guides/v2/payouts

const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");

const TOSS_PAYOUT_SECRET_KEY = defineSecret("TOSS_PAYOUT_SECRET_KEY");
const TOSS_PAYOUT_SECURITY_KEY = defineSecret("TOSS_PAYOUT_SECURITY_KEY");

const API_BASE = "https://api.tosspayments.com/v2";

const s = (v) => String(v ?? "").trim();
const digits = (v) => s(v).replace(/[^0-9]/g, "");

/* ── 켜짐 게이트 ────────────────────────────────────────────
 * 지급대행은 "실제로 남의 계좌로 돈을 보내는" 기능이다. 키가 꽂혀 있다는 이유만으로
 * 켜지면 안 된다. 두 조건이 모두 맞아야 동작한다:
 *   ① 시크릿 두 개가 다 있고
 *   ② TOSS_PAYOUTS_ENABLED=true 로 명시적으로 열었을 때
 * 심사·계약이 끝나 실제로 쓸 준비가 되면 env 를 바꿔 연다. 코드를 고치지 않는다.
 * (결제의 PAYMENTS_LOCAL_ONLY 게이트와 같은 사상 — 게이트가 한곳에 모여 있어야
 *  한쪽만 열리는 사고가 안 난다) */
function payoutsEnabled() {
  return (
    s(process.env.TOSS_PAYOUTS_ENABLED).toLowerCase() === "true" &&
    !!s(TOSS_PAYOUT_SECRET_KEY.value()) &&
    !!s(TOSS_PAYOUT_SECURITY_KEY.value())
  );
}

/** 게이트가 닫혀 있으면 여기서 끊는다 — 호출부마다 검사하면 언젠가 한 곳이 빠진다. */
function assertEnabled() {
  if (!payoutsEnabled()) {
    const e = new Error("지급대행이 아직 열려 있지 않습니다. (PG 계약·지급대행 신청 완료 후 활성화)");
    e.code = "payouts_disabled";
    throw e;
  }
}

/* ── JWE (dir + A256GCM) ───────────────────────────────────
 * 라이브러리를 쓰지 않고 node:crypto 로 직접 만든다. functions 번들에 JOSE 의존성을
 * 하나 더 얹을 만큼 복잡한 스펙이 아니고(대칭키 직접 암호화), 의존성이 적을수록
 * 배포 사고가 준다.
 *
 * Compact 직렬화: BASE64URL(header) '.' BASE64URL(cek) '.' BASE64URL(iv) '.'
 *                 BASE64URL(ciphertext) '.' BASE64URL(tag)
 * alg=dir 이라 cek 는 빈 문자열이다 → "header..iv.ct.tag" 모양이 된다.
 * AAD 는 protected header 의 ASCII 표현 그대로다(base64url 문자열 자체).
 */
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const unb64u = (str) => Buffer.from(s(str), "base64url");

/** 보안 키(64자 hex) → 32바이트 키 */
function securityKeyBytes() {
  const hex = s(TOSS_PAYOUT_SECURITY_KEY.value());
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("TOSS_PAYOUT_SECURITY_KEY 형식 오류 — 64자 hex 여야 합니다.");
  }
  return Buffer.from(hex, "hex");
}

/** KST ISO8601 (yyyy-MM-dd'T'HH:mm:ss+09:00) — JWE 헤더의 iat */
function kstIso(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  const p = (x) => String(x).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}T` +
    `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}:${p(k.getUTCSeconds())}+09:00`;
}

function jweEncrypt(payloadObj) {
  const key = securityKeyBytes();
  const header = {
    alg: "dir",
    enc: "A256GCM",
    iat: kstIso(),
    nonce: crypto.randomUUID(),
  };
  const protectedB64 = b64u(JSON.stringify(header));
  const iv = crypto.randomBytes(12); // A256GCM 권장 96비트
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(protectedB64, "ascii"));
  const ct = Buffer.concat([cipher.update(JSON.stringify(payloadObj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${protectedB64}..${b64u(iv)}.${b64u(ct)}.${b64u(tag)}`;
}

function jweDecrypt(token) {
  const parts = s(token).split(".");
  if (parts.length !== 5) throw new Error("JWE 형식이 아닙니다.");
  const [protectedB64, , ivB64, ctB64, tagB64] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", securityKeyBytes(), unb64u(ivB64));
  decipher.setAAD(Buffer.from(protectedB64, "ascii"));
  decipher.setAuthTag(unb64u(tagB64));
  const out = Buffer.concat([decipher.update(unb64u(ctB64)), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}

/* ── HTTP ──────────────────────────────────────────────── */
function authHeader() {
  const key = s(TOSS_PAYOUT_SECRET_KEY.value());
  if (!key) throw new Error("TOSS_PAYOUT_SECRET_KEY 미설정");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

/** 실패 응답도 암호화되어 돌아온다 — 복호화해서 진짜 사유를 남긴다(안 그러면 로그가 JWE 덩어리다). */
function toApiError(payload, status) {
  const body = payload && payload.error ? payload.error : payload;
  const e = new Error(s(body?.message) || `지급대행 API 실패(HTTP ${status})`);
  e.tossCode = s(body?.code);
  e.status = status;
  return e;
}

/** 암호화가 필요한 POST (셀러 등록·수정, 지급 요청) */
async function encryptedPost(path, body, idempotencyKey) {
  assertEnabled();
  const headers = {
    Authorization: authHeader(),
    "Content-Type": "text/plain",
    "TossPayments-api-security-mode": "ENCRYPTION",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = s(idempotencyKey).slice(0, 300);

  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: jweEncrypt(body) });
  const text = await res.text();
  let json = null;
  try { json = text ? jweDecrypt(text) : null; } catch { try { json = JSON.parse(text); } catch { json = null; } }
  if (!res.ok) throw toApiError(json, res.status);
  return json;
}

/** 암호화가 필요 없는 요청 (GET, body 없는 POST) */
async function plainRequest(path, method = "GET", idempotencyKey) {
  assertEnabled();
  const headers = { Authorization: authHeader() };
  if (idempotencyKey) headers["Idempotency-Key"] = s(idempotencyKey).slice(0, 300);
  const res = await fetch(`${API_BASE}${path}`, { method, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(json, res.status);
  return json;
}

/* ── 셀러 ──────────────────────────────────────────────────
 * 우리 셀러 = 구장 사업자. [[owner-supply-policy]] 상 비사업자 개인은 받지 않으므로
 * businessType 은 INDIVIDUAL_BUSINESS 또는 CORPORATE 뿐이다(INDIVIDUAL 은 쓰지 않는다).
 */
const BUSINESS_TYPES = ["INDIVIDUAL_BUSINESS", "CORPORATE"];

/**
 * 셀러 등록. refSellerId 는 7~20자 제약이 있어 venueId 를 그대로 못 쓸 수 있다 → 접두사 + 잘라쓰기.
 * @returns Seller 객체(entityBody)
 */
async function registerSeller({ refSellerId, businessType, company, account, metadata }) {
  const type = BUSINESS_TYPES.includes(s(businessType)) ? s(businessType) : "INDIVIDUAL_BUSINESS";
  const body = {
    refSellerId: s(refSellerId).slice(0, 20),
    businessType: type,
    company: {
      name: s(company?.name),
      representativeName: s(company?.representativeName),
      businessRegistrationNumber: digits(company?.businessRegistrationNumber), // '-' 없이 10자리
      email: s(company?.email),
      phone: digits(company?.phone), // '-' 없이 숫자만
    },
    account: {
      bankCode: s(account?.bankCode),
      accountNumber: digits(account?.accountNumber), // '-' 없이 숫자만, 최대 14자
      holderName: s(account?.holderName),
    },
    ...(metadata ? { metadata } : {}),
  };
  const json = await encryptedPost("/sellers", body);
  return json?.entityBody || json;
}

/** 셀러 수정 — 계좌 변경 등. 사업자번호는 수정 불가(폐업·재등록이면 삭제 후 재등록). */
async function updateSeller(sellerId, patch) {
  const json = await encryptedPost(`/sellers/${encodeURIComponent(s(sellerId))}`, patch);
  return json?.entityBody || json;
}

/** 셀러 단건 조회 — 본인인증·KYC 로 상태가 바뀌었는지 확인 */
async function getSeller(sellerId) {
  const json = await plainRequest(`/sellers/${encodeURIComponent(s(sellerId))}`);
  return json?.entityBody || json;
}

/** 지급 가능 잔액. availableAmount 를 넘겨 요청하면 지급이 실패하므로 요청 전에 반드시 본다. */
async function getBalance() {
  const json = await plainRequest("/balances");
  const b = json?.entityBody || json;
  return {
    available: Number(b?.availableAmount?.value) || 0,
    pending: Number(b?.pendingAmount?.value) || 0,
  };
}

/* ── 지급 요청 ─────────────────────────────────────────────
 * 한 번에 최대 100건. 한 건이라도 실패하면 **요청 전체가 실패**하고 첫 실패 건의 에러만 돌아온다
 * → 호출부는 "부분 성공"을 가정하면 안 된다.
 * 적요(transactionDescription)는 최대 7자다. 구장명을 그대로 넣으면 잘려서 이상해지므로
 * 호출부에서 짧은 문구를 만들어 넘긴다.
 */
const MAX_PAYOUT_ITEMS = 100;

async function requestPayouts(items, idempotencyKey) {
  const list = (Array.isArray(items) ? items : []).slice(0, MAX_PAYOUT_ITEMS);
  if (!list.length) return [];
  const body = list.map((it) => ({
    refPayoutId: s(it.refPayoutId).slice(0, 50),
    destination: s(it.sellerId),
    scheduleType: it.payoutDate ? "SCHEDULED" : "EXPRESS",
    ...(it.payoutDate ? { payoutDate: s(it.payoutDate) } : {}),
    amount: { currency: "KRW", value: Math.floor(Number(it.amount) || 0) },
    transactionDescription: s(it.description || "정산금").slice(0, 7),
    ...(it.metadata ? { metadata: it.metadata } : {}),
  }));
  const json = await encryptedPost("/payouts", body, idempotencyKey);
  return json?.entityBody?.items || [];
}

/** 예약 지급(REQUESTED)만 취소 가능. body 가 없어 암호화 대상이 아니다. */
async function cancelPayout(payoutId, idempotencyKey) {
  const json = await plainRequest(`/payouts/${encodeURIComponent(s(payoutId))}/cancel`, "POST", idempotencyKey);
  return json?.entityBody || json;
}

module.exports = {
  TOSS_PAYOUT_SECRET_KEY,
  TOSS_PAYOUT_SECURITY_KEY,
  PAYOUT_SECRETS: [TOSS_PAYOUT_SECRET_KEY, TOSS_PAYOUT_SECURITY_KEY],
  payoutsEnabled,
  registerSeller,
  updateSeller,
  getSeller,
  getBalance,
  requestPayouts,
  cancelPayout,
  MAX_PAYOUT_ITEMS,
  // 테스트·검증용 (JWE 라운드트립 확인)
  _jwe: { encrypt: jweEncrypt, decrypt: jweDecrypt, kstIso },
};
