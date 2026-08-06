/* eslint-disable */
// 리뷰 도구 데이터 — 도메인별 화면 목록.
// AppRoutes.jsx 에 실제로 등록된 라우트만 전수로 담는다(리다이렉트·404·리뷰전용 라우트 제외).
// 각 화면: { id(전역 유니크·기록 스레드 키), no, name, path, spec:[불릿, ★=핵심] }
//  · id 는 Firestore(reviewThreads)의 기록이 붙는 키라 한번 정하면 바꾸지 않는다. no 는 표시용.
//  · spec 은 지금은 비워둠 — 필요한 화면부터 채운다(기획서 대조 등).
//  · 상세 화면(:param)의 문서 ID는 목업 ID다 (아래 상수 블록 참고).
//
// 목록 기준: 2026-07-28 헤드리스 브라우저로 전 화면을 실제로 띄워 확인했다(목업 세션).
//   화면이 없거나 볼 게 없어 뺀 항목:
//     · /invites          — <Navigate to="/my/team-invites"> 뿐인 리다이렉트 스텁 (5-05 와 동일 화면)
//     · /settings/blocked — /settings/block-report 와 같은 컴포넌트
//     · /onboarding/club  — 앱 어디서도 진입하지 않는 스텁(styled 없는 h2+버튼). 죽은 화면
//     · /admin/matches/issues · /admin/notify/push · /admin/updates
//                         — 셋 다 <AdminPlaceholder "준비중"/> 껍데기라 리뷰할 내용이 없다
//   (/pay/success 는 보드의 "구장 예약 흐름" 변형 프레임으로 본다 — boardData.js)
//
// ✅ 세션 — 로그인하지 않아도 전 화면이 뜬다 (개발 모드 한정).
//    프레임 URL 에 ?mock=<시나리오>&freeze=1 이 붙는다 (src/dev/boardData.js).
//      · mock   → AuthContext·ClubContext·OwnerContext 를 목업으로 덮어 로그인 세션을 흉내낸다.
//                 RequireAuth·RequireConsent·RequirePhone·RequireBasicInfo·RequireWelcome·
//                 RequireAdmin·RequireOwnerAuth 게이트가 전부 통과한다.
//                 도메인별 기본 세션: 사용자앱=팀장 / 구장앱=구장주 / 관리자=admin 클레임.
//                 인증·가입(1-xx)·약관(8-xx)은 로그아웃 상태 자체가 화면이라 목업을 안 붙인다.
//      · freeze → 페이지가 스스로 navigate() 해도 렌더 트리를 진입 시점에 고정한다.
//                 (스플래시가 1초 뒤 /home 으로 넘어가던 문제 차단)
//    실제로 눌러보려면 프레임의 "조작" 버튼을 켠다(freeze 를 빼고 다시 로드).
//    아래 raw:true 는 예전 ?reviewRaw=1 잔존 플래그로, 지금은 아무 동작도 하지 않는다.

// ⚠️ 상세 화면(:param)의 문서 ID는 전부 "목업 ID" 다 (실제 Firestore 문서가 아니다).
//    src/dev/mockScenarios.js 의 목업 DB 가 이 ID들로 데이터를 돌려주므로,
//    로그인하지 않아도·데이터가 바뀌어도 화면이 항상 같은 내용으로 뜬다.
//    (예전에는 데모 계정의 실제 문서 ID를 박았는데, 로그인해야 보이고 데이터가 변하면 화면도 변했다)
const DEMO_UID = "mock_uid_me";       // 리뷰데모 유저(팀장)
const DEMO_CLUB = "mock_club_me";     // 팀청춘
const OPP_CLUB_ID = "mock_club_opp";  // 한강 슬램(상대 팀)
const OPP_UID = "mock_p_o1";          // 상대팀 선수(남의 프로필 보기)
const DEMO_VENUE = "mock_venue";      // 용산 더베이스 농구장(코트 2면)
const DEMO_COURT = "court_a";         // A코트 (40,000원/시간)
const S_POST = "mock_post";           // 커뮤니티 글
const S_MATCH = "mock_room";          // 매치룸
const S_EVENT = "mock_event";         // 이벤트 팝업
const S_CHAT = "match_mock_room";     // 매치룸 채팅방
const S_CHAT_ADMIN = "match_mock_room"; // 관리자 채팅 조회
const S_NOTI = "mock_noti";           // 알림 상세
const F_RESERVATION = "mock_reservation"; // 결제 대기 예약
const F_INVITE = "mock_invite";       // 받은 팀 초대
const F_JOINREQ = "mock_joinreq";     // 팀에 온 가입 신청

