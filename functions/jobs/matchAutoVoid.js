/* eslint-disable */
// functions/jobs/matchAutoVoid.js
// 결과 미입력 무효 처리:
//  - confirmed 경기 중 종료시각(scheduledAt + durationMin) + 3일이 지났는데
//    "양 팀 모두" 결과를 입력하지 않은 건을 "무효"로 종결한다.
//  - 무효 = status=finished + resultState="void" + voidReason 기록 (점수 없음 → 전적/통계 미반영).
//  - 한 팀이라도 결과를 제출(resultState=waiting_accept 등)했으면 무효 대상이 아니다.
//    (그 건은 기존 "경기 종료 + 3일 → 제출값 자동 확정" 흐름이 처리)
//  - 중복 방지: voidedAt 플래그(한 번만 처리).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");

const DEFAULT_DUR_MIN = 120; // 일정 시간 미지정 시 기본 2시간
const VOID_AFTER_DAYS = 3;

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

// 한 팀의 "팀장" uid 해석: clubs.ownerUid → members의 owner/captain → 첫 멤버.
async function clubLeaderUid(db, clubId) {
  const cid = String(clubId || "").trim();
  if (!cid) return "";
  try {
    const cs = await db.collection("clubs").doc(cid).get();
    const ownerUid = cs.exists ? String(cs.data()?.ownerUid || "").trim() : "";
    if (ownerUid) return ownerUid;

    const ms = await db.collection("clubs").doc(cid).collection("members").limit(100).get();
    let captain = "";
    let first = "";
    ms.forEach((m) => {
      const d = m.data() || {};
      const role = String(d.role || "").trim();
      if (!first) first = m.id;
      if (!captain && (role === "owner" || role === "captain" || d.isCaptain === true)) {
        captain = m.id;
      }
    });
    return captain || first || "";
  } catch (e) {
    return "";
  }
}

const matchAutoVoidTick = onSchedule("0 * * * *", async () => {
  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const nowMs = Date.now();

  const snap = await db
    .collection("match_requests")
    .where("status", "==", "confirmed")
    .limit(300)
    .get();

  if (snap.empty) return;

  let voided = 0;

  for (const docSnap of snap.docs) {
    try {
      const mr = docSnap.data() || {};
      if (mr.voidedAt) continue;

      // 한 팀이라도 결과를 제출했으면 무효 대상이 아님 (자동 확정 흐름)
      const resultState = String(mr.resultState || "").trim();
      const hasResult = !!resultState || (mr.result && Object.keys(mr.result).length > 0);
      if (hasResult) continue;

      const schedMs = mr.scheduledAt ? new Date(mr.scheduledAt).getTime() : NaN;
      if (!Number.isFinite(schedMs)) continue;

      const durMin = Number(mr.durationMin) > 0 ? Number(mr.durationMin) : DEFAULT_DUR_MIN;
      const endMs = schedMs + durMin * 60 * 1000;
      const voidAtMs = endMs + VOID_AFTER_DAYS * 24 * 60 * 60 * 1000;
      if (nowMs < voidAtMs) continue; // 아직 무효 기한 전

      // 무효 종결 — 점수 없음 → 전적/통계 미반영
      await docSnap.ref.update({
        status: "finished",
        resultState: "void",
        voided: true,
        voidReason: "양 팀 결과 미입력",
        voidedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 참가자 알림 (양 팀장 + 팀원)
      const clubIds = [mr.actorClubId, mr.targetClubId]
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      const recipientSet = new Set();
      for (const cid of clubIds) {
        const lead = await clubLeaderUid(db, cid);
        if (lead) recipientSet.add(lead);
        const us = await clubMemberUids(db, cid);
        us.forEach((u) => recipientSet.add(u));
      }
      const recipients = Array.from(recipientSet);

      if (recipients.length) {
        await db.collection("notifications").add({
          kind: "match",
          subType: "matchVoided",
          type: "match_voided",
          title: "경기가 무효 처리됐어요",
          body: "양 팀 모두 결과를 입력하지 않아 이 경기는 무효 처리됐어요. (전적에 반영되지 않습니다)",
          targetType: "USER",
          targetIds: recipients,
          linkType: "match",
          linkTargetId: docSnap.id,
          meta: { matchId: docSnap.id, deepLink: `/match-roomdetail/${docSnap.id}` },
          push: { enabled: true, status: "queued", sentAt: null, failReason: null },
          prefsCategory: "match",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          readBy: {},
        });
      }

      voided += 1;
    } catch (e) {
      console.warn("[matchAutoVoidTick] item failed:", e?.message || e);
    }
  }

  if (voided) console.log(`[matchAutoVoidTick] voided ${voided} matches`);
});

module.exports = { matchAutoVoidTick };
