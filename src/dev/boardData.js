/* eslint-disable */
// src/dev/boardData.js — /review/board (피그마식 전 화면 보드)가 그릴 프레임 목록.
//
// 프레임 = { key, name, path, scenario, note? }
//  · path 에 ?mock=<scenario> 를 붙여 띄운다 → 로그인 없이도 화면이 뜨고, 항상 같은 데이터로 고정된다.
//  · reviewData.DOMAINS(등록된 전 화면)를 기본 프레임으로 깔고, 그 위에 "경우의 수" 프레임을 얹는다.

import { DOMAINS } from "./reviewData";

// 도메인별 기본 세션 — 이 세션이 있어야 라우트 게이트를 통과해 화면이 뜬다.
//  auth(1-xx)는 로그아웃 상태 그 자체가 화면이라 목업을 붙이지 않는다.
const DOMAIN_BASE = {
  auth: "",
  home: "base-leader",
  matching: "base-leader",
  venue: "base-leader",
  team: "base-leader",
  community: "base-leader",
  my: "base-leader",
  legal: "",
  owner: "base-owner",
  admin: "base-admin",
  landing: "", // 랜딩은 정적 HTML — 로그인·목업이 필요 없다
};

// ── 경우의 수 프레임 (1차: 매칭) ────────────────────────────
// 같은 화면을 시나리오만 바꿔 여러 장 띄운다. 매치룸 id 는 목업이라 아무 값이나 무방.
const M_ROOM = "/match-roomdetail/mock_room";
const LP = "/landing/index.html"; // 랜딩 원본은 web/index.html — 복사본을 띄운다(reviewData 주석 참고)

