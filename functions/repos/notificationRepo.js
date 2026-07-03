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
 * 원자적 클레임 — push.status 를 queued → sending 으로 트랜잭션 전환.
 * - 이미 queued 가 아니면(다른 트리거/스케줄러가 처리 중/완료) false 반환
 * - 실시간 트리거와 3분 스케줄러가 같은 알림을 중복 발송하는 것을 방지
 * @returns {Promise<boolean>} 클레임 성공 여부
 */
async function claimNotification(notificationId) {
  if (!notificationId) return false;
  const ref = notificationsCol().doc(notificationId);
  try {
    return await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const push = (snap.data() || {}).push || {};
      const status = push.status;
      const isQueued = status === "queued";
      const isLegacy = push.sent === false && !status;
      if (!isQueued && !isLegacy) return false; // 이미 처리 중/완료
      tx.update(ref, { "push.status": "sending" });
      return true;
    });
  } catch (e) {
    console.warn(`[claimNotification] ${notificationId} tx failed:`, e?.message || e);
    return false;
  }
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

module.exports = { fetchQueuedNotifications, claimNotification, updatePushStatus };
