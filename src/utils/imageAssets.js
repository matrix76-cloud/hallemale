// src/utils/imageAssets.js
// 앞으로 모든 이미지 import는 여기서만 하고
// 나머지 컴포넌트는 이 모듈만 참조하게 간다.

/* 기본 공용 이미지 */
import logo from "../assets/images/logo.png";
import welcomeHero from "../assets/images/welcome-hero.png";
import signupSuccess from "../assets/images/signupsuccess.png";
// 필요하면 추후 기본 프로필 이미지도 추가
// import profileDefault from "../assets/images/profile_default.png";

/* =========================
 * 팀 로고 – TEAMS.logoKey 와 1:1 매칭
 * 파일 위치:
 *   src/assets/teams/logo_cheongcho_tigers.png
 *   src/assets/teams/logo_deokso_eagles.png
 *   src/assets/teams/logo_li_lion.png
 *   src/assets/teams/logo_shinchon_sharks.png
 *   src/assets/teams/logo_hangang_bulldogs.png
 * ========================= */

import logoCheongchoTigers from "../assets/teams/logo_cheongcho_tigers.png";
import logoDeoksoEagles from "../assets/teams/logo_deokso_eagles.png";
import logoLiLion from "../assets/teams/logo_li_lion.png";
import logoShinchonSharks from "../assets/teams/logo_shinchon_sharks.png";
import logoHangangBulldogs from "../assets/teams/logo_hangang_bulldogs.png";

/* =========================
 * 선수 아바타
 * ⚠️ 초상권: 실제 인물 얼굴 사진(src/assets/players/user_*.png)은
 *   초상권 리스크 차단을 위해 전면 미사용 처리함.
 *   playerAvatars 매핑은 비워 두고, 소비 측은 images.logo 로 폴백.
 *   (mock 구조/필드는 유지 — photoUrl/avatarUrl 폴백 체인이 처리)
 * ========================= */



import teamIntroIcon from "../assets/teams/teamIntroIcon.png";
import teamStatsIcon from "../assets/teams/teamStatsIcon.png";
import teamMembersIcon from "../assets/teams/teamMembersIcon.png";
import teamRecruitIcon from "../assets/teams/teamRecruitIcon.png";
import teamHighlightIcon from "../assets/teams/teamHighlightIcon.png";
import teamMediaIcon from "../assets/teams/teamMediaIcon.png";

// 초상권: 실제 인물 경기 샘플 사진(sampleplay1/2) 미사용 + 제거.


import homeBanner1 from "../assets/images/home-banner-1.png";
import homeBanner2 from "../assets/images/home-banner-2.png";
import homeBanner3 from "../assets/images/home-banner-3.png";
import homeBanner4 from "../assets/images/home-banner-4.png";

import teamActionManage from "../assets/images/teamActionManage.png";
import teamActionPool from "../assets/images/teamActionPool.png";

/* 3D 오브젝트 (Microsoft Fluent Emoji · MIT) — 밋밋함 완화용 */
import emoji3dBasketball from "../assets/images/emoji3d/basketball.png";
import emoji3dTrophy from "../assets/images/emoji3d/trophy.png";
import emoji3dParty from "../assets/images/emoji3d/party.png";
import emoji3dClap from "../assets/images/emoji3d/clap.png";
import emoji3dFire from "../assets/images/emoji3d/fire.png";
import emoji3dSparkles from "../assets/images/emoji3d/sparkles.png";
import emoji3dSpeech from "../assets/images/emoji3d/speech.png";
import emoji3dCheck from "../assets/images/emoji3d/check.png";
import emoji3dFlag from "../assets/images/emoji3d/flag.png";
import emoji3dCross from "../assets/images/emoji3d/cross.png";
import emoji3dPeople from "../assets/images/emoji3d/people.png";
import emoji3dIdCard from "../assets/images/emoji3d/idcard.png";
import emoji3dGear from "../assets/images/emoji3d/gear.png";
import emoji3dWave from "../assets/images/emoji3d/wave.png";
import emoji3dCalendar from "../assets/images/emoji3d/calendar.png";
import emoji3dVs from "../assets/images/emoji3d/vs.png";
import emoji3dBarchart from "../assets/images/emoji3d/barchart.png";
import emoji3dPicture from "../assets/images/emoji3d/picture.png";
import emoji3dStar from "../assets/images/emoji3d/star.png";
import emoji3dShield from "../assets/images/emoji3d/shield.png";
import emoji3dFolder from "../assets/images/emoji3d/folder.png";


/* =========================
 * export 모음
 * ========================= */


