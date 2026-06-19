/* eslint-disable */
// functions/jobs/matchStartReminder.js
// 경기 시작 알림: confirmed 경기 중 시작시각(scheduledAt)이 도달했고
// 아직 알림을 보내지 않은 건에 대해 양 팀장에게 푸시 알림 생성. (중복 방지: startNotifiedAt)
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");

const matchStartReminderTick = onSchedule("*/5 * * * *", async () => {
  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const nowMs = Date.now();

  const snap = await db
    .collection("match_requests")
    .where("status", "==", "confirmed")
    .limit(300)
    .get();

  if (snap.empty) return;

  let sent = 0;

  for (const docSnap of snap.docs) {
    try {
      const mr = docSnap.data() || {};
      if (mr.startNotifiedAt) continue;

      const schedMs = mr.scheduledAt ? new Date(mr.scheduledAt).getTime() : NaN;
      if (!Number.isFinite(schedMs)) continue;
      if (schedMs > nowMs) continue; // 아직 시작 시각 전

      // 너무 오래 지난 과거 경기는 알림 없이 플래그만 세팅 (폭주 방지)
      if (nowMs - schedMs > 6 * 60 * 60 * 1000) {
        await docSnap.ref.update({ startNotifiedAt: FieldValue.serverTimestamp() });
        continue;
      }

      const clubIds = [mr.actorClubId, mr.targetClubId]
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      const owners = [];
      for (const cid of clubIds) {
        const cs = await db.collection("clubs").doc(cid).get();
        const uid = cs.exists ? String(cs.data()?.ownerUid || "").trim() : "";
        if (uid) owners.push(uid);
      }

      if (owners.length === 0) {
        await docSnap.ref.update({ startNotifiedAt: FieldValue.serverTimestamp() });
        continue;
      }

      await db.collection("notifications").add({
        kind: "match",
        subType: "matchStarted",
        type: "match_started",
        title: "경기 시작 시간이에요 🏀",
        body: "매칭한 경기 시작 시간입니다. 즐겁게 경기하세요!",
        targetType: "USER",
        targetIds: owners,
        linkType: "match",
        linkTargetId: docSnap.id,
        meta: { matchId: docSnap.id, deepLink: `/match-roomdetail/${docSnap.id}` },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        readBy: {},
      });

      await docSnap.ref.update({ startNotifiedAt: FieldValue.serverTimestamp() });
      sent += 1;
    } catch (e) {
      console.warn("[matchStartReminderTick] item failed:", e?.message || e);
    }
  }

  if (sent) console.log(`[matchStartReminderTick] sent ${sent} start notifications`);
});

module.exports = { matchStartReminderTick };
