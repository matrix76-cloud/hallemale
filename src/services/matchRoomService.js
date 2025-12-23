/* eslint-disable */
// src/services/matchRoomService.js
// ✅ 실데이터 버전 (match_requests 기반)
// - ✅ SSOT: pending/accepted/proposed/confirmed/cancelled/finished
// - ✅ 결과 흐름:
//   - submitResult: status=confirmed 유지 + resultState=waiting_accept (상대 승인 대기)
//   - acceptResult: resultState=confirmed + status=finished + clubs.stats 트랜잭션 반영(중복 방지)
// - ✅ 사진/코멘트: match_requests.result.{comment, photoUrls, submittedByClubId, submittedAt} 저장

import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { uploadCompressedImageMedia } from "./mediaService";

/* ========================= util ========================= */

const toStr = (v) => String(v || "").trim();

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function tsMs(v) {
  return toDateSafe(v)?.getTime() || 0;
}

function uniqById(list) {
  const map = {};
  for (const x of list || []) {
    const id = toStr(x?.id);
    if (!id) continue;
    map[id] = x;
  }
  return Object.values(map);
}

function normalizeRoomStatus(matchReqStatus) {
  const s = toStr(matchReqStatus);
  if (s === "accepted") return "accepted";
  if (s === "proposed") return "proposed";
  if (s === "confirmed") return "confirmed";
  if (s === "finished") return "finished";
  if (s === "cancelled") return "cancelled";
  return "accepted";
}

function safeNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRate(stats) {
  if (!stats) return 0;
  const winRate = Number(stats.winRate);
  if (Number.isFinite(winRate)) return winRate;

  const wins = safeNum(stats.wins, 0);
  const losses = safeNum(stats.losses, 0);
  const draws = safeNum(stats.draws, 0);
  const total = safeNum(stats.totalMatches, wins + losses + draws);
  if (total <= 0) return 0;
  return wins / total;
}

function normalizeClubDocToTeam(id, data) {
  const stats = data?.stats || {};
  const wins = safeNum(stats.wins, 0);
  const losses = safeNum(stats.losses, 0);
  const draws = safeNum(stats.draws, 0);
  const totalMatches = safeNum(stats.totalMatches, wins + losses + draws);

  return {
    clubId: id,
    id,
    name: toStr(data?.name) || "팀",
    region: toStr(data?.region),
    regionSido: toStr(data?.regionSido),
    regionGu: toStr(data?.regionGu),
    logoUrl: data?.logoUrl || "",
    logoPath: data?.logoPath || "",
    ownerUid: data?.ownerUid || "",
    stats: {
      wins,
      losses,
      draws,
      totalMatches,
      winRate: calcWinRate({ ...stats, wins, losses, draws, totalMatches }),
      recentResults: Array.isArray(stats?.recentResults) ? stats.recentResults : [],
    },
    createdAt: data?.createdAt || null,
    updatedAt: data?.updatedAt || null,
  };
}

function buildRecentFromStats(teamDoc) {
  const stats = teamDoc?.stats || {};
  const recent = Array.isArray(stats?.recentResults) ? stats.recentResults : [];

  return (recent || []).slice(0, 5).map((r) => {
    const v = toStr(r).toLowerCase();
    if (v === "w" || v.includes("win") || v === "승") return "W";
    if (v === "d" || v.includes("draw") || v === "무") return "D";
    return "L";
  });
}

function buildFallbackTeamFromSnapshot(snap, clubId) {
  const s = snap || {};
  return {
    clubId: toStr(clubId || s.clubId || s.id),
    id: toStr(clubId || s.clubId || s.id),
    name: toStr(s.name) || "팀",
    region: toStr(s.region),
    regionSido: toStr(s.regionSido),
    regionGu: toStr(s.regionGu),
    logoUrl: toStr(s.logoUrl || s.photoUrl || ""),
    stats: { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] },
  };
}

async function runBatches(ids, batchSize, worker) {
  const out = [];
  const list = Array.isArray(ids) ? ids : [];
  for (let i = 0; i < list.length; i += batchSize) {
    const chunk = list.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const res = await Promise.all(chunk.map((x) => worker(x)));
    out.push(...res);
  }
  return out;
}

