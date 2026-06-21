/* eslint-disable */
// src/services/matchRoomService.js
// ✅ 실데이터 버전 (match_requests 기반)
// - ✅ SSOT: pending/accepted/proposed/confirmed/cancelled/finished
// - ✅ 결과 흐름:
//   - submitResult: status=confirmed 유지 + resultState=waiting_accept (상대 승인 대기)
//   - acceptResult: resultState=confirmed + status=finished + clubs.stats + users.stats 트랜잭션 반영(중복 방지)
// - ✅ 사진/코멘트: match_requests.result.{comment, photoUrls, submittedByClubId, submittedAt} 저장

import { db, auth } from "./firebase";
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
  orderBy,
  startAfter,
  documentId,
  addDoc,
} from "firebase/firestore";
import { uploadCompressedImageMedia } from "./mediaService";
import { getUserProfileByUid } from "./userService";

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

function uniqStr(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    const v = toStr(x);
    if (!v) return;
    if (seen.has(v)) return;
    seen.add(v);
    out.push(v);
  });
  return out;
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

/* ========================= lineup helpers (SSOT) ========================= */

function parseMatchSizeKeyToLimit(matchSizeKey) {
  const k = toStr(matchSizeKey).toLowerCase();
  const m = k.match(/^(\d+)\s*v\s*\d+$/);
  if (m && m[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.min(Math.max(n, 1), 20);
  }
  return null;
}

function pickPreviewMembersFromUsers(usersById, memberIds, limit) {
  const ids = Array.isArray(memberIds) ? memberIds : [];
  const take = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : ids.length;

  const out = [];
  for (let i = 0; i < ids.length && out.length < take; i += 1) {
    const uid = toStr(ids[i]);
    if (!uid) continue;
    const u = usersById[uid] || null;
    if (!u) {
      out.push({
        userId: uid,
        nickname: "선수",
        photoUrl: "",
        mainPosition: "",
      });
      continue;
    }
    out.push({
      userId: uid,
      nickname: toStr(u.nickname) || "선수",
      photoUrl: toStr(u.avatarUrl),
      mainPosition: toStr(u.mainPosition),
    });
  }
  return out;
}

/**
 * ✅ 라인업 스냅샷 정합성 강제(저장 시 사용)
 * - memberIds SSOT
 * - memberCount = memberIds.length
 * - previewMembers = memberIds 기준(최대 matchSize 인원)
 *
 * @param {object} args
 * @param {string[]} args.memberIds
 * @param {string} args.matchSizeKey
 * @param {object} args.usersById  // { [uid]: usersDocData }
 * @param {string} args.id
 * @param {string} args.name
 */
export function buildLineupSnapshotSSOT({
  memberIds = [],
  matchSizeKey = "",
  usersById = {},
  id = "",
  name = "",
} = {}) {
  const ids = uniqStr(memberIds);
  const limit = parseMatchSizeKeyToLimit(matchSizeKey) || ids.length;

  const previewMembers = pickPreviewMembersFromUsers(usersById, ids, limit);

  return {
    id: toStr(id) || "",
    name: toStr(name) || "",
    matchSizeKey: toStr(matchSizeKey) || "",
    memberIds: ids,
    memberCount: ids.length,
    previewMembers,
  };
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
      durationMin: Number.isFinite(Number(mr?.durationMin)) ? Number(mr.durationMin) : null,

      proposedByClubId: toStr(mr?.proposedByClubId),
      confirmedByClubId: toStr(mr?.confirmedByClubId),

      field: mr?.field || null,
      fieldAddress: toStr(mr?.field?.address || mr?.fieldAddress || ""),
      fieldLat:
        mr?.field?.lat != null && Number.isFinite(Number(mr.field.lat)) ? Number(mr.field.lat) : null,
      fieldLng:
        mr?.field?.lng != null && Number.isFinite(Number(mr.field.lng)) ? Number(mr.field.lng) : null,

      // ✅ myScore=actorScore, oppScore=targetScore (문서 기준). 뷰어 기준 정렬은 iAmActor로.
      myScore: mr?.myScore ?? null,
      oppScore: mr?.oppScore ?? null,
      resultState: mr?.resultState ?? null,
      result: mr?.result || null,
      iAmActor,

      // 미확인 배지용
      lastActivityAt: mr?.lastActivityAt || null,
      lastSeenBy: mr?.lastSeenBy || {},

      myRecent,
      oppRecent,
    };
  });

  return { rooms, myTeam };
}

