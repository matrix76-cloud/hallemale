/* eslint-disable */

import { PLAYERS_BY_ID, TEAMS_BY_ID } from "./teamsMock";

/**
 * ChatRoom {
 *   id: string;
 *   type: "dm" | "system_join_request" | "system_join_result";
 *   counterpartId: string | null;   // 상대 선수 userId (알림일 때는 null 가능)
 *   counterpartName: string;        // 리스트에 보이는 이름/타이틀
 *   teamId: string;                 // 클럽 id
 *   teamName: string;
 *   teamLogoKey: string;
 *   lastMessage: string;            // 리스트에서 한 줄로 미리보기
 *   lastMessageAt: string;          // ISO
 *   unreadCount: number;
 * }
 *
 * ChatMessage {
 *   id: string;
 *   chatId: string;
 *   from: "me" | "them";
 *   text: string;
 *   createdAt: string;         // ISO
 * }
 */

const ensurePlayer = (userId) => {
  const p = PLAYERS_BY_ID[userId];
  if (!p) return null;
  const team = TEAMS_BY_ID[p.clubId] || {};
  return {
    userId: p.userId,
    nickname: p.nickname,
    clubId: p.clubId,
    clubName: p.clubName || team.name || "",
    clubLogoKey: p.clubLogoKey || team.logoKey || "logo",
  };
};

// 상대 선수 3명 선택 (한주성 / 김도윤 / 남효승)
const P1 = ensurePlayer("user_cheongcho_han_juseong");
const P2 = ensurePlayer("user_deokso_kim_doyun");
const P3 = ensurePlayer("user_lion_nam_hyoseung");

// 팀 메타 (알림용)
const CLUB_CHEONGCHO = TEAMS_BY_ID["cheongcho_tigers"] || {};
const CLUB_LI_LION = TEAMS_BY_ID["li_lion"] || {};

export const CHAT_ROOMS = [
  // ===== 일반 DM 채팅 =====
  {
    id: "chat-han-juseong",
    type: "dm",
    counterpartId: P1.userId,
    counterpartName: P1.nickname,
    teamId: P1.clubId,
    teamName: P1.clubName,
    teamLogoKey: P1.clubLogoKey,
    lastMessage: "내일 경기 전에 30분 정도 조기 입장 가능해요?",
    lastMessageAt: "2025-11-30T09:20:00+09:00",
    unreadCount: 2,
  },
  {
    id: "chat-kim-doyun",
    type: "dm",
    counterpartId: P2.userId,
    counterpartName: P2.nickname,
    teamId: P2.clubId,
    teamName: P2.clubName,
    teamLogoKey: P2.clubLogoKey,
    lastMessage: "라인업 확정되면 공유 부탁드려요 🙌",
    lastMessageAt: "2025-11-29T21:10:00+09:00",
    unreadCount: 0,
  },
  {
    id: "chat-nam-hyoseung",
    type: "dm",
    counterpartId: P3.userId,
    counterpartName: P3.nickname,
    teamId: P3.clubId,
    teamName: P3.clubName,
    teamLogoKey: P3.clubLogoKey,
    lastMessage: "다음 스파링은 풀코트로 해볼까요?",
    lastMessageAt: "2025-11-28T18:40:00+09:00",
    unreadCount: 0,
  },

  // ===== 시스템 알림: 팀장에게 온 참여 요청 알림 =====
  {
    id: "sys-join-request-cheongcho",
    type: "system_join_request",
    counterpartId: P2.userId, // 알림 카드에서도 아바타는 신청한 선수로
    counterpartName: `[알림]`,
    teamId: "cheongcho_tigers",
    teamName: CLUB_CHEONGCHO.name || "청춘호랑이",
    teamLogoKey: CLUB_CHEONGCHO.logoKey || "logo_cheongcho_tigers",
    lastMessage:
      `${P2.nickname} 님이 ${CLUB_CHEONGCHO.name || "청춘호랑이"} 팀 참여를 신청했어요. ` +
      "수락/거절은 팀 관리에서 할 수 있어요.",
    lastMessageAt: "2025-12-01T21:30:00+09:00",
    unreadCount: 1,
  },

  // ===== 시스템 알림: 내가 보낸 가입 신청 결과 =====
  {
    id: "sys-join-result-li-lion",
    type: "system_join_result",
    counterpartId: null, // 시스템 알림이므로 특정 선수 없음
    counterpartName: "[알림]",
    teamId: "li_lion",
    teamName: CLUB_LI_LION.name || "LI이언",
    teamLogoKey: CLUB_LI_LION.logoKey || "logo_li_lion",
    lastMessage:
      `${CLUB_LI_LION.name || "LI이언"} 팀 참여 신청이 수락되었습니다. ` +
      "내 정보 > 프로필에서 멤버 상태를 확인해 보세요.",
    lastMessageAt: "2025-12-02T09:00:00+09:00",
    unreadCount: 1,
  },
];

