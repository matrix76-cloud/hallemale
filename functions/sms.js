/* eslint-disable */
// functions/sms.js
const { onRequest } = require("firebase-functions/v2/https");

const REGION = "asia-northeast3";

const VPC_CONNECTOR =
  "projects/dhmobile-a86e4/locations/asia-northeast3/connectors/serverless-conn-seoul";

/**
 * NAT 고정 IP 확인용
 * - 응답 ip가 34.64.237.111 나오면 성공
 */
exports.pingIp = onRequest(
  {
    region: REGION,
    vpcConnector: VPC_CONNECTOR,
    vpcConnectorEgressSettings: "ALL_TRAFFIC",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (_req, res) => {
    try {
      const resp = await fetch("https://api.ipify.org?format=json", { method: "GET" });
      const data = await resp.json();
      return res.status(200).send({ ok: true, ip: data?.ip || null });
    } catch (e) {
      console.error("[pingIp] error:", e);
      return res.status(500).send({ ok: false, error: String((e && e.message) || e) });
    }
  }
);

/**
 * 알리고 문자 발송
 * - .env 를 통해 환경변수 주입
 *   SMS_IDENTIFIER, SMS_API_KEY, SMS_SENDER, SMS_TESTMODE_YN
 */
exports.sendSms = onRequest(
  {
    region: REGION,
    vpcConnector: VPC_CONNECTOR,
    vpcConnectorEgressSettings: "ALL_TRAFFIC",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send({ ok: false, error: "method_not_allowed" });

      // ✅ ENV (functions/.env)
      const id = String(process.env.SMS_IDENTIFIER || "").trim();
      const key = String(process.env.SMS_API_KEY || "").trim();
      const sender = String(process.env.SMS_SENDER || "").replace(/\D/g, "");
      const test = String(process.env.SMS_TESTMODE_YN || "N").trim().toUpperCase();

      // ✅ debug (마스킹) — 문제 원인 분리용
      const debug = {
        user_id: id,
        key_tail: key ? key.slice(-6) : "",
        sender_tail: sender ? sender.slice(-4) : "",
        testmode_yn: test,
      };

      if (!id || !key || !sender) {
        return res.status(500).send({
          ok: false,
          error: "missing_env",
          debug,
          missing: {
            SMS_IDENTIFIER: !id,
            SMS_API_KEY: !key,
            SMS_SENDER: !sender,
          },
        });
      }

      const body = req.body || {};
      const to = String(body.to || "").replace(/\D/g, "");
      const text = body.text ? String(body.text).trim() : "";
      const templateId = body.templateId;
      const variables = body.variables || {};

      if (!to) return res.status(400).send({ ok: false, error: "missing_to", debug });

      // 플레인 텍스트 우선
      let msgText = text;

      // 템플릿 기반 메시지
      if (!msgText && templateId) {
        const TEMPLATES = {
          VERIFY_CODE: "[할래말래] 인증번호 {{code}} (3분 내 입력 해주세요)",
          STATUS_CONFIRMED: "[할래말래] 예약 확정: {{date}} {{time}} / 담당자 {{therapist}}",
          STATUS_REJECTED: "[할래말래] 예약 거절: 사유 {{reason}}",
          PAYMENT_SUCCESS: "[할래말래] 결제 완료 {{amount}}원 / 주문번호 {{orderId}}",
        };
        const tpl = TEMPLATES[templateId];
        if (!tpl) return res.status(400).send({ ok: false, error: "invalid_template", debug });

        msgText = tpl
          .replace(/{{(\w+)}}/g, (_, k) => (variables[k] !== undefined ? String(variables[k]) : ""))
          .trim();
      }

      if (!msgText) return res.status(400).send({ ok: false, error: "missing_text", debug });

      const form = new URLSearchParams({
        user_id: id,
        key,
        msg: msgText,
        sender,
        receiver: to,
        testmode_yn: test,
      });

      const resp = await fetch("https://apis.aligo.in/send/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });

      let result;
      try {
        result = await resp.json();
      } catch {
        result = { status: resp.status, text: await resp.text() };
      }

      // ✅ debug 포함 응답 (원인확정 후 제거하면 됨)
      return res.status(200).send({ ok: true, debug, result });
    } catch (e) {
      console.error("[sendSms] error:", e);
      return res.status(500).send({ ok: false, error: String((e && e.message) || e) });
    }
  }
);