// ── 1. 인증·가입 ─────────────────────────────────────────────
// 평소 게이트로만 뜨는 약관동의·전화인증·기본정보·가입완료는 /review-auth/* 로 직접 렌더한다.
export const AUTH_REVIEW = [
  { id: "splash",         no: "1-01", name: "스플래시",       path: "/",                            raw: true, spec: [] },
  { id: "welcome",        no: "1-02", name: "웰컴",           path: "/welcome",                     raw: true, spec: [] },
  { id: "login",          no: "1-03", name: "로그인",         path: "/login",                       raw: true, spec: [] },
  { id: "kakao-callback", no: "1-04", name: "카카오 콜백",     path: "/oauth/kakao",                 raw: true, spec: [] },
  { id: "agreement",      no: "1-05", name: "약관 동의",       path: "/review-auth/agreement",       raw: true, spec: [] },
  { id: "phone-verify",   no: "1-06", name: "전화번호 인증",   path: "/review-auth/phone",           raw: true, spec: [] },
  { id: "basic-info",     no: "1-07", name: "기본정보 입력",   path: "/review-auth/basic-info",      raw: true, spec: [] },
  { id: "signup-done",    no: "1-08", name: "회원가입 완료",   path: "/review-auth/signup-complete", raw: true, spec: [] },
  // /invites 제외 — InvitesPage 는 <Navigate to="/my/team-invites"> 뿐이라 화면이 없다(5-05 와 같은 화면).
];

// ── 2. 홈·랭킹·프로필 ────────────────────────────────────────
export const HOME_REVIEW = [
  { id: "home",           no: "2-01", name: "홈",             path: "/home",                 spec: [] },
  // /impact(기부 캠페인) 제외 — 앱 안에 진입점이 없다(홈 티커 ImpactDonationBar 미렌더링, 링크 없음).
  { id: "player-ranking", no: "2-03", name: "선수 랭킹(전체)", path: "/playerRanking",        spec: [] },
  { id: "team-ranking",   no: "2-04", name: "팀 랭킹(전체)",   path: "/teamRanking",          spec: [] },
  { id: "player-profile", no: "2-05", name: "선수 프로필(남)", path: `/player/${OPP_UID}`,      spec: [] },
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
  { id: "match-roomdetail", no: "3-07", name: "매치룸 상세(채팅)", path: `/match-roomdetail/${S_MATCH}`, spec: [] },
  // 같은 컴포넌트의 별도 탭 — URL 로 분리된 독립 화면이라 따로 본다.
  { id: "match-roomvenue",  no: "3-08", name: "매치룸 구장 정하기", path: `/match-roomdetail/${S_MATCH}/venue`, spec: [] },
  { id: "match-analysis",   no: "3-09", name: "매칭 분석",       path: `/matching/analysis/${DEMO_CLUB}`, spec: [] },
  { id: "my-team-matches",  no: "3-10", name: "내 팀 경기(기록탭)", path: "/records",              spec: [] },
  { id: "matches-finished", no: "3-11", name: "지난 경기",       path: "/matches/finished",        spec: [] },
];

// ── 4. 구장 예약·결제 ────────────────────────────────────────
export const VENUE_REVIEW = [
  { id: "venues",          no: "4-01", name: "구장 목록",    path: "/venues",                          spec: [] },
  // 예약 화면은 데모 구장으로 본다. 크롤링 구장(한국외대 등)은 courts 가 비어 있어
  // "코트 정보를 찾을 수 없어요" 만 뜬다(실측 확인).
  { id: "venue-book",      no: "4-02", name: "구장 예약",    path: `/venue-book/${DEMO_VENUE}`,        spec: [] },
  { id: "pay",             no: "4-04", name: "결제(토스 위젯)", path: `/pay/${F_RESERVATION}`,         spec: [] },
  // 성공 화면은 토스 승인 파라미터(paymentKey·orderId·amount)가 다 있어야 뜬다. 없으면 실패 화면과
  // 같은 모습이라 리뷰가 안 된다 → 목업 주문 id 를 붙여 띄운다(승인 호출은 목업이라 돈이 안 빠진다).
  { id: "pay-success",     no: "4-05", name: "결제 결과(성공·확정)", path: "/pay/success?orderId=mock_order_20260802_001&paymentKey=mock_pk&amount=84000", spec: [] },
  { id: "pay-fail",        no: "4-06", name: "결제 결과(실패)", path: "/pay/fail?message=%EA%B2%B0%EC%A0%9C%EB%A5%BC%20%EC%B7%A8%EC%86%8C%ED%96%88%EC%96%B4%EC%9A%94", spec: [] },
  { id: "my-reservations", no: "4-07", name: "내 구장 예약", path: "/my/reservations",                 spec: [] },
  { id: "fav-venues",      no: "4-08", name: "찜한 구장",    path: "/my/fav-venues",                   spec: [] },
];