// forScreen = reviewData 의 화면 id — /review/:id 상세에서 "이 화면의 변형"으로 묶어 보여준다.
const EXTRA_FRAMES = {
  matching: [
    { key: "sc-match-lineup-wait",   forScreen: "match-roomdetail", name: "매치룸 · 라인업 대기",     path: M_ROOM,            scenario: "match-lineup-wait" },
    { key: "sc-match-coordinating",  forScreen: "match-roomdetail", name: "매치룸 · 조율중(채팅)",     path: M_ROOM,            scenario: "match-coordinating" },
    { key: "sc-match-proposed-mine", forScreen: "match-roomdetail", name: "매치룸 · 내가 제의함",      path: M_ROOM,            scenario: "match-proposed-mine" },
    { key: "sc-match-proposed-they", forScreen: "match-roomdetail", name: "매치룸 · 제의 받음",        path: M_ROOM,            scenario: "match-proposed-theirs" },
    { key: "sc-match-venue-approval",forScreen: "match-roomdetail", name: "매치룸 · 구장 승인 대기",   path: M_ROOM,            scenario: "match-venue-approval" },
    { key: "sc-match-confirmed",     forScreen: "match-roomdetail", name: "매치룸 · 일정 확정",        path: M_ROOM,            scenario: "match-confirmed" },
    { key: "sc-match-pay-wait",      forScreen: "match-roomdetail", name: "매치룸 · 분담결제 대기",    path: M_ROOM,            scenario: "match-pay-wait" },
    { key: "sc-match-result-input",  forScreen: "match-roomdetail", name: "매치룸 · 결과 입력",        path: M_ROOM,            scenario: "match-result-input" },
    { key: "sc-match-result-accept", forScreen: "match-roomdetail", name: "매치룸 · 결과 승인 대기",   path: M_ROOM,            scenario: "match-result-wait-accept" },
    { key: "sc-match-finished",      forScreen: "match-roomdetail", name: "매치룸 · 종료(결과확정)",   path: M_ROOM,            scenario: "match-finished" },
    { key: "sc-match-cancelled",     forScreen: "match-roomdetail", name: "매치룸 · 취소됨",           path: M_ROOM,            scenario: "match-cancelled" },
    // 구장 정하기 분기 — 방식 선택 → 제휴구장(구장목록으로 이동) / 직접입력(지도→날짜·시간)
    { key: "sc-venue-gate",   forScreen: "match-roomvenue", name: "①구장 정하기 · 방식 선택",   path: `${M_ROOM}/venue`,                    scenario: "match-coordinating" },
    { key: "sc-venue-partner",forScreen: "match-roomvenue", name: "②제휴구장 · 구장 고르기",     path: "/venues?match=mock_room",            scenario: "match-coordinating" },
    { key: "sc-venue-map",    forScreen: "match-roomvenue", name: "②'직접입력 · 지도에서 위치",  path: `${M_ROOM}/venue?venueMode=direct`,   scenario: "match-coordinating" },
    { key: "sc-venue-form",   forScreen: "match-roomvenue", name: "③직접입력 · 날짜·시간",       path: `${M_ROOM}/venue?venueMode=direct`,   scenario: "match-direct-form" },

    // 매치룸 목록 — 앱의 탭 그대로. 파라미터 없으면 전체(섹션 3개), ?tab= 이면 그 탭만.
    { key: "sc-roomlist-all",        forScreen: "match-roomlist",   name: "매치룸 목록 · 전체",       path: "/match-roomlist",                 scenario: "roomlist-full" },
    { key: "sc-roomlist-adjusting",  forScreen: "match-roomlist",   name: "매치룸 목록 · 조율중",     path: "/match-roomlist?tab=adjusting",   scenario: "roomlist-full" },
    { key: "sc-roomlist-confirmed",  forScreen: "match-roomlist",   name: "매치룸 목록 · 확정",       path: "/match-roomlist?tab=confirmed",   scenario: "roomlist-full" },
    { key: "sc-roomlist-past",       forScreen: "match-roomlist",   name: "매치룸 목록 · 지난경기",   path: "/match-roomlist?tab=past",        scenario: "roomlist-full" },
    { key: "sc-roomlist-cancelled",  forScreen: "match-roomlist",   name: "매치룸 목록 · 취소된경기", path: "/match-roomlist?tab=cancelled",   scenario: "roomlist-full" },
    { key: "sc-roomlist-empty",      forScreen: "match-roomlist",   name: "매치룸 목록 · 비어있음",    path: "/match-roomlist",                 scenario: "roomlist-empty" },

    { key: "sc-inbox-received",      forScreen: "matching-manage",  name: "매칭 관리 · 받은 제의",     path: "/matchingmanage", scenario: "inbox-received" },
    { key: "sc-inbox-sent",          forScreen: "matching-manage",  name: "매칭 관리 · 보낸 제의",     path: "/matchingmanage", scenario: "inbox-sent" },
    { key: "sc-inbox-mixed",         forScreen: "matching-manage",  name: "매칭 관리 · 주고받음",      path: "/matchingmanage", scenario: "inbox-mixed" },
    { key: "sc-inbox-empty",         forScreen: "matching-manage",  name: "매칭 관리 · 비어있음",      path: "/matchingmanage", scenario: "inbox-empty" },
  ],

  // 가입 직후 단계별 게이트 — 로그인은 됐지만 users 플래그가 없으면
  // /home 으로 들어가도 그 단계 화면이 대신 뜬다(라우트 게이트).
  auth: [
    { key: "sc-gate-consent",   forScreen: "agreement",   name: "①약관 동의 게이트",   path: "/home", scenario: "gate-consent" },
    { key: "sc-gate-phone",     forScreen: "phone-verify", name: "②전화인증 게이트",   path: "/home", scenario: "gate-phone" },
    { key: "sc-gate-basicinfo", forScreen: "basic-info",  name: "③기본정보 게이트",   path: "/home", scenario: "gate-basicinfo" },
    { key: "sc-gate-welcome",   forScreen: "signup-done", name: "④가입완료 게이트",   path: "/home", scenario: "gate-welcome" },
  ],

  home: [
    { key: "sc-home-newbie",  forScreen: "home", name: "홈 · 신규가입자(팀 없음)", path: "/home", scenario: "base-noteam" },
    { key: "sc-home-member",  forScreen: "home", name: "홈 · 일반 팀원",          path: "/home", scenario: "me-member" },
    { key: "sc-home-nothing", forScreen: "home", name: "홈 · 활동 기록 없음",      path: "/home", scenario: "me-nothing" },
    { key: "sc-pp-empty",     forScreen: "player-profile", name: "선수 프로필 · 미완성", path: "/player/mock_uid_me", scenario: "me-empty-profile" },
    { key: "sc-tp-solo",      forScreen: "team-profile",   name: "팀 프로필 · 팀원 1명", path: "/team/mock_club_me",  scenario: "team-solo" },
  ],

  // MY·설정 — 보는 사람의 지위/데이터 유무로 메뉴와 목록이 달라진다
  my: [
    { key: "sc-my-leader",   forScreen: "my", name: "마이 · 팀장",       path: "/my", scenario: "base-leader" },
    { key: "sc-my-member",   forScreen: "my", name: "마이 · 일반 팀원",   path: "/my", scenario: "me-member" },
    { key: "sc-my-noteam",   forScreen: "my", name: "마이 · 무소속",      path: "/my", scenario: "base-noteam" },
    { key: "sc-my-pd-empty", forScreen: "my-profile-detail", name: "프로필 상세 · 미완성", path: "/my/profile/detail", scenario: "me-empty-profile" },
    { key: "sc-my-posts-0",  forScreen: "my-posts",   name: "내가 쓴 글 · 없음",   path: "/my/posts",           scenario: "me-nothing" },
    { key: "sc-my-pm-0",     forScreen: "my-personal-matches", name: "개인경기 · 없음", path: "/my/personal-matches", scenario: "me-nothing" },
    { key: "sc-my-rep-0",    forScreen: "my-reports",  name: "신고내역 · 없음",   path: "/my/reports",          scenario: "me-nothing" },
    { key: "sc-my-blk-0",    forScreen: "settings-block", name: "차단관리 · 없음", path: "/settings/block-report", scenario: "me-nothing" },
  ],

  // 팀 — 신청·초대 유무
  team: [
    { key: "sc-team-jr-0",  forScreen: "team-join-requests", name: "가입 신청 · 없음", path: "/team/mock_club_me/join-requests", scenario: "team-empty" },
    { key: "sc-team-inv-0", forScreen: "my-team-invites",    name: "받은 초대 · 없음", path: "/my/team-invites",                 scenario: "team-empty" },
    { key: "sc-team-mng-member", forScreen: "team-manage",   name: "팀 관리 · 팀원(권한없음)", path: "/team/mock_club_me/manage", scenario: "me-member" },
  ],

  community: [
    { key: "sc-comm-empty",   forScreen: "community",        name: "커뮤니티 · 글 없음",     path: "/community",                scenario: "community-empty" },
    { key: "sc-post-others",  forScreen: "community-detail",  name: "글 상세 · 남의 글",      path: "/communitypost/mock_post_5", scenario: "post-others" },
    { key: "sc-post-nocmt",   forScreen: "community-detail",  name: "글 상세 · 댓글 없음",    path: "/communitypost/mock_post",   scenario: "post-no-comment" },
    { key: "sc-noti-empty",   forScreen: "notifications",     name: "알림함 · 비어있음",      path: "/notifications",             scenario: "noti-empty" },
    { key: "sc-noti-read",    forScreen: "notifications",     name: "알림함 · 전부 읽음",     path: "/notifications",             scenario: "noti-all-read" },
    // 기본(6-04)은 빈 목록이 실제 앱 상태다 — DM 을 만드는 진입점이 없다.
    // 이 프레임은 "DM 진입점을 붙였을 때" 레이아웃 확인용.
    { key: "sc-chat-dm", forScreen: "chats", name: "채팅 목록 · DM 있음(미구현)", path: "/chats", scenario: "chat-dm" },
  ],

  // 관리자 — 빈 상태 / 처리 대기 많은 상태
  admin: [
    { key: "sc-adm-u-0",    forScreen: "admin-users-list",   name: "회원 목록 · 없음",     path: "/admin/users/list",   scenario: "admin-empty" },
    { key: "sc-adm-t-0",    forScreen: "admin-teams-list",   name: "팀 목록 · 없음",       path: "/admin/teams/list",   scenario: "admin-empty" },
    { key: "sc-adm-m-0",    forScreen: "admin-matches-list", name: "매칭 목록 · 없음",     path: "/admin/matches/list", scenario: "admin-empty" },
    { key: "sc-adm-c-0",    forScreen: "admin-community-posts", name: "게시글 · 없음",     path: "/admin/community/posts", scenario: "admin-empty" },
    { key: "sc-adm-i-0",    forScreen: "admin-inquiries",    name: "문의 · 없음",          path: "/admin/inquiries",    scenario: "admin-empty" },
    { key: "sc-adm-dash-0", forScreen: "admin-dashboard",    name: "대시보드 · 데이터 없음", path: "/admin/dashboard",   scenario: "admin-empty" },
    { key: "sc-adm-i-busy", forScreen: "admin-inquiries",    name: "문의 · 답변대기 4건",   path: "/admin/inquiries",    scenario: "admin-pending" },
    { key: "sc-adm-v-busy", forScreen: "admin-venues",       name: "구장 · 심사 신청 1건",  path: "/admin/venues",       scenario: "admin-pending" },
  ],

  // 구장주 — 심사 단계(승인 전 상태는 기본 세션으로 볼 수 없다) + 구장 등록 8단계 위저드
  owner: [
    { key: "sc-owner-noven",    forScreen: "owner-onboarding", name: "구장 미등록(온보딩)", path: "/owner/onboarding", scenario: "owner-noven" },
    { key: "sc-owner-pending",  forScreen: "owner-pending",    name: "심사 대기",          path: "/owner/pending",    scenario: "owner-pending" },
    { key: "sc-owner-rejected", forScreen: "owner-pending",    name: "심사 반려",          path: "/owner/pending",    scenario: "owner-rejected" },

    // 구장주 가입도 단계형(4단계) → 온보딩과 같이 ?step= 으로 한 장씩 본다.
    { key: "sc-osu-1", forScreen: "owner-signup", name: "가입①이메일",     path: "/owner/signup?step=email",    scenario: "" },
    { key: "sc-osu-2", forScreen: "owner-signup", name: "가입②비밀번호",   path: "/owner/signup?step=password", scenario: "" },
    { key: "sc-osu-3", forScreen: "owner-signup", name: "가입③담당자명",   path: "/owner/signup?step=name",     scenario: "" },
    { key: "sc-osu-4", forScreen: "owner-signup", name: "가입④휴대폰인증", path: "/owner/signup?step=phone",    scenario: "" },

    // 온보딩(실제 등록 흐름)은 8단계 위저드 → 단계별로 한 장씩 본다.
    // 편의시설·이용안내·키워드는 승인 후 구장정보에서, 정산 계좌는 승인 후 내정보에서
    // 받도록 빠졌다(온보딩에서 제거) → 그 단계 프레임도 함께 없앴다.
    { key: "sc-onb-1",  forScreen: "owner-onboarding", name: "온보딩①시작",      path: "/owner/onboarding?step=intro",    scenario: "owner-noven" },
    { key: "sc-onb-2",  forScreen: "owner-onboarding", name: "온보딩②구장명",    path: "/owner/onboarding?step=name",     scenario: "owner-noven" },
    { key: "sc-onb-3",  forScreen: "owner-onboarding", name: "온보딩③위치",      path: "/owner/onboarding?step=location", scenario: "owner-noven" },
    { key: "sc-onb-4",  forScreen: "owner-onboarding", name: "온보딩④사진",      path: "/owner/onboarding?step=photos",   scenario: "owner-noven" },
    { key: "sc-onb-5",  forScreen: "owner-onboarding", name: "온보딩⑤코트·요금", path: "/owner/onboarding?step=courts",   scenario: "owner-noven" },
    { key: "sc-onb-6",  forScreen: "owner-onboarding", name: "온보딩⑥연락처",    path: "/owner/onboarding?step=contact",  scenario: "owner-noven" },
    { key: "sc-onb-7",  forScreen: "owner-onboarding", name: "온보딩⑦주체증빙",  path: "/owner/onboarding?step=verify",   scenario: "owner-noven" },
    { key: "sc-onb-8",  forScreen: "owner-onboarding", name: "온보딩⑧최종확인",  path: "/owner/onboarding?step=review",   scenario: "owner-noven" },

    // 운영 주체(개인·사업자/학교/기관)로 갈리는 단계만 세 벌로 본다.
    // 위 기본 프레임이 개인·사업자 버전이므로 여기엔 학교·기관만 얹는다.
    // ⚠️ 이름에 " · " 를 넣지 말 것 — 상세 리뷰가 앞부분을 잘라내(AuthReview 의 라벨 정리)
    //    "학교 · 온보딩⑨연락처" 가 "온보딩⑨연락처" 로 보여 주체 구분이 사라진다.
    { key: "sc-onb-school-1", forScreen: "owner-onboarding", name: "온보딩①시작(학교)",    path: "/owner/onboarding?step=intro",   scenario: "owner-noven-school" },
    { key: "sc-onb-school-2", forScreen: "owner-onboarding", name: "온보딩②구장명(학교)",  path: "/owner/onboarding?step=name",    scenario: "owner-noven-school" },
    { key: "sc-onb-school-6", forScreen: "owner-onboarding", name: "온보딩⑥연락처(학교)",  path: "/owner/onboarding?step=contact", scenario: "owner-noven-school" },
    { key: "sc-onb-school-7", forScreen: "owner-onboarding", name: "온보딩⑦학교확인(학교)",path: "/owner/onboarding?step=verify",  scenario: "owner-noven-school" },
    { key: "sc-onb-school-8", forScreen: "owner-onboarding", name: "온보딩⑧최종확인(학교)",path: "/owner/onboarding?step=review",  scenario: "owner-noven-school" },
    { key: "sc-onb-org-1",    forScreen: "owner-onboarding", name: "온보딩①시작(기관)",    path: "/owner/onboarding?step=intro",   scenario: "owner-noven-org" },
    { key: "sc-onb-org-2",    forScreen: "owner-onboarding", name: "온보딩②구장명(기관)",  path: "/owner/onboarding?step=name",    scenario: "owner-noven-org" },
    { key: "sc-onb-org-6",    forScreen: "owner-onboarding", name: "온보딩⑥연락처(기관)",  path: "/owner/onboarding?step=contact", scenario: "owner-noven-org" },
    { key: "sc-onb-org-7",    forScreen: "owner-onboarding", name: "온보딩⑦기관확인(기관)",path: "/owner/onboarding?step=verify",  scenario: "owner-noven-org" },
    { key: "sc-onb-org-8",    forScreen: "owner-onboarding", name: "온보딩⑧최종확인(기관)",path: "/owner/onboarding?step=review",  scenario: "owner-noven-org" },

    // 인증·계좌·통신판매업이 다 채워진 상태 — base-owner 로는 "미등록" 화면만 보인다.
    { key: "sc-own-my-done",  forScreen: "owner-my",         name: "내정보 · 인증·계좌 등록완료", path: "/owner/my",         scenario: "owner-verified" },
    { key: "sc-own-set-done", forScreen: "owner-settlement",  name: "정산 · 계좌 확인완료",        path: "/owner/settlement", scenario: "owner-verified" },
    { key: "sc-own-home-noacct", forScreen: "owner-home",     name: "예약관리 · 계좌 미등록 배너",  path: "/owner/home",       scenario: "base-owner" },

    { key: "sc-own-busy",  forScreen: "owner-home",  name: "예약관리 · 승인대기 3건", path: "/owner/home",  scenario: "owner-busy" },
    { key: "sc-own-quiet", forScreen: "owner-home",  name: "예약관리 · 예약 없음",    path: "/owner/home",  scenario: "owner-quiet" },
    { key: "sc-own-s-0",   forScreen: "owner-sales", name: "예약통계 · 예약 없음",    path: "/owner/sales", scenario: "owner-quiet" },
  ],

  // 구장 예약 흐름 — 목록부터 결제·결과·내 예약까지 순서대로 늘어놓는다.
  venue: [
    { key: "sc-v1-list",      forScreen: "venues",          name: "①구장 목록",        path: "/venues",                                   scenario: "venue-flow" },
    { key: "sc-v2-detail",    forScreen: "venue-book",      name: "②구장 상세",        path: "/venue-book/mock_venue",                    scenario: "venue-flow" },
    { key: "sc-v4-pay",       forScreen: "pay",             name: "④결제(토스 위젯)",  path: "/pay/mock_reservation",                     scenario: "venue-flow" },
    { key: "sc-v5-success",   forScreen: "pay-success",     name: "⑤결제 성공 · 확정",  path: "/pay/success?orderId=mock_order_20260802_001&paymentKey=mock_pk&amount=84000", scenario: "venue-flow" },
    // 매칭 제휴구장은 팀당 1건이라, 우리 팀이 내도 상대 팀이 안 내면 확정이 아니다.
    { key: "sc-v5b-success-wait", forScreen: "pay-success", name: "⑤'결제 성공 · 상대팀 대기", path: "/pay/success?orderId=mock_order_20260802_001&paymentKey=mock_pk&amount=42000", scenario: "pay-share-waiting" },
    { key: "sc-v6-fail",      forScreen: "pay-fail",        name: "⑤'결제 실패",       path: "/pay/fail?message=%EA%B2%B0%EC%A0%9C%EB%A5%BC%20%EC%B7%A8%EC%86%8C%ED%96%88%EC%96%B4%EC%9A%94", scenario: "venue-flow" },
    { key: "sc-v7-resv-req",  forScreen: "my-reservations", name: "⑥내 예약 · 승인대기", path: "/my/reservations",                        scenario: "resv-requested" },
    { key: "sc-v8-resv-conf", forScreen: "my-reservations", name: "⑥'내 예약 · 확정",   path: "/my/reservations",                         scenario: "resv-confirmed" },
    { key: "sc-v9-resv-none", forScreen: "my-reservations", name: "내 예약 · 비어있음",  path: "/my/reservations",                         scenario: "resv-empty" },
    { key: "sc-v10-none",     forScreen: "venues",          name: "구장 목록 · 비어있음", path: "/venues",                                 scenario: "venues-empty" },
  ],

  // 랜딩 — 760px 아래에서 레이아웃이 갈린다(내비 메뉴 숨김 · 팀월 2열 · PC푸터↔앱푸터 교체).
  // 기본 프레임이 PC(pc:true)이므로 여기엔 폰 폭 버전만 얹는다.
  // ⚠️ 이름에 " · " 를 넣지 말 것 — 상세 리뷰의 라벨 정리가 앞부분을 잘라낸다.
  landing: [
    { key: "sc-lp-m-hero",     forScreen: "landing-hero",     name: "모바일 히어로",      path: `${LP}#main`,     pc: false },
    { key: "sc-lp-m-teams",    forScreen: "landing-teams",    name: "모바일 참여 팀",     path: `${LP}#teams`,    pc: false },
    { key: "sc-lp-m-features", forScreen: "landing-features", name: "모바일 기능 소개",   path: `${LP}#features`, pc: false },
    { key: "sc-lp-m-venue",    forScreen: "landing-venue",    name: "모바일 구장 예약",   path: `${LP}#venue`,    pc: false },
    { key: "sc-lp-m-ranking",  forScreen: "landing-ranking",  name: "모바일 명예의 전당", path: `${LP}#ranking`,  pc: false },
    { key: "sc-lp-m-contact",  forScreen: "landing-contact",  name: "모바일 제휴 문의",   path: `${LP}#contact`,  pc: false },
    { key: "sc-lp-m-footer",   forScreen: "landing-footer",   name: "모바일 CTA/푸터",    path: `${LP}#cta`,      pc: false },
  ],
};

