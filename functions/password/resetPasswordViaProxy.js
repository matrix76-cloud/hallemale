/* eslint-disable */
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function getBearerToken(req) {
  const raw = safeStr(req.headers.authorization || "");
  if (!raw) return "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? safeStr(m[1]) : "";
}

function json(res, status, payload) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(payload));
}

function allowCors(req, res) {
  const origin = safeStr(req.headers.origin || "*");
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

exports.resetPasswordViaProxy = onRequest(
  {
    region: "asia-northeast3",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    allowCors(req, res);

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    try {
      const expectedKey = safeStr(process.env.RESET_PASSWORD_PROXY_KEY);
      if (!expectedKey) {
        return json(res, 500, { ok: false, error: "Server misconfigured: RESET_PASSWORD_PROXY_KEY is missing" });
      }

      const gotKey = getBearerToken(req);
      if (!gotKey || gotKey !== expectedKey) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }

      const phoneE164 = safeStr(req.body?.phoneE164);
      const newPassword = safeStr(req.body?.newPassword);
      const app = safeStr(req.body?.app || "halle");

      if (!phoneE164) return json(res, 400, { ok: false, error: "phoneE164 is required" });
      if (!newPassword) return json(res, 400, { ok: false, error: "newPassword is required" });

      // 비번 정책(필요하면 형 기준으로 강화)
      if (newPassword.length < 8) {
        return json(res, 400, { ok: false, error: "비밀번호는 8자 이상이어야 합니다." });
      }

      // 1) phoneE164 -> email 매핑 조회
      const mapRef = admin.firestore().doc(`users_by_phone/${phoneE164}`);
      const mapSnap = await mapRef.get();
      if (!mapSnap.exists) {
        return json(res, 404, { ok: false, error: "해당 전화번호로 가입된 계정을 찾을 수 없습니다." });
      }

      const mapData = mapSnap.data() || {};
      const email = safeStr(mapData.email);
      if (!email) {
        return json(res, 400, { ok: false, error: "Mapping missing: email not found" });
      }

      // 2) Auth 유저 찾기 (email 기반)
      const user = await admin.auth().getUserByEmail(email);

      // 3) 비번 변경
      await admin.auth().updateUser(user.uid, { password: newPassword });

      // (선택) 감사 로그
      try {
        await admin.firestore().collection("password_reset_logs").add({
          phoneE164,
          email,
          uid: user.uid,
          app,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch {}

      return json(res, 200, { ok: true });
    } catch (e) {
      const msg = safeStr(e?.message || e);
      return json(res, 500, { ok: false, error: msg || "Unknown error" });
    }
  }
);