// ── 5. 팀 ───────────────────────────────────────────────────
export const TEAM_REVIEW = [
  { id: "team-create",           no: "5-01", name: "팀 생성",       path: "/team/create",                          spec: [] },
  { id: "team-manage",           no: "5-02", name: "팀 관리",       path: `/team/${DEMO_CLUB}/manage`,             spec: [] },
  { id: "team-join-requests",    no: "5-03", name: "가입 신청 목록", path: `/team/${DEMO_CLUB}/join-requests`,      spec: [] },
  { id: "team-join-detail",      no: "5-04", name: "가입 신청 상세", path: `/team/${DEMO_CLUB}/join-requests/${F_JOINREQ}`, spec: [] },
  { id: "my-team-invites",       no: "5-05", name: "받은 팀 초대",   path: "/my/team-invites",                      spec: [] },
  // 초대는 "상대 팀(한강 슬램)이 나에게" 보낸 것이라 clubId 는 상대 팀이다.
  { id: "my-team-invite-detail", no: "5-06", name: "팀 초대 상세",   path: `/my/team-invites/${OPP_CLUB_ID}/${F_INVITE}`, spec: [] },
];

// ── 6. 커뮤니티·채팅·알림 ────────────────────────────────────
export const COMMUNITY_REVIEW = [
  { id: "community",          no: "6-01", name: "커뮤니티 목록",  path: "/community",                     spec: [] },
  { id: "community-write",    no: "6-02", name: "글 작성",        path: "/community/write",               spec: [] },
  { id: "community-detail",   no: "6-03", name: "글 상세",        path: `/communitypost/${S_POST}`,       spec: [] },
  // ⚠️ 6-04·6-05 는 현재 앱에서 도달할 수 없다 (코드·라우트는 살려둠).
  //    · 사용자끼리 DM 은 열지 않기로 했다 → getOrCreateDmRoom 호출처 0곳, 헤더 채팅 아이콘 없음
  //    · ChatListPage 는 type==="dm" 만 렌더하므로 실제로는 항상 빈 목록
  //    · 매치룸 채팅은 매치룸 안 MatchRoomChat 컴포넌트로만 존재(별도 화면 아님)
  //    나중에 DM 진입점을 붙이면 그대로 살아난다. 레이아웃은 보드의 chat-dm 시나리오로 본다.
  { id: "chats",              no: "6-04", name: "채팅 목록(도달불가)", path: "/chats",                    spec: [] },
  { id: "chatroom",           no: "6-05", name: "채팅방(도달불가)",   path: `/chats/${S_CHAT}`,           spec: [] },
  { id: "notifications",      no: "6-06", name: "알림함",         path: "/notifications",                 spec: [] },
  { id: "notification-detail",no: "6-07", name: "알림 상세",      path: `/notificationsdetail/${S_NOTI}`, spec: [] },
];

// ── 7. MY·설정 ──────────────────────────────────────────────
// /settings/blocked 는 /settings/block-report 와 같은 컴포넌트라 목록에 넣지 않는다.
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
// 9-07 이후는 ownerAuth 세션이 있어야 뜬다(없으면 /owner/login).
// 9-05·9-06 은 라우트가 아니라 OwnerLayout 안의 게이트라 /review-owner/* 로 직접 렌더한다.
//   · 9-06 동의 게이트는 문구가 운영 주체별로 갈린다 → ?ownerType=school|org 를 붙이면 그 버전이 뜬다.
export const OWNER_REVIEW = [
  { id: "owner-login",        no: "9-01", name: "구장주 로그인",   path: "/owner/login",         spec: [] },
  { id: "owner-signup",       no: "9-02", name: "구장주 가입",     path: "/owner/signup",        spec: [] },
  { id: "owner-terms",        no: "9-03", name: "구장주 약관",     path: "/owner/terms",         spec: [] },
  { id: "owner-privacy",      no: "9-04", name: "구장주 개인정보", path: "/owner/privacy",       spec: [] },
  { id: "owner-type-gate",    no: "9-05", name: "운영 주체 선택",  path: "/review-owner/type",      spec: [] },
  { id: "owner-agreement",    no: "9-06", name: "구장주 필수 동의", path: "/review-owner/agreement", spec: [] },
  // /owner 제외 — OwnerEntry 는 <Navigate to="/owner/home"> 뿐인 리다이렉트 스텁이라 화면이 없다(9-10 과 같은 화면).
  // 구장 등록(/owner/register)은 온보딩 이전 세대라 삭제했다 — 인증·정산 단계가 빠져 있었다.
  { id: "owner-onboarding",   no: "9-07", name: "구장 온보딩",     path: "/owner/onboarding",    spec: [] },
  { id: "owner-pending",      no: "9-08", name: "심사 현황",       path: "/owner/pending",       spec: [] },
  { id: "owner-home",         no: "9-09", name: "구장주 홈(예약관리)", path: "/owner/home",      spec: [] },
  { id: "owner-sales",        no: "9-10", name: "매출",           path: "/owner/sales",         spec: [] },
  { id: "owner-settlement",   no: "9-11", name: "정산",           path: "/owner/settlement",    spec: [] },
  { id: "owner-venue",        no: "9-12", name: "구장 정보",       path: "/owner/venue",         spec: [] },
  { id: "owner-my",           no: "9-13", name: "구장주 내정보",   path: "/owner/my",            spec: [] },
  { id: "owner-notifications",no: "9-14", name: "구장주 알림",     path: "/owner/notifications", spec: [] },
  { id: "owner-inquiry",      no: "9-15", name: "구장주 문의",     path: "/owner/inquiry",       spec: [] },
  { id: "owner-withdraw",     no: "9-16", name: "구장주 탈퇴",     path: "/owner/withdraw",      spec: [] },
];

