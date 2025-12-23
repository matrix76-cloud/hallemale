/* eslint-disable */
// src/mock/matchRequestsMock.js

import { TEAMS_BY_ID } from "./teamsMock";
import { MATCHES_BY_ID } from "./matchesMock";

/**
 * MatchRequestDoc {
 *   id: string;
 *   fromTeamId: string;   // 제안 보낸 팀
 *   toTeamId: string;     // 제안 받은 팀
 *   fromLineupId?: string;
 *
 *   status: "pending" | "accepted" | "rejected" | "canceled";
 *   createdAt: string;        // ISO
 *   updatedAt: string;        // ISO
 *   lastActionByTeamId?: string; // 수락/거절/취소한 팀
 *
 *   matchId?: string;         // status === "accepted" 인 경우, 실제 경기 id
 *   noteForTimeline?: string; // UI 한 줄 메모(타임라인용)
 * }
 */

export const MATCH_REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELED: "canceled",
};

/**
 * 예시 시나리오 (myTeamId = "cheongcho_tigers" 기준):
 *
 * 1) 덕소독수리 → 청춘호랑이
 *    - 받은 제안, 대기 중
 * 2) 청춘호랑이 → 한강불독
 *    - 상대가 거절함
 * 3) 청춘호랑이 → LI이언
 *    - 내가 보낸 제안, 대기 중
 */

export const MATCH_REQUESTS = [
  // 1. 받은 제안 (상대가 먼저 신청, 아직 대기)
  {
    id: "mr_001",
    fromTeamId: "deokso_eagles",
    toTeamId: "cheongcho_tigers",
    fromLineupId: "deokso_main",
    status: MATCH_REQUEST_STATUS.PENDING,
    createdAt: "2025-12-10T09:05:00+09:00",
    updatedAt: "2025-12-10T09:05:00+09:00",
    noteForTimeline: "상대가 신청함",
  },

  // 2. 내가 보냈던 제안을 상대가 거절한 상태
  {
    id: "mr_002",
    fromTeamId: "cheongcho_tigers",
    toTeamId: "hangang_bulldogs",
    fromLineupId: "cheongcho_main",
    status: MATCH_REQUEST_STATUS.REJECTED,
    createdAt: "2025-12-09T10:30:00+09:00",
    updatedAt: "2025-12-09T11:05:00+09:00",
    lastActionByTeamId: "hangang_bulldogs",
    noteForTimeline: "상대가 거절함",
  },

  // 3. 내가 보낸 제안, 상대 응답 대기중 (보낸 제안 탭에 노출)
  {
    id: "mr_003",
    fromTeamId: "cheongcho_tigers",
    toTeamId: "li_lion",
    fromLineupId: "cheongcho_main",
    status: MATCH_REQUEST_STATUS.PENDING,
    createdAt: "2025-12-10T10:05:00+09:00",
    updatedAt: "2025-12-10T10:05:00+09:00",
    noteForTimeline: "내가 신청함",
  },

  // 4. 과거에 수락되어 실제 경기까지 확정된 요청 (MATCHES와 연결)
  {
    id: "mr_004",
    fromTeamId: "cheongcho_tigers",
    toTeamId: "shinchon_sharks",
    fromLineupId: "cheongcho_main",
    status: MATCH_REQUEST_STATUS.ACCEPTED,
    createdAt: "2025-12-01T09:00:00+09:00",
    updatedAt: "2025-12-01T09:30:00+09:00",
    lastActionByTeamId: "shinchon_sharks",
    matchId: "m_2025_12_13_cheongcho_shinchon",
    noteForTimeline: "매칭 확정됨",
  },

  // 5. 내가 보냈다가 내가 취소한 요청
  {
    id: "mr_005",
    fromTeamId: "cheongcho_tigers",
    toTeamId: "deokso_eagles",
    fromLineupId: "cheongcho_practice",
    status: MATCH_REQUEST_STATUS.CANCELED,
    createdAt: "2025-12-08T09:00:00+09:00",
    updatedAt: "2025-12-08T09:20:00+09:00",
    lastActionByTeamId: "cheongcho_tigers",
    noteForTimeline: "내가 취소함",
  },
];

/**
 * 팀별로 보기 쉽게 맵 구성
 * - 한 요청은 fromTeam / toTeam 두 군데에 모두 들어감
 *   (받은 제안 / 보낸 제안 탭에서 공용으로 쓰기 위함)
 */
export const MATCH_REQUESTS_BY_TEAM_ID = MATCH_REQUESTS.reduce(
  (acc, req) => {
    const { fromTeamId, toTeamId } = req;
    if (!acc[fromTeamId]) acc[fromTeamId] = [];
    if (!acc[toTeamId]) acc[toTeamId] = [];

    acc[fromTeamId].push({ ...req, _direction: "sent" });
    acc[toTeamId].push({ ...req, _direction: "received" });

    return acc;
  },
  {}
);

/**
 * 프론트에서 카드 렌더링 시 쓸 수 있는 헬퍼용 스냅샷
 * (목업 단계에서만 사용. 실제 서비스에서는 백엔드에서 join 해서 내려줄 수도 있음)
 */
export const MATCH_REQUEST_VIEWS = MATCH_REQUESTS.map((req) => {
  const fromTeam = TEAMS_BY_ID[req.fromTeamId];
  const toTeam = TEAMS_BY_ID[req.toTeamId];

  return {
    ...req,
    fromTeam: fromTeam
      ? {
          id: fromTeam.id,
          name: fromTeam.name,
          region: fromTeam.region,
          logoKey: fromTeam.logoKey,
          wins: fromTeam.stats.wins,
          losses: fromTeam.stats.losses,
          winRate: fromTeam.stats.winRate,
          recentResults: fromTeam.recentResults || [],
        }
      : null,
    toTeam: toTeam
      ? {
          id: toTeam.id,
          name: toTeam.name,
          region: toTeam.region,
          logoKey: toTeam.logoKey,
          wins: toTeam.stats.wins,
          losses: toTeam.stats.losses,
          winRate: toTeam.stats.winRate,
          recentResults: toTeam.recentResults || [],
        }
      : null,
  };
});
