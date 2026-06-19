// src/services/homeService.js
/* eslint-disable */

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  limit,
} from "firebase/firestore";
import { listPlayerRankingTopApprox } from "./rankingService";

let _countApiChecked = false;
let _getCountFromServer = null;

async function ensureCountApi() {
  if (_countApiChecked) return;
  _countApiChecked = true;
  try {
    const mod = await import("firebase/firestore");
    _getCountFromServer = mod.getCountFromServer || null;
  } catch (e) {
    _getCountFromServer = null;
  }
}

function logJson(label, obj) {
  try {
    console.log(label, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.log(label, obj);
  }
}

function safeNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

// ✅ 전체보기와 동일한 정렬 기준 (점수 → 승률 → 승수 → 경기수 → 이름)
function teamRankingComparator(a, b) {
  const sa = a?.stats || {};
  const sb = b?.stats || {};
  const winsA = safeNumber(sa.wins, 0);
  const lossA = safeNumber(sa.losses, 0);
  const drawA = safeNumber(sa.draws, 0);
  const winsB = safeNumber(sb.wins, 0);
  const lossB = safeNumber(sb.losses, 0);
  const drawB = safeNumber(sb.draws, 0);

  const pa = winsA * 5 + drawA * 2 + lossA * 1;
  const pb = winsB * 5 + drawB * 2 + lossB * 1;
  if (pb !== pa) return pb - pa;

  const totalA = winsA + lossA + drawA;
  const totalB = winsB + lossB + drawB;
  const wrA = totalA > 0 ? winsA / totalA : 0;
  const wrB = totalB > 0 ? winsB / totalB : 0;
  if (wrB !== wrA) return wrB - wrA;

  if (winsB !== winsA) return winsB - winsA;
  if (totalB !== totalA) return totalB - totalA;

  const na = String(a?.name || "").toLowerCase();
  const nb = String(b?.name || "").toLowerCase();
  if (na === nb) return 0;
  return na > nb ? 1 : -1;
}

// ✅ 경기 결과 1건을 W/L/D 로 정규화
function normalizeResultToken(x) {
  const v = String(x || "").trim().toUpperCase();
  if (v === "W" || v === "L" || v === "D") return v;
  if (v === "WIN") return "W";
  if (v === "LOSE" || v === "LOSS") return "L";
  if (v === "DRAW") return "D";
  if (v.includes("승")) return "W";
  if (v.includes("패")) return "L";
  if (v.includes("무")) return "D";
  return null;
}

// ✅ 연승(연속 승리) 계산
// - 데이터 소스: clubs/{id}.stats.recentResults (최신이 index 0, matchRoomService.computeNextStats 기준)
// - 가장 최근 경기부터 보며 '승'이 연속되는 동안 카운트, '패/무'를 만나면 중단
function computeWinStreak(recentResults) {
  const arr = Array.isArray(recentResults) ? recentResults : [];
  if (!arr.length) return 0;

  let count = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const cur = normalizeResultToken(arr[i]);
    if (cur === "W") {
      count += 1;
      continue;
    }
    // 패/무 또는 알 수 없는 값이면 중단
    break;
  }
  return count;
}

function calcWinRate(stats) {
  if (!stats) return 0;
  const winRate = safeNumber(stats.winRate, NaN);
  if (Number.isFinite(winRate)) return winRate;

  const wins = safeNumber(stats.wins, 0);
  const total = safeNumber(stats.totalMatches, 0);
  if (total <= 0) return 0;
  return wins / total;
}

