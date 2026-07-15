/* eslint-disable */
// functions/jobs/matchRequestReminder.js
// 매칭 제안 미응답 처리 (수락률↑ / 무한 방치 데드엔드↓):
//  - status="pending"(상대 수락 대기) 요청 중
//    · 24h 넘게 답이 없으면 상대(target) 팀장에게 리마인더 1회(remindedAt 플래그).
//    · 72h 넘으면 자동 만료(status="cancelled" + autoExpired) + 보낸(actor) 팀장에게 안내.
//  - 만료되면 두 팀은 다시 매칭 신청 가능(createMatchRequest 중복가드는 active 상태만 막음).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");

const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
const EXPIRE_AFTER_MS = 72 * 60 * 60 * 1000;

function tsToMs(v) {
  try {
    if (!v) return NaN;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v._seconds === "number") return v._seconds * 1000;
    if (typeof v.seconds === "number") return v.seconds * 1000;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : NaN;
  } catch (e) {
    return NaN;
  }
}

// 팀장 uid = clubs.ownerUid
async function clubLeaderUid(db, clubId) {
  const cid = String(clubId || "").trim();
  if (!cid) return "";
  try {
    const cs = await db.collection("clubs").doc(cid).get();
    return cs.exists ? String(cs.data()?.ownerUid || "").trim() : "";
  } catch (e) {
    return "";
  }
}

// side: "actor" | "target"
function teamName(mr, side) {
  if (side === "actor") return String(mr.actorTeam?.name || mr.fromTeamSnapshot?.name || "상대 팀").trim();
  return String(mr.targetTeam?.name || mr.toTeamSnapshot?.name || "상대 팀").trim();
}

async function notify(db, FieldValue, { uid, title, body, matchId, deepLink, subType, type }) {
  if (!uid) return;
  await db.collection("notifications").add({
    kind: "match",
    subType,
    type,
    title,
    body,
    targetType: "USER",
    targetIds: [uid],
    linkType: "match",
    linkTargetId: matchId,
    meta: { matchId, deepLink },
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    prefsCategory: "match",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    readBy: {},
  });
}

const matchRequestReminderTick = onSchedule("0 * * * *", async () => {
  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const nowMs = Date.now();

  const snap = await db
    .collection("match_requests")
    .where("status", "==", "pending")
    .limit(300)
    .get();

  if (snap.empty) return;

  let reminded = 0;
  let expired = 0;

  for (const docSnap of snap.docs) {
    try {
      const mr = docSnap.data() || {};
      const createdMs = tsToMs(mr.createdAt);
      if (!Number.isFinite(createdMs)) continue;
      const ageMs = nowMs - createdMs;

      // 72h 초과 → 자동 만료
      if (ageMs >= EXPIRE_AFTER_MS) {
        await docSnap.ref.update({
          status: "cancelled",
          autoExpired: true,
          cancelReason: "상대 미응답으로 만료",
          expiredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        const actorLead = await clubLeaderUid(db, mr.actorClubId);
        await notify(db, FieldValue, {
          uid: actorLead,
          title: "매칭 제안이 만료됐어요",
          body: `'${teamName(mr, "target")}'이 응답하지 않아 제안이 만료됐어요. 다른 팀에 다시 신청해보세요.`,
          matchId: docSnap.id,
          deepLink: "/matchingmanage",
          subType: "matchExpired",
          type: "match_expired",
        });
        expired += 1;
        continue;
      }

      // 24h 초과 & 아직 리마인드 안 함 → 상대 팀장에게 1회 리마인더
      if (ageMs >= REMIND_AFTER_MS && !mr.remindedAt) {
        const targetLead = await clubLeaderUid(db, mr.targetClubId);
        await notify(db, FieldValue, {
          uid: targetLead,
          title: "답을 기다리는 매칭 제안이 있어요 📩",
          body: `'${teamName(mr, "actor")}'의 매칭 제안이 아직 대기 중이에요. 수락 또는 거절해 주세요.`,
          matchId: docSnap.id,
          deepLink: "/matchingmanage",
          subType: "matchReminder",
          type: "match_reminder",
        });
        await docSnap.ref.update({ remindedAt: FieldValue.serverTimestamp() });
        reminded += 1;
      }
    } catch (e) {
      console.warn("[matchRequestReminderTick] item failed:", e?.message || e);
    }
  }

  if (reminded || expired) {
    console.log(`[matchRequestReminderTick] reminded ${reminded}, expired ${expired}`);
  }
});

module.exports = { matchRequestReminderTick };
