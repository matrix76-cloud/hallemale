// 관리자(admin) 도메인 감사 결과를 리뷰 허브 기록 스레드에 올린다.
// 지시서 #9 — 10-01~10-32 화면 32개. 1~3차 라운드 결과를 화면당 1건으로 묶어 기록한다.
// 상세 근거는 docs/review-system/admin-audit.md 에 있다(여기는 형이 읽는 요약).
//
// reviewThreads 는 현재 전면 공개(firestore.rules, AI 에이전트 기록용) — 인증 불필요.
//
// 사용: node scripts/post-admin-review.mjs          → 올릴 내용만 출력 (dry-run)
//       node scripts/post-admin-review.mjs --apply  → 실제 기록

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const APPLY = process.argv.includes("--apply");
const BY = "AI"; // AuthReview.jsx 작성자 토글 값과 일치해야 파란 카드로 렌더된다
const COL = "reviewThreads";

const kstNow = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

// screenId 는 src/dev/reviewData.js 의 ADMIN_REVIEW 와 일치해야 한다.
const ENTRIES = [
  {
    screenId: "admin-dashboard",
    text: `[10-01 대시보드]
● 결함:
  1) 총득점 32,840 · 누적기부금 328,400원이 하드코딩 더미인데 실적처럼 보인다. 화면에 "예시"라는 표시가 없어 대외 발표에 쓰일 위험. (치명급 파급, 심각도 중대)
  2) "팀 등록 / 선수 등록" 카드가 항상 0 — 승인 집계가 아예 없다. 우측 "승인" 탭도 영구 빈 화면.
  3) 완료 경기(finished) 전수 무제한 로드 — 경기가 쌓일수록 대시보드가 느려지다 안 뜨게 된다.
  4) [경미] 주간 요약이 2000건에서 조용히 잘림 / 시:분 표시가 KST 아닌 브라우저 시간 / 총득점 칩이 눌리는 모양인데 동작 없음.
● 재현: /admin/dashboard 진입. 기부금 카드 확인 → 데이터를 아무리 바꿔도 숫자가 그대로.
● 근거: spec 비어 있음(기준 없음) — 코드 정적 감사.
● 추정 원인 파일: AdminDashboardPage.jsx:478-479, :610-619, :649-659 / adminDashboardService.js:245-248, :419, :450-452
● 심각도: 중대 3 · 경미 4
※ 4열 KPI가 리뷰 프레임에서 좁아 보이는 건 0.6 축소 탓 — 결함 아님.`,
  },
  {
    screenId: "admin-login",
    text: `[10-02 관리자 로그인]
● 결함:
  1) [치명·고침] 로그인 엔드포인트가 계정이 없으면 admin/admin 슈퍼계정을 자동 생성했다 — 아무나 한 번 호출하면 관리자 콘솔 전체를 가져갈 수 있었다. 시도 제한도 없었고 비밀번호는 무솔트 SHA-256 4자 이상이었다.
     → 자동 생성 제거(최초 1회는 서버 환경변수를 아는 사람만) · 5회 실패 시 15분 잠금 · PBKDF2 21만회 · 최소 10자로 교체 완료.
  2) [중대·미수정] "자동로그인" 체크박스가 아무 일도 안 한다. 꺼도 세션이 남는다 — 공용 PC에서 신뢰를 배신하는 컨트롤.
  3) [경미] 아이디/비번 입력에 autoComplete·name 없음(비밀번호 관리자 인식 불가).
● 재현: 체크박스를 끄고 로그인 → 브라우저 껐다 켜도 로그인 유지.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: functions/auth/adminLogin.js / AdminLoginPage.jsx:149, :256-262
● 심각도: 치명 1(수정 완료) · 중대 1 · 경미 1
● 형이 정해줘야 할 것: 운영 DB의 admin 계정 비밀번호가 아직 'admin'인지 — 코드로는 확인이 안 된다. 로그인해서 10자 이상으로 바꿔줘.`,
  },
  {
    screenId: "admin-users-list",
    text: `[10-03 회원 목록]
● 결함:
  1) [중대] 최근 200명만 보이고 검색도 그 200명 안에서만 된다. 회원이 200명을 넘으면 201번째부터는 목록에도 검색에도 영영 안 나온다. 잘렸다는 표시도 없다.
  2) [중대] 조회 창은 "최근 수정순"인데 화면은 "새로 가입한 순"이라고 적고 다시 정렬한다. 프로필을 최근 고친 회원이 창을 차지하면 더 최근 가입자가 밀려난다. updatedAt 없는 옛 계정은 아예 안 보인다.
  3) [경미] 운영 코드에 디버그 로그 / 차단 후 목록 갱신 없이 이동.
● 재현: 회원 201명 이상인 상태에서 최근 가입자 닉네임 검색 → 안 나옴.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminPlayersListPage.jsx:596, :603, :642-650 / adminPlayersService.js:212, :236
● 심각도: 중대 2 · 경미 2`,
  },
  {
    screenId: "admin-users-ranking",
    text: `[10-04 회원 랭킹]
● 이상 없음 — 사용자 랭킹 화면(PlayerRankingFullPage)을 그대로 감싼 48줄 래퍼다. 자체 로직이 없어 이 화면만의 결함이 생길 여지가 없다.
● 근거: spec 비어 있음 → 기준 없음`,
  },
  {
    screenId: "admin-users-reports",
    text: `[10-05 회원 신고]
● 결함:
  1) [중대] user_reports 전수 조회(상한 없음) — 신고가 쌓이면 화면이 느려지다 안 뜬다.
  2) [중대] 대상을 차단해도 그 사람에 대한 나머지 신고는 "처리 대기"로 남는다. 같은 사람 신고 5건이면 4건이 남아 이미 차단된 회원을 또 차단하게 만든다.
  3) [경미] 처리자가 항상 문자열 "admin" — 어느 운영자가 처리했는지 안 남는다.
● 재현: 한 회원에 대해 신고 2건을 만든 뒤 하나를 차단 처리 → 나머지 1건이 대기에 그대로.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: userReportService.js:85-95, :147 / AdminUsersReportsPage.jsx:381-390
● 심각도: 중대 2 · 경미 1`,
  },
  {
    screenId: "admin-users-blocks",
    text: `[10-06 회원 차단]
● 결함:
  1) [중대·COMMON] 차단이 서버에서 강제되지 않는다. 화면 오버레이일 뿐이라 차단된 계정도 글·채팅·매칭 신청이 그대로 되고, 본인이 자기 문서의 blocked를 false로 되돌릴 수도 있다. (firestore.rules 문제 — 공용 파일이라 지휘 취합 대상)
  2) [경미] "차단자" 열이 항상 admin으로 하드코딩.
● 재현: 차단된 계정으로 로그인 → 커뮤니티 글 작성 시도.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: firestore.rules:81 / AdminPlayersListPage.jsx:578
● 심각도: 중대 1(COMMON) · 경미 1`,
  },
  {
    screenId: "admin-teams-list",
    text: `[10-07 팀 목록]
● 결함:
  1) [중대] 지역·기간·키워드 필터가 "최근 200팀" 안에서만 동작한다. "제주"로 걸러도 실제 제주 팀 전체가 아니라 최근 200팀 중 제주다 — 건수를 그대로 믿으면 판단이 틀어진다.
  2) [중대] 팀 하나당 쿼리 2회(멤버 수·가입신청 수) — 목록 한 번에 최대 400 왕복이라 느리고 비싸다.
  3) [중대] updatedAt 필드가 없는 옛 팀은 목록에서 통째로 사라진다.
● 재현: 팀 200개 초과 상태에서 지역 필터 → 실제보다 적게 나온다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminTeamsListPage.jsx:629 / adminTeamsService.js:233-272
● 심각도: 중대 3`,
  },
  {
    screenId: "admin-teams-ranking",
    text: `[10-08 팀 랭킹]
● 이상 없음 — 사용자 팀 랭킹 화면(TeamRankingFullPage)을 카드로 감싼 55줄 래퍼다. 자체 로직 없음.
● 근거: spec 비어 있음 → 기준 없음`,
  },
  {
    screenId: "admin-teams-reports",
    text: `[10-09 팀 신고]
● 결함:
  1) [중대] team_reports 전수 조회(상한 없음). 10-05와 같은 구조다.
  2) [중대] 팀을 차단해도 그 팀에 대한 나머지 신고는 대기열에 남는다 — 이미 차단한 팀을 또 차단하게 된다.
  3) [중대] 차단은 됐는데 신고 처리가 실패하면 그대로 어긋난다(팀은 차단, 신고는 대기). 실패해도 화면은 차단 목록으로 넘어간다.
  4) [경미] 처리자가 항상 "admin" / 리뷰 목업이 이 화면에만 안 걸려 있어 리뷰 프레임이 실 DB를 친다.
● 재현: 한 팀에 신고 2건 → 하나를 차단 처리 → 나머지가 대기에 남는다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: teamReportService.js:81-88 / AdminTeamsReportsPage.jsx:383-393
● 심각도: 중대 3 · 경미 2`,
  },
  {
    screenId: "admin-teams-blocks",
    text: `[10-10 팀 차단]
● 이상 없음 — 서비스는 10-06과 대칭으로 정상이고, clubs.blocked는 팀 프로필에서 실제로 소비된다(오버레이 노출까지 확인).
● 다만 회원 차단과 같은 COMMON 문제를 공유한다: 서버 규칙이 clubs 쓰기를 막지 않아 로그인한 누구나 blocked를 되돌릴 수 있다.
● 근거: spec 비어 있음(기준 없음).
● 심각도: 중대 1(COMMON, 10-06과 동일 뿌리)`,
  },
  {
    screenId: "admin-matches-list",
    text: `[10-11 매칭 목록]
● 결함: [중대] 상태 필터에 실제 상태가 빠져 있다. 필터는 pending/accepted/rejected/cancelled/finished 뿐인데, 매칭에는 proposed·awaiting_venue_approval·confirmed가 실재한다. 제휴구장 결제로 확정된 경기는 상태로 골라낼 방법이 없다.
● 재현: 구장 결제까지 끝난 경기를 상태 필터로 찾기 → 어느 탭에도 안 잡힘.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminMatchesService.js:135-141
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-matches-issues",
    text: `[10-12 분쟁/신고]
● 감사 제외 — 이번 라운드에 내가 직접 새로 구현한 화면이다(플레이스홀더였음). 자기 구현은 같은 눈으로 보면 놓치므로 다음 회차에 다른 관점으로 다시 본다.
● 근거: spec 비어 있음(기준 없음).`,
  },
  {
    screenId: "admin-community-posts",
    text: `[10-13 커뮤니티 글]
● 결함:
  1) [중대] 게시글 전수 조회 + 작성자마다 순차 왕복 — 작성자가 200명이면 200번을 줄 세워 기다린다.
  2) [중대] 댓글 500개가 넘는 글을 지우면 댓글이 고아로 남는다(배치 500건 제한, 분할 없음). 게다가 실패를 삼키고 글 삭제는 그대로 진행한다.
  3) [중대] 첨부 이미지가 Storage에 그대로 남는다.
  4) [경미] 댓글 수 감소가 원자적이지 않다.
