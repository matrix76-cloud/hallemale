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

  logJson("[homeService] users(sample-for-ranking)", users.slice(0, 2));

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

      const rankedTeams = [...allClubs].sort(
        (a, b) => (b.stats?.winRate || 0) - (a.stats?.winRate || 0)
      );
      const idx = rankedTeams.findIndex((t) => t.clubId === myTeam.clubId);
      myTeamRank = idx >= 0 ? idx + 1 : null;
    }
  }

  // logJson("[homeService] myTeam(clubDoc)", myTeam);

  // 팀 랭킹 Top5
  const teamRankingTop5 = [...allClubs]
    .sort((a, b) => (b.stats?.winRate || 0) - (a.stats?.winRate || 0))
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

  const winningTeamsHighlight = [...teamRankingTop5].slice(0, 5);

  // 개인 랭킹 Top5
  const playerRankingTop5 = await buildPlayerRankingTop5(db);

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
