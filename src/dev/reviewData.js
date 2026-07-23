/* eslint-disable */
// 리뷰 도구 데이터 — 도메인별 화면 목록 (할래말래 실제 라우트 기준 · AppRoutes.jsx).
// 각 화면: { id(전역 유니크), no, name, path(빈 문자열=정책/게이트/화면없음), spec:[불릿, ★=핵심] }
//  · spec 은 지금은 비워둠 — 필요한 화면부터 채운다(기획서 대조 등).
//  · 상세 화면(:param)은 데모 계정(팀청춘 클럽장)의 실제 문서 ID를 박아 실데이터가 뜨게 함.
//    (없는 :param 은 리뷰 프레임에서 'sample' 로 치환되어 빈 화면으로 뜸)
//  · 시드: scripts/seed-review-demo.mjs · 자동로그인: src/dev/reviewDemo.js

// 데모 계정/데이터의 실제 ID (seed-review-demo.mjs 와 동기화)
const DEMO_UID = "p9y3QI1A0wSiAXpOByX1ulOPD9O2"; // 리뷰데모 유저
const DEMO_CLUB = "3fvB0Uolgp5dzziy3gLL";        // 팀청춘 (데모가 클럽장)
const S_VENUE = "Mb9O0C1QuDnfmjfp3VXd";          // 한국외대 실내체육관
const S_POST = "9hgBRey1ToAzs7UA01B5";           // 커뮤니티 글
const S_MATCH = "12jjiBlz97nPTbiToCoT";          // 매치룸(accepted)
const S_MATCH_FIN = "2OlhjwrsHlbvPFFPuQ1l";      // 지난 경기(finished)
const S_EVENT = "Cqg0kRQh1qxBddC0bMXr";          // 이벤트 팝업(event_popups)
const S_CHAT = "44g2JTuWxXVhCbPYUhYv2NLpuuL2__6P3ymwsl0OOINAPF2geHbTw3hax2"; // 채팅방(관리자 조회용)

// ── 1. 인증·가입 ─────────────────────────────────────────────
// 인증·가입 도메인은 raw:true — 로그인된 상태가 아니라 실제 로그인/가입 화면 자체를
// 절차대로 봐야 하므로 자동로그인/게이트우회를 끄고 로그아웃 상태로 띄운다.
// (평소 게이트로만 뜨는 약관동의·전화인증·가입완료는 리뷰 전용 라우트로 직접 렌더)
export const AUTH_REVIEW = [
  { id: "splash",         no: "1-01", name: "스플래시",       path: "/",                        raw: true, spec: [] },
  { id: "welcome",        no: "1-02", name: "웰컴",           path: "/welcome",                 raw: true, spec: [] },
  { id: "login",          no: "1-03", name: "로그인",         path: "/login",                   raw: true, spec: [] },
  { id: "kakao-callback", no: "1-04", name: "카카오 콜백",     path: "/oauth/kakao",             raw: true, spec: [] },
  { id: "agreement",      no: "1-05", name: "약관 동의",       path: "/review-auth/agreement",       raw: true, spec: [] },
  { id: "phone-verify",   no: "1-06", name: "전화번호 인증",   path: "/review-auth/phone",           raw: true, spec: [] },
  { id: "signup-done",    no: "1-07", name: "회원가입 완료",   path: "/review-auth/signup-complete", raw: true, spec: [] },
  { id: "club-onboarding",no: "1-08", name: "클럽 온보딩",     path: "/onboarding/club",         raw: true, spec: [] },
  { id: "invites",        no: "1-09", name: "초대 받기",       path: "/invites",                 spec: [] },
];

// ── 2. 홈·랭킹·프로필 ────────────────────────────────────────
export const HOME_REVIEW = [
  { id: "home",           no: "2-01", name: "홈",             path: "/home",                 spec: [] },
  { id: "impact",         no: "2-02", name: "임팩트 캠페인",   path: "/impact",               spec: [] },
  { id: "player-ranking", no: "2-03", name: "선수 랭킹(전체)", path: "/playerRanking",        spec: [] },
  { id: "team-ranking",   no: "2-04", name: "팀 랭킹(전체)",   path: "/teamRanking",          spec: [] },
  { id: "player-profile", no: "2-05", name: "선수 프로필",     path: `/player/${DEMO_UID}`,     spec: [] },
  { id: "team-profile",   no: "2-06", name: "팀 프로필",       path: `/team/${DEMO_CLUB}`,      spec: [] },
  { id: "player-matches", no: "2-07", name: "선수 경기기록",   path: `/player/${DEMO_UID}/matches`, spec: [] },
  { id: "team-matches",   no: "2-08", name: "팀 경기기록",     path: `/team/${DEMO_CLUB}/matches`, spec: [] },
  { id: "event",          no: "2-09", name: "이벤트",          path: `/event/${S_EVENT}`,     spec: [] },
];