● 재현: 댓글 많은 글 삭제 → 댓글 문서가 DB에 남아 있음.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminCommunityService.js:57-77, :254-306
● 심각도: 중대 3 · 경미 1
※ 이번 라운드는 서비스 계층까지만 봤다. 화면 레이어는 다음 회차.`,
  },
  {
    screenId: "admin-community-detail",
    text: `[10-14 커뮤니티 글 상세]
● 서비스 계층만 확인 — 결함은 10-13과 같은 뿌리(삭제 시 댓글·이미지 정리 누락)를 공유한다.
● 화면 레이어(상세 렌더·액션 버튼)는 이번 라운드 미착수. 다음 회차 대상.
● 근거: spec 비어 있음(기준 없음).`,
  },
  {
    screenId: "admin-community-reports",
    text: `[10-15 커뮤니티 신고]
● 결함: [중대·COMMON] community_reports 를 신고 대상이 읽고 상태를 바꾸거나 지울 수 있다(규칙이 로그인만 요구). 신고자 uid·닉네임이 그대로 들어 있어 누가 신고했는지도 알 수 있다 — 보복 위험.
● 조회 상한이 없는 문제도 10-05·10-09와 같다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: firestore.rules:215-217 / adminCommunityService.js
● 심각도: 중대 1(COMMON)
※ 화면 레이어는 다음 회차.`,
  },
  {
    screenId: "admin-notify-notices",
    text: `[10-16 공지 관리]
