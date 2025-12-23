/* eslint-disable */
import { TEAMS } from "./teamsMock";

/**
 * 임시 개인 랭킹 목업
 * - userId / clubId 는 TEAMS 에 실제 존재하는 값으로 맞춰서
 *   아바타/팀 로고가 정상적으로 나오도록 한다.
 */

// clubId → 팀 메타 맵
const clubMap = TEAMS.reduce((acc, team) => {
  acc[team.clubId] = team;
  return acc;
}, {});

// 헬퍼: 간단히 랭킹 라인 생성
const makeRankRow = ({
  userId,
  name,
  position,
  wins,
  losses,
  draws,
  clubId,
}) => {
  const club = clubMap[clubId] || {};
  return {
    userId,
    name,
    position,
    wins,
    losses,
    draws,
    clubId,
    clubName: club.name || "",
  };
};

export const PLAYER_RANKING = [
  // 1등: 청춘호랑이 한주성 (센터)
  makeRankRow({
    userId: "user_cheongcho_han_juseong",
    name: "한주성",
    position: "센터",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "cheongcho_tigers",
  }),
  // 2등: (더미 이름) 김주성 — 덕소 김동천 아바타 사용
  makeRankRow({
    userId: "user_deokso_kim_dongcheon",
    name: "김주성",
    position: "가드",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "cheongcho_tigers",
  }),
  // 3등: 김도윤 — 실제 user_deokso_kim_doyun 아바타 사용
  makeRankRow({
    userId: "user_deokso_kim_doyun",
    name: "김도윤",
    position: "포워드",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "cheongcho_tigers",
  }),
  // 4등: 신촌샤크 박준영(이름은 예전 더미 유지)
  makeRankRow({
    userId: "user_shinchon_park_junyoung",
    name: "한주성",
    position: "센터",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "shinchon_sharks",
  }),
  // 5등: 한강불독 강태현(이름도 예전 더미 유지)
  makeRankRow({
    userId: "user_bulldogs_kang_taehyun",
    name: "한주성",
    position: "센터",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "hangang_bulldogs",
  }),
];