function normalizeClubDoc(id, data) {
  const stats = data?.stats || {};
  const wins = safeNumber(stats.wins, 0);
  const losses = safeNumber(stats.losses, 0);
  const draws = safeNumber(stats.draws, 0);
  const totalMatches = safeNumber(stats.totalMatches, wins + losses + draws);
  const recentResults = Array.isArray(stats.recentResults) ? stats.recentResults : [];

  return {
    clubId: id,
    id,
    name: String(data?.name || "").trim(),
    description: String(data?.description || "").trim(),
    region: String(data?.region || "").trim(),
    regionSido: String(data?.regionSido || "").trim(),
    regionGu: String(data?.regionGu || "").trim(),
    tags: Array.isArray(data?.tags) ? data.tags.filter(Boolean) : [],
    logoUrl: data?.logoUrl || "",
    logoPath: data?.logoPath || "",
    ownerUid: data?.ownerUid || "",
    promo: data?.promo || null,
    media: Array.isArray(data?.media) ? data.media : [],
    stats: {
      wins,
      losses,
      draws,
      totalMatches,
      winRate: calcWinRate({ ...stats, wins, losses, draws, totalMatches }),
      recentResults,
    },
    createdAt: data?.createdAt || null,
    updatedAt: data?.updatedAt || null,
  };
}

async function getMembersCount(db, clubId) {
  if (!clubId) return 0;

  await ensureCountApi();

  const membersCol = collection(db, "clubs", clubId, "members");

  if (_getCountFromServer) {
    try {
      const snap = await _getCountFromServer(membersCol);
      return safeNumber(snap?.data()?.count, 0);
    } catch (e) {}
  }

  const docs = await getDocs(membersCol);
  return safeNumber(docs.size, 0);
}

