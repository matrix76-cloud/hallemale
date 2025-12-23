/* eslint-disable */
// src/services/matchingHomeService.js
// ✅ 매칭 홈(매칭하기) 실데이터 서비스
// SSOT: users/{uid}.activeTeamId (ClubContext에서 주입)
// - myTeam: teamService.getTeamProfile(activeTeamId)로 members까지 조립
// - opponentTeams: clubs 컬렉션에서 최신순 로드 후 내 팀 제외

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
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

  return {
    wins,
    losses,
    draws,
    totalMatches,
    winRate,
  };
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
 * @param {number} params.opponentLimit - 상대 팀 후보 로드 개수
 */
export async function loadMatchingHomeData({
  activeTeamId = "",
  opponentLimit = 60,
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

  const col = collection(db, "clubs");
  const qy = query(col, orderBy("createdAt", "desc"), limit(opponentLimit));
  const snap = await getDocs(qy);

  const opponentTeams = snap.docs
    .map((d) => normalizeOpponentClubDoc(d))
    .filter((t) => t && t.clubId && t.clubId !== teamId);

  return {
    myTeam,
    opponentTeams,
  };
}