// ── 3. 매칭 ─────────────────────────────────────────────────
export const MATCHING_REVIEW = [
  { id: "matching",         no: "3-01", name: "매칭 시작",       path: "/matching",                spec: [] },
  { id: "match-region",     no: "3-02", name: "지역 선택",       path: "/matching/region",         spec: [] },
  { id: "match-searching",  no: "3-03", name: "상대 탐색",       path: "/matching/searching",      spec: [] },
  { id: "match-opponent",   no: "3-04", name: "상대 공개",       path: "/matching/opponent",       spec: [] },
  { id: "matching-manage",  no: "3-05", name: "매칭 관리",       path: "/matchingmanage",          spec: [] },
  { id: "match-roomlist",   no: "3-06", name: "매치룸 목록",     path: "/match-roomlist",          spec: [] },
  { id: "match-roomdetail", no: "3-07", name: "매치룸 상세",     path: `/match-roomdetail/${S_MATCH}`, spec: [] },
  { id: "match-analysis",   no: "3-08", name: "매칭 분석",       path: `/matching/analysis/${DEMO_CLUB}`, spec: [] },
  { id: "my-team-matches",  no: "3-09", name: "내 팀 경기(기록탭)", path: "/records",              spec: [] },
  { id: "matches-finished", no: "3-10", name: "지난 경기",       path: "/matches/finished",        spec: [] },
];

// ── 4. 구장 예약 ─────────────────────────────────────────────
export const VENUE_REVIEW = [
  { id: "venues",          no: "4-01", name: "구장 목록",    path: "/venues",                          spec: [] },
  { id: "venue-book",      no: "4-02", name: "구장 예약",    path: `/venue-book/${S_VENUE}`,           spec: [] },
  { id: "court-book",      no: "4-03", name: "코트 예약",    path: `/venue-book/${S_VENUE}/court/1`,   spec: [] },
  { id: "my-reservations", no: "4-04", name: "내 구장 예약", path: "/my/reservations",                 spec: [] },
  { id: "fav-venues",      no: "4-05", name: "찜한 구장",    path: "/my/fav-venues",                   spec: [] },
];

// ── 5. 팀 ───────────────────────────────────────────────────
export const TEAM_REVIEW = [
  { id: "team-create",         no: "5-01", name: "팀 생성",       path: "/team/create",                          spec: [] },
  { id: "team-manage",         no: "5-02", name: "팀 관리",       path: `/team/${DEMO_CLUB}/manage`,             spec: [] },
  { id: "team-join-requests",  no: "5-03", name: "가입 신청 목록", path: `/team/${DEMO_CLUB}/join-requests`,      spec: [] },
  { id: "my-team-invites",     no: "5-05", name: "받은 팀 초대",   path: "/my/team-invites",                      spec: [] },
];

// ── 6. 커뮤니티·채팅·알림 ────────────────────────────────────
export const COMMUNITY_REVIEW = [
  { id: "community",          no: "6-01", name: "커뮤니티 목록",  path: "/community",                     spec: [] },
  { id: "community-write",    no: "6-02", name: "글 작성",        path: "/community/write",               spec: [] },
  { id: "community-detail",   no: "6-03", name: "글 상세",        path: `/communitypost/${S_POST}`,       spec: [] },
  { id: "chats",              no: "6-04", name: "채팅 목록",      path: "/chats",                         spec: [] },
  { id: "notifications",      no: "6-06", name: "알림함",         path: "/notifications",                 spec: [] },
];

