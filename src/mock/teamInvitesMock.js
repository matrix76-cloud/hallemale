/* eslint-disable */
// src/mock/teamInvitesMock.js
// 팀이 선수에게 보내는 초대(Invite) 목업

import {
  TEAMS_BY_ID,
  PLAYERS_BY_ID,
  PLAYER_PROFILES_BY_ID,
} from "./teamsMock";

/**
 * TeamInviteDoc {
 *   id: string;
 *   teamId: string;           // 초대 보낸 팀(clubId)
 *   playerUserId: string;     // 초대 받은 선수 userId
 *
 *   status: "pending" | "accepted" | "rejected" | "canceled";
 *   createdAt: string;        // ISO
 *   updatedAt: string;        // ISO
 *   lastActionBy?: "team" | "player"; // 마지막 액션 주체
 *
 *   message?: string;         // 초대 메세지
 * }
 */

export const TEAM_INVITE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELED: "canceled",
};

export const TEAM_INVITES = [
  // 1. 청춘호랑이 → 김도윤(덕소 센터) — 대기중 초대
  {
    id: "ti_001",
    teamId: "cheongcho_tigers",
    playerUserId: "user_deokso_kim_doyun",
    status: TEAM_INVITE_STATUS.PENDING,
    createdAt: "2025-12-10T09:30:00+09:00",
    updatedAt: "2025-12-10T09:30:00+09:00",
    lastActionBy: "team",
    message: "센터 포지션으로 함께 뛰어보실래요? 주말 경기 위주입니다 🙌",
  },

  // 2. 청춘호랑이 → 남효승(LI이언 센터) — 이미 수락된 초대
  {
    id: "ti_002",
    teamId: "cheongcho_tigers",
    playerUserId: "user_lion_nam_hyoseung",
    status: TEAM_INVITE_STATUS.ACCEPTED,
    createdAt: "2025-11-25T20:10:00+09:00",
    updatedAt: "2025-11-26T08:45:00+09:00",
    lastActionBy: "player",
    message: "스파링 위주로 함께 뛰어주실 실업 출신 빅맨을 찾고 있어요.",
  },

  // 3. 덕소독수리 → 이재훈(신촌샤크 가드) — 선수가 거절
  {
    id: "ti_003",
    teamId: "deokso_eagles",
    playerUserId: "user_shinchon_lee_jaehun",
    status: TEAM_INVITE_STATUS.REJECTED,
    createdAt: "2025-12-08T18:00:00+09:00",
    updatedAt: "2025-12-08T19:20:00+09:00",
    lastActionBy: "player",
    message: "하프코트 세트오펜스 좋아하시면 잘 맞을 것 같아요.",
  },

  // 4. 한강불독 → 김민준(청춘호랑이 가드) — 팀이 직접 취소한 초대
  {
    id: "ti_004",
    teamId: "hangang_bulldogs",
    playerUserId: "user_cheongcho_kim_minjun",
    status: TEAM_INVITE_STATUS.CANCELED,
    createdAt: "2025-12-07T21:00:00+09:00",
    updatedAt: "2025-12-07T21:30:00+09:00",
    lastActionBy: "team",
    message: "야간 하프코트 러닝 위주 팀입니다. 일정 변경으로 초대 취소되었습니다.",
  },
];

// 팀 기준 맵: 팀 관리 화면에서 "보낸 초대" 리스트용
export const TEAM_INVITES_BY_TEAM_ID = TEAM_INVITES.reduce((acc, inv) => {
  if (!acc[inv.teamId]) acc[inv.teamId] = [];
  acc[inv.teamId].push(inv);
  return acc;
}, {});

// 선수 기준 맵: 나중에 선수 마이페이지에서 "받은 팀 초대" 리스트용
export const TEAM_INVITES_BY_PLAYER_ID = TEAM_INVITES.reduce((acc, inv) => {
  if (!acc[inv.playerUserId]) acc[inv.playerUserId] = [];
  acc[inv.playerUserId].push(inv);
  return acc;
}, {});

/**
 * 뷰 모델: 팀/선수 스냅샷 합쳐서 바로 카드에 쓸 수 있는 형태
 * - 팀 관리 > 팀원 초대 상태 리스트
 * - (향후) 선수 마이페이지 > 받은 팀 초대 리스트
 */
export const TEAM_INVITE_VIEWS = TEAM_INVITES.map((inv) => {
  const team = TEAMS_BY_ID[inv.teamId];
  const player = PLAYERS_BY_ID[inv.playerUserId];
  const profile = PLAYER_PROFILES_BY_ID[inv.playerUserId];

  return {
    ...inv,
    team: team
      ? {
          id: team.id,
          name: team.name,
          region: team.region,
          logoKey: team.logoKey,
          wins: team.stats.wins,
          losses: team.stats.losses,
          winRate: team.stats.winRate,
          recentResults: team.recentResults || [],
        }
      : null,
    player: player
      ? {
          userId: player.userId,
          nickname: player.nickname,
          mainPosition: player.mainPosition,
          skillLevel: player.skillLevel,
          heightCm: player.heightCm,
          weightKg: player.weightKg,
          clubId: player.clubId,
          clubName: player.clubName,
          clubRegion:
            TEAMS_BY_ID[player.clubId]?.region || "",
          avatarUrl: profile?.avatarUrl || null,
        }
      : null,
  };
});
