/* eslint-disable */
// src/services/matchingHomeService.js
// ✅ 매칭 홈(매칭하기) 실데이터 서비스
// SSOT: users/{uid}.activeTeamId (ClubContext에서 주입)
// - myTeam: teamService.getTeamProfile(activeTeamId)로 members까지 조립
// - opponentTeams: clubs 컬렉션에서 최신순 로드 후 내 팀 제외

import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
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

  if (!teamId) {
    return {
      myTeam: null,
      opponentTeams: [],
    };
  }

  const myTeam = await getTeamProfile(teamId);
  if (!myTeam) {
    return {
      myTeam: null,
      opponentTeams: [],
    };
  }

  // ⚠️ orderBy("createdAt")로 쿼리하면 createdAt 필드가 없는 팀(스크립트/구버전 생성 등)이
  //    Firestore에서 조용히 제외되어 매칭 리스트에 안 보인다.
  //    → 랭킹(listAllTeamsForRanking)과 동일하게 전체를 가져와 클라이언트에서 최신순 정렬한다.
  const col = collection(db, "clubs");
  const snap = await getDocs(col);

  const opponentTeams = snap.docs
    .map((d) => ({ club: normalizeOpponentClubDoc(d), createdAtSec: toCreatedAtSec(d.data()) }))
    .filter((x) => x.club && x.club.clubId && x.club.clubId !== teamId)
    .sort((a, b) => b.createdAtSec - a.createdAtSec) // 최신순 (createdAt 없으면 0 → 뒤로)
    .map((x) => x.club);

  return {
    myTeam,
    opponentTeams,
  };
}