// ── 10. 관리자 페이지 (PC 풀와이드) ──────────────────────────
// 로그인 외 전 화면은 admin 클레임 세션이 있어야 뜬다(없으면 /admin/login).
export const ADMIN_REVIEW = [
  // 대시보드를 먼저 — 관리자 탭 진입 시 로그인폼 대신 대시보드가 바로 보이게
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
  { id: "admin-community-posts", no: "10-13", name: "커뮤니티 글",     path: "/admin/community/posts",    spec: [] },
  { id: "admin-community-detail",no: "10-14", name: "커뮤니티 글 상세", path: `/admin/community/posts/${S_POST}`, spec: [] },
  { id: "admin-community-reports",no: "10-15", name: "커뮤니티 신고",  path: "/admin/community/reports",  spec: [] },
  { id: "admin-notify-notices",  no: "10-16", name: "공지 관리",       path: "/admin/notify/notices",     spec: [] },
  { id: "admin-settings-admins", no: "10-18", name: "관리자 계정",     path: "/admin/settings/admins",    spec: [] },
  { id: "admin-settings-policy", no: "10-19", name: "정책 설정",       path: "/admin/settings/policy",    spec: [] },
  { id: "admin-games-upcoming",  no: "10-20", name: "예정 경기",       path: "/admin/games/upcoming",     spec: [] },
  { id: "admin-games-past",      no: "10-21", name: "지난 경기",       path: "/admin/games/past",         spec: [] },
  { id: "admin-chat-list",       no: "10-22", name: "채팅 목록",       path: "/admin/chat/list",          spec: [] },
  { id: "admin-chat-detail",     no: "10-23", name: "채팅방 상세",     path: `/admin/chat/list/${S_CHAT_ADMIN}`, spec: [] },
  { id: "admin-banners",         no: "10-24", name: "배너 관리",       path: "/admin/banners",            spec: [] },
  { id: "admin-venues",          no: "10-25", name: "구장 관리(승인)", path: "/admin/venues",             spec: [] },
  { id: "admin-reservations",    no: "10-30", name: "예약 현황",       path: "/admin/reservations",       spec: [] },
  { id: "admin-settlements",     no: "10-26", name: "정산 관리",       path: "/admin/settlements",        spec: [] },
  { id: "admin-refunds",         no: "10-27", name: "환불 관리",       path: "/admin/refunds",            spec: [] },
  { id: "admin-inquiries",       no: "10-28", name: "문의 관리",       path: "/admin/inquiries",          spec: [] },
  { id: "admin-popups",          no: "10-29", name: "이벤트 팝업",     path: "/admin/popups",             spec: [] },
];

