/* eslint-disable */
// src/services/matchingHomeService.js
// ✅ 매칭 홈(매칭하기) 실데이터 서비스
// SSOT: users/{uid}.activeTeamId (ClubContext에서 주입)
// - myTeam: teamService.getTeamProfile(activeTeamId)로 members까지 조립
// - opponentTeams: clubs 컬렉션에서 최신순 로드 후 내 팀 제외

import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { getAllClubDocs } from "./clubsSnapshot";
import { getTeamProfile } from "./teamService";
import { images } from "../utils/imageAssets";

function normalizeStats(stats) {
  const s = stats || {};
  const wins = typeof s.wins === "number" ? s.wins : 0;
  const losses = typeof s.losses === "number" ? s.losses : 0;
  const draws = typeof s.draws === "number" ? s.draws : 0;

  const totalMatches =
    typeof s.totalMatches === "number"
      ? s.totalMatches
      : wins + losses + draws;

  const winRate =
    typeof s.winRate === "number"
      ? s.winRate
      : totalMatches > 0
      ? wins / totalMatches
      : 0;

  const recentResults = Array.isArray(s.recentResults) ? s.recentResults : [];

  return {
    wins,
    losses,
    draws,
    totalMatches,
    winRate,
    recentResults,
  };
}

function toCreatedAtSec(data) {
  const c = data?.createdAt;
  if (!c) return 0;
  if (typeof c.seconds === "number") return c.seconds;
  if (typeof c.toMillis === "function") return Math.floor(c.toMillis() / 1000);
  return 0;
}

function resolveClubLogoUrl(club) {
  if (!club) return images.logo;
  if (club.logoUrl) return club.logoUrl;
  if (club.photoUrl) return club.photoUrl;
  if (club.logoKey && images[club.logoKey]) return images[club.logoKey];
  return images.logo;
}

function normalizeOpponentClubDoc(docSnap) {
  const data = docSnap?.data?.() ? docSnap.data() : docSnap || {};
  const clubId = docSnap?.id || data.clubId || data.id || "";

  const name = String(data.name || "").trim();
  const region =
    String(data.region || "").trim() ||
    `${String(data.regionSido || "").trim()}${
      String(data.regionSido || "").trim() && String(data.regionGu || "").trim()
        ? " "
        : ""
    }${String(data.regionGu || "").trim()}`.trim();

  const stats = normalizeStats(data.stats);

  return {
    clubId,
    id: clubId,
    name: name || "팀 이름 없음",
    region: region || "지역 미지정",
    regionSido: String(data.regionSido || "").trim(),
    regionGu: String(data.regionGu || "").trim(),
    logoUrl: resolveClubLogoUrl(data),
    logoKey: data.logoKey || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    stats,
  };
}

/**
 * 매칭 홈 데이터 로드 (실데이터)
 * @param {object} params
 * @param {string} params.activeTeamId - ClubContext의 activeTeamId (SSOT)
 */
export async function loadMatchingHomeData({
  activeTeamId = "",
} = {}) {
  const teamId = String(activeTeamId || "").trim();

  // ⚠️ orderBy("createdAt")로 쿼리하면 createdAt 필드가 없는 팀(스크립트/구버전 생성 등)이
  //    Firestore에서 조용히 제외되어 매칭 리스트에 안 보인다.
  //    → 랭킹(listAllTeamsForRanking)과 동일하게 전체를 가져와 클라이언트에서 최신순 정렬한다.
  //
  // 내 팀 조회와 서로 의존하지 않으므로 먼저 띄워 두고 병렬로 진행한다.
  const clubDocsPromise = getAllClubDocs();
  clubDocsPromise.catch(() => {}); // 아래에서 조기 return 해도 unhandled rejection 이 되지 않도록

  // ✅ 팀 없는 사용자(둘러보기): 내 팀 없이 전체 팀 목록만 반환
  let myTeam = null;
  if (teamId) {
    myTeam = await getTeamProfile(teamId);
    if (!myTeam) {
      return {
        myTeam: null,
        opponentTeams: [],
      };
    }
  }

  const clubDocs = await clubDocsPromise;

  const opponentTeams = clubDocs
    .map((d) => ({ club: normalizeOpponentClubDoc(d), createdAtSec: toCreatedAtSec(d.data()) }))
    .filter((x) => x.club && x.club.clubId && x.club.clubId !== teamId)
    .sort((a, b) => b.createdAtSec - a.createdAtSec) // 최신순 (createdAt 없으면 0 → 뒤로)
    .map((x) => x.club);

  return {
    myTeam,
    opponentTeams,
  };
}

/* ===========================
 * ✅ 팀별 멤버 수 집계 (clubs/{id}/members)
 * - AI 추천: 팀원 3명 이상(3대3 한 팀 구성 가능)인 팀만 노출하기 위해 사용
 * - getCountFromServer 집계 쿼리 우선, 미지원 시 getDocs.size 폴백
 * =========================== */

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

async function countClubMembers(clubId) {
  const cid = String(clubId || "").trim();
  if (!cid) return 0;

  const col = collection(db, "clubs", cid, "members");

  await ensureCountApi();
  if (_getCountFromServer) {
    try {
      const snap = await _getCountFromServer(col);
      return Number(snap?.data()?.count || 0);
    } catch (e) {
      // 집계 실패 시 아래 폴백
    }
  }

  const docs = await getDocs(col);
  return docs.size;
}

/**
 * 여러 팀의 멤버 수를 한 번에 조회
 * @param {string[]} clubIds
 * @returns {Promise<Map<string, number>>} clubId → 멤버 수
 */
export async function getClubMemberCounts(clubIds = []) {
  const ids = Array.from(
    new Set(
      (Array.isArray(clubIds) ? clubIds : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );

  const counts = await Promise.all(
    ids.map((id) => countClubMembers(id).catch(() => 0))
  );

  const map = new Map();
  ids.forEach((id, i) => map.set(id, counts[i]));
  return map;
}