// 프레임 URL 조립
//  · mock=<시나리오>  → 로그인 없이 뜨고, 데이터가 항상 같다
//  · freeze=1        → 페이지가 스스로 navigate() 해도 그 화면에 머문다(스플래시→홈 자동이동 차단)
//    "조작" 켠 프레임은 freeze 를 빼서 실제로 눌러볼 수 있게 한다.
//  · 해시(#섹션)는 언제나 맨 뒤에 남긴다 — 랜딩처럼 앵커로 섹션을 잡는 프레임에서
//    "…#main?freeze=1" 이 되면 앵커 이름이 깨져 그 섹션으로 스크롤되지 않는다.
export function withQuery(path, params) {
  const p = String(path || "");
  if (!p || !params.length) return p;
  const i = p.indexOf("#");
  const base = i < 0 ? p : p.slice(0, i);
  const hash = i < 0 ? "" : p.slice(i);
  return base + (base.includes("?") ? "&" : "?") + params.join("&") + hash;
}

export function frameSrc(frame, { freeze = true } = {}) {
  const p = String(frame.path || "");
  if (!p) return "";
  const q = [];
  if (frame.scenario) q.push("mock=" + frame.scenario);
  if (freeze) q.push("freeze=1");
  return withQuery(p, q);
}

// 보드가 그릴 섹션 목록
// 도메인 기본 세션으로는 볼 수 없는 화면 — 그 화면만 다른 시나리오로 띄운다.
//  · 심사 현황은 venue.status 가 approved 면 /owner/home 으로 넘어가 빈 화면이 된다.
//  · 온보딩은 base-owner(승인된 구장 보유)로 열면 "기존 구장 수정" 모드로 프리필돼
//    신규 등록 화면이 안 보인다 → 구장 미등록 세션으로 띄운다.
const SCREEN_SCENARIO = {
  "owner-pending": "owner-pending",
  "owner-onboarding": "owner-noven",
};