● 작성·수정·삭제·고정·발행 토글과 전체 푸시는 정상 경로다(푸시 딥링크도 상세 화면에서 제대로 열린다).
● 결함:
  1) [중대] 미발행 공지가 사용자 목록을 밀어낸다 — 최근 100건을 먼저 받고 나서 "발행됨"을 거른다. 비공개 공지가 100건을 채우면 발행된 공지가 사용자 화면에서 사라진다.
  2) [경미] 어드민 목록도 200건 상한이고 잘렸다는 표시가 없다.
  3) [경미] 푸시는 새로 쓸 때만 보낼 수 있다(수정 후 재발송 경로 없음).
● 재현: 비공개 공지를 100건 이상 만든 뒤 사용자 앱 공지 목록 확인.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: noticesService.js:49, :66-71, :84-94
● 심각도: 중대 1 · 경미 2`,
  },
  {
    screenId: "admin-notify-push",
    text: `[10-17 푸시 발송]
● 감사 제외 — 이번 라운드에 새로 구현한 화면이다. 지시서대로 실제 발송은 하지 않았고 화면·검증 로직만 확인했다.
● 근거: spec 비어 있음(기준 없음).`,
  },
  {
    screenId: "admin-notify-history",
    text: `[10-31 발송 로그]
● 감사 제외 — 이번 라운드 신규 구현. 다음 회차에 다른 관점으로 재점검한다.
● 근거: spec 비어 있음(기준 없음).`,
  },
  {
    screenId: "admin-settings-admins",
    text: `[10-18 관리자 계정]