// ── 7. MY·설정 ──────────────────────────────────────────────
export const MY_REVIEW = [
  { id: "my",               no: "7-01", name: "마이페이지",     path: "/my",                        spec: [] },
  { id: "my-profile-detail",no: "7-02", name: "프로필 상세",     path: "/my/profile/detail",         spec: [] },
  { id: "my-profile-edit",  no: "7-03", name: "프로필 편집",     path: "/my/profile/edit",           spec: [] },
  { id: "edit-skills",      no: "7-04", name: "능력치 편집",     path: "/my/profile/edit/skills",    spec: [] },
  { id: "edit-body",        no: "7-05", name: "신체정보 편집",   path: "/my/profile/edit/body",      spec: [] },
  { id: "edit-intro",       no: "7-06", name: "소개 편집",       path: "/my/profile/edit/intro",     spec: [] },
  { id: "edit-media",       no: "7-07", name: "미디어 편집",     path: "/my/profile/edit/media",     spec: [] },
  { id: "edit-team-join",   no: "7-08", name: "팀 가입설정 편집", path: "/my/profile/edit/team-join", spec: [] },
  { id: "my-posts",         no: "7-09", name: "내가 쓴 글",      path: "/my/posts",                  spec: [] },
  { id: "my-personal-matches", no: "7-10", name: "내 개인경기",  path: "/my/personal-matches",       spec: [] },
  { id: "my-reports",       no: "7-11", name: "내 신고내역",     path: "/my/reports",                spec: [] },
  { id: "my-inquiry",       no: "7-12", name: "1:1 문의",       path: "/my/inquiry",                spec: [] },
  { id: "settings-noti",    no: "7-13", name: "알림 설정",       path: "/settings/notifications",    spec: [] },
  { id: "settings-notices", no: "7-14", name: "공지사항",        path: "/settings/notices",          spec: [] },
  { id: "settings-block",   no: "7-15", name: "차단·신고 관리",   path: "/settings/block-report",     spec: [] },
  { id: "settings-withdraw",no: "7-16", name: "회원탈퇴",        path: "/settings/withdraw",         spec: [] },
  { id: "settings-faq",     no: "7-17", name: "FAQ",            path: "/settings/faq",              spec: [] },
];

// ── 8. 약관·정책 ─────────────────────────────────────────────
export const LEGAL_REVIEW = [
  { id: "terms",     no: "8-01", name: "이용약관",     path: "/terms",     spec: [] },
  { id: "privacy",   no: "8-02", name: "개인정보처리방침", path: "/privacy", spec: [] },
  { id: "operation", no: "8-03", name: "운영정책",     path: "/operation", spec: [] },
  { id: "refund",    no: "8-04", name: "환불정책",     path: "/refund",    spec: [] },
];

// ── 9. 구장앱(구장주 워크스페이스) ───────────────────────────
export const OWNER_REVIEW = [
  { id: "owner-login",        no: "9-01", name: "구장주 로그인",   path: "/owner/login",         spec: [] },
  { id: "owner-signup",       no: "9-02", name: "구장주 가입",     path: "/owner/signup",        spec: [] },
  { id: "owner-terms",        no: "9-03", name: "구장주 약관",     path: "/owner/terms",         spec: [] },
  { id: "owner-privacy",      no: "9-04", name: "구장주 개인정보", path: "/owner/privacy",       spec: [] },
  { id: "owner-entry",        no: "9-05", name: "구장주 진입",     path: "/owner",               spec: [] },
  { id: "owner-onboarding",   no: "9-06", name: "구장 온보딩",     path: "/owner/onboarding",    spec: [] },
  { id: "owner-home",         no: "9-09", name: "구장주 홈(예약관리)", path: "/owner/home",      spec: [] },
  { id: "owner-sales",        no: "9-10", name: "매출",           path: "/owner/sales",         spec: [] },
  { id: "owner-venue",        no: "9-11", name: "구장 정보",       path: "/owner/venue",         spec: [] },
  { id: "owner-my",           no: "9-12", name: "구장주 내정보",   path: "/owner/my",            spec: [] },
  { id: "owner-notifications",no: "9-13", name: "구장주 알림",     path: "/owner/notifications", spec: [] },
  { id: "owner-inquiry",      no: "9-14", name: "구장주 문의",     path: "/owner/inquiry",       spec: [] },
  { id: "owner-withdraw",     no: "9-15", name: "구장주 탈퇴",     path: "/owner/withdraw",      spec: [] },
];

