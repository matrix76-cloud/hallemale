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
};

// ── 경우의 수 프레임 (1차: 매칭) ────────────────────────────
// 같은 화면을 시나리오만 바꿔 여러 장 띄운다. 매치룸 id 는 목업이라 아무 값이나 무방.
const M_ROOM = "/match-roomdetail/mock_room";

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

    // 온보딩(실제 등록 흐름)은 10단계 위저드 → 단계별로 한 장씩 본다.
    { key: "sc-onb-1",  forScreen: "owner-onboarding", name: "온보딩①시작",      path: "/owner/onboarding?step=intro",      scenario: "owner-noven" },
    { key: "sc-onb-2",  forScreen: "owner-onboarding", name: "온보딩②구장명",    path: "/owner/onboarding?step=name",       scenario: "owner-noven" },
    { key: "sc-onb-3",  forScreen: "owner-onboarding", name: "온보딩③위치",      path: "/owner/onboarding?step=location",   scenario: "owner-noven" },
    { key: "sc-onb-4",  forScreen: "owner-onboarding", name: "온보딩④사진",      path: "/owner/onboarding?step=photos",     scenario: "owner-noven" },
    { key: "sc-onb-5",  forScreen: "owner-onboarding", name: "온보딩⑤편의시설",  path: "/owner/onboarding?step=facilities", scenario: "owner-noven" },
    { key: "sc-onb-6",  forScreen: "owner-onboarding", name: "온보딩⑥코트·요금", path: "/owner/onboarding?step=courts",     scenario: "owner-noven" },
    { key: "sc-onb-7",  forScreen: "owner-onboarding", name: "온보딩⑦이용안내",  path: "/owner/onboarding?step=notice",     scenario: "owner-noven" },
    { key: "sc-onb-8",  forScreen: "owner-onboarding", name: "온보딩⑧키워드",    path: "/owner/onboarding?step=keywords",   scenario: "owner-noven" },
    { key: "sc-onb-9",  forScreen: "owner-onboarding", name: "온보딩⑨연락처",    path: "/owner/onboarding?step=contact",    scenario: "owner-noven" },
    { key: "sc-onb-10", forScreen: "owner-onboarding", name: "온보딩⑩주체증빙",  path: "/owner/onboarding?step=verify",     scenario: "owner-noven" },
    // 정산 계좌는 앱내 결제(PG)를 켰을 때만 나오는 단계 → 개발 빌드 전용 ?pg=1 로 미리 본다.
    { key: "sc-onb-11", forScreen: "owner-onboarding", name: "온보딩⑪정산계좌",  path: "/owner/onboarding?step=payout&pg=1", scenario: "owner-noven" },
    { key: "sc-onb-12", forScreen: "owner-onboarding", name: "온보딩⑫최종확인",  path: "/owner/onboarding?step=review",     scenario: "owner-noven" },

    // 운영 주체(개인·사업자/학교/기관)로 갈리는 단계만 세 벌로 본다.
    // 위 기본 프레임이 개인·사업자 버전이므로 여기엔 학교·기관만 얹는다.
    // ⚠️ 이름에 " · " 를 넣지 말 것 — 상세 리뷰가 앞부분을 잘라내(AuthReview 의 라벨 정리)
    //    "학교 · 온보딩⑨연락처" 가 "온보딩⑨연락처" 로 보여 주체 구분이 사라진다.
    { key: "sc-onb-school-1", forScreen: "owner-onboarding", name: "온보딩①시작(학교)",    path: "/owner/onboarding?step=intro",   scenario: "owner-noven-school" },
    { key: "sc-onb-school-2", forScreen: "owner-onboarding", name: "온보딩②구장명(학교)",  path: "/owner/onboarding?step=name",    scenario: "owner-noven-school" },
    { key: "sc-onb-school-9", forScreen: "owner-onboarding", name: "온보딩⑨연락처(학교)",  path: "/owner/onboarding?step=contact", scenario: "owner-noven-school" },
    { key: "sc-onb-school-10",forScreen: "owner-onboarding", name: "온보딩⑩학교확인(학교)",path: "/owner/onboarding?step=verify",  scenario: "owner-noven-school" },
    { key: "sc-onb-school-11",forScreen: "owner-onboarding", name: "온보딩⑪정산계좌(학교)",path: "/owner/onboarding?step=payout&pg=1", scenario: "owner-noven-school" },
    { key: "sc-onb-school-12",forScreen: "owner-onboarding", name: "온보딩⑫최종확인(학교)",path: "/owner/onboarding?step=review",  scenario: "owner-noven-school" },
    { key: "sc-onb-org-1",    forScreen: "owner-onboarding", name: "온보딩①시작(기관)",    path: "/owner/onboarding?step=intro",   scenario: "owner-noven-org" },
    { key: "sc-onb-org-2",    forScreen: "owner-onboarding", name: "온보딩②구장명(기관)",  path: "/owner/onboarding?step=name",    scenario: "owner-noven-org" },
    { key: "sc-onb-org-9",    forScreen: "owner-onboarding", name: "온보딩⑨연락처(기관)",  path: "/owner/onboarding?step=contact", scenario: "owner-noven-org" },
    { key: "sc-onb-org-10",   forScreen: "owner-onboarding", name: "온보딩⑩기관확인(기관)",path: "/owner/onboarding?step=verify",  scenario: "owner-noven-org" },
    { key: "sc-onb-org-11",   forScreen: "owner-onboarding", name: "온보딩⑪정산계좌(기관)",path: "/owner/onboarding?step=payout&pg=1", scenario: "owner-noven-org" },
    { key: "sc-onb-org-12",   forScreen: "owner-onboarding", name: "온보딩⑫최종확인(기관)",path: "/owner/onboarding?step=review",  scenario: "owner-noven-org" },

    // 등록 폼은 한 화면에 다 넣지 않고 8단계로 나눴다 → 단계별로 한 장씩 본다.
    // (반려 후 "다시 신청" 경로에서 쓰는 폼. 신규 등록은 위 온보딩으로 간다)
    { key: "sc-reg-1", forScreen: "owner-register", name: "등록①기본정보",   path: "/owner/register?step=basic",    scenario: "owner-noven" },
    { key: "sc-reg-2", forScreen: "owner-register", name: "등록②사진",       path: "/owner/register?step=photo",    scenario: "owner-noven" },
    { key: "sc-reg-3", forScreen: "owner-register", name: "등록③편의시설",   path: "/owner/register?step=facility", scenario: "owner-noven" },
    { key: "sc-reg-4", forScreen: "owner-register", name: "등록④코트·요금",  path: "/owner/register?step=court",    scenario: "owner-noven" },
    { key: "sc-reg-5", forScreen: "owner-register", name: "등록⑤운영시간",   path: "/owner/register?step=hours",    scenario: "owner-noven" },
    { key: "sc-reg-6", forScreen: "owner-register", name: "등록⑥이용안내",   path: "/owner/register?step=notice",   scenario: "owner-noven" },
    { key: "sc-reg-7", forScreen: "owner-register", name: "등록⑦사업자정보", path: "/owner/register?step=biz",      scenario: "owner-noven" },
    { key: "sc-reg-8", forScreen: "owner-register", name: "등록⑧최종확인",   path: "/owner/register?step=confirm",  scenario: "owner-noven" },
    { key: "sc-reg-school-7",  forScreen: "owner-register", name: "등록⑦학교정보(학교)",   path: "/owner/register?step=biz",     scenario: "owner-noven-school" },
    { key: "sc-reg-school-8",  forScreen: "owner-register", name: "등록⑧최종확인(학교)",   path: "/owner/register?step=confirm", scenario: "owner-noven-school" },
    { key: "sc-reg-org-7",     forScreen: "owner-register", name: "등록⑦기관정보(기관)",   path: "/owner/register?step=biz",     scenario: "owner-noven-org" },
    { key: "sc-reg-org-8",     forScreen: "owner-register", name: "등록⑧최종확인(기관)",   path: "/owner/register?step=confirm", scenario: "owner-noven-org" },

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
};