● 결함: 치명 1(10-02)과 같은 뿌리. 비밀번호가 무솔트 SHA-256 최소 4자로 저장돼 있어, admin_accounts를 읽을 수 있는 다른 운영자가 남의 해시를 가져가면 바로 복원된다.
  → [고침] 솔트 PBKDF2-SHA256 21만회로 교체 · 최소 10자 · 옛 계정은 다음 로그인 때 자동으로 새 방식으로 올라간다. 목록 조회가 계정을 자동 생성하던 것도 제거했다.
  → [고침] 클라이언트에 남아 있던 죽은 로그인 검증 함수(verifyAdminLogin) 제거.
● 확인 방법: 관리자 계정 → 비밀번호 변경 → 10자 미만이면 거부되는지.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminAccountService.js
● 심각도: 치명 1(수정 완료)`,
  },
  {
    screenId: "admin-settings-policy",
    text: `[10-19 정책 설정]
● 결함:
  1) [중대] 화면을 열기만 해도 약관 본문이 DB에 저장된다. 아무것도 안 했는데 "마지막 수정" 시각이 찍히고, 그 순간부터 코드의 기본 본문을 고쳐도 사용자 화면은 안 바뀐다. 탭 5개를 눌러보면 5종이 다 굳는다.
  2) [중대] 개정 이력이 없다 — 저장할 때마다 같은 문서를 덮어써서 이전 본문·개정일이 사라진다. 약관은 개정 고지가 필요한 문서라 파급이 크다.
  3) [경미] 수정자가 항상 "admin"으로 남는다(화면엔 수정자 칸이 있는데 정보가 없다).
  4) [경미] 저장 안 하고 좌측 메뉴로 나가거나 새로고침하면 경고 없이 날아간다(탭 전환만 물어본다).
● 재현: /admin/settings/policy 진입 → 아무것도 안 하고 나감 → "마지막 수정"이 오늘로 찍혀 있음.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminSettingsPolicyPage.jsx:191-207, :254 / legalService.js:57-67
● 심각도: 중대 2 · 경미 2
● 형이 정해줘야 할 것: 약관 본문의 "원본"을 코드(legalDefaults.js)로 둘지 DB로 둘지. 지금은 이 화면을 여는 순간 DB가 원본이 된다.`,
  },
  {
    screenId: "admin-games-upcoming",
    text: `[10-20 예정 경기]
● 결함:
  1) [중대] 제휴구장으로 확정된 경기가 목록에서 통째로 빠진다 — 쿼리가 accepted 하나뿐이라 결제까지 끝난 confirmed 경기, 승인 대기 경기가 "예정 경기"에 안 나온다.
  2) [중대] 목업과 실제 쿼리가 다르다 — 리뷰 화면에서는 정상으로 보이고 운영에서만 비어 보인다. 리뷰로는 잡히지 않는 종류의 결함이다.
  3) [중대] 정렬 없이 200건을 자른 뒤 클라에서 정렬 — 경기가 200건을 넘으면 오늘 경기가 빠질 수 있다.