// ── 10. 관리자 페이지 (PC 풀와이드) ──────────────────────────
export const ADMIN_REVIEW = [
  // 대시보드를 먼저 — 관리자 탭 진입 시 로그인폼 대신 로그인된 대시보드가 바로 보이게(데모 자동 진입)
  { id: "admin-dashboard",       no: "10-01", name: "대시보드",        path: "/admin/dashboard",          spec: [] },
  { id: "admin-login",           no: "10-02", name: "관리자 로그인",   path: "/admin/login",              spec: [] },
  { id: "admin-users-list",      no: "10-03", name: "회원 목록",       path: "/admin/users/list",         spec: [] },
  { id: "admin-users-ranking",   no: "10-04", name: "회원 랭킹",       path: "/admin/users/ranking",      spec: [] },
  { id: "admin-users-reports",   no: "10-05", name: "회원 신고",       path: "/admin/users/reports",      spec: [] },
  { id: "admin-users-blocks",    no: "10-06", name: "회원 차단",       path: "/admin/users/blocks",       spec: [] },
  { id: "admin-teams-list",      no: "10-07", name: "팀 목록",         path: "/admin/teams/list",         spec: [] },
  { id: "admin-teams-ranking",   no: "10-08", name: "팀 랭킹",         path: "/admin/teams/ranking",      spec: [] },
  { id: "admin-teams-reports",   no: "10-09", name: "팀 신고",         path: "/admin/teams/reports",      spec: [] },
  { id: "admin-teams-blocks",    no: "10-10", name: "팀 차단",         path: "/admin/teams/blocks",       spec: [] },
  { id: "admin-matches-list",    no: "10-11", name: "매칭 목록",       path: "/admin/matches/list",       spec: [] },
  { id: "admin-matches-issues",  no: "10-12", name: "매칭 이슈",       path: "/admin/matches/issues",     spec: [] },
  { id: "admin-community-posts", no: "10-13", name: "커뮤니티 글",     path: "/admin/community/posts",    spec: [] },
  { id: "admin-community-detail",no: "10-14", name: "커뮤니티 글 상세", path: `/admin/community/posts/${S_POST}`, spec: [] },
  { id: "admin-community-reports",no: "10-15", name: "커뮤니티 신고",  path: "/admin/community/reports",  spec: [] },
  { id: "admin-notify-notices",  no: "10-16", name: "공지 관리",       path: "/admin/notify/notices",     spec: [] },
  { id: "admin-notify-push",     no: "10-17", name: "푸시 발송",       path: "/admin/notify/push",        spec: [] },
  { id: "admin-settings-admins", no: "10-18", name: "관리자 계정",     path: "/admin/settings/admins",    spec: [] },
  { id: "admin-settings-policy", no: "10-19", name: "정책 설정",       path: "/admin/settings/policy",    spec: [] },
  { id: "admin-games-upcoming",  no: "10-20", name: "예정 경기",       path: "/admin/games/upcoming",     spec: [] },
  { id: "admin-games-past",      no: "10-21", name: "지난 경기",       path: "/admin/games/past",         spec: [] },
  { id: "admin-chat-list",       no: "10-22", name: "채팅 목록",       path: "/admin/chat/list",          spec: [] },
  { id: "admin-chat-detail",     no: "10-23", name: "채팅방 상세",     path: `/admin/chat/list/${S_CHAT}`, spec: [] },
  { id: "admin-banners",         no: "10-24", name: "배너 관리",       path: "/admin/banners",            spec: [] },
  { id: "admin-venues",          no: "10-25", name: "구장 관리(승인)", path: "/admin/venues",             spec: [] },
  { id: "admin-settlements",     no: "10-26", name: "정산 관리",       path: "/admin/settlements",        spec: [] },
  { id: "admin-refunds",         no: "10-27", name: "환불 관리",       path: "/admin/refunds",            spec: [] },
  { id: "admin-inquiries",       no: "10-28", name: "문의 관리",       path: "/admin/inquiries",          spec: [] },
  { id: "admin-popups",          no: "10-29", name: "이벤트 팝업",     path: "/admin/popups",             spec: [] },
  { id: "admin-updates",         no: "10-30", name: "앱 업데이트",     path: "/admin/updates",            spec: [] },
];

export const DOMAINS = [
  { key: "auth",      label: "인증·가입",       screens: AUTH_REVIEW },
  { key: "home",      label: "홈·랭킹·프로필",   screens: HOME_REVIEW },
  { key: "matching",  label: "매칭",            screens: MATCHING_REVIEW },
  { key: "venue",     label: "구장 예약",       screens: VENUE_REVIEW },
  { key: "team",      label: "팀",              screens: TEAM_REVIEW },
  { key: "community", label: "커뮤니티·채팅·알림", screens: COMMUNITY_REVIEW },
  { key: "my",        label: "MY·설정",         screens: MY_REVIEW },
  { key: "legal",     label: "약관·정책",       screens: LEGAL_REVIEW },
  { key: "owner",     label: "구장앱(구장주)",   screens: OWNER_REVIEW },
  { key: "admin",     label: "관리자",          screens: ADMIN_REVIEW },
];
