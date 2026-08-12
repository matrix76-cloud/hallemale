/* eslint-disable */
// functions/otp/phoneOtp.js
// 전화번호 SMS 인증 (Solapi) — 소셜(카카오/구글) 계정을 전화번호로 통합하기 위한 OTP 발송/검증.
// 참고 구현: ieum(이음) functions/index.js requestPhoneOtp / verifyPhoneOtp
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getDb, getAdmin } = require("../firebaseAdmin");

const REGION = "asia-northeast3";

// 🔐 Solapi 키는 Firebase Secret Manager 사용 (.env / 하드코딩 금지)
//   firebase functions:secrets:set SOLAPI_API_KEY
//   firebase functions:secrets:set SOLAPI_API_SECRET
const SOLAPI_API_KEY = defineSecret("SOLAPI_API_KEY");
const SOLAPI_API_SECRET = defineSecret("SOLAPI_API_SECRET");

// 솔라피 콘솔에 사전 등록된 할래말래 발신번호 (변경 시 여기만 수정)
const SENDER = "07080657687";

const OTP_EXPIRE_MS = 3 * 60 * 1000; // 인증번호 유효 3분
const OTP_MAX_ATTEMPTS = 5; // 코드 오입력 허용 횟수
const OTP_RATE_LIMIT = 5; // 동일번호 1시간당 발송 제한

// 개인정보처리방침 제3조: 휴대폰 인증 기록(전화번호·인증번호)은 인증 요청일로부터 30일 보관 후 파기.
// 방침에 적힌 보유기간을 실제로 지키는 주체가 아래 purgePhoneVerificationsDaily 다.
const OTP_RETENTION_DAYS = 30;

// Solapi 발신은 국내망 전용 → 해외 번호는 SMS가 나가지 않는다.
// 길이만 검사하면 미국 10자리 번호 등이 통과해 발송 실패 문서만 쌓인다.
const KR_MOBILE_RE = /^01[016789]\d{7,8}$/;

// App Store 심사용 테스트 전화번호 범위 — Solapi 발송 스킵 + 응답에 testCode 노출
const TEST_PHONE_RANGE = { start: "01099991000", end: "01099991005" };
function isTestPhone(p) {
  return p >= TEST_PHONE_RANGE.start && p <= TEST_PHONE_RANGE.end;
}

function genOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6자리
}

/**
 * 인증번호 발송
 * body: { phone, purpose? }
 * res : { ok, verificationId, smsStatus, expiresInSec, testCode? }
 */
