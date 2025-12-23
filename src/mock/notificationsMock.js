/* eslint-disable */

// 🔔 알림/공지 목업 데이터 (v2 확장판)
// ✅ 기존 화면/로직과 호환되게 kind/linkType/linkTargetId 유지
// ✅ 나중에 Firestore SSOT 구조로 옮기기 쉽게 targetType/targetIds/readBy/push도 같이 포함
//
// NotificationDoc (Mock v2)
// {
//   id: string;
//   kind: "notice" | "event" | "match" | "system" | "team";
//   title: string;
//   body: string;
//   createdAt: string; // ISO
//
//   // (레거시 호환) 화면에서 쓰던 필드
//   read?: boolean;                // ⚠️ 단일 유저용 레거시 (정식은 readBy로)
//   important?: boolean;
//   targetTeamId?: string | null;  // ⚠️ 레거시
//   targetUserId?: string | null;  // ⚠️ 레거시
//   linkType?: "notice" | "match" | "team" | "external";
//   linkTargetId?: string;
//
//   // (정식 설계용 확장)
//   targetType?: "GLOBAL" | "TEAM" | "USER";
//   targetIds?: string[];          // GLOBAL: [], TEAM: [teamId], USER: [uid]
//   readBy?: Record<string, string>; // { [uid]: ISO timestamp }
//   push?: { enabled: boolean; sent: boolean; sentAt?: string };
//   expiresAt?: string | null;
// }

