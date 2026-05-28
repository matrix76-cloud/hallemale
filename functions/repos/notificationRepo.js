/* eslint-disable */
// functions/repos/notificationRepo.js
const { getDb, getAdmin } = require("../firebaseAdmin");

function notificationsCol() {
  return getDb().collection("notifications");
}

function nowTs() {
  return getAdmin().firestore.FieldValue.serverTimestamp();
}

/**
 * queued 알림 조회
 * - push.enabled == true 쿼리 후 JS에서 status 필터
 * - 레거시 호환: push.sent === false && !push.status 도 포함
 */
async function fetchQueuedNotifications(batchSize = 50) {
  const snap = await notificationsCol()
    .where("push.enabled", "==", true)
    .limit(batchSize * 2) // JS 필터링 여유분
    .get();

  const results = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const push = data.push || {};

    const isQueued = push.status === "queued";
    const isLegacy = push.sent === false && !push.status;

    if (isQueued || isLegacy) {
      results.push({ id: doc.id, ...data });
      if (results.length >= batchSize) break;
    }
  }

  return results;
}

/**
 * push 상태 업데이트
 */
async function updatePushStatus(notificationId, { status, failReason = null }) {
  if (!notificationId) return;

  const patch = {
    "push.status": status,
    "push.sentAt": nowTs(),
    "push.sent": status === "sent", // 레거시 호환
  };

  if (failReason) {
    patch["push.failReason"] = failReason;
  }

  await notificationsCol().doc(notificationId).update(patch);
}

module.exports = { fetchQueuedNotifications, updatePushStatus };
