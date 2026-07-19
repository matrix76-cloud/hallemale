# Hallamaella Web - 프로젝트 메모

## ⚠️ 작업 규칙
- [작업하면 무조건 commit+push](./feedback-always-commit-push.md) — 두 군데서 병렬 작업 중, 끝나면 자동으로 올릴 것 (2026-07-03~)
- [sticky/스크롤 픽스는 내 걸로 유지](./feedback-sticky-scroll-fix-keep.md) — 의뢰인 소스가 덮어도 무시하고 재적용 (헤더 고정+로그인/동의 화면 스크롤 제거)

## 프로젝트 개요
- **앱 이름**: 할래말래 (Hallamaella) - 농구 동호회 매칭 플랫폼
- **Firebase 프로젝트**: `halle-bf789` (messagingSenderId: 939913723928)
- **Firestore 위치**: nam5 (북미), Functions: asia-northeast3 (도쿄)

## 기술 스택
- **프론트**: CRA (React 19.2), Styled Components 6, React Router 7.9
- **백엔드**: Firebase Cloud Functions v2, Node 20
- **DB**: Firestore (클라이언트 직접 접근 + 서버 Repo 패턴)
- **인증**: Firebase Auth (이메일/비밀번호)
- **스토리지**: Firebase Storage (로고 캐시, 미디어 업로드)
- **푸시**: FCM (2026-02-11 구현 완료)

## 상세 분석 파일 인덱스
- [프론트엔드 분석](./frontend-analysis.md) — 페이지, 컴포넌트, Context, Hooks, 라우팅
- [서비스 레이어 분석](./services-analysis.md) — Firestore 서비스, 함수, 스키마, 데이터 흐름
- [백엔드 분석](./backend-analysis.md) — Cloud Functions, Repos, 크롤러, 잡, SMS/비밀번호
- [Firestore 스키마](./firestore-schema.md) — 전체 컬렉션/문서 스키마 통합
- [인프라/설정](./infrastructure.md) — firebase.json, 보안규칙, 환경변수, 의존성
- [FCM 푸시 구현](./fcm-push-implementation.md) — FCM 상세 구현 내역

## 코드 컨벤션
- 서비스 파일 상단: `/* eslint-disable */`
- 클라이언트 Firestore: `import { db } from "./firebase"`
- 서버 Firestore: `const { getDb, getAdmin } = require("../firebaseAdmin")`
- Context + Hook 조합 패턴 (AuthContext→useAuth, ClubContext→useClub 등)
- SSOT: `users/{uid}.activeTeamId` (팀), `targetIds` (알림 대상)

## 주요 아키텍처 패턴
- **Context 스택**: Theme→Auth→Club→UI→HomeData→MatchingData→WebviewBridge→Routes
- **Repo 패턴** (서버): `functions/repos/` — DB 접근 계층 분리
- **스냅샷 패턴**: match_requests에 팀/라인업 스냅샷 저장 (역사 보존)
- **배치/트랜잭션**: acceptMatchResult, acceptClubInvite 등 다중 문서 동시 업데이트
- **인덱스 최소화**: 클라이언트 메모리 정렬, array-contains만 사용
- **중복 호출 방지**: inflightRef 패턴 (HomeData, MatchingData)

## Cloud Functions 목록
| 함수명 | 트리거 | 스케줄 |
|--------|--------|--------|
| crawlKblInitOnce | onRequest | 수동 1회 |
| crawlKblDaily | onSchedule | 매일 05:00 KST |
| crawlKblTick | onSchedule | 15분마다 |
| sendPushTick | onSchedule | 3분마다 |
| resetPasswordViaProxy | onRequest | HTTP POST |
| sendSmsProxy | onRequest | HTTP POST |

## 로컬 실행 팁
- [CRA 백그라운드 stdin 종료 문제](./cra-bg-stdin-exit.md) — `npm start`를 백그라운드로 띄우면 컴파일 직후 죽음. `tail -f /dev/null | PORT=3000 BROWSER=none npm start`로 stdin 열어두면 해결

## 배포 전 필수
- `.env`에 `REACT_APP_FCM_VAPID_KEY` 설정
- Firestore 보안규칙 수정 (현재 전면 허용 ⚠️)
- Storage 보안규칙 수정 (현재 전면 차단)

## RN 모바일 프로젝트 (2026-02-20 생성)
상세 → [rn-project.md](./rn-project.md)
- **위치**: `/Users/a1111/Downloads/2026Dev/mainproject/2026Mobile/HallaMalle`
- **패키지**: `com.hongcomms.hallemalle`, RN 0.77.0
- **패턴**: WebView Shell (RNShellDictionary 기반)
- **webUrl**: `https://halle-bf789.web.app/welcome`
- **TODO**: Firebase 앱 등록, google-services.json, 소셜키 설정