/**
 * ✅ 특정 선수(uid)가 "라인업에 실제로 참가한" 종료(finished) 경기만 반환
 * - clubId(선수의 소속 팀)의 finished 경기 중, 내 팀 라인업 memberIds에 uid가 포함된 것만 필터
 * - rooms는 선수 팀 관점으로 myTeam/oppTeam/myScore/oppScore 정렬 → TeamMatchHistorySection 그대로 사용 가능
 */
export async function loadPlayerFinishedMatches({ clubId, uid } = {}) {
  const myClubId = toStr(clubId);
  const myUid = toStr(uid);
  if (!myClubId || !myUid) return { rooms: [] };

  const col = collection(db, "match_requests");
  const qActor = query(col, where("actorClubId", "==", myClubId), limit(200));
  const qTarget = query(col, where("targetClubId", "==", myClubId), limit(200));
  const [snapA, snapB] = await Promise.all([getDocs(qActor), getDocs(qTarget)]);

  const rowsA = (snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  const rowsB = (snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  const merged = uniqById([...(rowsA || []), ...(rowsB || [])]);

  const finished = merged.filter((r) => toStr(r?.status) === "finished");

  // 라인업 참가 필터: 내 팀(actor/target) 라인업 스냅샷 memberIds에 uid 포함
  const participated = finished.filter((mr) => {
    const iAmActor = toStr(mr?.actorClubId) === myClubId;
    const snap = iAmActor ? mr?.fromLineupSnapshot : mr?.toLineupSnapshot;
    const ids = Array.isArray(snap?.memberIds) ? snap.memberIds.map((x) => toStr(x)) : [];
    return ids.includes(myUid);
  });

  // 정렬: 최신 경기 먼저
  const sorted = [...participated].sort((a, b) => {
    const ta = tsMs(a?.scheduledAt) || tsMs(a?.confirmedAt) || tsMs(a?.updatedAt) || tsMs(a?.createdAt);
    const tb = tsMs(b?.scheduledAt) || tsMs(b?.confirmedAt) || tsMs(b?.updatedAt) || tsMs(b?.createdAt);
    return tb - ta;
  });

  // 팀 요약(이름/로고)
  const teamIdSet = new Set();
  sorted.forEach((mr) => {
    const a = toStr(mr?.actorClubId);
    const t = toStr(mr?.targetClubId);
    if (a) teamIdSet.add(a);
    if (t) teamIdSet.add(t);
  });
  const teamMap = {};
  await runBatches(Array.from(teamIdSet), 24, async (cid) => {
    const team = await safeGetClubTeamSummary(cid);
    if (team) teamMap[cid] = team;
    return null;
  });

  const rooms = sorted.map((mr) => {
    const iAmActor = toStr(mr?.actorClubId) === myClubId;
    const myId = iAmActor ? toStr(mr?.actorClubId) : toStr(mr?.targetClubId);
    const oppId = iAmActor ? toStr(mr?.targetClubId) : toStr(mr?.actorClubId);

    const myFallbackSnap = iAmActor ? mr?.fromTeamSnapshot : mr?.toTeamSnapshot;
    const oppFallbackSnap = iAmActor ? mr?.toTeamSnapshot : mr?.fromTeamSnapshot;

    const myTeam = teamMap[myId] || buildFallbackTeamFromSnapshot(myFallbackSnap, myId);
    const oppTeam = teamMap[oppId] || buildFallbackTeamFromSnapshot(oppFallbackSnap, oppId);

    // 문서 myScore=actorScore, oppScore=targetScore → 선수 팀 관점으로 정렬
    const actorScore = mr?.myScore ?? null;
    const targetScore = mr?.oppScore ?? null;
    const myScore = iAmActor ? actorScore : targetScore;
    const oppScore = iAmActor ? targetScore : actorScore;

    return {
      id: toStr(mr?.id),
      myTeam,
      oppTeam,
      status: normalizeRoomStatus(mr?.status),
      scheduledAt: mr?.scheduledAt || null,
      myScore,
      oppScore,
      iAmActor,
    };
  });

  return { rooms };
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
    memberIds: Array.isArray(s.memberIds) ? s.memberIds.map((x) => toStr(x)).filter(Boolean) : [],
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
    durationMin: Number.isFinite(Number(d.durationMin)) ? Number(d.durationMin) : null,

    proposedByClubId: toStr(d.proposedByClubId),
    confirmedByClubId: toStr(d.confirmedByClubId),
    cancelledByClubId: toStr(d.cancelledByClubId),

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

/**
 * ✅ 선수 명단 보강
 * 라인업 스냅샷에 previewMembers가 없어 players가 비어있는 경우(과거/현재 데이터 공통),
 * 보존된 memberIds로 users 프로필을 조회해 players를 채운다.
 * - players가 이미 있으면 스냅샷(역사 보존) 값을 그대로 사용
 * - memberIds가 없으면 손대지 않음
 */
async function hydrateLineupPlayers(lineup) {
  if (!lineup) return lineup;
  const hasPlayers = Array.isArray(lineup.players) && lineup.players.length > 0;
  const ids = Array.isArray(lineup.memberIds) ? lineup.memberIds.filter(Boolean) : [];
  if (hasPlayers || ids.length === 0) return lineup;

  const profiles = await Promise.all(
    ids.map((uid) => getUserProfileByUid(uid).catch(() => null))
  );

  const players = profiles.map((u, idx) => {
    const id = toStr(ids[idx]);
    if (!u) {
      return { userId: id, nickname: "선수", mainPosition: "", heightCm: null, weightKg: null, photoUrl: "" };
    }
    return {
      userId: toStr(u.id || id),
      nickname: toStr(u.nickname || u.name) || "선수",
      mainPosition: toStr(u.mainPosition || u.position || ""),
      heightCm: u.heightCm != null ? safeNum(u.heightCm, null) : null,
      weightKg: u.weightKg != null ? safeNum(u.weightKg, null) : null,
      photoUrl: toStr(u.avatarUrl || u.photoUrl || u.profileUrl || ""),
    };
  });

  return { ...lineup, players, memberCount: lineup.memberCount || players.length };
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

  // 선수 명단이 비어있으면 memberIds로 보강 (기존/신규 매칭룸 모두 대응)
  const [myLineup, oppLineup] = await Promise.all([
    hydrateLineupPlayers(room.myLineup),
    hydrateLineupPlayers(room.oppLineup),
  ]);
  room.myLineup = myLineup;
  room.oppLineup = oppLineup;

  return { room };
}

/* ========================= propose / confirm / cancel ========================= */

/* ───── 매칭룸 이벤트 푸시 알림 (상대 팀장에게) ─────
   sendPushTick은 targetIds(uid)로 발송하므로 수신 팀의 ownerUid를 명시한다. */
async function notifyMatchRoomEvent({ matchId, recipientClubId, subType, type, title, body }) {
  try {
    const rid = toStr(recipientClubId);
    if (!rid || !toStr(matchId)) return;
    const clubSnap = await getDoc(doc(db, "clubs", rid));
    const ownerUid = toStr(clubSnap.exists() ? clubSnap.data()?.ownerUid : "");
    if (!ownerUid) return;

    await addDoc(collection(db, "notifications"), {
      kind: "match",
      subType,
      type,
      title,
      body,
      targetType: "USER",
      targetIds: [ownerUid],
      linkType: "match",
      linkTargetId: toStr(matchId),
      meta: { matchId: toStr(matchId), deepLink: `/match-roomdetail/${toStr(matchId)}` },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "match",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[matchRoom] notifyMatchRoomEvent failed:", e?.message || e);
  }
}

// matchId로 mr 읽어 actor/target 중 actorClubId가 아닌 쪽(상대) clubId 반환
async function getOpponentClubId(matchId, actingClubId) {
  try {
    const snap = await getDoc(doc(db, "match_requests", toStr(matchId)));
    if (!snap.exists()) return "";
    const mr = snap.data() || {};
    const a = toStr(mr.actorClubId);
    const t = toStr(mr.targetClubId);
    const acting = toStr(actingClubId);
    if (acting && acting === a) return t;
    if (acting && acting === t) return a;
    return "";
  } catch (e) {
    return "";
  }
}

// ── 매칭룸 미확인 배지: 상세 열람 시 "본 시각" 기록(배지 해제) ──
export async function markMatchRoomSeen({ matchRequestId, uid } = {}) {
  const id = toStr(matchRequestId);
  const u = toStr(uid || auth.currentUser?.uid);
  if (!id || !u) return;
  try {
    await updateDoc(doc(db, "match_requests", id), {
      [`lastSeenBy.${u}`]: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[match] markMatchRoomSeen failed:", e?.message || e);
  }
}

// 내 행동(제안/확정/취소/메시지)에 붙일 활동패치 — 상대에겐 새 알림, 나는 본 것으로 처리
function activityPatch() {
  const u = toStr(auth.currentUser?.uid);
  const patch = { lastActivityAt: serverTimestamp() };
  if (u) patch[`lastSeenBy.${u}`] = serverTimestamp();
  return patch;
}

export async function proposeMatchSchedule({
  matchRequestId,
  scheduledAtISO,
  fieldAddress,
  fieldLatLng,
  durationMin,
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

  const durMin = Number.isFinite(Number(durationMin)) ? Number(durationMin) : 120;

  await updateDoc(ref, {
    status: "proposed",
    scheduledAt: iso,

    field: { address: addr, lat, lng },
    durationMin: durMin,
    proposedByClubId: proposer,
    proposedAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
    ...activityPatch(),
  });

  // (1-13) 제의 알림 → 상대 팀장
  const oppForPropose = await getOpponentClubId(id, proposer);
  if (oppForPropose) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: oppForPropose,
      subType: "matchProposed",
      type: "match_proposed",
      title: "구장·일정 제안 도착",
      body: "상대팀이 구장·일정을 제안했어요. 확인하고 수락해 주세요.",
    });
  }

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
    ...activityPatch(),
  });

  // (1-13) 경기 확정 알림 → 제안했던 상대 팀장
  const oppForConfirm = await getOpponentClubId(id, confirmer);
  if (oppForConfirm) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: oppForConfirm,
      subType: "matchConfirmed",
      type: "match_confirmed",
      title: "경기 확정 🎉",
      body: "상대팀이 수락해 경기가 확정됐어요! 일정을 확인하세요.",
    });
  }

  return true;
}

