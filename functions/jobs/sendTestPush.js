/* eslint-disable */
// functions/jobs/sendTestPush.js
const { onRequest } = require("firebase-functions/v2/https");
const { ENV } = require("../env");
const { getAdmin } = require("../firebaseAdmin");
const { getUsersFcmInfoBatch, removeStaleToken } = require("../repos/userRepo");

/**
 * 즉시 푸시 발송 (디버깅용)
 * - POST { uid, title, body }
 * - users/{uid}.fcmTokens 조회 → admin.messaging().sendEachForMulticast 즉시 발송
 */
const sendTestPush = onRequest(
  {
    region: ENV.REGION,
    cors: true,
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, message: "POST only" });
        return;
      }

      const body = req.body || {};
      const uid = String(body.uid || "").trim();
      const title = String(body.title || "테스트 푸시").trim();
      const text = String(body.body || "테스트 알림입니다").trim();

      if (!uid) {
        res.status(400).json({ ok: false, message: "uid required" });
        return;
      }

      const infoMap = await getUsersFcmInfoBatch([uid]);
      const info = infoMap.get(uid);
      if (!info || info.fcmTokens.length === 0) {
        res.status(200).json({ ok: true, sent: 0, reason: "no tokens" });
        return;
      }

      const tokens = info.fcmTokens;
      const messaging = getAdmin().messaging();

      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body: text },
        data: {
          notificationId: "test",
          deepLink: "/",
          kind: "test",
        },
        // Android: 절전모드(Doze)에서도 즉시 배달되도록 high priority + 고중요도 채널 지정
        android: {
          priority: "high",
          notification: {
            channelId: "hallamalle_default",
            sound: "default",
          },
        },
        // iOS: APNs 최우선순위(10)로 즉시 배달
        apns: {
          headers: { "apns-priority": "10" },
          payload: { aps: { sound: "default" } },
        },
        webpush: { fcmOptions: { link: "/" } },
      });

      // stale 토큰 정리
      for (let i = 0; i < response.responses.length; i++) {
        const r = response.responses[i];
        if (r.success) continue;
        const code = r.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          try {
            await removeStaleToken(uid, tokens[i]);
          } catch (_) {}
        }
      }

      res.status(200).json({
        ok: true,
        sent: response.successCount,
        failed: response.failureCount,
      });
    } catch (e) {
      res.status(500).json({ ok: false, message: String(e?.message || e) });
    }
  }
);

module.exports = { sendTestPush };
