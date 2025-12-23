/* eslint-disable */
// src/services/playerService.js
// ✅ PlayerProfilePage 전용 "실데이터" 뷰 모델 서비스
// - SSOT(선수): users/{playerId}
// - SSOT(소속팀): users/{playerId}.activeTeamId  ("" = 무소속)
// - teamsMock / PLAYERS_BY_ID 제거
// - 페이지는 이 서비스 결과를 렌더링만 하도록 전환

import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { images } from "../utils/imageAssets";

/**
 * skillLevel 코드 → 레이블
 */
const SKILL_LEVEL_LABEL_MAP = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로",
};

/**
 * mainPosition 코드 → 레이블
 */
const POSITION_LABEL_MAP = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

/**
 * users/{uid} 로드
 */
async function loadUserById(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, uid: snap.id, ...snap.data() };
}

/**
 * clubs/{clubId} 로드
 */
async function loadClubById(clubId) {
  if (!clubId) return null;
  const ref = doc(db, "clubs", clubId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, clubId: snap.id, ...snap.data() };
}

/**
 * users.media → PlayerProfilePage에서 쓰기 편한 형태로 정리
 * - 여기서는 "추정" 안 하고, 들어온 형태를 최대한 유지
 * - url이 없으면 스킵
 */
function normalizeUserMedia(mediaArr) {
  if (!Array.isArray(mediaArr)) return [];

  const list = [];
  mediaArr.forEach((m, idx) => {
    const item = m || {};
    const url = typeof item.url === "string" ? item.url : "";
    if (!url) return;

    list.push({
      id: item.id || `m_${idx}`,
      type: item.type || "image", // image | youtube | video (프로젝트에서 쓰는 타입 유지)
      url,
      youtubeId: item.youtubeId || "",
      thumbnailUrl: item.thumbnailUrl || item.thumbUrl || "",
      title: item.title || item.caption || "",
      caption: item.caption || "",
      createdAt: item.createdAt || null,
    });
  });

  return list;
}

/**
 * ✅ PlayerProfilePage에서 사용하는 "실데이터 플레이어" 뷰모델
 * - playerId === users doc id
 */
export async function getPlayerProfile(playerId) {
  if (!playerId) return null;

  // 1) 선수(users)
  const u = await loadUserById(playerId);
  if (!u) return null;

  // 2) 소속팀(clubs) — SSOT: users.activeTeamId
  const activeTeamId = typeof u.activeTeamId === "string" ? u.activeTeamId : "";
  const hasTeam = !!activeTeamId && activeTeamId.trim().length > 0;

  const club = hasTeam ? await loadClubById(activeTeamId) : null;

  // 3) 라벨 가공
  const positionLabel = POSITION_LABEL_MAP[u.mainPosition] || null;
  const skillLabel = SKILL_LEVEL_LABEL_MAP[u.skillLevel] || null;

  // 4) 아바타/팀로고
  const avatarUrl = u.avatarUrl || images.playerDefaultAvatar || images.teamDefaultLogo || images.logo;
  const teamLogoUrl = club?.logoUrl || images.teamDefaultLogo || images.logo;

  // 5) PlayerProfilePage에서 쓰기 편하게 "player" 형태로 반환
  // - stats/recentMatches는 users에 아직 없으면 null/[]로 둔다 (추후 확장)
  const view = {
    // 기본
    userId: u.uid,
    uid: u.uid,
    id: u.uid,

    nickname: u.nickname || "(닉네임 없음)",
    photoUrl: avatarUrl,

    // 프로필
    region: u.region || "",
    regionSido: u.regionSido || "",
    regionGu: u.regionGu || "",

    mainPosition: u.mainPosition || null,
    mainPositionLabel: positionLabel, // 필요하면 사용
    skillLevel: u.skillLevel || null,
    skillLevelLabel: skillLabel, // 필요하면 사용

    heightCm: typeof u.heightCm === "number" ? u.heightCm : null,
    weightKg: typeof u.weightKg === "number" ? u.weightKg : null,

    intro: typeof u.intro === "string" ? u.intro : "",
    careers: Array.isArray(u.careers) ? u.careers : [],

    // 팀
    clubId: hasTeam ? activeTeamId : "",
    clubName: club?.name || "",
    clubRegion: club?.region || "",
    clubLogoUrl: teamLogoUrl,
    ownerUid: club?.ownerUid || "",

    // 팀장 여부(표시용)
    isTeamCaptain: u.isTeamCaptain === true,

    // 미디어
    media: normalizeUserMedia(u.media),

    // 전적/최근경기(현재 users에 없으면 비움)
    stats: u.stats || null,
    recentMatches: Array.isArray(u.recentMatches) ? u.recentMatches : [],

    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null,
  };

  return view;
}
