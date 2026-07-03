/* eslint-disable */
// functions/jobs/sendPushNotifications.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getAdmin } = require("../firebaseAdmin");
const { fetchQueuedNotifications, updatePushStatus } = require("../repos/notificationRepo");
const { getUsersFcmInfoBatch, getAllUsersFcmInfo, removeStaleToken } = require("../repos/userRepo");

const BATCH_SIZE = 50;

/**
 * 3분마다 queued 알림을 FCM으로 발송
 */
const sendPushTick = onSchedule("*/3 * * * *", async () => {
  const notifications = await fetchQueuedNotifications(BATCH_SIZE);

  if (notifications.length === 0) return;

  console.log(`[sendPushTick] processing ${notifications.length} queued notifications`);

  // 모든 대상 uid 수집 (브로드캐스트 = targetIds 빈배열)
  const allUids = new Set();
  let needsBroadcast = false;
  for (const noti of notifications) {
    const targets = Array.isArray(noti.targetIds) ? noti.targetIds : [];
    if (targets.length === 0) {
      needsBroadcast = true;
    } else {
      targets.forEach((uid) => allUids.add(uid));
    }
  }

  // FCM 토큰 + 알림 설정 일괄 조회
  let userInfoMap;
  if (needsBroadcast) {
    userInfoMap = await getAllUsersFcmInfo();
    // 개별 타겟도 누락되지 않도록 보강 조회
    const missing = [...allUids].filter((u) => !userInfoMap.has(u));
    if (missing.length > 0) {
      const extra = await getUsersFcmInfoBatch(missing);
      for (const [uid, info] of extra) userInfoMap.set(uid, info);
    }
  } else {
    userInfoMap = await getUsersFcmInfoBatch([...allUids]);
  }

  const messaging = getAdmin().messaging();

  for (const noti of notifications) {
    try {
      await processNotification(noti, userInfoMap, messaging);
    } catch (err) {
      console.error(`[sendPushTick] error processing ${noti.id}:`, err?.message || err);
      await updatePushStatus(noti.id, {
        status: "failed",
        failReason: String(err?.message || "unknown error").slice(0, 200),
      });
    }
  }
});

async function processNotification(noti, userInfoMap, messaging) {
  const rawTargets = Array.isArray(noti.targetIds) ? noti.targetIds : [];
  const prefsCategory = noti.prefsCategory || "";

  // 브로드캐스트: targetIds 빈배열 → 토큰 보유 전체 사용자
  const targetIds = rawTargets.length === 0 ? [...userInfoMap.keys()] : rawTargets;

  if (targetIds.length === 0) {
    await updatePushStatus(noti.id, { status: "skipped", failReason: "no recipients" });
    return;
  }

  // 유저별 prefs 확인 + FCM 토큰 수집
  const tokens = []; // { token, uid }[]
  const skippedUids = [];

  for (const uid of targetIds) {
    const info = userInfoMap.get(uid);
    if (!info) {
      skippedUids.push(uid);
      continue;
    }

    // 알림 설정 확인
    const prefs = info.prefs || {};
    if (prefs.enabled === false) {
      skippedUids.push(uid);
      continue;
    }

    // 카테고리별 설정 확인
    if (prefsCategory && prefs.categories && prefs.categories[prefsCategory] === false) {
      skippedUids.push(uid);
      continue;
    }

    for (const token of info.fcmTokens) {
      if (token) tokens.push({ token, uid });
    }
  }

  // 모든 대상이 설정 OFF이거나 토큰 없으면 skipped
  if (tokens.length === 0) {
    const reason = skippedUids.length === targetIds.length
      ? "all targets opted out"
      : "no fcm tokens";
    await updatePushStatus(noti.id, { status: "skipped", failReason: reason });
    return;
  }

  // FCM 메시지 구성
  const title = String(noti.title || "").trim() || "알림";
  const body = String(noti.body || "").trim();
  const deepLink = noti.meta?.deepLink || noti.deepLink || "";

  const messages = tokens.map(({ token }) => ({
    token,
    notification: { title, body },
    data: {
      notificationId: noti.id || "",
      deepLink: deepLink || "",
      kind: noti.kind || "",
      type: noti.type || "",
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
    webpush: {
      fcmOptions: {
        link: deepLink || "/",
      },
    },
  }));

  // sendEach로 발송 (500개 제한이지만 실제로는 훨씬 적을 것)
  const response = await messaging.sendEach(messages);

  console.log(
    `[sendPushTick] noti=${noti.id} success=${response.successCount} fail=${response.failureCount}`
  );

  // stale 토큰 정리
  for (let i = 0; i < response.responses.length; i++) {
    const res = response.responses[i];
    if (res.success) continue;

    const errCode = res.error?.code || "";
    if (
      errCode === "messaging/registration-token-not-registered" ||
      errCode === "messaging/invalid-registration-token"
    ) {
      const { token, uid } = tokens[i];
      try {
        await removeStaleToken(uid, token);
        console.log(`[sendPushTick] removed stale token for uid=${uid}`);
      } catch (e) {
        console.warn(`[sendPushTick] failed to remove stale token:`, e?.message);
      }
    }
  }

  // 최종 상태 결정
  if (response.successCount > 0) {
    await updatePushStatus(noti.id, { status: "sent" });
  } else {
    const firstErr = response.responses.find((r) => !r.success);
    const reason = firstErr?.error?.message || "all sends failed";
    await updatePushStatus(noti.id, {
      status: "failed",
      failReason: String(reason).slice(0, 200),
    });
  }
}

module.exports = { sendPushTick };