● 재현: 결제 완료된 경기를 만든 뒤 /admin/games/upcoming 확인.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminGamesService.js:181-212
● 심각도: 중대 3`,
  },
  {
    screenId: "admin-games-past",
    text: `[10-21 지난 경기]
● 서비스 계층만 확인 — 예정 경기(10-20)와 같은 "정렬 없는 200건 자르기" 문제를 공유한다. 경기가 쌓이면 최근 경기가 목록에서 빠질 수 있다.
● 화면 레이어는 이번 라운드 미착수. 다음 회차 대상.
● 근거: spec 비어 있음(기준 없음).
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-chat-list",
    text: `[10-22 채팅 목록]
● 결함: [중대] 채팅방을 상한 없이 전부 읽고, 참여자 uid마다 순차로 한 번씩 더 읽는다. 커뮤니티와 같은 패턴이라 방이 늘면 가장 먼저 느려지는 화면이 된다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminChatService.js:42-111
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-chat-detail",
    text: `[10-23 채팅방 상세]
● 서비스 계층만 확인 — 조회 상한 문제를 10-22와 공유한다.
● 화면 레이어(메시지 렌더·신고 처리)는 이번 라운드 미착수. 다음 회차 대상.
● 근거: spec 비어 있음(기준 없음).`,
  },
  {
    screenId: "admin-banners",
    text: `[10-24 배너 관리]