export const NOTIFICATIONS = [
  /* ─────────────────────────
   * GLOBAL 공지 / 시스템
   * ───────────────────────── */

  {
    id: "notice-winter-league",
    kind: "notice",
    title: "겨울 리그 참가팀 모집 안내",
    body:
      "12월부터 시작되는 하렐말레 겨울 리그 참가팀을 모집합니다. 조기 신청 팀에게는 코트 이용료 할인 혜택이 제공됩니다.",
    createdAt: "2025-11-29T10:00:00+09:00",
    important: true,

    // 레거시
    read: false,
    targetTeamId: null,
    targetUserId: null,
    linkType: "notice",
    linkTargetId: "notice-winter-league",

    // 확장
    targetType: "GLOBAL",
    targetIds: [],
    push: { enabled: true, sent: true, sentAt: "2025-11-29T10:00:05+09:00" },
  },
  {
    id: "system-policy-update",
    kind: "system",
    title: "매칭 취소 규정 변경 안내",
    body:
      "노쇼 및 당일 취소에 대한 패널티 규정이 12월 1일부터 변경됩니다. 자세한 내용은 공지사항에서 확인해 주세요.",
    createdAt: "2025-11-25T09:00:00+09:00",
    important: true,

    // 레거시
    read: true,
    targetTeamId: null,
    targetUserId: null,
    linkType: "notice",
    linkTargetId: "system-policy-update",

    // 확장
    targetType: "GLOBAL",
    targetIds: [],
    readBy: {
      u_neo_001: "2025-11-25T11:12:00+09:00",
      u_tiger_004: "2025-11-25T12:05:00+09:00",
    },
    push: { enabled: true, sent: true, sentAt: "2025-11-25T09:00:08+09:00" },
  },
  {
    id: "notice-maintenance-20251202",
    kind: "notice",
    title: "서비스 점검 안내 (12/2 02:00~03:30)",
    body:
      "안정적인 서비스 제공을 위해 새벽 점검이 진행됩니다. 점검 시간 동안 일부 기능이 일시적으로 제한될 수 있습니다.",
    createdAt: "2025-12-01T18:10:00+09:00",
    important: false,

    read: false,
    targetTeamId: null,
    targetUserId: null,
    linkType: "notice",
    linkTargetId: "notice-maintenance-20251202",

    targetType: "GLOBAL",
    targetIds: [],
    push: { enabled: true, sent: false },
  },

  /* ─────────────────────────
   * TEAM 이벤트 / 쿠폰 / 리워드
   * ───────────────────────── */

  {
    id: "event-first-match",
    kind: "event",
    title: "첫 매칭 완료 기념 쿠폰이 도착했어요",
    body:
      "축하합니다! 첫 매칭을 완료한 팀에게 5,000원 상당의 코트 할인 쿠폰이 발급되었습니다. 마이페이지 > 쿠폰함에서 확인해 주세요.",
    createdAt: "2025-11-28T19:30:00+09:00",

    // 레거시
    read: false,
    targetTeamId: "cheongcho_tigers",
    targetUserId: null,
    linkType: "external",
    linkTargetId: "coupon-box",

    // 확장
    targetType: "TEAM",
    targetIds: ["cheongcho_tigers"],
    push: { enabled: true, sent: true, sentAt: "2025-11-28T19:30:05+09:00" },
  },
  {
    id: "event-streak-3win-cheongcho",
    kind: "event",
    title: "3연승 달성! 팀 배지가 열렸어요",
    body:
      "청춘호랑이가 3연승을 달성했습니다. 팀 프로필에서 새 배지를 확인해 보세요!",
    createdAt: "2025-12-03T22:12:00+09:00",

    read: false,
    targetTeamId: "cheongcho_tigers",
    targetUserId: null,
    linkType: "team",
    linkTargetId: "cheongcho_tigers",

    targetType: "TEAM",
    targetIds: ["cheongcho_tigers"],
    push: { enabled: true, sent: false },
    expiresAt: "2026-01-03T00:00:00+09:00",
  },

  /* ─────────────────────────
   * MATCH 리마인드 / 결과 / 요청 상태
   * ───────────────────────── */

  {
    id: "match-reminder-001",
    kind: "match",
    title: "내일 예정된 경기 리마인드",
    body:
      "청춘호랑이 vs 덕소독수리 매칭이 내일 오후 4시에 예정되어 있습니다. 라인업 변경이 필요하다면 오늘 자정 전까지 수정 가능합니다.",
    createdAt: "2025-11-27T21:15:00+09:00",

    // 레거시
    read: true,
    targetTeamId: "cheongcho_tigers",
    targetUserId: null,
    linkType: "match",
    linkTargetId: "m_2025_12_12_cheongcho_li",

    // 확장
    targetType: "TEAM",
    targetIds: ["cheongcho_tigers"],
    readBy: { u_tiger_001: "2025-11-27T21:20:00+09:00" },
    push: { enabled: true, sent: true, sentAt: "2025-11-27T21:15:03+09:00" },
  },
  {
    id: "match-request-received-neo-001",
    kind: "match",
    title: "새 매칭 요청이 도착했어요",
    body:
      "덕소독수리가 청춘호랑이에게 매칭을 요청했습니다. 조건을 확인하고 수락/거절을 선택해 주세요.",
    createdAt: "2025-12-04T14:05:00+09:00",

    read: false,
    targetTeamId: "cheongcho_tigers",
    targetUserId: null,
    linkType: "match",
    linkTargetId: "mr_2025_12_04_neo_to_tiger_001",

    targetType: "TEAM",
    targetIds: ["cheongcho_tigers"],
    push: { enabled: true, sent: false },
  },
  {
    id: "match-request-accepted-neo-001",
    kind: "match",
    title: "매칭 요청이 수락됐어요",
    body:
      "청춘호랑이가 덕소독수리의 매칭 요청을 수락했습니다. 경기 일정과 장소를 확인해 주세요.",
    createdAt: "2025-12-04T15:12:00+09:00",

    read: false,
    targetTeamId: "deokso_eagles",
    targetUserId: null,
    linkType: "match",
    linkTargetId: "mr_2025_12_04_neo_to_tiger_001",

    targetType: "TEAM",
    targetIds: ["deokso_eagles"],
    push: { enabled: true, sent: false },
  },
  {
    id: "match-result-uploaded-20251207-01",
    kind: "match",
    title: "경기 결과가 등록됐어요",
    body:
      "청춘호랑이 vs 덕소독수리 경기 결과가 등록되었습니다. MVP/리뷰를 남기면 팀 평점에 반영됩니다.",
    createdAt: "2025-12-07T20:40:00+09:00",

    read: false,
    targetTeamId: "cheongcho_tigers",
    targetUserId: null,
    linkType: "match",
    linkTargetId: "m_2025_12_07_tiger_eagles",

    targetType: "TEAM",
    targetIds: ["cheongcho_tigers"],
    push: { enabled: true, sent: false },
  },

  /* ─────────────────────────
   * TEAM 초대/요청 (상태관리용)
   * ───────────────────────── */

  {
    id: "team-invite-received-li-to-neo-001",
    kind: "team",
    title: "팀 초대가 도착했어요",
    body:
      "neo_falcons가 김민준님에게 팀 초대를 보냈습니다. 팀에 참여할까요?",
    createdAt: "2025-12-05T11:03:00+09:00",

    // 레거시
    read: false,
    targetTeamId: null,
    targetUserId: "u_neo_001",
    linkType: "team",
    linkTargetId: "inv_li_to_neo_001",

    // 확장
    targetType: "USER",
    targetIds: ["u_neo_001"],
    push: { enabled: true, sent: false },
  },
  {
    id: "team-invite-accepted-li-to-neo-001",
    kind: "team",
    title: "팀 초대가 수락됐어요",
    body:
      "김민준님이 neo_falcons 팀 초대를 수락했습니다. 팀 프로필에서 멤버를 확인해 보세요.",
    createdAt: "2025-12-05T11:25:00+09:00",

    read: false,
    targetTeamId: "neo_falcons",
    targetUserId: null,
    linkType: "team",
    linkTargetId: "neo_falcons",

    targetType: "TEAM",
    targetIds: ["neo_falcons"],
    push: { enabled: true, sent: false },
  },
  {
    id: "team-join-request-received-001",
    kind: "team",
    title: "팀 참가 요청이 도착했어요",
    body:
      "윤현우님이 덕소독수리에 참가 요청을 보냈습니다. 팀 관리에서 승인/거절을 선택해 주세요.",
    createdAt: "2025-12-06T09:18:00+09:00",

    read: false,
    targetTeamId: "deokso_eagles",
    targetUserId: null,
    linkType: "team",
    linkTargetId: "jr_2025_12_06_yoon_to_eagles_001",

    targetType: "TEAM",
    targetIds: ["deokso_eagles"],
    push: { enabled: true, sent: false },
  },
  {
    id: "team-join-request-rejected-001",
    kind: "team",
    title: "팀 참가 요청이 거절됐어요",
    body:
      "덕소독수리 참가 요청이 거절되었습니다. 다른 팀에 참가 요청을 보내거나 새 팀을 만들 수 있어요.",
    createdAt: "2025-12-06T10:02:00+09:00",

    read: false,
    targetTeamId: null,
    targetUserId: "u_player_007",
    linkType: "team",
    linkTargetId: "deokso_eagles",

    targetType: "USER",
    targetIds: ["u_player_007"],
    push: { enabled: true, sent: false },
  },

  /* ─────────────────────────
   * USER 개인 알림 (프로필/인증/제재 등)
   * ───────────────────────── */

  {
    id: "user-profile-missing-001",
    kind: "system",
    title: "프로필을 완성하면 매칭이 더 쉬워져요",
    body:
      "포지션/레벨/활동 지역을 입력하면 팀 추천과 매칭 성공률이 올라갑니다. 지금 30초면 끝나요.",
    createdAt: "2025-12-02T08:55:00+09:00",

    read: false,
    targetTeamId: null,
    targetUserId: "u_tiger_004",
    linkType: "external",
    linkTargetId: "my-profile-edit",

    targetType: "USER",
    targetIds: ["u_tiger_004"],
    push: { enabled: false, sent: false },
  },
  {
    id: "user-warning-noshow-001",
    kind: "system",
    title: "노쇼 경고가 1회 등록됐어요",
    body:
      "경기 당일 무단 불참으로 인해 노쇼 경고가 1회 등록되었습니다. 누적 시 매칭 제한이 적용될 수 있습니다.",
    createdAt: "2025-12-08T19:05:00+09:00",
    important: true,

    read: false,
    targetTeamId: null,
    targetUserId: "u_player_009",
    linkType: "notice",
    linkTargetId: "system-noshow-policy",

    targetType: "USER",
    targetIds: ["u_player_009"],
    push: { enabled: true, sent: false },
  },

  /* ─────────────────────────
   * EXTERNAL 링크 샘플 (설문/FAQ/가이드)
   * ───────────────────────── */

  {
    id: "event-survey-20251210",
    kind: "event",
    title: "간단 설문 참여하고 쿠폰 받기",
    body:
      "1분 설문에 참여하면 코트 할인 쿠폰을 드립니다. 여러분의 의견이 서비스 개선에 큰 도움이 됩니다.",
    createdAt: "2025-12-10T12:00:00+09:00",

    read: false,
    targetTeamId: null,
    targetUserId: null,
    linkType: "external",
    linkTargetId: "survey-20251210",

    targetType: "GLOBAL",
    targetIds: [],
    push: { enabled: true, sent: false },
    expiresAt: "2025-12-17T00:00:00+09:00",
  },
];

export const NOTIFICATIONS_BY_ID = NOTIFICATIONS.reduce((acc, n) => {
  acc[n.id] = n;
  return acc;
}, {});