// 프레임 URL 조립
//  · mock=<시나리오>  → 로그인 없이 뜨고, 데이터가 항상 같다
//  · freeze=1        → 페이지가 스스로 navigate() 해도 그 화면에 머문다(스플래시→홈 자동이동 차단)
//    "조작" 켠 프레임은 freeze 를 빼서 실제로 눌러볼 수 있게 한다.
export function frameSrc(frame, { freeze = true } = {}) {
  const p = String(frame.path || "");
  if (!p) return "";
  const q = [];
  if (frame.scenario) q.push("mock=" + frame.scenario);
  if (freeze) q.push("freeze=1");
  if (!q.length) return p;
  return p + (p.includes("?") ? "&" : "?") + q.join("&");
}

// 보드가 그릴 섹션 목록
// 도메인 기본 세션으로는 볼 수 없는 화면 — 그 화면만 다른 시나리오로 띄운다.
//  · 심사 현황은 venue.status 가 approved 면 /owner/home 으로 넘어가 빈 화면이 된다.
//  · 등록 폼은 base-owner(승인된 구장 보유)로 열면 "기존 구장 수정" 모드로 프리필돼
//    신규 등록 화면이 안 보인다 → 구장 미등록 세션으로 띄운다.
const SCREEN_SCENARIO = {
  "owner-pending": "owner-pending",
  "owner-onboarding": "owner-noven",
  "owner-register": "owner-noven",
};

export const BOARD_SECTIONS = DOMAINS.map((d) => {
  const base = DOMAIN_BASE[d.key] || "";
  const screens = d.screens.map((s) => ({
    key: s.id,
    reviewId: s.id,           // 클릭 시 /review/:id 상세 리뷰로 이동
    no: s.no,
    name: s.name,
    path: s.path,
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
