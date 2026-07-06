/* eslint-disable */
// functions/otp/phoneOtp.js
// 전화번호 SMS 인증 (Solapi) — 소셜(카카오/구글) 계정을 전화번호로 통합하기 위한 OTP 발송/검증.
// 참고 구현: ieum(이음) functions/index.js requestPhoneOtp / verifyPhoneOtp
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getDb, getAdmin } = require("../firebaseAdmin");

const REGION = "asia-northeast3";

// 🔐 Solapi 키는 Firebase Secret Manager 사용 (.env / 하드코딩 금지)
//   firebase functions:secrets:set SOLAPI_API_KEY
//   firebase functions:secrets:set SOLAPI_API_SECRET
const SOLAPI_API_KEY = defineSecret("SOLAPI_API_KEY");
const SOLAPI_API_SECRET = defineSecret("SOLAPI_API_SECRET");

// 솔라피 콘솔에 사전 등록된 할래말래 발신번호 (변경 시 여기만 수정)
const SENDER = "01063357687";

const OTP_EXPIRE_MS = 3 * 60 * 1000; // 인증번호 유효 3분
const OTP_MAX_ATTEMPTS = 5; // 코드 오입력 허용 횟수
const OTP_RATE_LIMIT = 5; // 동일번호 1시간당 발송 제한

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
      if (normPhone.length < 10 || normPhone.length > 11) {
        res.status(400).json({ ok: false, error: "전화번호 형식이 올바르지 않습니다." });
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

/**
 * 인증번호 검증
 * body: { phone, code }
 * res : { ok, verified, phone }
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
      res.status(404).json({ ok: false, error: "인증번호를 먼저 요청해 주세요.", code: "otp/not-found" });
      return;
    }

    const doc = pending[0];
    const data = doc.data();
    const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);

    if (Date.now() > expiresAt.getTime()) {
      res.status(410).json({ ok: false, error: "인증번호가 만료되었습니다. 재전송해 주세요.", code: "otp/expired" });
      return;
    }

    const attempts = (data.attempts || 0) + 1;
    if (attempts > OTP_MAX_ATTEMPTS) {
      res.status(429).json({ ok: false, error: "시도 횟수를 초과했습니다. 재전송해 주세요.", code: "otp/too-many-attempts" });
      return;
    }

    if (data.code !== normCode) {
      await doc.ref.update({ attempts });
      res.status(400).json({
        ok: false,
        error: "인증번호가 올바르지 않습니다.",
        code: "otp/mismatch",
        attemptsLeft: OTP_MAX_ATTEMPTS - attempts,
      });
      return;
    }

    await doc.ref.update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts,
    });

    res.json({ ok: true, verified: true, phone: normPhone });
  } catch (e) {
    console.error("[verifyPhoneOtp] error:", e?.message);
    res.status(500).json({ ok: false, error: "서버 오류가 발생했습니다." });
  }
});