export const CHAT_ROOMS_BY_ID = CHAT_ROOMS.reduce((acc, r) => {
  acc[r.id] = r;
  return acc;
}, {});

export const CHAT_MESSAGES = {
  "chat-han-juseong": [
    {
      id: "m1",
      chatId: "chat-han-juseong",
      from: "them",
      text: "안녕하세요! 내일 경기 라인업 확정됐나요?",
      createdAt: "2025-11-30T09:05:00+09:00",
    },
    {
      id: "m2",
      chatId: "chat-han-juseong",
      from: "me",
      text: "네, 방금 확정됐어요. 곧 매칭룸에 공유할게요!",
      createdAt: "2025-11-30T09:10:00+09:00",
    },
    {
      id: "m3",
      chatId: "chat-han-juseong",
      from: "them",
      text: "내일 경기 전에 30분 정도 조기 입장 가능해요?",
      createdAt: "2025-11-30T09:20:00+09:00",
    },
  ],
  "chat-kim-doyun": [
    {
      id: "m1",
      chatId: "chat-kim-doyun",
      from: "me",
      text: "덕소 체육관 주차 여유 있나요?",
      createdAt: "2025-11-29T20:40:00+09:00",
    },
    {
      id: "m2",
      chatId: "chat-kim-doyun",
      from: "them",
      text: "네, 저녁 타임이면 넉넉합니다. 10대 정도는 문제 없어요.",
      createdAt: "2025-11-29T20:55:00+09:00",
    },
    {
      id: "m3",
      chatId: "chat-kim-doyun",
      from: "them",
      text: "라인업 확정되면 공유 부탁드려요 🙌",
      createdAt: "2025-11-29T21:10:00+09:00",
    },
  ],
  "chat-nam-hyoseung": [
    {
      id: "m1",
      chatId: "chat-nam-hyoseung",
      from: "them",
      text: "지난 스크림 재밌었어요. 수비 텐션 좋더라구요.",
      createdAt: "2025-11-28T18:10:00+09:00",
    },
    {
      id: "m2",
      chatId: "chat-nam-hyoseung",
      from: "me",
      text: "다음엔 우리도 멤버 더 데려갈게요!",
      createdAt: "2025-11-28T18:25:00+09:00",
    },
    {
      id: "m3",
      chatId: "chat-nam-hyoseung",
      from: "them",
      text: "다음 스파링은 풀코트로 해볼까요?",
      createdAt: "2025-11-28T18:40:00+09:00",
    },
  ],

  // 시스템 알림 채팅은 실제 대화방에서 별도 대화가 없을 수도 있지만,
  // 디테일 페이지가 비어있지 않게 lastMessage 한 줄만 넣어둠.
  "sys-join-request-cheongcho": [
    {
      id: "m1",
      chatId: "sys-join-request-cheongcho",
      from: "them",
      text:
        `${P2.nickname} 님이 ${CLUB_CHEONGCHO.name || "청춘호랑이"} 팀 참여를 신청했어요. ` +
        "수락/거절은 팀 관리에서 할 수 있어요.",
      createdAt: "2025-12-01T21:30:00+09:00",
    },
  ],
  "sys-join-result-li-lion": [
    {
      id: "m1",
      chatId: "sys-join-result-li-lion",
      from: "them",
      text:
        `${CLUB_LI_LION.name || "LI이언"} 팀 참여 신청이 수락되었습니다. ` +
        "내 정보 > 프로필에서 멤버 상태를 확인해 보세요.",
      createdAt: "2025-12-02T09:00:00+09:00",
    },
  ],
};
