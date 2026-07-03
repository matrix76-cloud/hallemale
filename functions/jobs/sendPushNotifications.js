/* eslint-disable */
// functions/jobs/sendPushNotifications.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getAdmin } = require("../firebaseAdmin");
const { fetchQueuedNotifications, claimNotification, updatePushStatus } = require("../repos/notificationRepo");
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

/**
 * ✅ 실시간 발송 — notifications 문서 생성 즉시 FCM 발송 (Firestore 트리거)
 * - 3분 폴링(sendPushTick) 기다리지 않고 바로 전송
 * - 실패 시 status를 건드리지 않아 sendPushTick(폴백)이 재시도
 * - DB 위치(nam5)에 맞춰 us-central1 리전
 */
const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{notiId}", region: "us-central1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const noti = { id: snap.id, ...(snap.data() || {}) };
    const push = noti.push || {};

    // 푸시 비활성이거나 이미 처리된(다른 경로) 건은 스킵
    if (push.enabled === false) return;
    if (push.status && push.status !== "queued") return;

    try {
      const rawTargets = Array.isArray(noti.targetIds) ? noti.targetIds : [];
      // 브로드캐스트(빈 targetIds)는 토큰 보유 전체, 개별 타겟은 배치 조회
      const userInfoMap =
        rawTargets.length === 0
          ? await getAllUsersFcmInfo()
          : await getUsersFcmInfoBatch(rawTargets);

      const messaging = getAdmin().messaging();
      await processNotification(noti, userInfoMap, messaging);
    } catch (err) {
      // status 미변경 → queued 유지 → sendPushTick 폴백이 재시도
      console.error(`[onNotificationCreated] ${noti.id} failed:`, err?.message || err);
    }
  }
);

async function processNotification(noti, userInfoMap, messaging) {
  // ✅ 원자적 클레임 — 실시간 트리거와 스케줄러가 같은 알림을 중복 발송하지 않도록
  //    queued → sending 전환에 성공한 1개 경로만 실제 발송한다. (이미 처리 중/완료면 스킵)
  const claimed = await claimNotification(noti.id);
  if (!claimed) return;

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
  const seenTokens = new Set(); // ✅ 같은 토큰 중복 발송 방지(기기당 1회)

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
      if (!token || seenTokens.has(token)) continue; // 중복 토큰 스킵
      seenTokens.add(token);
      tokens.push({ token, uid });
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

  try {
    // sendEach로 발송 (500개 제한이지만 실제로는 훨씬 적을 것)
    const response = await messaging.sendEach(messages);

    console.log(
      `[push] noti=${noti.id} success=${response.successCount} fail=${response.failureCount}`
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
          console.log(`[push] removed stale token for uid=${uid}`);
        } catch (e) {
          console.warn(`[push] failed to remove stale token:`, e?.message);
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
  } catch (err) {
    // 발송 API 자체 오류(일시적) → queued 로 복구하여 스케줄러가 재시도
    console.error(`[push] sendEach failed noti=${noti.id}:`, err?.message || err);
    await updatePushStatus(noti.id, {
      status: "queued",
      failReason: String(err?.message || "send error").slice(0, 200),
    }).catch(() => {});
  }
}

module.exports = { sendPushTick, onNotificationCreated };
