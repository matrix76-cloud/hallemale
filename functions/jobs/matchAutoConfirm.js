/* eslint-disable */
// functions/jobs/matchAutoConfirm.js
// 결과 자동 승인:
//  - confirmed + resultState="waiting_accept" 경기 중, 종료시각(scheduledAt + durationMin) + 3일이 지났는데
//    상대팀이 제출 결과를 승인하지 않은 건을 "제출값으로 자동 확정"한다.
//  - 확정 = 클럽/선수 통계 반영 + status=finished + resultState="confirmed"
//    (클라이언트 acceptMatchResult와 동일한 통계 계산. statsAppliedAt 플래그로 중복 방지.)
//  - 결과 미제출(양 팀 모두) 건은 matchAutoVoid 잡이 "무효"로 처리한다(여기선 대상 아님).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");

const DEFAULT_DUR_MIN = 120; // 일정 시간 미지정 시 기본 2시간
const CONFIRM_AFTER_DAYS = 3;

const toStr = (v) => String(v ?? "").trim();
const safeNum = (n, fb = 0) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : fb;
};

function uniqStr(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    const s = toStr(x);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  });
  return out;
}

function normalizeRecentArray(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => {
      const v = toStr(x).toUpperCase();
      return v === "W" || v === "L" || v === "D" ? v : "";
    })
    .filter(Boolean)
    .slice(0, 5);
}

function computeNextStats(prevStats, nextResult) {
  const prev = prevStats && typeof prevStats === "object" ? prevStats : {};
  const wins = safeNum(prev.wins, 0) + (nextResult === "W" ? 1 : 0);
  const losses = safeNum(prev.losses, 0) + (nextResult === "L" ? 1 : 0);
  const draws = safeNum(prev.draws, 0) + (nextResult === "D" ? 1 : 0);
  const prevTotal = safeNum(
    prev.totalMatches,
    safeNum(prev.wins, 0) + safeNum(prev.losses, 0) + safeNum(prev.draws, 0)
  );
  const totalMatches = prevTotal + 1;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;
  const recentResults = [nextResult, ...normalizeRecentArray(prev.recentResults)].slice(0, 5);
  return { wins, losses, draws, totalMatches, winRate, recentResults };
}

function extractMemberIds(lineupSnap) {
  const snap = lineupSnap && typeof lineupSnap === "object" ? lineupSnap : {};
  const ids = Array.isArray(snap.memberIds) ? snap.memberIds.map(toStr).filter(Boolean) : [];
  if (ids.length) return uniqStr(ids);
  const preview = Array.isArray(snap.previewMembers) ? snap.previewMembers : [];
  const legacy = preview.map((m) => toStr(m?.userId || m?.uid || m?.id)).filter(Boolean);
  return uniqStr(legacy);
}

// 한 팀의 팀원 uid 목록 (users.activeTeamId == clubId) — 알림 수신자용
async function clubMemberUids(db, clubId) {
  const cid = toStr(clubId);
  if (!cid) return [];
  try {
    const snap = await db.collection("users").where("activeTeamId", "==", cid).limit(100).get();
    return snap.docs.map((d) => d.id);
  } catch (e) {
    return [];
  }
}