async function safeGetClubTeamSummary(clubId) {
  const id = toStr(clubId);
  if (!id) return null;

  try {
    const ref = doc(db, "clubs", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return normalizeClubDocToTeam(snap.id, snap.data());
  } catch (e) {
    return null;
  }
}

/* ========================= list loader ========================= */

export async function loadMatchRoomListPageData(myTeamId = null) {
  const myClubId = toStr(myTeamId);
  if (!myClubId) {
    return { rooms: [], myTeam: null };
  }

  const col = collection(db, "match_requests");

  const qActor = query(col, where("actorClubId", "==", myClubId), limit(200));
  const qTarget = query(col, where("targetClubId", "==", myClubId), limit(200));

  const [snapA, snapB] = await Promise.all([getDocs(qActor), getDocs(qTarget)]);

  const rowsA = (snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  const rowsB = (snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

  const merged = uniqById([...(rowsA || []), ...(rowsB || [])]);

  const filtered = merged.filter((r) => {
    const st = toStr(r?.status);
    return (
      st === "accepted" ||
      st === "proposed" ||
      st === "confirmed" ||
      st === "finished" ||
      st === "cancelled"
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta =
      tsMs(a?.confirmedAt) ||
      tsMs(a?.proposedAt) ||
      tsMs(a?.acceptedAt) ||
      tsMs(a?.updatedAt) ||
      tsMs(a?.createdAt);
    const tb =
      tsMs(b?.confirmedAt) ||
      tsMs(b?.proposedAt) ||
      tsMs(b?.acceptedAt) ||
      tsMs(b?.updatedAt) ||
      tsMs(b?.createdAt);
    return tb - ta;
  });

  const teamIdSet = new Set();
  for (const mr of sorted) {
    const a = toStr(mr?.actorClubId);
    const t = toStr(mr?.targetClubId);
    if (a) teamIdSet.add(a);
    if (t) teamIdSet.add(t);
  }
  const teamIds = Array.from(teamIdSet);

  const teamMap = {};
  const fetched = await runBatches(teamIds, 24, async (cid) => {
    const t = await safeGetClubTeamSummary(cid);
    return { cid, team: t };
  });

  fetched.forEach(({ cid, team }) => {
    if (team) teamMap[cid] = team;
  });

  const myTeam = teamMap[myClubId] || (await safeGetClubTeamSummary(myClubId)) || null;

  const rooms = sorted.map((mr) => {
    const matchId = toStr(mr?.id);
    const actorClubId = toStr(mr?.actorClubId);
    const targetClubId = toStr(mr?.targetClubId);

    const iAmActor = actorClubId === myClubId;

    const myId = iAmActor ? actorClubId : targetClubId;
    const oppId = iAmActor ? targetClubId : actorClubId;

    const myFallbackSnap = iAmActor ? mr?.fromTeamSnapshot : mr?.toTeamSnapshot;
    const oppFallbackSnap = iAmActor ? mr?.toTeamSnapshot : mr?.fromTeamSnapshot;

    const myTeamResolved = teamMap[myId] || buildFallbackTeamFromSnapshot(myFallbackSnap, myId);
    const oppTeamResolved = teamMap[oppId] || buildFallbackTeamFromSnapshot(oppFallbackSnap, oppId);

    const myRecent = buildRecentFromStats(myTeamResolved);
    const oppRecent = buildRecentFromStats(oppTeamResolved);

    return {
      id: matchId,
      myTeam: myTeamResolved,
      oppTeam: oppTeamResolved,

      status: normalizeRoomStatus(mr?.status),
      scheduledAt: mr?.scheduledAt || null,

      proposedByClubId: toStr(mr?.proposedByClubId),
      confirmedByClubId: toStr(mr?.confirmedByClubId),

      field: mr?.field || null,
      fieldAddress: toStr(mr?.field?.address || mr?.fieldAddress || ""),
      fieldLat:
        mr?.field?.lat != null && Number.isFinite(Number(mr.field.lat)) ? Number(mr.field.lat) : null,
      fieldLng:
        mr?.field?.lng != null && Number.isFinite(Number(mr.field.lng)) ? Number(mr.field.lng) : null,

      myScore: mr?.myScore ?? null,
      oppScore: mr?.oppScore ?? null,
      resultState: mr?.resultState ?? null,

      myRecent,
      oppRecent,
    };
  });

  return { rooms, myTeam };
}

/* ========================= detail adapter ========================= */

function normalizeTeamSnapshot(snap) {
  const s = snap || {};
  return {
    clubId: toStr(s.clubId || s.id),
    id: toStr(s.clubId || s.id),
    name: toStr(s.name),
    region: toStr(s.region),
    regionSido: toStr(s.regionSido),
    regionGu: toStr(s.regionGu),
    logoUrl: toStr(s.logoUrl),
    stats: s.stats || null,
  };
}

function normalizeLineupSnapshot(snap) {
  const s = snap || {};
  const preview = Array.isArray(s.previewMembers) ? s.previewMembers : [];
  const players = preview.map((m, idx) => {
    const userId = toStr(m?.userId || m?.uid || m?.id) || `unknown-${idx}`;
    const nickname = toStr(m?.nickname || m?.name) || "선수";
    const mainPosition = toStr(m?.mainPosition || m?.position || m?.pos) || "";
    const heightCm = m?.heightCm != null ? safeNum(m.heightCm, null) : null;
    const weightKg = m?.weightKg != null ? safeNum(m.weightKg, null) : null;
    const photoUrl = toStr(m?.photoUrl || m?.avatarUrl || m?.profileUrl);
    return { userId, nickname, mainPosition, heightCm, weightKg, photoUrl };
  });

  return {
    id: toStr(s.id),
    matchSizeKey: toStr(s.matchSizeKey),
    memberCount: safeNum(s.memberCount, players.length),
    players,
  };
}

export function adaptMatchRequestToRoom(docId, data) {
  const d = data || {};
  const rawStatus = toStr(d.status);

  const field = d.field && typeof d.field === "object" ? d.field : null;
  const result = d.result && typeof d.result === "object" ? d.result : null;

  return {
    id: docId,
    status: rawStatus || "accepted",
    rawStatus,

    actorClubId: toStr(d.actorClubId),
    targetClubId: toStr(d.targetClubId),

    scheduledAt: d.scheduledAt || null,

    proposedByClubId: toStr(d.proposedByClubId),
    confirmedByClubId: toStr(d.confirmedByClubId),

    field,
    fieldAddress: toStr(field?.address || d.fieldAddress || ""),
    fieldLat: field?.lat != null ? Number(field.lat) : null,
    fieldLng: field?.lng != null ? Number(field.lng) : null,

    myTeam: normalizeTeamSnapshot(d.fromTeamSnapshot), // ✅ actor team
    oppTeam: normalizeTeamSnapshot(d.toTeamSnapshot), // ✅ target team
    myLineup: normalizeLineupSnapshot(d.fromLineupSnapshot),
    oppLineup: normalizeLineupSnapshot(d.toLineupSnapshot),

    // ✅ score SSOT: myScore=actorScore, oppScore=targetScore
    myScore: d.myScore ?? null,
    oppScore: d.oppScore ?? null,
    resultState: d.resultState || null,

    result: result || null,
    statsAppliedAt: d.statsAppliedAt || null,
  };
}

export async function loadMatchRoomDetail(matchRequestId) {
  const id = toStr(matchRequestId);
  if (!id) return { room: null };

  const ref = doc(db, "match_requests", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.warn("[matchRoomService] match_requests not found:", id);
    return { room: null };
  }

  const data = snap.data();
  const room = adaptMatchRequestToRoom(snap.id, data);
  return { room };
}

/* ========================= propose / confirm / cancel ========================= */

export async function proposeMatchSchedule({
  matchRequestId,
  scheduledAtISO,
  fieldAddress,
  fieldLatLng,
  proposedByClubId,
} = {}) {
  const id = toStr(matchRequestId);
  const iso = toStr(scheduledAtISO);
  const proposer = toStr(proposedByClubId);

  if (!id) throw new Error("proposeMatchSchedule: matchRequestId is required");
  if (!iso) throw new Error("proposeMatchSchedule: scheduledAtISO is required");
  if (!proposer) throw new Error("proposeMatchSchedule: proposedByClubId is required");

  const addr = toStr(fieldAddress);
  const lat = fieldLatLng && Number.isFinite(Number(fieldLatLng.lat)) ? Number(fieldLatLng.lat) : null;
  const lng = fieldLatLng && Number.isFinite(Number(fieldLatLng.lng)) ? Number(fieldLatLng.lng) : null;

  if (!addr) throw new Error("proposeMatchSchedule: fieldAddress is required");
  if (lat == null || lng == null) throw new Error("proposeMatchSchedule: fieldLatLng is required");

  const ref = doc(db, "match_requests", id);

  await updateDoc(ref, {
    status: "proposed",
    scheduledAt: iso,

    field: { address: addr, lat, lng },
    proposedByClubId: proposer,
    proposedAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function confirmProposedSchedule({ matchRequestId, confirmedByClubId } = {}) {
  const id = toStr(matchRequestId);
  const confirmer = toStr(confirmedByClubId);

  if (!id) throw new Error("confirmProposedSchedule: matchRequestId is required");
  if (!confirmer) throw new Error("confirmProposedSchedule: confirmedByClubId is required");

  const ref = doc(db, "match_requests", id);

  await updateDoc(ref, {
    status: "confirmed",
    confirmedByClubId: confirmer,
    confirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function cancelMatchRequest({ matchRequestId }) {
  const id = toStr(matchRequestId);
  if (!id) throw new Error("cancelMatchRequest: matchRequestId is required");

  const ref = doc(db, "match_requests", id);

  await updateDoc(ref, {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });

  return true;
}

/* ========================= result (submit) ========================= */

// ✅ 결과 제출 + 사진/코멘트 저장
// - files: File[] (이미지)
// - 저장: status는 confirmed 유지, resultState는 waiting_accept
export async function submitMatchResultWithMedia({
  matchRequestId,
  actorScore,
  targetScore,
  comment = "",
  files = [],
  submittedByClubId,
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);

  if (!id) throw new Error("submitMatchResultWithMedia: matchRequestId is required");
  if (!by) throw new Error("submitMatchResultWithMedia: submittedByClubId is required");

  const as = safeNum(actorScore, NaN);
  const ts = safeNum(targetScore, NaN);
  if (!Number.isFinite(as) || !Number.isFinite(ts)) throw new Error("submitMatchResultWithMedia: scores are required");

  const cleanComment = String(comment || "").trim();

  // ✅ 이미지 업로드(서비스에서 처리)
  const fileList = Array.isArray(files) ? files.filter(Boolean) : [];
  const uploadedUrls = [];

  if (fileList.length > 0) {
    const uploaded = await Promise.all(
      fileList.slice(0, 6).map(async (file) => {
        const res = await uploadCompressedImageMedia({
          scope: "match_requests",
          ownerId: id,
          file,
          kind: "result",
        });
        return res?.url || "";
      })
    );

    uploaded.forEach((u) => {
      const url = toStr(u);
      if (url) uploadedUrls.push(url);
    });
  }

  const ref = doc(db, "match_requests", id);

  await updateDoc(ref, {
    // score SSOT
    myScore: as,   // actorScore
    oppScore: ts,  // targetScore

    // ✅ confirmed 상태 유지(확정된 게임에서 결과 입력)
    status: "confirmed",
    resultState: "waiting_accept",

    result: {
      submittedByClubId: by,
      comment: cleanComment,
      photoUrls: uploadedUrls,
      submittedAt: serverTimestamp(),
    },

    updatedAt: serverTimestamp(),
  });

  return { ok: true, photoUrls: uploadedUrls };
}

/* ========================= result + stats (client transaction) ========================= */

// ✅ 결과 인정 + clubs.stats 트랜잭션 반영(중복 방지 statsAppliedAt)
// - 승인되면 status=finished 로 내려감 (지난 게임 탭)
export async function acceptMatchResult({ matchRequestId, confirmedByClubId } = {}) {
  const id = toStr(matchRequestId);
  const confirmer = toStr(confirmedByClubId);

  if (!id) throw new Error("acceptMatchResult: matchRequestId is required");
  if (!confirmer) throw new Error("acceptMatchResult: confirmedByClubId is required");

  const mrRef = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    const mrSnap = await tx.get(mrRef);
    if (!mrSnap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = mrSnap.data() || {};

    if (mr.statsAppliedAt) {
      tx.update(mrRef, {
        resultState: "confirmed",
        status: "finished",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const actorClubId = toStr(mr.actorClubId);
    const targetClubId = toStr(mr.targetClubId);
    if (!actorClubId || !targetClubId) throw new Error("팀 정보를 확인할 수 없습니다.");

    const actorScore = mr.myScore;
    const targetScore = mr.oppScore;

    if (!Number.isFinite(Number(actorScore)) || !Number.isFinite(Number(targetScore))) {
      throw new Error("점수 정보를 확인할 수 없습니다.");
    }

    const aScore = Number(actorScore);
    const tScore = Number(targetScore);

    let actorResult = "D";
    let targetResult = "D";

    if (aScore > tScore) {
      actorResult = "W";
      targetResult = "L";
    } else if (aScore < tScore) {
      actorResult = "L";
      targetResult = "W";
    }

    const actorRef = doc(db, "clubs", actorClubId);
    const targetRef = doc(db, "clubs", targetClubId);

    const [aClubSnap, tClubSnap] = await Promise.all([tx.get(actorRef), tx.get(targetRef)]);

    const aClub = aClubSnap.exists() ? aClubSnap.data() || {} : {};
    const tClub = tClubSnap.exists() ? tClubSnap.data() || {} : {};

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

    const aRecent = Array.isArray(aStats.recentResults) ? aStats.recentResults : [];
    const tRecent = Array.isArray(tStats.recentResults) ? tStats.recentResults : [];

    const nextARecent = [actorResult, ...aRecent].slice(0, 5);
    const nextTRecent = [targetResult, ...tRecent].slice(0, 5);

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
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    tx.update(mrRef, {
      resultState: "confirmed",
      status: "finished",
      resultAcceptedByClubId: confirmer,
      resultAcceptedAt: serverTimestamp(),
      statsAppliedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return true;
}

export async function disputeMatchResult({ matchRequestId }) {
  const id = toStr(matchRequestId);
  if (!id) throw new Error("disputeMatchResult: matchRequestId is required");

  const ref = doc(db, "match_requests", id);

  await updateDoc(ref, {
    resultState: "disputed",
    updatedAt: serverTimestamp(),
  });

  return true;
}
