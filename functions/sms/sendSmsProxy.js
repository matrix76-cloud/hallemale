// functions/sms/sendSmsProxy.js
const { onRequest } = require("firebase-functions/v2/https");

// ✅ VM 게이트웨이(기존 인스턴스)
const VM_SMS_URL = "http://34.64.211.220:8080/sendSms";

// ✅ 프론트/서버 공통 shared key
const SHARED_KEY = "sms-gateway-shared-key-2025";

function safeStr(v) {
  return String(v ?? "").trim();
}

function applyCors(req, res) {
  const origin = safeStr(req.headers.origin);

  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  } else {
    res.set("Access-Control-Allow-Origin", "*");
  }

  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
}

function authOk(req) {
  const auth = safeStr(req.headers.authorization);
  if (!auth.startsWith("Bearer ")) return false;
  const token = safeStr(auth.slice("Bearer ".length));
  return token === SHARED_KEY;
}

exports.sendSmsProxy = onRequest(
  {
    region: "asia-northeast3",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    try {
      applyCors(req, res);

      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return res.status(405).send({ ok: false, error: "METHOD_NOT_ALLOWED" });

      if (!authOk(req)) return res.status(401).send({ ok: false, error: "UNAUTHORIZED" });

      const body = req.body || {};
      const to = safeStr(body.to);
      const templateId = safeStr(body.templateId);
      const app = safeStr(body.app);
      const variables = body.variables || {};

      if (!to || !templateId || !app) {
        return res.status(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const resp = await fetch(VM_SMS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SHARED_KEY}`,
        },
        body: JSON.stringify({ to, templateId, app, variables }),
      });

      const text = await resp.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!resp.ok) {
        return res.status(502).send({ ok: false, error: "VM_GATEWAY_ERROR", status: resp.status, data });
      }

      return res.status(200).send({ ok: true, data });
    } catch (e) {
      console.error("[sendSmsProxy] error:", e);
      return res.status(500).send({ ok: false, error: String((e && e.message) || e) });
    }
  }
);
