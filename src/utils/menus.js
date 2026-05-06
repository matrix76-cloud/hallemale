/* eslint-disable */
// src/utils/menus.js
// ✅ 할래말래 Admin 메뉴 SSOT (단일 사이드바용 평탄화 구조)
// - 모든 경로는 /admin prefix
// - section: 섹션 구분자 (사이드바 헤더)
// - to: 단일 메뉴 (서브 없음)
// - sub: 그룹 메뉴 (아코디언으로 펼침)
//
// jogun 레이아웃 참고 (구조만), 디자인 토큰은 hallamaella 유지

import {
  IoGridOutline,
  IoPersonOutline,
  IoPeopleOutline,
  IoBasketballOutline,
  IoSwapHorizontalOutline,
  IoChatbubblesOutline,
  IoNewspaperOutline,
  IoMegaphoneOutline,
  IoNotificationsOutline,
  IoCloudDownloadOutline,
  IoSettingsOutline,
  IoImageOutline,
} from "react-icons/io5";

const A = "/admin";

/** @type {Array<{section?: string, to?: string, sub?: Array<{to: string, label: string}>, icon?: any, label?: string, end?: boolean, key?: string}>} */
export const MENUS = [
  // ━━━ 운영 ━━━
  { section: "운영" },
  {
    key: "dashboard",
    to: `${A}/dashboard`,
    icon: IoGridOutline,
    label: "대시보드",
    end: true,
  },
  {
    key: "users",
    icon: IoPersonOutline,
    label: "회원 관리",
    sub: [
      { to: `${A}/users/list`, label: "회원 목록" },
      { to: `${A}/users/player-approvals`, label: "회원 승인" },
      { to: `${A}/users/reports`, label: "신고/차단" },
    ],
  },
  {
    key: "teams",
    icon: IoPeopleOutline,
    label: "팀 관리",
    sub: [
      { to: `${A}/teams/list`, label: "팀 목록" },
      { to: `${A}/teams/approvals`, label: "팀 승인" },
    ],
  },
  {
    key: "games",
    icon: IoBasketballOutline,
    label: "경기 관리",
    sub: [
      { to: `${A}/games/upcoming`, label: "예정된 경기" },
      { to: `${A}/games/past`, label: "지난 경기" },
    ],
  },
  {
    key: "matches",
    icon: IoSwapHorizontalOutline,
    label: "매칭 관리",
    sub: [
      { to: `${A}/matches/list`, label: "매칭 목록" },
      { to: `${A}/matches/issues`, label: "분쟁/신고" },
    ],
  },

  // ━━━ 커뮤니티 ━━━
  { section: "커뮤니티" },
  {
    key: "community",
    icon: IoNewspaperOutline,
    label: "게시판",
    sub: [
      { to: `${A}/community/posts`, label: "게시글" },
      { to: `${A}/community/reports`, label: "신고글" },
    ],
  },
  {
    key: "chat",
    to: `${A}/chat/list`,
    icon: IoChatbubblesOutline,
    label: "채팅 관리",
  },

  // ━━━ 콘텐츠 ━━━
  { section: "콘텐츠" },
  {
    key: "banners",
    to: `${A}/banners`,
    icon: IoImageOutline,
    label: "홈 배너/광고",
  },
  {
    key: "notify",
    icon: IoNotificationsOutline,
    label: "알림/푸시",
    sub: [
      { to: `${A}/notify/notices`, label: "공지 작성" },
      { to: `${A}/notify/push`, label: "푸시 발송" },
      { to: `${A}/notify/history`, label: "발송 로그" },
    ],
  },
  {
    key: "updates",
    to: `${A}/updates`,
    icon: IoCloudDownloadOutline,
    label: "앱 업데이트",
  },

  // ━━━ 시스템 ━━━
  { section: "시스템" },
  {
    key: "settings",
    icon: IoSettingsOutline,
    label: "설정",
    sub: [
      { to: `${A}/settings/admins`, label: "운영자 계정" },
      { to: `${A}/settings/policy`, label: "약관/정책" },
    ],
  },
];

/** breadcrumb 생성: [{label, to?}] */
export function getBreadcrumb(pathname) {
  const p = String(pathname || "").toLowerCase();
  const crumbs = [{ label: "관리자 홈", to: `${A}/dashboard` }];

  if (p === A || p === `${A}/` || p === `${A}/dashboard`) return crumbs;

  for (const m of MENUS) {
    if (m.section) continue;

    if (m.sub) {
      for (const s of m.sub) {
        const sLower = s.to.toLowerCase();
        if (p === sLower || p.startsWith(`${sLower}/`)) {
          crumbs.push({ label: m.label, to: m.sub[0].to });
          crumbs.push({ label: s.label });
          return crumbs;
        }
      }
    } else if (m.to) {
      const mLower = m.to.toLowerCase();
      if (p === mLower || p.startsWith(`${mLower}/`)) {
        crumbs.push({ label: m.label });
        return crumbs;
      }
    }
  }
  return crumbs;
}

// ── 하위 호환 (기존 코드가 import 한 경우 깨지지 않도록 stub) ──
export const TOP_MENUS = MENUS;
export function findActiveTop() {
  return MENUS[0];
}