exports.requestPhoneOtp = onRequest(
  { region: REGION, cors: true, secrets: [SOLAPI_API_KEY, SOLAPI_API_SECRET] },
  async (req, res) => {
    try {
      const { phone, purpose } = req.body || {};
      if (!phone) {
        res.status(400).json({ ok: false, error: "phone 필수" });
        return;
      }

      const normPhone = String(phone).replace(/\D/g, "");
      if (!KR_MOBILE_RE.test(normPhone)) {
        res.status(400).json({
          ok: false,
          error: "국내 휴대폰 번호만 인증할 수 있습니다.",
          code: "phone/kr-only",
        });
        return;
      }

      const db = getDb();
      const admin = getAdmin();
      const now = Date.now();
      const isTest = isTestPhone(normPhone);

      // 레이트 리밋: 동일 번호 1시간 내 5건 초과 차단 (단일 필드 쿼리 후 메모리 필터 — 복합 인덱스 불필요)
      if (!isTest) {
        const oneHourAgo = now - 60 * 60 * 1000;
        const recentSnap = await db
          .collection("phone_verifications")
          .where("phone", "==", normPhone)
          .get();
        const recentCount = recentSnap.docs.filter((d) => {
          const t = d.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
          return t >= oneHourAgo;
        }).length;
        if (recentCount >= OTP_RATE_LIMIT) {
          res.status(429).json({ ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
          return;
        }
      }

      const code = genOtpCode();
      const expiresAt = new Date(now + OTP_EXPIRE_MS);

      const docRef = await db.collection("phone_verifications").add({
        phone: normPhone,
        code,
        purpose: purpose || "generic",
        expiresAt,
        verified: false,
        attempts: 0,
        isTest,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 테스트 번호: Solapi 발송 스킵 + 응답에 코드 노출 (앱 심사용)
      if (isTest) {
        res.json({
          ok: true,
          verificationId: docRef.id,
          smsStatus: "test_skipped",
          expiresInSec: OTP_EXPIRE_MS / 1000,
          testCode: code,
        });
        return;
      }

      const smsText = `[할래말래] 인증번호는 ${code} 입니다. 3분 이내에 입력해 주세요.`;

      let smsStatus = "skipped";
      try {
        const apiKey = SOLAPI_API_KEY.value();
        const apiSecret = SOLAPI_API_SECRET.value();
        if (apiKey && apiSecret) {
          const { SolapiMessageService } = require("solapi");
          const solapi = new SolapiMessageService(apiKey, apiSecret);
          await solapi.sendOne({ to: normPhone, from: SENDER, text: smsText });
          smsStatus = "success";
        } else {
          console.log("[requestPhoneOtp] Solapi 키 없음 — 콘솔 로그 대체:", { to: normPhone, code });
        }
      } catch (smsErr) {
        console.error("[requestPhoneOtp] Solapi send error:", smsErr?.message);
        smsStatus = "failed";
      }

      res.json({ ok: true, verificationId: docRef.id, smsStatus, expiresInSec: OTP_EXPIRE_MS / 1000 });
    } catch (e) {
      console.error("[requestPhoneOtp] error:", e?.message);
      res.status(500).json({ ok: false, error: "서버 오류가 발생했습니다." });
    }
  }
);

/** 010… → +8210… (클라이언트 toE164Kr 과 같은 규칙) */
function toE164Kr(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("0") ? `+82${d.slice(1)}` : `+82${d}`;
}

/**
 * 인증 증빙 문서 id — 규칙에서 exists() 로 찾아야 하므로 결정론적이어야 한다.
 * ⚠️ firestore.rules 의 phoneProofId() 와 반드시 같은 규칙을 유지할 것.
 */
function proofId(uid, phoneE164) {
  return `${uid}__${phoneE164}`;
}

/**
 * 대기 중인 OTP 하나를 찾아 코드를 대조하고, 맞으면 소비(verified=true)한다.
 * 전화인증 게이트(verifyPhoneOtp)와 계정 찾기(recoverAccountByPhone)가 같은 규칙
 * (유효 3분·5회 제한·최신 건 우선)을 쓰도록 검증 로직을 한 곳에 둔다.
 *
 * @returns {{ ok: true }} | {{ ok: false, status, error, code, attemptsLeft? }}
 */
async function consumePendingOtp(db, admin, normPhone, normCode) {
  // 동일 번호의 미검증 OTP 중 가장 최근 것 하나 사용 (단일 필드 쿼리 + 메모리 정렬 — 복합 인덱스 불필요)
  const snap = await db
    .collection("phone_verifications")
    .where("phone", "==", normPhone)
    .get();

  const pending = snap.docs
    .filter((d) => d.data()?.verified === false)
    .sort((a, b) => {
      const ta = a.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
      const tb = b.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
      return tb - ta;
    });

  if (pending.length === 0) {
    return { ok: false, status: 404, error: "인증번호를 먼저 요청해 주세요.", code: "otp/not-found" };
  }

  const doc = pending[0];
  const data = doc.data();
  const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);

  if (Date.now() > expiresAt.getTime()) {
    return { ok: false, status: 410, error: "인증번호가 만료되었습니다. 재전송해 주세요.", code: "otp/expired" };
  }

  const attempts = (data.attempts || 0) + 1;
  if (attempts > OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: "시도 횟수를 초과했습니다. 재전송해 주세요.", code: "otp/too-many-attempts" };
  }

  if (data.code !== normCode) {
    await doc.ref.update({ attempts });
    return {
      ok: false,
      status: 400,
      error: "인증번호가 올바르지 않습니다.",
      code: "otp/mismatch",
      attemptsLeft: OTP_MAX_ATTEMPTS - attempts,
    };
  }

  await doc.ref.update({
    verified: true,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    attempts,
  });

  return { ok: true };
}

/** consumePendingOtp 실패 결과를 그대로 HTTP 응답으로 옮긴다. */
function sendOtpError(res, r) {
  const body = { ok: false, error: r.error, code: r.code };
  if (r.attemptsLeft != null) body.attemptsLeft = r.attemptsLeft;
  res.status(r.status).json(body);
}

/**
 * 인증번호 검증
 * body: { phone, code }
 * header: Authorization: Bearer <ID 토큰> (선택)
 * res : { ok, verified, phone, proof? }
 *
 * 토큰이 있으면 "이 uid 가 이 번호를 인증했다"는 증빙(phone_proofs)을 서버가 남긴다.
 * 보안규칙이 이 증빙을 요구하므로, 인증을 거치지 않은 사람은 phones/{번호} 를 선점하거나
 * users.phoneVerified 를 true 로 올릴 수 없다.
 * (예전에는 phones 쓰기가 로그인만 하면 통과라, 남의 번호를 미리 선점해 두면 진짜 번호 주인이
 *  인증을 마치는 순간 계정이 선점자에게 병합됐다)
 */
exports.verifyPhoneOtp = onRequest({ region: REGION, cors: true }, async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) {
      res.status(400).json({ ok: false, error: "phone, code 필수" });
      return;
    }

    const normPhone = String(phone).replace(/\D/g, "");
    const normCode = String(code).replace(/\D/g, "");

    const db = getDb();
    const admin = getAdmin();

    const otp = await consumePendingOtp(db, admin, normPhone, normCode);
    if (!otp.ok) {
      sendOtpError(res, otp);
      return;
    }

    // 인증 증빙 — 호출자가 로그인 상태면(사용자앱 전화인증 게이트) 남긴다.
    // 구장주 가입은 로그인 전에 인증하므로 토큰이 없다 → 증빙 없이도 검증 자체는 성공한다.
    let proof = false;
    const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (m) {
      try {
        const uid = (await admin.auth().verifyIdToken(m[1])).uid;
        const e164 = toE164Kr(normPhone);
        await db.collection("phone_proofs").doc(proofId(uid, e164)).set({
          uid,
          phoneE164: e164,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        proof = true;
      } catch (e) {
        // 토큰이 유효하지 않아도 인증 결과 자체는 돌려준다(증빙만 생략).
        console.warn("[verifyPhoneOtp] proof skipped:", e?.message);
      }
    }

    res.json({ ok: true, verified: true, phone: normPhone, proof });
  } catch (e) {
    console.error("[verifyPhoneOtp] error:", e?.message);
    res.status(500).json({ ok: false, error: "서버 오류가 발생했습니다." });
  }
});

/* ===================== 계정 찾기 · 임시 비밀번호 발급 ===================== */

// 임시 비밀번호는 사람이 문자로 받아 옮겨 적는 값이다.
// 헷갈리는 글자(0·O·1·l·I)를 빼야 "왜 로그인이 안 되지" 문의가 줄어든다.
const TEMP_PW_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PW_LEN = 10;

/** 임시 비밀번호 생성 — 클라이언트 비밀번호 정책(영문+숫자 포함)을 만족할 때까지 뽑는다. */
function genTempPassword() {
  const { randomBytes } = require("crypto");
  for (;;) {
    const bytes = randomBytes(TEMP_PW_LEN);
    let s = "";
    for (let i = 0; i < TEMP_PW_LEN; i++) s += TEMP_PW_ALPHABET[bytes[i] % TEMP_PW_ALPHABET.length];
    if (/[A-Za-z]/.test(s) && /\d/.test(s)) return s;
  }
}

/** "hallaemallae@gmail.com" → "ha**********@gmail.com" (아이디 찾기 결과 표시용) */
function maskEmail(email) {
  const [id, domain] = String(email || "").split("@");
  if (!id || !domain) return "";
  const head = id.slice(0, 2);
  return `${head}${"*".repeat(Math.max(id.length - head.length, 2))}@${domain}`;
}

/**
 * 계정 찾기 + 임시 비밀번호 발급 (전화번호 인증 기반)
 * body: { phone, code }
 * res : { ok, tempIssued, provider, maskedEmail, tempPassword? }
 *
 * 이메일 로그인은 비밀번호를 잃으면 계정이 통째로 잠긴다. 이메일 인증 메일을 쓰지 않기로 했으므로
 * 복구 경로는 "이미 인증된 전화번호" 하나뿐이다 — 그래서 이 함수가 유일한 복구 창구다.
 *
 * ⚠️ 순서가 중요하다: SMS 를 먼저 보내고 그 다음에 비밀번호를 바꾼다.
 *    반대로 하면 SMS 발송이 실패했을 때 사용자는 바뀐 비밀번호를 영영 알 수 없어 계정이 잠긴다.
 *    이 순서면 최악의 경우가 "문자는 받았는데 비번은 안 바뀜"(= 기존 비번으로 그대로 로그인, 재시도 가능)이다.
 */
exports.recoverAccountByPhone = onRequest(
  { region: REGION, cors: true, secrets: [SOLAPI_API_KEY, SOLAPI_API_SECRET] },
  async (req, res) => {
    try {
      const { phone, code } = req.body || {};
      if (!phone || !code) {
        res.status(400).json({ ok: false, error: "phone, code 필수" });
        return;
      }

      const normPhone = String(phone).replace(/\D/g, "");
      const normCode = String(code).replace(/\D/g, "");

      const db = getDb();
      const admin = getAdmin();

      const otp = await consumePendingOtp(db, admin, normPhone, normCode);
      if (!otp.ok) {
        sendOtpError(res, otp);
        return;
      }

      // 이 번호의 주인 — phones/{e164}.primaryUid 가 단일 출처, users_by_phone 은 구버전 폴백.
      const e164 = toE164Kr(normPhone);
      let uid = "";
      const phoneSnap = await db.collection("phones").doc(e164).get();
      if (phoneSnap.exists) uid = phoneSnap.data()?.primaryUid || "";
      if (!uid) {
        const idxSnap = await db.collection("users_by_phone").doc(e164).get();
        if (idxSnap.exists) uid = idxSnap.data()?.uid || "";
      }
      if (!uid) {
        res.status(404).json({
          ok: false,
          code: "account/not-found",
          error: "이 번호로 가입된 계정이 없습니다.",
        });
        return;
      }

      let userRecord = null;
      try {
        userRecord = await admin.auth().getUser(uid);
      } catch (e) {
        res.status(404).json({
          ok: false,
          code: "account/not-found",
          error: "이 번호로 가입된 계정이 없습니다.",
        });
        return;
      }

      const maskedEmail = maskEmail(userRecord.email || "");
      const hasPassword = (userRecord.providerData || []).some((p) => p.providerId === "password");

      // 카카오/구글로 가입한 계정은 비밀번호 자체가 없다 — 발급할 게 없으니 어느 쪽으로
      // 로그인하면 되는지만 알려준다.
      if (!hasPassword) {
        const userSnap = await db.collection("users").doc(uid).get();
        res.json({
          ok: true,
          tempIssued: false,
          provider: userSnap.data()?.provider || "social",
          maskedEmail,
        });
        return;
      }

      const tempPw = genTempPassword();
      const smsText = `[할래말래] 임시 비밀번호는 ${tempPw} 입니다. 로그인 후 비밀번호를 변경해 주세요.`;

      // 테스트 번호(앱 심사용): 발송을 건너뛰고 응답에 임시 비밀번호를 실어 준다 — requestPhoneOtp 의 testCode 와 같은 취급.
      const isTest = isTestPhone(normPhone);
      if (!isTest) {
        const apiKey = SOLAPI_API_KEY.value();
        const apiSecret = SOLAPI_API_SECRET.value();
        // 키가 없으면 문자가 안 나간다 = 사용자가 임시 비밀번호를 못 받는다.
        // 여기서 그냥 진행하면 비밀번호만 바뀌고 계정이 잠기므로 반드시 중단한다.
        if (!apiKey || !apiSecret) {
          console.error("[recoverAccountByPhone] Solapi 키 없음 — 임시 비밀번호 발급 중단");
          res.status(500).json({ ok: false, error: "임시 비밀번호 발송에 실패했습니다. 고객센터로 문의해 주세요." });
          return;
        }
        try {
          const { SolapiMessageService } = require("solapi");
          const solapi = new SolapiMessageService(apiKey, apiSecret);
          await solapi.sendOne({ to: normPhone, from: SENDER, text: smsText });
        } catch (smsErr) {
          console.error("[recoverAccountByPhone] Solapi send error:", smsErr?.message);
          res.status(502).json({ ok: false, error: "임시 비밀번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." });
          return;
        }
      }

      await admin.auth().updateUser(uid, { password: tempPw });
      // 임시 비밀번호가 문자로 나간 이상 기존 세션은 더 이상 신뢰할 수 없다 — 전부 끊는다.
      await admin.auth().revokeRefreshTokens(uid);
      await db.collection("users").doc(uid).set(
        {
          mustChangePassword: true,
          tempPasswordAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.json({
        ok: true,
        tempIssued: true,
        provider: "email",
        maskedEmail,
        ...(isTest ? { tempPassword: tempPw } : {}),
      });
    } catch (e) {
      console.error("[recoverAccountByPhone] error:", e?.message);
      res.status(500).json({ ok: false, error: "서버 오류가 발생했습니다." });
    }
  }
);

/**
 * 휴대폰 인증 기록 파기 (매일 04:00 KST)
 * phone_verifications 는 전화번호와 인증번호를 담고 있어 무기한 보관하면 안 된다.
 * 개인정보처리방침에 고지한 보유기간(30일)이 지난 문서를 삭제한다.
 */
exports.purgePhoneVerificationsDaily = onSchedule(
  { region: REGION, schedule: "0 4 * * *", timeZone: "Asia/Seoul", retryCount: 0 },
  async () => {
    const db = getDb();
    const cutoff = new Date(Date.now() - OTP_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let deleted = 0;
    // 배치 상한(500)에 맞춰 반복 — 하루치 적재량은 이보다 훨씬 적지만 최초 실행 시 누적분을 비운다.
    for (;;) {
      const snap = await db
        .collection("phone_verifications")
        .where("createdAt", "<", cutoff)
        .limit(400)
        .get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;

      if (snap.size < 400) break;
    }

    console.log("[purgePhoneVerificationsDaily] deleted:", deleted);
    return null;
  }
);
