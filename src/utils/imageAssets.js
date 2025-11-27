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
 * 선수 아바타 – TEAMS.players.userId 와 매칭
 * 파일 위치 예시:
 *   src/assets/players/user_cheongcho_han_juseong.png
 *   ...
 * ========================= */

/* 청춘호랑이 */
import avatarUserCheongchoHanJuseong from "../assets/players/user_cheongcho_han_juseong.png";
import avatarUserCheongchoMoonGyeongbin from "../assets/players/user_cheongcho_moon_gyeongbin.png";
import avatarUserCheongchoKimMinjun from "../assets/players/user_cheongcho_kim_minjun.png";
import avatarUserCheongchoKimGiyong from "../assets/players/user_cheongcho_kim_giyong.png";
import avatarUserCheongchoLeeSeonwoo from "../assets/players/user_cheongcho_lee_seonwoo.png";

/* 덕소독수리 */
import avatarUserDeoksoKimDoyun from "../assets/players/user_deokso_kim_doyun.png";
import avatarUserDeoksoKimDongcheon from "../assets/players/user_deokso_kim_dongcheon.png";
import avatarUserDeoksoJeongHwan from "../assets/players/user_deokso_jeong_hwan.png";
import avatarUserDeoksoByunYumin from "../assets/players/user_deokso_byun_yumin.png";
import avatarUserDeoksoKwonHyeokju from "../assets/players/user_deokso_kwon_hyeokju.png";

/* LI이언 */
import avatarUserLionNamHyoseung from "../assets/players/user_lion_nam_hyoseung.png";
import avatarUserLionLeeSangjun from "../assets/players/user_lion_lee_sangjun.png";
import avatarUserLionSeoJun from "../assets/players/user_lion_seo_jun.png";
import avatarUserLionOhSeungeob from "../assets/players/user_lion_oh_seungeob.png";
import avatarUserLionShinJongmin from "../assets/players/user_lion_shin_jongmin.png";

/* 신촌샤크 */
import avatarUserShinchonParkJunyoung from "../assets/players/user_shinchon_park_junyoung.png";
import avatarUserShinchonLeeJaehun from "../assets/players/user_shinchon_lee_jaehun.png";
import avatarUserShinchonKimHayoung from "../assets/players/user_shinchon_kim_hayoung.png";
import avatarUserShinchonChoiMinhyuk from "../assets/players/user_shinchon_choi_minhyuk.png";
import avatarUserShinchonJungNayeon from "../assets/players/user_shinchon_jung_nayeon.png";

/* 한강불독 */
import avatarUserBulldogsKangTaehyun from "../assets/players/user_bulldogs_kang_taehyun.png";
import avatarUserBulldogsYoonSungmin from "../assets/players/user_bulldogs_yoon_sungmin.png";
import avatarUserBulldogsHanJiyoon from "../assets/players/user_bulldogs_han_jiyoon.png";
import avatarUserBulldogsSongWoojin from "../assets/players/user_bulldogs_song_woojin.png";
import avatarUserBulldogsChoMinseo from "../assets/players/user_bulldogs_cho_minseo.png";


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

export const bottomTabIcons = {
  home: { active: tabHomeActive, inactive: tabHomeInactive },
  matching: { active: tabMatchActive, inactive: tabMatchInactive },
  gym: { active: tabGymActive, inactive: tabGymInactive },
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
  teamActionPool

};

/**
 * 선수 아바타 매핑
 * - key: TEAMS.players[user].userId
 * - value: 해당 이미지 import
 *
 * 사용 예:
 *   const avatarSrc = playerAvatars[player.userId] || images.profileDefault;
 */
export const playerAvatars = {
  /* 청춘호랑이 */
  user_cheongcho_han_juseong: avatarUserCheongchoHanJuseong,
  user_cheongcho_moon_gyeongbin: avatarUserCheongchoMoonGyeongbin,
  user_cheongcho_kim_minjun: avatarUserCheongchoKimMinjun,
  user_cheongcho_kim_giyong: avatarUserCheongchoKimGiyong,
  user_cheongcho_lee_seonwoo: avatarUserCheongchoLeeSeonwoo,

  /* 덕소독수리 */
  user_deokso_kim_doyun: avatarUserDeoksoKimDoyun,
  user_deokso_kim_dongcheon: avatarUserDeoksoKimDongcheon,
  user_deokso_jeong_hwan: avatarUserDeoksoJeongHwan,
  user_deokso_byun_yumin: avatarUserDeoksoByunYumin,
  user_deokso_kwon_hyeokju: avatarUserDeoksoKwonHyeokju,

  /* LI이언 */
  user_lion_nam_hyoseung: avatarUserLionNamHyoseung,
  user_lion_lee_sangjun: avatarUserLionLeeSangjun,
  user_lion_seo_jun: avatarUserLionSeoJun,
  user_lion_oh_seungeob: avatarUserLionOhSeungeob,
  user_lion_shin_jongmin: avatarUserLionShinJongmin,

  /* 신촌샤크 */
  user_shinchon_park_junyoung: avatarUserShinchonParkJunyoung,
  user_shinchon_lee_jaehun: avatarUserShinchonLeeJaehun,
  user_shinchon_kim_hayoung: avatarUserShinchonKimHayoung,
  user_shinchon_choi_minhyuk: avatarUserShinchonChoiMinhyuk,
  user_shinchon_jung_nayeon: avatarUserShinchonJungNayeon,

  /* 한강불독 */
  user_bulldogs_kang_taehyun: avatarUserBulldogsKangTaehyun,
  user_bulldogs_yoon_sungmin: avatarUserBulldogsYoonSungmin,
  user_bulldogs_han_jiyoon: avatarUserBulldogsHanJiyoon,
  user_bulldogs_song_woojin: avatarUserBulldogsSongWoojin,
  user_bulldogs_cho_minseo: avatarUserBulldogsChoMinseo,
};