import tabHomeActive from "../assets/btab/home_active.png";
import tabHomeInactive from "../assets/btab/home_inactive.png";
import tabMatchActive from "../assets/btab/match_active.png";
import tabMatchInactive from "../assets/btab/match_inactive.png";
import tabGymActive from "../assets/btab/gym_active.png";
import tabGymInactive from "../assets/btab/gym_inactive.png";
import tabMyActive from "../assets/btab/my_active.png";
import tabMyInactive from "../assets/btab/my_inactive.png";


import peopleMatch from "../assets/icons/people_match.png";
import pinRegion from "../assets/icons/pin_region.png";

import TeamProfilePage from "../assets/images/teamprofile.png";

import teamHeroBasket from "../assets/images/teamHeroBasket.png";


export const bottomTabIcons = {
  home: { active: tabHomeActive, inactive: tabHomeInactive },
  matchingmanage: { active: tabMatchActive, inactive: tabMatchInactive },
  community: { active: tabGymActive, inactive: tabGymInactive },
  my: { active: tabMyActive, inactive: tabMyInactive },
};


// ✅ 팀 로고 미등록 시 기본 placeholder (회색 둥근 사각형 + 그룹 아이콘) — data URI
const TEAM_PLACEHOLDER_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
  "<rect width='64' height='64' rx='16' fill='#eef0f4'/>" +
  "<g transform='translate(16,16) scale(1.33)' fill='#b8bfca'>" +
  "<path d='M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'/>" +
  "</g></svg>";

export const teamPlaceholder = `data:image/svg+xml,${encodeURIComponent(TEAM_PLACEHOLDER_SVG)}`;

/**
 * ✅ 팀 로고 표시용 헬퍼
 * - 실제 로고가 있으면 그대로, 없거나(빈값) 기본 앱 로고(crown)면 그룹 placeholder 반환
 * - 사용: teamLogoSrc(team.logoUrl) 또는 teamLogoSrc(team.logoUrl || images[team.logoKey])
 */
export const teamLogoSrc = (candidate) => {
  const u = String(candidate || "").trim();
  if (u && u !== logo) return u;
  return teamPlaceholder;
};

export const images = {
  // 공용
  logo,
  teamPlaceholder,
  welcomeHero,
  signupSuccess,
  // profileDefault,
  peopleMatch,
  pinRegion,

  // 팀 로고 (TEAMS.logoKey 로 접근)
  logo_cheongcho_tigers: logoCheongchoTigers,
  logo_deokso_eagles: logoDeoksoEagles,
  logo_li_lion: logoLiLion,
  logo_shinchon_sharks: logoShinchonSharks,
  logo_hangang_bulldogs: logoHangangBulldogs,
  homeBanner1,
  homeBanner2,
  homeBanner3,
  homeBanner4,
  teamActionManage,
  teamActionPool,
  // 3D 오브젝트 (Fluent Emoji · MIT)
  emoji3dBasketball,
  emoji3dTrophy,
  emoji3dParty,
  emoji3dClap,
  emoji3dFire,
  emoji3dSparkles,
  emoji3dSpeech,
  emoji3dCheck,
  emoji3dFlag,
  emoji3dCross,
  emoji3dPeople,
  emoji3dIdCard,
  emoji3dGear,
  emoji3dWave,
  emoji3dCalendar,
  emoji3dVs,
  emoji3dBarchart,
  emoji3dPicture,
  emoji3dStar,
  emoji3dShield,
  emoji3dFolder,
  TeamProfilePage,
  teamHeroBasket,
  teamIntroIcon,
  teamStatsIcon,
  teamHighlightIcon,
  teamMembersIcon,
  teamRecruitIcon,
  teamMediaIcon,
  playerHeroBasket: require("../assets/players/player-hero-basket.png"), // 녹색 히어로 우측 일러스트
  playerInfoIcon: require("../assets/players/player-info.png"),          // 기본 정보 아이콘
  playerStatsIcon: require("../assets/players/player-stats.png"),        // 플레이 스타일/스탯
  playerRecordIcon: require("../assets/players/player-stats.png"),        // 플레이 스타일/스탯
  playerCareerIcon: require("../assets/players/player-career.png"),      // (PlayerCareerSection 안에서 쓰고 싶으면)
  playerTeamsIcon: require("../assets/players/player-teams.png"),        // 소속 팀

};

/**
 * 선수 아바타 매핑
 * - key: TEAMS.players[user].userId
 * - value: 해당 이미지 import
 *
 * ⚠️ 초상권: 실제 인물 얼굴 사진 매핑을 전면 제거함.
 *   소비 측은 `playerAvatars[uid] || images.logo` 로 자동 폴백되어
 *   화면이 깨지지 않음. (구조는 유지 — 추후 안전한 이미지로 다시 매핑 가능)
 *
 * 사용 예:
 *   const avatarSrc = playerAvatars[player.userId] || images.logo;
 */
export const playerAvatars = {};