export async function cancelMatchRequest({ matchRequestId, cancelledByClubId } = {}) {
  const id = toStr(matchRequestId);
  if (!id) throw new Error("cancelMatchRequest: matchRequestId is required");

  const ref = doc(db, "match_requests", id);

  const patch = {
    status: "cancelled",
    updatedAt: serverTimestamp(),
    ...activityPatch(),
  };
  // 누가 취소했는지 기록 (취소 화면 사유 표시용)
  const by = toStr(cancelledByClubId);
  if (by) patch.cancelledByClubId = by;

  await updateDoc(ref, patch);

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

  // ✅ 추가: 작성자 메타(선택)
  authorUid = "",
  authorName = "",
  authorRole = "", // "owner" | "member" 등 (선택)
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);

  const auid = toStr(authorUid);
  const aname = toStr(authorName);
  const arole = toStr(authorRole);

  if (!id) throw new Error("submitMatchResultWithMedia: matchRequestId is required");
  if (!by) throw new Error("submitMatchResultWithMedia: submittedByClubId is required");

  const as = safeNum(actorScore, NaN);
  const ts = safeNum(targetScore, NaN);
  if (!Number.isFinite(as) || !Number.isFinite(ts))
    throw new Error("submitMatchResultWithMedia: scores are required");

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
    myScore: as, // actorScore
    oppScore: ts, // targetScore

    // ✅ confirmed 상태 유지(확정된 게임에서 결과 입력)
    status: "confirmed",
    resultState: "waiting_accept",

    result: {
      submittedByClubId: by,

      // ✅ 작성자 메타 (있으면 저장, 없으면 빈값)
      authorUid: auid,
      authorName: aname,
      authorRole: arole,

      comment: cleanComment,
      photoUrls: uploadedUrls,
      submittedAt: serverTimestamp(),
    },

    updatedAt: serverTimestamp(),
  });

  // (1-13) 결과 입력 알림 → 상대 팀장 (확인/인정 요청)
  const oppForResult = await getOpponentClubId(id, by);
  if (oppForResult) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: oppForResult,
      subType: "matchResultSubmitted",
      type: "match_result_submitted",
      title: "경기 결과 입력됨",
      body: `상대팀이 경기 결과(${as} : ${ts})를 입력했어요. 확인하고 인정해 주세요.`,
    });
  }

  return { ok: true, photoUrls: uploadedUrls };
}