export const BOARD_SECTIONS = DOMAINS.map((d) => {
  const base = DOMAIN_BASE[d.key] || "";
  const screens = d.screens.map((s) => ({
    key: s.id,
    reviewId: s.id,           // 클릭 시 /review/:id 상세 리뷰로 이동
    no: s.no,
    name: s.name,
    path: s.path,
    pc: s.pc, // 프레임 폭을 화면별로 지정(랜딩). undefined 면 섹션 기본(wide)을 따른다.
    scenario: SCREEN_SCENARIO[s.id] || base,
  }));
  const extras = (EXTRA_FRAMES[d.key] || []).map((f) => ({ ...f, no: "변형" }));
  return {
    key: d.key,
    label: d.label,
    group: d.group || "",
    wide: d.key === "admin", // 관리자만 PC 폭
    frames: [...screens, ...extras],
  };
});

export const BOARD_TOTAL = BOARD_SECTIONS.reduce((n, s) => n + s.frames.length, 0);

// ── /review/:id 상세 리뷰에서도 쓰는 헬퍼 ──────────────────
// 도메인 기본 세션(로그인 흉내)
export function baseScenarioFor(domainKey) {
  return DOMAIN_BASE[domainKey] || "";
}

// 그 화면에 실제로 쓸 시나리오 (화면별 예외 > 도메인 기본)
export function scenarioForScreen(domainKey, screenId) {
  return SCREEN_SCENARIO[screenId] || baseScenarioFor(domainKey);
}

// 그 화면에 등록된 "경우의 수" 목록 — 상세 리뷰에서 골라 볼 수 있게.
export function variantsForScreen(domainKey, screenId) {
  return (EXTRA_FRAMES[domainKey] || []).filter((f) => f.forScreen === screenId);
}
