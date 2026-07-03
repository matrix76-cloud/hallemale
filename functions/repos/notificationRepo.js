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
 * - push.status == "queued" 를 직접 쿼리(단일 필드 인덱스, 자동 생성됨)
 *   ⚠️ 과거엔 push.enabled==true 를 정렬 없이 limit 로 훑고 JS에서 queued 필터했는데,
 *      enabled 알림이 limit 를 넘으면 queued 가 조회 범위 밖으로 밀려 영영 발송 안 되던 버그.
 * - 레거시 호환(push.sent===false && !push.status)은 별도 쿼리로 소량 보강
 */
async function fetchQueuedNotifications(batchSize = 50) {
  const snap = await notificationsCol()
    .where("push.status", "==", "queued")
    .limit(batchSize)
    .get();

  const results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // 레거시 문서(status 없음) 보강 — 여유분만
  if (results.length < batchSize) {
    const legacySnap = await notificationsCol()
      .where("push.sent", "==", false)
      .limit(batchSize - results.length)
      .get();
    for (const doc of legacySnap.docs) {
      const data = doc.data() || {};
      if (data.push && !data.push.status) {
        results.push({ id: doc.id, ...data });
      }
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
