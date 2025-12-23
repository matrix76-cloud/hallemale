/* eslint-disable */
// src/mock/playerDetailsMock.js

/**
 * PlayerDetail {
 *   userId: string;
 *   careers?: {
 *     date: string;   // 예: "2024년", "2023년 5월"
 *     title: string;  // 예: "17회 클럽리그 대회 1등"
 *   }[];
 *   highlights?: {
 *     id: string;
 *     type: "photo" | "video";
 *     thumbnailUrl: string;
 *     title: string;
 *   }[];
 * }
 */

export const PLAYER_DETAILS = {
  // 청춘호랑이 한주성 — 나의 프로필 화면 예시
  user_cheongcho_han_juseong: {
    userId: "user_cheongcho_han_juseong",
    careers: [
      {
        date: "2024년",
        title: "17회 클럽리그 대회 1등",
      },
      {
        date: "2023년",
        title: "동호회 3on3 대회 우승",
      },
      {
        date: "2022년",
        title: "대학 농구 리그 출전",
      },
    ],
    // 지금은 화면에 "추가 예정"이라 비워둠
    highlights: [],
  },

  // 예시: 덕소독수리 김도윤
  user_deokso_kim_doyun: {
    userId: "user_deokso_kim_doyun",
    careers: [
      {
        date: "2023년",
        title: "지역 동호회 리그 센터상 수상",
      },
      {
        date: "2022년",
        title: "직장인 5대5 리그 준우승",
      },
    ],
    highlights: [],
  },

  // 예시: LI이언 남효승
  user_lion_nam_hyoseung: {
    userId: "user_lion_nam_hyoseung",
    careers: [
      {
        date: "2024년",
        title: "실업팀 정규시즌 출전",
      },
      {
        date: "2021년",
        title: "전국 체전 농구 출전",
      },
    ],
    highlights: [],
  },
};

export const PLAYER_DETAILS_BY_ID = PLAYER_DETAILS;
