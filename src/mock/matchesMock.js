/* eslint-disable */
// src/mock/matchesMock.js

import { TEAMS_BY_ID } from "./teamsMock";

/**
 * MatchDoc {
 *   id: string;
 *   homeTeamId: string;
 *   awayTeamId: string;         // 양 팀 모두 실제 팀 기준
 *   homeScore: number | null;   // 예정/취소 경기는 null
 *   awayScore: number | null;
 *   playedAt: string;           // ISO (경기 예정/진행 시간)
 *   status: "scheduled" | "finished" | "canceled";
 *   venue?: string;             // 경기 장소
 *   summary?: string;           // "4쿼터 역전승" 같은 한 줄 요약
 * }
 */

// ⬇️ 스크린샷 기준 예시 경기들
export const MATCHES = [
  // 1) 이미 지난 경기 — 청춘호랑이 vs 신촌샤크 (62:57 승)
  {
    id: "m_2025_12_13_cheongcho_shinchon",
    homeTeamId: "cheongcho_tigers",
    awayTeamId: "shinchon_sharks",
    homeScore: 62,
    awayScore: 57,
    playedAt: "2025-12-13T16:00:00+09:00",
    status: "finished",
    venue: "서울 강동구 공원",
    summary: "4쿼터 역전승",
  },
  // 2) 이미 지난 경기 — 청춘호랑이 vs 한강불독 (72:65 승)
  {
    id: "m_2025_12_04_cheongcho_hangang",
    homeTeamId: "cheongcho_tigers",
    awayTeamId: "hangang_bulldogs",
    homeScore: 72,
    awayScore: 65,
    playedAt: "2025-12-04T20:00:00+09:00",
    status: "finished",
    venue: "서울 강동구 공원",
    summary: "4쿼터 역전승",
  },
  // 3) 이미 지난 경기 — 청춘호랑이 vs 신촌샤크 (68:70 패)
  {
    id: "m_2025_11_20_cheongcho_shinchon",
    homeTeamId: "cheongcho_tigers",
    awayTeamId: "shinchon_sharks",
    homeScore: 68,
    awayScore: 70,
    playedAt: "2025-11-20T19:30:00+09:00",
    status: "finished",
    venue: "성북 체육관",
    summary: "접전 끝 한 점차 패배",
  },

  // 4) LI이언 vs 게스트 — 랭킹/최근 전적용 더미 경기
  {
    id: "m_2025_11_30_li_guest",
    homeTeamId: "li_lion",
    awayTeamId: "cheongcho_tigers",
    homeScore: 19,
    awayScore: 5,
    playedAt: "2025-11-30T16:00:00+09:00",
    status: "finished",
    venue: "서울 마포 실내 코트",
    summary: "전반부터 리드 유지",
  },
  // 5) 덕소독수리 vs 게스트
  {
    id: "m_2025_11_28_deokso_guest",
    homeTeamId: "deokso_eagles",
    awayTeamId: "hangang_bulldogs",
    homeScore: 20,
    awayScore: 8,
    playedAt: "2025-11-28T20:00:00+09:00",
    status: "finished",
    venue: "덕소 체육관",
    summary: "초반 리드 후 여유로운 승리",
  },
  // 6) 신촌샤크 vs 게스트
  {
    id: "m_2025_11_27_shinchon_guest",
    homeTeamId: "shinchon_sharks",
    awayTeamId: "li_lion",
    homeScore: 11,
    awayScore: 7,
    playedAt: "2025-11-27T19:30:00+09:00",
    status: "finished",
    venue: "신촌 실외 코트",
    summary: "로우 스코어 수비전",
  },
  // 7) 한강불독 vs 게스트
  {
    id: "m_2025_11_26_hangang_guest",
    homeTeamId: "hangang_bulldogs",
    awayTeamId: "deokso_eagles",
    homeScore: 9,
    awayScore: 11,
    playedAt: "2025-11-26T21:00:00+09:00",
    status: "finished",
    venue: "한강 야외 코트",
    summary: "막판 역전 허용",
  },

  // 8) 매칭 확정된 경기 — 청춘호랑이 vs LI이언 (12.12 16:00 예정)
  {
    id: "m_2025_12_12_cheongcho_li",
    homeTeamId: "cheongcho_tigers",
    awayTeamId: "li_lion",
    homeScore: null,
    awayScore: null,
    playedAt: "2025-12-12T16:00:00+09:00",
    status: "scheduled",
    venue: "서울 강동구 공원",
    summary: "친선 매칭 (예정)",
  },

  // 9) 취소된 매칭 — 청춘호랑이 vs 한강불독
  {
    id: "m_2025_12_10_cheongcho_hangang_canceled",
    homeTeamId: "cheongcho_tigers",
    awayTeamId: "hangang_bulldogs",
    homeScore: null,
    awayScore: null,
    playedAt: "2025-12-10T20:00:00+09:00",
    status: "canceled",
    venue: "서울 강동구 공원",
    summary: "취소된 매칭",
  },
];

export const MATCHES_BY_ID = MATCHES.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

// 완료된 경기만 필터 (이미 지난 게임 탭용 기본)
export const FINISHED_MATCHES = MATCHES.filter(
  (m) => m.status === "finished"
);

// 예정된 경기만 필터 (매칭 확정된 게임 탭용 기본)
export const SCHEDULED_MATCHES = MATCHES.filter(
  (m) => m.status === "scheduled"
);

/**
 * 팀별 최근 경기 한 줄 요약 (랭킹 카드 / 팀 프로필 "최근 팀전적"용)
 * - status === "finished" 인 경기만 사용
 * - home/away 모두 각 팀 입장에서 결과 계산
 */
export const RECENT_MATCH_BY_TEAM_ID = (() => {
  const map = {};

  FINISHED_MATCHES.forEach((m) => {
    const homeTeam = TEAMS_BY_ID[m.homeTeamId];
    const awayTeam = TEAMS_BY_ID[m.awayTeamId];
    if (!homeTeam || !awayTeam) return;

    const candidates = [
      {
        teamId: m.homeTeamId,
        teamName: homeTeam.name,
        scoreFor: m.homeScore,
        scoreAgainst: m.awayScore,
      },
      {
        teamId: m.awayTeamId,
        teamName: awayTeam.name,
        scoreFor: m.awayScore,
        scoreAgainst: m.homeScore,
      },
    ];

    candidates.forEach((c) => {
      if (c.scoreFor == null || c.scoreAgainst == null) return;

      let result = "draw";
      if (c.scoreFor > c.scoreAgainst) result = "win";
      else if (c.scoreFor < c.scoreAgainst) result = "lose";

      const prev = map[c.teamId];
      if (!prev || new Date(m.playedAt) > new Date(prev.playedAt)) {
        map[c.teamId] = {
          matchId: m.id,
          teamId: c.teamId,
          teamName: c.teamName,
          scoreLabel: `${c.scoreFor}:${c.scoreAgainst}`, // ex) "62:57"
          result, // "win" | "lose" | "draw"
          playedAt: m.playedAt,
          opponentTeamId:
            c.teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId,
        };
      }
    });
  });

  return map;
})();
