/* eslint-disable */
// src/admin/constants/menus.js
// ✅ 할래말래 Admin 메뉴 SSOT (Topbar 1차 + Sidebar 2~3차)
// - 모든 경로는 /admin prefix
// - "경기"를 상위 메뉴(TOP)로 분리

/**
 * @typedef {Object} MenuNode
 * @property {string} key
 * @property {string} label
 * @property {string=} to
 * @property {MenuNode[]=} children
 */

const ADMIN_PREFIX = "/admin";

/** @type {MenuNode[]} */
export const TOP_MENUS = [
  {
    key: "dashboard",
    label: "대시보드",
    to: `${ADMIN_PREFIX}/dashboard`,
    children: [
      {
        key: "dashboard-group",
        label: "요약",
        children: [{ key: "dashboard-home", label: "대시보드", to: `${ADMIN_PREFIX}/dashboard` }],
      },
    ],
  },
  {
    key: "users",
    label: "선수",
    to: `${ADMIN_PREFIX}/users`,
    children: [
      {
        key: "players-group",
        label: "선수",
        children: [
          { key: "players-approvals", label: "선수 목록", to: `${ADMIN_PREFIX}/users/player-approvals` },
          { key: "users-reports", label: "신고/차단", to: `${ADMIN_PREFIX}/users/reports` },
        ],
      },
    ],
  },
  {
    key: "teams",
    label: "팀",
    to: `${ADMIN_PREFIX}/teams`,
    children: [
      {
        key: "teams-list-group",
        label: "팀",
        children: [{ key: "teams-list", label: "팀 목록", to: `${ADMIN_PREFIX}/teams/list` }],
      },
    ],
  },

  /* ✅ 상위 메뉴로 분리: 경기 */
  {
    key: "games",
    label: "경기",
    to: `${ADMIN_PREFIX}/games`,
    children: [
      {
        key: "games-group",
        label: "경기 목록",
        children: [
          { key: "games-upcoming", label: "예정된 경기", to: `${ADMIN_PREFIX}/games/upcoming` },
          { key: "games-past", label: "지난 경기", to: `${ADMIN_PREFIX}/games/past` },
        ],
      },
    ],
  },

  {
    key: "matches",
    label: "매칭",
    to: `${ADMIN_PREFIX}/matches`,
    children: [
      {
        key: "matches-list-group",
        label: "매칭",
        children: [
          { key: "matches-list", label: "매칭 목록", to: `${ADMIN_PREFIX}/matches/list` },
          { key: "matches-issues", label: "분쟁/신고", to: `${ADMIN_PREFIX}/matches/issues` },
        ],
      },
    ],
  },
  {
    key: "community",
    label: "커뮤니티",
    to: `${ADMIN_PREFIX}/community`,
    children: [
      {
        key: "community-posts-group",
        label: "게시판",
        children: [
          { key: "community-posts", label: "게시글", to: `${ADMIN_PREFIX}/community/posts` },
          { key: "community-reports", label: "신고글", to: `${ADMIN_PREFIX}/community/reports` },
        ],
      },
    ],
  },
  {
    key: "notify",
    label: "알림/푸시",
    to: `${ADMIN_PREFIX}/notify`,
    children: [
      {
        key: "notify-notice-group",
        label: "공지/알림",
        children: [
          { key: "notify-notices", label: "공지 작성", to: `${ADMIN_PREFIX}/notify/notices` },
          { key: "notify-push", label: "푸시 발송", to: `${ADMIN_PREFIX}/notify/push` },
          { key: "notify-history", label: "발송 로그", to: `${ADMIN_PREFIX}/notify/history` },
        ],
      },
    ],
  },
  {
    key: "settings",
    label: "설정",
    to: `${ADMIN_PREFIX}/settings`,
    children: [
      {
        key: "settings-admins-group",
        label: "운영",
        children: [
          { key: "settings-admins", label: "운영자 계정", to: `${ADMIN_PREFIX}/settings/admins` },
          { key: "settings-policy", label: "약관/정책", to: `${ADMIN_PREFIX}/settings/policy` },
        ],
      },
    ],
  },
];

export function findActiveTop(pathname) {
  const p = String(pathname || "/").toLowerCase();
  const adminHome = TOP_MENUS[0];

  if (p === "/admin" || p === "/admin/") return adminHome;

  const candidates = TOP_MENUS.filter((m) => m.to).filter((m) =>
    p.startsWith(String(m.to).toLowerCase())
  );

  if (candidates.length) {
    candidates.sort((a, b) => String(b.to).length - String(a.to).length);
    return candidates[0];
  }

  return adminHome;
}
