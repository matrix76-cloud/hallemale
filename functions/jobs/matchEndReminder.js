/* eslint-disable */
// functions/jobs/matchEndReminder.js
// 경기 종료 알림 + 경기 결과 입력 알림:
//  - confirmed 경기 중 종료시각(scheduledAt + durationMin)이 지났고 아직 종료 알림을 안 보낸 건에 대해
//    양 팀장에게 "경기 종료" 알림 생성.
//  - 아직 결과 미입력이면 "경기 결과 입력" 알림도 함께 생성.
//  - 중복 방지: endNotifiedAt 플래그(한 번만 발송).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");

const DEFAULT_DUR_MIN = 120; // 일정 시간 미지정 시 기본 2시간

// 한 팀의 팀원 uid 목록 (users.activeTeamId == clubId). 팀장 포함 — 호출부에서 Set으로 중복 제거.
async function clubMemberUids(db, clubId) {
  const cid = String(clubId || "").trim();
  if (!cid) return [];
  try {
    const snap = await db
      .collection("users")
      .where("activeTeamId", "==", cid)
      .limit(100)
      .get();
    return snap.docs.map((d) => d.id);
  } catch (e) {
    return [];
  }
}

const matchEndReminderTick = onSchedule("*/5 * * * *", async () => {
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
      if (mr.endNotifiedAt) continue;

      const schedMs = mr.scheduledAt ? new Date(mr.scheduledAt).getTime() : NaN;
      if (!Number.isFinite(schedMs)) continue;

      const durMin = Number(mr.durationMin) > 0 ? Number(mr.durationMin) : DEFAULT_DUR_MIN;
      const endMs = schedMs + durMin * 60 * 1000;
      if (endMs > nowMs) continue; // 아직 종료 시각 전

      // 너무 오래 지난 경기는 알림 없이 플래그만 세팅 (폭주 방지)
      if (nowMs - endMs > 6 * 60 * 60 * 1000) {
        await docSnap.ref.update({ endNotifiedAt: FieldValue.serverTimestamp() });
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
        await docSnap.ref.update({ endNotifiedAt: FieldValue.serverTimestamp() });
        continue;
      }

      const baseMeta = { matchId: docSnap.id, deepLink: `/match-roomdetail/${docSnap.id}` };

      // 팀장 + 양 팀 팀원 모두에게 발송 (Set으로 중복 제거)
      const recipientSet = new Set(owners);
      for (const cid of clubIds) {
        const us = await clubMemberUids(db, cid);
        us.forEach((u) => recipientSet.add(u));
      }
      const recipients = Array.from(recipientSet);

      // 1) 경기 종료 알림 — 팀장 + 팀원 전원
      await db.collection("notifications").add({
        kind: "match",
        subType: "matchEnded",
        type: "match_ended",
        title: "경기가 종료됐어요",
        body: "경기 수고하셨어요! 결과를 확인해 주세요.",
        targetType: "USER",
        targetIds: recipients,
        linkType: "match",
        linkTargetId: docSnap.id,
        meta: baseMeta,
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        readBy: {},
      });

      // 2) 경기 결과 입력 알림 (아직 결과 미입력일 때만)
      const resultState = String(mr.resultState || "").trim();
      const hasResult = !!resultState || (mr.result && Object.keys(mr.result).length > 0);
      if (!hasResult) {
        await db.collection("notifications").add({
          kind: "match",
          subType: "matchResultReminder",
          type: "match_result_reminder",
          title: "경기 결과를 입력해 주세요",
          body: "방금 끝난 경기의 스코어를 입력하면 전적에 반영돼요.",
          targetType: "USER",
          targetIds: owners,
          linkType: "match",
          linkTargetId: docSnap.id,
          meta: baseMeta,
          push: { enabled: true, status: "queued", sentAt: null, failReason: null },
          prefsCategory: "match",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          readBy: {},
        });
      }

      await docSnap.ref.update({ endNotifiedAt: FieldValue.serverTimestamp() });
      sent += 1;
    } catch (e) {
      console.warn("[matchEndReminderTick] item failed:", e?.message || e);
    }
  }

  if (sent) console.log(`[matchEndReminderTick] sent ${sent} end notifications`);
});

module.exports = { matchEndReminderTick };