## 진행중 이슈
- [전화번호 SMS 인증 재도입 (2026-07-06)](./phone-otp-reintro.md) — Solapi로 카카오/구글 전화번호 통합. 코드/커밋(fe64b6c) 완료. Secret등록+functions/hosting 배포만 남음
- [구글 로그인 오류10 = SHA-1 미등록 (2026-07-03)](./google-signin-error10-sha1.md) — Play 앱 서명 SHA-1 `49:DD:0C:...:87:85` Firebase 등록 필요. debug는 등록됨, Play재서명 키가 문제
- [카카오 로그인 디버깅](./kakao-login-debug.md) — iOS AppDelegate 카카오 SDK 초기화 누락 발견
- [에이전트 지시서 (5개 병렬)](./agent-instructions.md) — 2026-04-15 작성, 보안/관리자 제외판 35건 TODO. A(푸시)/B(Functions)/C(모바일)/D(미완UX)/E(인증환경)
- [Agent B 완료 보고 (2026-04-15)](./agent-b-report.md) — sendTestPush + 객체형 토큰 호환 + KBL 신규경기 공지 ✅
- [Agent A #1 완료 보고 (2026-04-15)](./agent-A-report.md) — WebView 토큰 차단 + RN 토큰 객체형 저장 + 알림 6종 ✅
- [Agent E 완료 보고 (2026-04-15)](./agent-E-report.md) — DEBUG 제거 + Apple + 전화번호 통합 + SETUP.md ✅
- [의뢰자 요청 6건 + 스피너 (2026-04-29)](./client-request-2026-04-29.md) — 뒤로가기/내 팀 매칭룸/랭킹 동기화/조회수/내 정보 실데이터/Safe Area ✅
- [Android 뒤로가기 핫픽스 (2026-04-29)](./android-back-fix-2026-04-29.md) — RN→Web 메시지 Android는 document에 dispatch. 웹 리스너 window+document 양쪽 등록 + 종료 확인 모달 ✅
- [2026-05-06 작업 정리](./work-2026-05-06.md) — 다크모드 78파일 + 어드민 라이트강제 + 회원/팀 신고·차단 + BlockedOverlay + 광고 관리(배너/이벤트팝업) + Spinner 풀스크린 ✅
- [차단 가드는 signOut 안 함](./feedback_block_pattern.md) — 해제 가능성 보존, 새로고침으로 자동 재확인
- [로그인 카카오 단일화 (보류)](./login-kakao-only-pending.md) — 2026-06-02. 애플 심사 후 진행. 전화번호·이메일·구글·애플 다 빼고 카카오 로그인만. 통합 로직 불필요
- [작업 백로그 (2026-06-02)](./work-backlog-2026-06-02.md) — ⭐다음 세션 시작점. 버그4+텍스트 완료(미커밋)/로그인 보류/보상시스템·AI매칭 검증 남음
- [웹 카카오 로그인 테스트 (2026-06-12)](./kakao-web-login-test.md) — 카카오 단일화+전화인증 제거 적용. 웹은 redirect/code 방식, classmanage 키 임시 사용(교체 필요). 함수 배포 완료, 결제 활성화됨
- [카카오 지도 appkey (2026-06-18)](./kakao-maps-appkey.md) — public/index.html 지도 키를 classmanage 임시키→할래말래 본인 JS키(2d8b…)로 교체. localhost 회색타일=키/도메인 인증 문제
- [구글 로그인 redirect_uri_mismatch 해결 (2026-06-22)](./google-login-redirect-uri-fix.md) — authDomain을 커스텀도메인→firebaseapp.com 기본도메인으로 통일해 400 해결. 커밋 1871307+웹배포 완료
- [구장 관리자 시스템 (2026-06-25)](./owner-venue-system.md) — `/owner/*` 별도 라우트(구장주 워크스페이스). 소셜로그인 재활용+role=owner / 구장등록→어드민심사(venues.status)→승인 / 코트 여러개·날짜별 슬롯 예약관리. venues확장+venueReservations+venueBlocks. 빌드통과·미커밋
- [구장주 RN 앱 HallaMalleOwner (2026-06-26)](./rn-owner-project.md) — 사용자앱 스켈레톤 복제. com.hongcomms.halleowner, webUrl=halle-bf789.web.app/owner, 같은 Firebase에 새 패키지 등록. Android assembleDebug 성공(JAVA_HOME=Android Studio JBR 필요). 카카오콘솔/SHA-1/iOS pod·plist/아이콘 남음
- [토스페이먼츠 테스트 연동 (2026-06-26)](#) — 웹 분할결제(MatchPayPage)에 @tosspayments/payment-sdk 테스트키 연동(커밋 7bd31bb). 결제하기 옆 '가상결제' 버튼=토스 안 거치고 바로 payPartnerShare(PC테스트용). 실서비스엔 서버 confirm 필요

## 외부 서비스 연동
- Naver Sports API (KBL/NBA 게임 크롤링)
- Kakao Maps API (지도/우편번호)
- SMS Gateway VM (`34.64.211.220:8080`)
- React Native WebView (앱 연동)
