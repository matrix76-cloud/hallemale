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


export const images = {
  // 공용
  logo,
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