async function safeGetUserDoc(db, uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

async function safeGetClubDoc(db, clubId) {
  if (!clubId) return null;
  const ref = doc(db, "clubs", clubId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeClubDoc(snap.id, snap.data());
}

async function listAllClubs(db) {
  const snap = await getDocs(collection(db, "clubs"));
  const rows = [];
  snap.forEach((d) => rows.push(normalizeClubDoc(d.id, d.data())));
  return rows;
}

/* =========================
 * Player ranking (임시 스코어 기반) + 로그
 * ========================= */

const SKILL_SCORE = {
  beginner: 1,
  amateur: 2,
  intermediate: 3,
  advanced: 4,
  pro: 5,
};

function calcPlayerScore(u) {
  const s = SKILL_SCORE[String(u?.skillLevel || "").trim()] || 0;
  const captain = u?.isTeamCaptain ? 0.4 : 0;
  const careersBonus =
    Array.isArray(u?.careers) && u.careers.length > 0 ? 0.2 : 0;
  return s + captain + careersBonus;
}

function normalizeUserForRanking(uid, data) {
  return {
    uid,
    userId: uid,
    nickname: String(data?.nickname || "").trim(),
    avatarUrl: data?.avatarUrl || "",
    mainPosition: data?.mainPosition || "",
    skillLevel: data?.skillLevel || "",
    heightCm: data?.heightCm ?? null,
    weightKg: data?.weightKg ?? null,
    isTeamCaptain : data?.isTeamCaptain,
    region: data?.region || "",
    regionSido: data?.regionSido || "",
    regionGu: data?.regionGu || "",
    careers: Array.isArray(data?.careers) ? data.careers : [],
    isTeamCaptain: !!data?.isTeamCaptain,
    activeTeamId: String(data?.activeTeamId || "").trim(),
  };
}

async function listUsersForRanking(db) {
  const qy = query(collection(db, "users"), limit(50));
  const snap = await getDocs(qy);

  const users = [];
  snap.forEach((d) => {
    users.push(normalizeUserForRanking(d.id, d.data()));
  });

  return users;
}

async function buildPlayerRankingTop5(db) {
  const users = await listUsersForRanking(db);

  // logJson("[homeService] users(sample-for-ranking)", users.slice(0, 2));

  const ranked = [...users]
    .map((u) => ({ ...u, _score: calcPlayerScore(u) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const clubIds = Array.from(
    new Set(ranked.map((u) => String(u?.activeTeamId || "").trim()).filter(Boolean))
  );

  const clubMap = {};

  await Promise.all(
    clubIds.map(async (cid) => {
      const c = await safeGetClubDoc(db, cid);
      if (c) clubMap[cid] = c;
    })
  );

  const rows = ranked.map((u, idx) => {
    const uid = String(u?.userId || "").trim();
    const clubId = String(u?.activeTeamId || "").trim();
    const club = clubId ? clubMap[clubId] : null;

    const ownerUid = String(club?.ownerUid || "").trim();

    // ✅ 팀장 판별: user 플래그가 있으면 우선, 없으면 club.ownerUid로 교차 체크
    const isTeamCaptain = u?.isTeamCaptain === true;

    return {
      rank: idx + 1,
      userId: uid,

      name: u.nickname || "사용자",
      nickname: u.nickname || "사용자",

      avatarUrl: u.avatarUrl || "",
      mainPosition: u.mainPosition || "",
      skillLevel: u.skillLevel || "",

      wins: 0,
      losses: 0,
      draws: 0,

      clubId,
      clubName: club?.name || "",
      clubLogoUrl: club?.logoUrl || "",

      // ✅ 추가
      isTeamCaptain,

      _score: u._score,
    };
  });

  return rows;
}

/**
 * ✅ Home 전용 데이터 로더 (DB SSOT)
 * - 내 팀 SSOT: users/{uid}.activeTeamId
 * - 즐겨찾기 SSOT: users/{uid}.favoriteTeamIds / favoritePlayerIds
 */
export async function loadHomePageData({ uid } = {}) {
  if (!uid) throw new Error("loadHomePageData: uid is required");

  const me = await safeGetUserDoc(db, uid);
  // logJson("[homeService] me(userDoc)", me);

  const activeTeamId = String(me?.activeTeamId || "").trim();
  // logJson("[homeService] activeTeamId", { activeTeamId, clubId: activeTeamId });

  const allClubs = await listAllClubs(db);

  // 내 팀
  let myTeam = null;
  let myTeamRank = null;

  if (activeTeamId) {
    myTeam = await safeGetClubDoc(db, activeTeamId);
    if (myTeam) {
      const memberCount = await getMembersCount(db, myTeam.clubId);
      myTeam = { ...myTeam, memberCount };

      const rankedTeams = [...allClubs].sort(teamRankingComparator);
      const idx = rankedTeams.findIndex((t) => t.clubId === myTeam.clubId);
      myTeamRank = idx >= 0 ? idx + 1 : null;
    }
  }

  // logJson("[homeService] myTeam(clubDoc)", myTeam);

  // 팀 랭킹 Top5 (전체보기와 동일 기준)
  const teamRankingTop5 = [...allClubs]
    .sort(teamRankingComparator)
    .slice(0, 5)
    .map((t, idx) => ({
      rank: idx + 1,
      clubId: t.clubId,
      name: t.name,
      region: t.region,
      regionSido: t.regionSido,
      regionGu: t.regionGu,
      logoUrl: t.logoUrl,
      winRate: t.stats?.winRate || 0,
      totalMatches: t.stats?.totalMatches || 0,
      wins: t.stats?.wins || 0,
      losses: t.stats?.losses || 0,
      draws: t.stats?.draws || 0,
    }));

  // ✅ 연승팀 하이라이트 (실데이터 recentResults 기반)
  // - 2연승 이상인 팀만, 연승 수 → 승률 순으로 정렬해서 최대 5팀
  const WIN_STREAK_MIN = 2;
  const winningTeamsHighlight = [...allClubs]
    .map((t) => ({
      team: t,
      winStreak: computeWinStreak(t.stats?.recentResults),
    }))
    .filter((x) => x.winStreak >= WIN_STREAK_MIN)
    .sort((a, b) => {
      if (b.winStreak !== a.winStreak) return b.winStreak - a.winStreak;
      return (b.team.stats?.winRate || 0) - (a.team.stats?.winRate || 0);
    })
    .slice(0, 5)
    .map(({ team, winStreak }) => ({
      rank: 0,
      clubId: team.clubId,
      id: team.clubId,
      name: team.name,
      region: team.region,
      regionSido: team.regionSido,
      regionGu: team.regionGu,
      logoUrl: team.logoUrl,
      winRate: team.stats?.winRate || 0,
      totalMatches: team.stats?.totalMatches || 0,
      wins: team.stats?.wins || 0,
      losses: team.stats?.losses || 0,
      draws: team.stats?.draws || 0,
      winStreak,
      streakLabel: `${winStreak}연승 중`,
    }));

  // 개인 랭킹 Top5
  // const playerRankingTop5 = await buildPlayerRankingTop5(db);


  const playerRankingTop5 = await listPlayerRankingTopApprox({
    top: 5,
    candidateSize: 200,
    debugLog: false,
  });

  // ✅ 즐겨찾기 로드
  const favoriteTeamIds = Array.isArray(me?.favoriteTeamIds)
    ? me.favoriteTeamIds.filter(Boolean).map(String)
    : [];

  const favoritePlayerIds = Array.isArray(me?.favoritePlayerIds)
    ? me.favoritePlayerIds.filter(Boolean).map(String)
    : [];

  const favoriteTeamsRaw = await Promise.all(
    favoriteTeamIds.slice(0, 30).map((cid) => safeGetClubDoc(db, cid))
  );

  const favoriteTeams = favoriteTeamsRaw
    .filter(Boolean)
    .map((t) => ({
      clubId: t.clubId,
      id: t.clubId,
      name: t.name,
      logoUrl: t.logoUrl,
      region: t.region,
      regionSido: t.regionSido,
      regionGu: t.regionGu,
      winRate: t.stats?.winRate || 0,
    }));

  const favoritePlayersRaw = await Promise.all(
    favoritePlayerIds.slice(0, 30).map((puid) => safeGetUserDoc(db, puid))
  );

  const favoritePlayers = favoritePlayersRaw
    .filter(Boolean)
    .map((u) => ({
      userId: u.uid,
      nickname: u.nickname || "",
      name: u.nickname || "",
      avatarUrl: u.avatarUrl || "",
      photoUrl: u.photoUrl || "",
      mainPosition: u.mainPosition || "",
      heightCm: u.heightCm ?? null,
      weightKg: u.weightKg ?? null,
      clubId: u.activeTeamId || "",
    }));

  // logJson("[homeService] favoriteTeamIds", favoriteTeamIds);
  // logJson("[homeService] favoritePlayerIds", favoritePlayerIds);

  return {
    myTeam,
    myTeamRank,
    winningTeamsHighlight,
    teamRankingTop5,
    playerRankingTop5,
    favoriteTeams,
    favoritePlayers,
  };
}

// ✅ 즐겨찾기만 최신화 (홈 진입 시마다 사용)
export async function loadHomeFavorites({ uid } = {}) {
  if (!uid) throw new Error("loadHomeFavorites: uid is required");

  const me = await safeGetUserDoc(db, uid);

  const favoriteTeamIds = Array.isArray(me?.favoriteTeamIds)
    ? me.favoriteTeamIds.filter(Boolean).map(String)
    : [];

  const favoritePlayerIds = Array.isArray(me?.favoritePlayerIds)
    ? me.favoritePlayerIds.filter(Boolean).map(String)
    : [];

  const favoriteTeamsRaw = await Promise.all(
    favoriteTeamIds.slice(0, 30).map((cid) => safeGetClubDoc(db, cid))
  );

  const favoriteTeams = favoriteTeamsRaw
    .filter(Boolean)
    .map((t) => ({
      clubId: t.clubId,
      id: t.clubId,
      name: t.name,
      logoUrl: t.logoUrl,
      region: t.region,
      regionSido: t.regionSido,
      regionGu: t.regionGu,
      winRate: t.stats?.winRate || 0,
    }));

  const favoritePlayersRaw = await Promise.all(
    favoritePlayerIds.slice(0, 30).map((puid) => safeGetUserDoc(db, puid))
  );

  const favoritePlayers = favoritePlayersRaw
    .filter(Boolean)
    .map((u) => ({
      userId: u.uid,
      nickname: u.nickname || "",
      name: u.nickname || "",
      avatarUrl: u.avatarUrl || "",
      photoUrl: u.photoUrl || "",
      mainPosition: u.mainPosition || "",
      heightCm: u.heightCm ?? null,
      weightKg: u.weightKg ?? null,
      clubId: u.activeTeamId || "",
    }));

  return { favoriteTeams, favoritePlayers };
}