/* ========================= result + stats (client transaction) ========================= */

function normalizeRecentArray(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((x) => {
      const v = toStr(x).toUpperCase();
      if (v === "W" || v === "L" || v === "D") return v;
      return "";
    })
    .filter(Boolean)
    .slice(0, 5);
}

function computeNextStats(prevStats, nextResult) {
  const prev = prevStats && typeof prevStats === "object" ? prevStats : {};
  const wins = safeNum(prev.wins, 0) + (nextResult === "W" ? 1 : 0);
  const losses = safeNum(prev.losses, 0) + (nextResult === "L" ? 1 : 0);
  const draws = safeNum(prev.draws, 0) + (nextResult === "D" ? 1 : 0);
  const prevTotal = safeNum(prev.totalMatches, safeNum(prev.wins, 0) + safeNum(prev.losses, 0) + safeNum(prev.draws, 0));
  const totalMatches = prevTotal + 1;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;

  const recent = normalizeRecentArray(prev.recentResults);
  const recentResults = [nextResult, ...recent].slice(0, 5);

  return { wins, losses, draws, totalMatches, winRate, recentResults };
}

function extractMemberIdsStrict(lineupSnap, labelForLog) {
  const snap = lineupSnap && typeof lineupSnap === "object" ? lineupSnap : {};
  const ids = Array.isArray(snap.memberIds) ? snap.memberIds.map((x) => toStr(x)).filter(Boolean) : [];
  if (ids.length > 0) return uniqStr(ids);

  const preview = Array.isArray(snap.previewMembers) ? snap.previewMembers : [];
  const legacy = preview.map((m) => toStr(m?.userId || m?.uid || m?.id)).filter(Boolean);
  if (legacy.length > 0) {
    console.warn(
      `[matchRoomService][acceptMatchResult] lineup.memberIds missing -> using previewMembers as legacy source (${labelForLog}). ` +
        `PLEASE FIX lineup writer to always set memberIds.`
    );
    return uniqStr(legacy);
  }

  return [];
}