● 결함: [중대] 노출수·클릭수가 영원히 0이다. 사용자 화면이 집계를 올리려 할 때마다 서버 규칙이 막고(배너 쓰기는 관리자만), 그 실패를 코드가 조용히 삼킨다. 관리자 화면의 "노출/클릭" 열은 항상 0으로 보인다.
● 광고를 팔 때 근거로 쓰는 숫자라 파급이 크다 — 서버 집계로 옮겨야 한다.
● 재현: 홈 배너를 여러 번 노출·클릭한 뒤 배너 관리에서 수치 확인 → 0 그대로.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: bannersService.js:141-161 / firestore.rules:206
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-venues",
    text: `[10-25 구장 관리(승인)]
● 승인 자체는 정상이다 — 승인된 구장만 노출되고 구장주에게 승인·반려 알림도 나간다.
● 결함: [치명·고침] 구장 삭제가 venues 문서만 지웠다. 예약·결제·슬롯락이 그대로 남아, 이용자의 "내 예약"에서는 상세가 깨지고 구장주는 그 예약을 처리할 방법이 없어지며, 결제는 정산 지급 대상에 계속 잡혔다(없는 구장에 돈이 나간다). 확인 문구도 몇 건이 걸렸는지 안 알려줬다.
  → 진행 중 예약이나 정산 전 결제가 하나라도 있으면 삭제를 거부하고 건수를 알려주도록 고쳤다. 노출만 막고 싶으면 '비활성'을 쓰면 된다. 지난 예약이 남아 있으면 삭제 전에 몇 건인지 보여준다.
● 확인 방법: 예약이 걸린 구장에서 삭제 → "진행 중 예약 N건이 남아 삭제할 수 없습니다" 안내.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: venuesService.js deleteVenue / AdminVenuesPage.jsx handleDelete
● 심각도: 치명 1(수정 완료)`,
  },
  {
    screenId: "admin-reservations",
    text: `[10-30 예약 현황]
● 매칭 예약을 "A vs B"로 보여주는 모델링은 정상이다.
● 결함: [중대] venueReservations 를 상한 없이 통째로 읽는다. 예약은 이 서비스에서 가장 빨리 늘어나는 데이터라 상한이 꼭 필요하다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminReservationsService.js:75-92
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-settlements",
    text: `[10-26 정산 관리]
● 설계는 관리자 도메인에서 가장 견고하다 — 환불을 뺀 구장 몫(netVenueAmount)을 단일 기준으로 써서 구장주 화면과 금액이 일치하고, 정산 시점 수수료 재공제를 0으로 못박아 이중 공제를 막았다. 배치도 450개씩 나눈다.
● 결함: [중대] payments 를 기간 필터도 상한도 없이 전부 읽고 클라에서 기간을 자른다. 결제가 쌓이면 정산 화면이 가장 먼저 무너진다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: settlementService.js:68-79
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-refunds",
    text: `[10-27 환불 관리]
● 결함: [치명·고침] 카드로 결제된 예약을 환불하면 돈이 두 번 나갔다. 화면은 앱 잔액(피지)을 얹어주고, 예약이 취소되는 순간 서버가 카드로도 진짜 환불을 실행했다. 게다가 화면에서 입력한 환불액은 카드로 나가는 실제 금액과 달랐다(카드 환불액은 취소 시점 정책이 정한다).
  → 카드 결제건은 이제 "취소"만 하고 잔액을 얹지 않는다. 환불액을 묻지도 않는다(서버가 정한다). 앱 잔액으로 낸 예약만 화면에서 금액을 정한다. 환불 완료 목록에서 카드 건이 0원으로 보이던 것도 "카드 환불(정책)"로 바꿨다.
● 확인 방법: 환불 관리 → 카드 결제 예약에 "환불 처리" → 금액을 묻지 않고 "카드로 자동 환불" 안내가 뜬다.
● 남은 것: 부분환불인데 상태가 항상 '취소'로 기록되는 건 서버에 부분환불 개념이 없어 그대로다. 목록이 예약 전수 조회인 것도 미해결.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: refundService.js processRefund / AdminRefundsPage.jsx doRefund
● 심각도: 치명 1(수정 완료) · 중대 1(미수정)`,
  },
  {
    screenId: "admin-inquiries",
    text: `[10-28 문의 관리]
● 답변 저장과 사용자 알림 생성 경로는 정상이다.
● 결함: [중대] "최근 N건"이 방어가 아니다 — inquiries 전체를 읽은 뒤에 잘라낸다. 읽기 비용은 그대로라 문의가 쌓이면 느려진다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: adminInquiryService.js:37-42
● 심각도: 중대 1`,
  },
  {
    screenId: "admin-popups",
    text: `[10-29 이벤트 팝업]
● 등록·수정·삭제·활성 토글과 사용자측 노출 조건(활성 + 기간 + 오늘 그만보기)은 정상이다.
● 결함:
  1) [중대] 시작이 종료보다 뒤인 기간을 그대로 저장한다. 사용자에게는 영원히 안 뜨는데 관리자 목록에는 "활성"으로 보여서, 잘못을 알아챌 방법이 없다.
  2) [중대] 이미지를 바꾸면 예전 파일이 저장소에 그대로 남는다(업로드만 하고 저장을 취소해도 같다).
  3) [경미] 조건을 만족하는 팝업이 여럿이어도 사용자는 첫 1건만 본다 — 화면에 그 설명이 없어 "왜 내 팝업이 안 뜨지"가 된다.
● 재현: 시작 2026-09-01 / 종료 2026-08-01 로 저장 → 목록엔 활성, 앱엔 안 뜸.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminEventPopupsSection.jsx:428-429, :472-483 / EventPopupModal.jsx:170
● 심각도: 중대 2 · 경미 2`,
  },
  {
    screenId: "admin-updates",
    text: `[10-32 앱 업데이트]
● 감사 제외 — 이번 라운드 신규 구현(마지막 플레이스홀더였다). 다음 회차에 다른 관점으로 재점검한다.
● 근거: spec 비어 있음(기준 없음).`,
  },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const existing = await getDocs(query(collection(db, COL), where("by", "==", BY)));
  const already = new Set(
    existing.docs
      .map((d) => d.data().screenId)
      .filter((s) => ENTRIES.some((e) => e.screenId === s))
  );

  for (const e of ENTRIES) {
    const dup = already.has(e.screenId) ? "  ⚠ 기존 AI 기록 있음" : "";
    console.log(`── ${e.screenId} (${e.text.split("\n")[0]})${dup}`);
    console.log(`   ${e.text.length}자`);
  }

  if (already.size) {
    console.log(
      `\n⚠ ${already.size}개 화면에 이미 AI 기록이 있습니다. --apply 하면 중복 기록됩니다.`
    );
  }

  if (!APPLY) {
    console.log("\n실제 기록하려면 --apply 를 붙이세요.\n");
    process.exit(0);
  }

  for (const e of ENTRIES) {
    await addDoc(collection(db, COL), {
      screenId: e.screenId,
      by: BY,
      text: e.text,
      at: kstNow(),
      ts: serverTimestamp(),
    });
    console.log(`✓ ${e.screenId}`);
  }

  console.log(`\n완료 — ${ENTRIES.length}건 기록.\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error("실패:", e?.message || e);
  process.exit(1);
});