// 제출값으로 결과 자동 확정 (acceptMatchResult 포팅). 적용했으면 true 반환.
async function autoConfirmOne(db, FieldValue, mrRef) {
  return db.runTransaction(async (tx) => {
    // ===== READS (먼저 전부) =====
    const mrSnap = await tx.get(mrRef);
    if (!mrSnap.exists) return false;
    const mr = mrSnap.data() || {};
    if (mr.statsAppliedAt) return false; // 이미 반영됨
    if (toStr(mr.resultState) !== "waiting_accept") return false;

    const aScore = Number(mr.myScore);
    const tScore = Number(mr.oppScore);
    if (!Number.isFinite(aScore) || !Number.isFinite(tScore)) return false;

    const actorClubId = toStr(mr.actorClubId);
    const targetClubId = toStr(mr.targetClubId);
    if (!actorClubId || !targetClubId) return false;

    let actorResult = "D";
    let targetResult = "D";
    if (aScore > tScore) {
      actorResult = "W";
      targetResult = "L";
    } else if (aScore < tScore) {
      actorResult = "L";
      targetResult = "W";
    }

    const actorRef = db.collection("clubs").doc(actorClubId);
    const targetRef = db.collection("clubs").doc(targetClubId);
    const [aClubSnap, tClubSnap] = await Promise.all([tx.get(actorRef), tx.get(targetRef)]);
    const aClub = aClubSnap.exists ? aClubSnap.data() || {} : {};
    const tClub = tClubSnap.exists ? tClubSnap.data() || {} : {};

    const actorMemberIds = extractMemberIds(mr.fromLineupSnapshot);
    const targetMemberIds = extractMemberIds(mr.toLineupSnapshot);
    const allUserIds = uniqStr([...actorMemberIds, ...targetMemberIds]);
    const userRefs = allUserIds.map((uid) => ({ uid, ref: db.collection("users").doc(uid) }));
    const userSnaps = await Promise.all(userRefs.map((x) => tx.get(x.ref)));
    const userDataById = {};
    userRefs.forEach((x, i) => {
      userDataById[x.uid] = userSnaps[i].exists ? userSnaps[i].data() || {} : null;
    });

    // ===== COMPUTE =====
    const aStats = aClub.stats || {};
    const tStats = tClub.stats || {};
    const aWins = safeNum(aStats.wins, 0) + (actorResult === "W" ? 1 : 0);
    const aLosses = safeNum(aStats.losses, 0) + (actorResult === "L" ? 1 : 0);
    const aDraws = safeNum(aStats.draws, 0) + (actorResult === "D" ? 1 : 0);
    const aTotal =
      safeNum(aStats.totalMatches, safeNum(aStats.wins, 0) + safeNum(aStats.losses, 0) + safeNum(aStats.draws, 0)) + 1;
    const tWins = safeNum(tStats.wins, 0) + (targetResult === "W" ? 1 : 0);
    const tLosses = safeNum(tStats.losses, 0) + (targetResult === "L" ? 1 : 0);
    const tDraws = safeNum(tStats.draws, 0) + (targetResult === "D" ? 1 : 0);
    const tTotal =
      safeNum(tStats.totalMatches, safeNum(tStats.wins, 0) + safeNum(tStats.losses, 0) + safeNum(tStats.draws, 0)) + 1;
    const aWinRate = aTotal > 0 ? aWins / aTotal : 0;
    const tWinRate = tTotal > 0 ? tWins / tTotal : 0;
    const nextARecent = [actorResult, ...normalizeRecentArray(aStats.recentResults)].slice(0, 5);
    const nextTRecent = [targetResult, ...normalizeRecentArray(tStats.recentResults)].slice(0, 5);

    // 평판(별점)
    const ratingVal = safeNum(mr?.result?.opponentRating, 0);
    const ratedByClubId = toStr(mr?.result?.submittedByClubId);
    const ratedClubId =
      ratingVal >= 1 && ratedByClubId
        ? ratedByClubId === actorClubId
          ? targetClubId
          : actorClubId
        : "";
    const buildRep = (club) => {
      const rep = club.reputation || {};
      const sum = safeNum(rep.sum, 0) + ratingVal;
      const count = safeNum(rep.count, 0) + 1;
      return { sum, count, avg: count > 0 ? sum / count : 0, updatedAt: FieldValue.serverTimestamp() };
    };
    const aRep = ratedClubId && ratedClubId === actorClubId ? buildRep(aClub) : null;
    const tRep = ratedClubId && ratedClubId === targetClubId ? buildRep(tClub) : null;

    const nextUserStatsById = {};
    actorMemberIds.forEach((uid) => {
      const u = userDataById[uid];
      nextUserStatsById[uid] = {
        prevStats: u && typeof u === "object" && u.stats ? u.stats : {},
        next: computeNextStats(u ? u.stats : null, actorResult),
      };
    });
    targetMemberIds.forEach((uid) => {
      const u = userDataById[uid];
      nextUserStatsById[uid] = {
        prevStats: u && typeof u === "object" && u.stats ? u.stats : {},
        next: computeNextStats(u ? u.stats : null, targetResult),
      };
    });

    // ===== WRITES =====
    tx.set(
      actorRef,
      {
        stats: {
          ...aStats,
          wins: aWins,
          losses: aLosses,
          draws: aDraws,
          totalMatches: aTotal,
          winRate: aWinRate,
          recentResults: nextARecent,
          updatedAt: FieldValue.serverTimestamp(),
        },
        ...(aRep ? { reputation: aRep } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(
      targetRef,
      {
        stats: {
          ...tStats,
          wins: tWins,
          losses: tLosses,
          draws: tDraws,
          totalMatches: tTotal,
          winRate: tWinRate,
          recentResults: nextTRecent,
          updatedAt: FieldValue.serverTimestamp(),
        },
        ...(tRep ? { reputation: tRep } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    allUserIds.forEach((uid) => {
      const pack = nextUserStatsById[uid];
      if (!pack) return;
      tx.set(
        db.collection("users").doc(uid),
        {
          stats: { ...(pack.prevStats || {}), ...(pack.next || {}), updatedAt: FieldValue.serverTimestamp() },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    // 확정 주체 = 미승인(상대) 팀으로 기록
    const submittedBy = toStr(mr?.result?.submittedByClubId);
    const confirmer = (submittedBy === actorClubId ? targetClubId : actorClubId) || submittedBy;
    tx.update(mrRef, {
      resultState: "confirmed",
      status: "finished",
      resultAcceptedByClubId: confirmer,
      resultAcceptedAt: FieldValue.serverTimestamp(),
      statsAppliedAt: FieldValue.serverTimestamp(),
      autoConfirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return true;
  });
}

const matchAutoConfirmTick = onSchedule("0 * * * *", async () => {
  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const nowMs = Date.now();

  const snap = await db
    .collection("match_requests")
    .where("status", "==", "confirmed")
    .limit(300)
    .get();

  if (snap.empty) return;

  let confirmed = 0;

  for (const docSnap of snap.docs) {
    try {
      const mr = docSnap.data() || {};
      if (mr.statsAppliedAt) continue;
      // 한 팀이 제출해 승인 대기 중인 건만 (양 팀 미제출은 matchAutoVoid가 처리)
      if (toStr(mr.resultState) !== "waiting_accept") continue;
      if (!Number.isFinite(Number(mr.myScore)) || !Number.isFinite(Number(mr.oppScore))) continue;

      const schedMs = mr.scheduledAt ? new Date(mr.scheduledAt).getTime() : NaN;
      if (!Number.isFinite(schedMs)) continue;

      const durMin = Number(mr.durationMin) > 0 ? Number(mr.durationMin) : DEFAULT_DUR_MIN;
      const endMs = schedMs + durMin * 60 * 1000;
      const confirmAtMs = endMs + CONFIRM_AFTER_DAYS * 24 * 60 * 60 * 1000;
      if (nowMs < confirmAtMs) continue; // 아직 자동 확정 기한 전

      const applied = await autoConfirmOne(db, FieldValue, docSnap.ref);
      if (!applied) continue;

      // 참가자 알림 (양 팀 팀원)
      const recipientSet = new Set();
      for (const cid of [mr.actorClubId, mr.targetClubId]) {
        (await clubMemberUids(db, cid)).forEach((u) => recipientSet.add(u));
      }
      const recipients = Array.from(recipientSet);
      if (recipients.length) {
        await db.collection("notifications").add({
          kind: "match",
          subType: "matchResultAutoConfirmed",
          type: "match_result_confirmed",
          title: "경기 결과가 자동 확정됐어요",
          body: "상대팀이 기한(경기 후 3일) 내 승인하지 않아 입력된 결과로 자동 확정됐어요.",
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

      confirmed += 1;
    } catch (e) {
      console.warn("[matchAutoConfirmTick] item failed:", e?.message || e);
    }
  }

  if (confirmed) console.log(`[matchAutoConfirmTick] auto-confirmed ${confirmed} matches`);
});

module.exports = { matchAutoConfirmTick };