// ✅ 결과 인정 + clubs.stats + users.stats 트랜잭션 반영(중복 방지 statsAppliedAt)
// - 승인되면 status=finished 로 내려감 (지난 게임 탭)
export async function acceptMatchResult({ matchRequestId, confirmedByClubId } = {}) {
  const id = toStr(matchRequestId);
  const confirmer = toStr(confirmedByClubId);

  if (!id) throw new Error("acceptMatchResult: matchRequestId is required");
  if (!confirmer) throw new Error("acceptMatchResult: confirmedByClubId is required");

  const mrRef = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    // =========================
    // 0) READS (무조건 먼저 전부)
    // =========================
    const mrSnap = await tx.get(mrRef);
    if (!mrSnap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = mrSnap.data() || {};

    // 이미 적용된 케이스면 mr만 마무리(추가 READ 없음)
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

    // users.stats 업데이트 대상 uid 수집 (READ만)
    const fromLineup = mr.fromLineupSnapshot || null;
    const toLineup = mr.toLineupSnapshot || null;

    const actorMemberIds = extractMemberIdsStrict(fromLineup, "fromLineupSnapshot(actor)");
    const targetMemberIds = extractMemberIdsStrict(toLineup, "toLineupSnapshot(target)");

    if (!actorMemberIds.length || !targetMemberIds.length) {
      console.warn(
        "[matchRoomService][acceptMatchResult] memberIds missing/empty. " +
          "users.stats will be partially applied. " +
          "actorMemberIds=",
        actorMemberIds,
        "targetMemberIds=",
        targetMemberIds
      );
    }

    const allUserIds = uniqStr([...(actorMemberIds || []), ...(targetMemberIds || [])]);
    const userRefs = allUserIds.map((uid) => ({ uid, ref: doc(db, "users", uid) }));
    const userSnaps = await Promise.all(userRefs.map((x) => tx.get(x.ref)));

    const userDataById = {};
    for (let i = 0; i < userRefs.length; i += 1) {
      const uid = userRefs[i].uid;
      const snap = userSnaps[i];
      userDataById[uid] = snap && snap.exists() ? snap.data() || {} : null;
    }

    // =========================
    // 1) COMPUTE (메모리에서만)
    // =========================
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

    const aRecent = normalizeRecentArray(aStats.recentResults);
    const tRecent = normalizeRecentArray(tStats.recentResults);

    const nextARecent = [actorResult, ...aRecent].slice(0, 5);
    const nextTRecent = [targetResult, ...tRecent].slice(0, 5);

    // users별 next stats 계산도 메모리에서 미리
    const nextUserStatsById = {};
    actorMemberIds.forEach((uid) => {
      const u = userDataById[uid];
      const prevStats = u && typeof u === "object" ? u.stats : null;
      nextUserStatsById[uid] = {
        prevStats: prevStats && typeof prevStats === "object" ? prevStats : {},
        next: computeNextStats(prevStats, actorResult),
      };
    });
    targetMemberIds.forEach((uid) => {
      const u = userDataById[uid];
      const prevStats = u && typeof u === "object" ? u.stats : null;
      nextUserStatsById[uid] = {
        prevStats: prevStats && typeof prevStats === "object" ? prevStats : {},
        next: computeNextStats(prevStats, targetResult),
      };
    });

    // =========================
    // 2) WRITES (여기부터는 tx.get 절대 금지)
    // =========================

    // clubs.stats 업데이트
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

    // users.stats 업데이트
    allUserIds.forEach((uid) => {
      const pack = nextUserStatsById[uid];
      if (!pack) return;

      const uRef = doc(db, "users", uid);
      tx.set(
        uRef,
        {
          stats: {
            ...(pack.prevStats || {}),
            ...(pack.next || {}),
            updatedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    // match_requests 마무리
    tx.update(mrRef, {
      resultState: "confirmed",
      status: "finished",
      resultAcceptedByClubId: confirmer,
      resultAcceptedAt: serverTimestamp(),
      statsAppliedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // ✅ 결과 확정 알림 (양 팀)
  try {
    const mrSnap = await getDoc(mrRef);
    const mr = mrSnap.exists() ? mrSnap.data() || {} : {};
    const aClubId = toStr(mr.actorClubId);
    const tClubId = toStr(mr.targetClubId);
    const teamIds = [aClubId, tClubId].filter(Boolean);
    if (teamIds.length) {
      await addDoc(collection(db, "notifications"), {
        kind: "match",
        subType: "matchResultConfirmed",
        type: "match_result_confirmed",
        title: "경기 결과가 확정되었어요",
        body: "경기 결과가 양 팀 모두 확정되었습니다.",
        targetType: "TEAM",
        targetIds: teamIds,
        actorClubId: confirmer,
        linkType: "match",
        linkTargetId: id,
        meta: { matchId: id, deepLink: `/matchroom/${id}` },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: {},
      });
    }
  } catch (e) {
    console.warn("[match] result-confirmed notification failed:", e?.message || e);
  }

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

// ✅ 결과에 코멘트 추가(append)
// - 기존 result.comment 뒤에 구분선 + 새 코멘트가 붙음
export async function appendMatchResultComment({
  matchRequestId,
  comment = "",
  submittedByClubId,
  authorUid = "",
  authorName = "",
  authorRole = "",
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);
  const clean = String(comment || "").trim();

  if (!id) throw new Error("appendMatchResultComment: matchRequestId is required");
  if (!by) throw new Error("appendMatchResultComment: submittedByClubId is required");
  if (!clean) throw new Error("appendMatchResultComment: comment is required");

  const auid = toStr(authorUid);
  const aname = toStr(authorName);
  const arole = toStr(authorRole);

  const ref = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = snap.data() || {};
    const prevResult = mr.result && typeof mr.result === "object" ? mr.result : {};
    const prevComment = String(prevResult.comment || "").trim();

    const metaLine = `[추가 기록] ${aname ? aname : "참가자"} · ${by}`;
    const nextChunk = `${metaLine}\n${clean}`;

    const nextComment = prevComment ? `${prevComment}\n\n${nextChunk}` : nextChunk;

    tx.update(ref, {
      result: {
        ...prevResult,
        submittedByClubId: prevResult.submittedByClubId || by,
        authorUid: auid || prevResult.authorUid || "",
        authorName: aname || prevResult.authorName || "",
        authorRole: arole || prevResult.authorRole || "",
        comment: nextComment,
      },
      updatedAt: serverTimestamp(),
    });
  });

  return true;
}

// ✅ 결과에 사진 추가(append)
// - 기존 result.photoUrls 뒤에 업로드된 사진 URL을 덧붙임
export async function appendMatchResultPhotos({
  matchRequestId,
  files = [],
  submittedByClubId,
  authorUid = "",
  authorName = "",
  authorRole = "",
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);

  if (!id) throw new Error("appendMatchResultPhotos: matchRequestId is required");
  if (!by) throw new Error("appendMatchResultPhotos: submittedByClubId is required");

  const fileList = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!fileList.length) throw new Error("appendMatchResultPhotos: files are required");

  const auid = toStr(authorUid);
  const aname = toStr(authorName);
  const arole = toStr(authorRole);

  const uploadedUrls = [];
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

  const ref = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = snap.data() || {};
    const prevResult = mr.result && typeof mr.result === "object" ? mr.result : {};
    const prevUrls = Array.isArray(prevResult.photoUrls) ? prevResult.photoUrls : [];

    const nextUrls = [...prevUrls, ...uploadedUrls].slice(0, 30);

    tx.update(ref, {
      result: {
        ...prevResult,
        submittedByClubId: prevResult.submittedByClubId || by,
        authorUid: auid || prevResult.authorUid || "",
        authorName: aname || prevResult.authorName || "",
        authorRole: arole || prevResult.authorRole || "",
        photoUrls: nextUrls,
      },
      updatedAt: serverTimestamp(),
    });
  });

  return { ok: true, photoUrls: uploadedUrls };
}

/* ========================= finished feed helpers ========================= */
function mapFinishedDoc(d) {
  const data = d.data() || {};
  const fromTeam = data?.fromTeamSnapshot || {};
  const toTeam = data?.toTeamSnapshot || {};

  return {
    id: d.id,
    status: toStr(data?.status),

    actorClubId: toStr(data?.actorClubId),
    targetClubId: toStr(data?.targetClubId),

    scheduledAt: data?.scheduledAt || null,
    updatedAt: data?.updatedAt || null,

    fieldAddress: toStr(data?.field?.address || data?.fieldAddress || ""),

    actorScore: data?.myScore ?? null,
    targetScore: data?.oppScore ?? null,

    actorTeam: {
      clubId: toStr(fromTeam?.clubId || fromTeam?.id),
      name: toStr(fromTeam?.name) || "팀",
      logoUrl: toStr(fromTeam?.logoUrl || ""),
      region: toStr(fromTeam?.region),
      regionSido: toStr(fromTeam?.regionSido),
      regionGu: toStr(fromTeam?.regionGu),
    },
    targetTeam: {
      clubId: toStr(toTeam?.clubId || toTeam?.id),
      name: toStr(toTeam?.name) || "팀",
      logoUrl: toStr(toTeam?.logoUrl || ""),
      region: toStr(toTeam?.region),
      regionSido: toStr(toTeam?.regionSido),
      regionGu: toStr(toTeam?.regionGu),
    },

    result: data?.result && typeof data.result === "object" ? data.result : null,
  };
}

/* ========================= finished feed ========================= */
// ✅ finished 경기 피드
// - status == "finished"
// - clubId 지정 시: 해당 팀이 actor 또는 target 인 경기만 (두 쿼리 병합)
// - 미지정 시: 전체 (기존 동작)
export async function listFinishedMatchesPage({ pageSize = 20, cursor = null, clubId = "", debugLog = false } = {}) {
  const size = Number(pageSize);
  const take = Number.isFinite(size) && size > 0 ? Math.min(size, 50) : 20;
  const myClubId = toStr(clubId);

  const col = collection(db, "match_requests");

  // 내 팀 필터: actor/target 두 쿼리 병합 후 클라이언트 정렬
  if (myClubId) {
    const buildQ = (field) => {
      const base = [
        where("status", "==", "finished"),
        where(field, "==", myClubId),
        orderBy("updatedAt", "desc"),
        orderBy(documentId(), "desc"),
      ];
      const c = cursor?.[field];
      return c?.updatedAt && c?.id
        ? query(col, ...base, startAfter(c.updatedAt, c.id), limit(take))
        : query(col, ...base, limit(take));
    };

    try {
      const [snapA, snapT] = await Promise.all([getDocs(buildQ("actorClubId")), getDocs(buildQ("targetClubId"))]);
      const docsA = snapA?.docs || [];
      const docsT = snapT?.docs || [];

      const seen = new Set();
      const merged = [];
      [...docsA, ...docsT].forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        merged.push(d);
      });

      // updatedAt desc 정렬
      merged.sort((a, b) => {
        const ua = a.data()?.updatedAt || "";
        const ub = b.data()?.updatedAt || "";
        if (ua === ub) return a.id < b.id ? 1 : -1;
        return ua < ub ? 1 : -1;
      });

      const sliced = merged.slice(0, take);
      const rows = sliced.map(mapFinishedDoc);

      const lastA = docsA[docsA.length - 1];
      const lastT = docsT[docsT.length - 1];
      const nextCursor =
        docsA.length < take && docsT.length < take
          ? null
          : {
              actorClubId: lastA ? { updatedAt: lastA.data()?.updatedAt || null, id: lastA.id } : null,
              targetClubId: lastT ? { updatedAt: lastT.data()?.updatedAt || null, id: lastT.id } : null,
            };

      return { rows, nextCursor };
    } catch (e) {
      const err = new Error(e?.message || "Firestore query failed");
      err.code = e?.code || "";
      throw err;
    }
  }

  const base = [
    where("status", "==", "finished"),
    orderBy("updatedAt", "desc"),
    orderBy(documentId(), "desc"),
  ];

  const qFinal =
    cursor && cursor.updatedAt && cursor.id
      ? query(col, ...base, startAfter(cursor.updatedAt, cursor.id), limit(take))
      : query(col, ...base, limit(take));

  const cursorLog = cursor ? { updatedAt: cursor.updatedAt || null, id: cursor.id || null } : null;

  console.groupCollapsed("[listFinishedMatchesPage] START");
  console.log("take:", take);
  console.log("cursor:", cursorLog);
  console.log("debugLog:", !!debugLog);
  console.groupEnd();

  const withTimeout = async (p, ms = 5000) => {
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`getDocs timeout after ${ms}ms`)), ms);
    });
    try {
      const res = await Promise.race([p, timeout]);
      return res;
    } finally {
      try {
        clearTimeout(t);
      } catch (e) {}
    }
  };

  try {
    console.log("[listFinishedMatchesPage] before getDocs");
    const snap = await withTimeout(getDocs(qFinal), 8000);
    console.log("[listFinishedMatchesPage] after getDocs");

    const docs = snap?.docs || [];
    console.log("[listFinishedMatchesPage] docs.length =", docs.length);

    if (docs[0]) {
      const d0 = docs[0];
      const data0 = d0.data() || {};
      console.log("[listFinishedMatchesPage] first.id:", d0.id);
      console.log("[listFinishedMatchesPage] first.status:", data0?.status);
      console.log("[listFinishedMatchesPage] first.updatedAt:", data0?.updatedAt);
    }

    if (debugLog) {
      console.groupCollapsed("[listFinishedMatchesPage] OK(detail)");
      console.log("take:", take);
      console.log("cursor:", cursorLog);
      console.log("docs.length:", docs.length);
      console.groupEnd();
    }

    const rows = docs.map(mapFinishedDoc);

    const last = docs[docs.length - 1] || null;
    const nextCursor = last ? { updatedAt: last.data()?.updatedAt || null, id: last.id } : null;

    console.log("[listFinishedMatchesPage] DONE -> rows:", rows.length, "nextCursor:", nextCursor);
    return { rows, nextCursor };
  } catch (e) {
    const code = e?.code || "";
    const msg = e?.message || String(e || "");

    console.groupCollapsed("[listFinishedMatchesPage] FAILED");
    console.log("code:", code);
    console.log("message:", msg);
    console.log("take:", take);
    console.log("cursor:", cursorLog);
    console.log("rawError:", e);
    console.groupEnd();

    const err = new Error(msg || "Firestore query failed");
    err.code = code;
    throw err;
  }
}