// ── 11. 랜딩(웹 홍보 페이지) ─────────────────────────────────
// React 앱이 아니라 web/ 의 정적 HTML이다.
//   · 고칠 원본은 항상 web/ 다. npm start·build 가 scripts/copy-landing*.mjs 로
//     public|build/landing 에 복사하므로, 리뷰 프레임은 그 복사본(/landing/*.html)을 띄운다.
//     → web/ 을 고친 뒤엔 `npm run copy-landing` 을 돌려야 프레임에 반영된다(HMR 대상이 아님).
//   · 한 장짜리 긴 페이지라 섹션 앵커(#teams 등)로 나눠 프레임을 만든다 — 기록이 섹션 단위로 붙는다.
//   · pc:true = 1266px PC 폭으로 띄운다(랜딩은 PC 기준으로 짜인 페이지).
//     760px 아래에서 레이아웃이 갈리는 섹션은 boardData 의 "경우의 수"에 모바일 프레임을 얹었다.
const LP = "/landing/index.html";
export const LANDING_REVIEW = [
  { id: "landing-hero",     no: "11-01", name: "히어로",          path: `${LP}#main`,     pc: true, spec: [] },
  { id: "landing-teams",    no: "11-02", name: "참여 팀(팀월)",    path: `${LP}#teams`,    pc: true, spec: [] },
  { id: "landing-pain",     no: "11-03", name: "문제 제기",        path: `${LP}#pain`,     pc: true, spec: [] },
  { id: "landing-features", no: "11-04", name: "기능 소개",        path: `${LP}#features`, pc: true, spec: [] },
  { id: "landing-venue",    no: "11-05", name: "구장 예약",        path: `${LP}#venue`,    pc: true, spec: [] },
  { id: "landing-ranking",  no: "11-06", name: "명예의 전당",      path: `${LP}#ranking`,  pc: true, spec: [] },
  { id: "landing-reviews",  no: "11-07", name: "후기",            path: `${LP}#reviews`,  pc: true, spec: [] },
  { id: "landing-sports",   no: "11-08", name: "종목 확장",        path: `${LP}#sports`,   pc: true, spec: [] },
  { id: "landing-contact",  no: "11-09", name: "제휴 문의",        path: `${LP}#contact`,  pc: true, spec: [] },
  { id: "landing-footer",   no: "11-10", name: "다운로드 CTA·푸터", path: `${LP}#cta`,      pc: true, spec: [] },
  // 랜딩 푸터에서 링크되는 정적 정책 문서 — 앱 안의 8-xx(React 화면)와는 별개 파일이라 따로 본다.
  { id: "landing-terms",     no: "11-11", name: "이용약관(웹)",        path: "/landing/terms.html",            pc: true, spec: [] },
  { id: "landing-privacy",   no: "11-12", name: "개인정보처리방침(웹)", path: "/landing/privacy.html",          pc: true, spec: [] },
  { id: "landing-operation", no: "11-13", name: "운영정책(웹)",        path: "/landing/operation.html",        pc: true, spec: [] },
  { id: "landing-refund",    no: "11-14", name: "환불정책(웹)",        path: "/landing/refund.html",           pc: true, spec: [] },
  { id: "landing-delete",    no: "11-15", name: "계정 삭제 안내(웹)",   path: "/landing/account-deletion.html", pc: true, spec: [] },
  { id: "landing-404",       no: "11-16", name: "404",               path: "/landing/404.html",              pc: true, spec: [] },
];

// 카테고리 순서 = 실제 사용자 여정.
//   가입 → 홈에서 둘러보기 → 팀 만들기 → 매칭 → 구장 예약·결제 → 소통 → 내 정보 → 약관
//   그 뒤에 공급자(구장앱) · 운영(관리자).
// group 은 보드에서 앱 단위로 묶어 보여주기 위한 라벨이다.
export const DOMAINS = [
  { key: "auth",      group: "사용자앱", label: "1. 인증·가입",        screens: AUTH_REVIEW },
  { key: "home",      group: "사용자앱", label: "2. 홈·랭킹·프로필",    screens: HOME_REVIEW },
  { key: "team",      group: "사용자앱", label: "3. 팀",               screens: TEAM_REVIEW },
  { key: "matching",  group: "사용자앱", label: "4. 매칭",             screens: MATCHING_REVIEW },
  { key: "venue",     group: "사용자앱", label: "5. 구장 예약·결제",    screens: VENUE_REVIEW },
  { key: "community", group: "사용자앱", label: "6. 커뮤니티·채팅·알림", screens: COMMUNITY_REVIEW },
  { key: "my",        group: "사용자앱", label: "7. MY·설정",          screens: MY_REVIEW },
  { key: "legal",     group: "사용자앱", label: "8. 약관·정책",         screens: LEGAL_REVIEW },
  { key: "owner",     group: "구장앱",   label: "9. 구장앱(구장주)",    screens: OWNER_REVIEW },
  { key: "admin",     group: "관리자",   label: "10. 관리자",           screens: ADMIN_REVIEW },
  { key: "landing",   group: "웹",      label: "11. 랜딩(웹)",         screens: LANDING_REVIEW },
];
