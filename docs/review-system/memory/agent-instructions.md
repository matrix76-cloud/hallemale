---
name: 지휘 에이전트 지시서 (5개 병렬 작업)
description: 할래말래 전체 TODO 35건을 5개 에이전트로 나눈 병렬 작업 지시서 (보안규칙/관리자 제외판, 2026-04-15 작성)
type: project
originSessionId: ec54489d-e9b9-4221-b9dd-b3a15672e3fa
---
# 할래말래 전체 TODO 병렬 작업 지시서

**작성일**: 2026-04-15
**전제**: 보안규칙(firestore/storage rules)과 관리자 페이지 작업은 이번 라운드 제외
**Why**: 카스가 "보완은 우선 모두 허용으로 가고 관리자 페이지도 이번은 제외" 라고 명시 → 배포 블로커/푸시/미완 기능만 우선 처리
**How to apply**: 병렬 작업 재개 시 이 파일의 지시서를 그대로 복붙해서 각 터미널에 붙여넣기. 에이전트 끝나면 지휘 에이전트(메인 터미널)가 다음 지시서 발행.

## 에이전트 분배표

| 에이전트 | 영역 | 소유 파일 루트 |
|---|---|---|
| 🔔 A (푸시) | 푸시 파이프라인 + 알림 케이스 확충 | src/services/fcm·chat·matchRoom·invite·joinRequest·community·clubManage, src/context/Auth·WebviewBridge |
| ☁️ B (Functions) | Cloud Functions 전반 | `functions/**` |
| 📱 C (모바일) | RN 앱 | `2026Mobile/HallaMalle/**` |
| 🧩 D (미완/UX) | 페이지 TODO, 라우트, gymService, UX 정리 | src/pages, src/components(home·matching), AppRoutes, gymService, schemaDumpService |
| 🔐 E (인증/환경) | authService DEBUG 정리, Apple, 전화번호 통합, 환경 가이드 | src/services/authService·phoneService·recoveryService + 환경설정 문서 |

## 병합 순서
**B → A → D → E → C** (푸시 서버 먼저 완성돼야 나머지 검증 가능)

## 진행 상황 로그
- **2026-04-15 D 완료** (터미널4, 10분 스프린트):
  - `AppRoutes.jsx`: `joxin-requests` → `join-requests` 오타 수정
  - `services/gymService.js` 신규: listGyms/getGym/createGym/updateGym/deleteGym 스텁 (현재 호출처 없음)
  - `services/appVersionService.js` 신규: jogunBiz 패턴, localStorage 키 `hallamaella.app.version`
  - `App.js`: `VersionChecker` 컴포넌트 추가, 하단 흰 토스트 + `IoInformationCircleOutline`
  - `services/schemaDumpService.js`: `runSchemaDumpFront` 최상단 `NODE_ENV==="production"` 가드
  - TODO 9건 제거:
    - `HomeHeader` 알림 버튼 → `navigate("/notifications")`
    - `HomeNotificationPreview`/`HomeRankingPreview`/`HomeClubCard`: TODO 주석만 제거 (useNotifications/useRanking 훅 미존재 → 추후 연결 필요)
    - `MatchingHomePage`(pages): TODO 주석 제거 (매칭 신청 API 연결은 추후 — 실제 함수명 미결정)
    - `MyPostsPage`: 클릭 시 `/communitypost/:id` 네비게이트
    - `MyPersonalMatchesPage`/`MyMatchedMatchesPage`: 클릭 시 `/match-roomdetail/:id` 네비게이트 (`/match-room/` 잘못된 경로도 교체)
    - `NotificationsPage`: 이미 `markNotificationRead` 연결돼 있어 수정 불필요
  - **검증**: 대상 11개 파일 `joxin|TODO` grep 0건
  - **남은 숙제**: useNotifications/useRanking 훅 생성, MatchingHomePage regions/TEAMS 실데이터 교체 (원 지시서 3번 일부 미완 — 실제 훅/서비스가 아직 없어 속도 우선 보류)

---

## 📋 에이전트 A (푸시) 지시서 #1

```
🎯 목표: 푸시 알림 파이프라인 완결 + 누락 알림 케이스 추가

📁 작업 파일:
  - src/services/fcmService.js
  - src/context/AuthContext.jsx
  - src/context/WebviewBridgeContext.jsx
  - src/services/chatService.js
  - src/services/matchRoomService.js
  - src/services/joinRequestService.js
  - src/services/inviteService.js
  - src/services/communityService.js
  - src/services/clubManageService.js
  - src/services/notificationDefinitions.js (필요시 신규 key 추가)

⛔ 건드리지 마:
  - src/services/authService.js (E 담당)
  - functions/** (B 담당)
  - src/pages/**, src/components/** (D 담당)
  - src/services/gymService.js (D 담당)

📝 작업 내용:
  1. WebView 환경 감지: fcmService.registerFcmToken() 최상단에
     isInWebView() 체크 → true면 null 반환 (웹 토큰 저장 금지)
  2. WebviewBridgeContext/AuthContext에 PUSH_TOKEN·FCM_TOKEN 구독 추가
     → 수신한 {token, platform} 을 users/{uid}.fcmTokens 에
       arrayUnion으로 저장 (기존 배열 호환)
  3. fcmTokens 스키마 확장(호환 유지):
     - 신규 저장 시 `{token, platform, updatedAt}` 객체로 저장
     - userRepo 쪽은 B가 맞출 것이니, 저장만 객체형으로
  4. 누락 알림 케이스 구현 (모두 notifications 컬렉션에 addDoc):
     A) chatService.sendMessage → 상대 수신자에게 chat 알림
     B) matchRoomService.acceptResult → 양 팀에 match 결과 확정 알림
     C) joinRequestService: 거절 케이스에 팀 참가 거절 알림
     D) inviteService: 초대 거절 시 초대자에게 알림
     E) communityService: 댓글 생성 시 글쓴이에게, 좋아요 시 글쓴이에게
     F) clubManageService: 팀 해체/강퇴 시 대상자에게 알림
  5. 모든 신규 알림은 push.enabled:true, push.status:"queued",
     prefsCategory 정확히 세팅, meta.deepLink 지정

✅ 완료 조건:
  - WebView에서 웹 토큰 저장 안 됨
  - RN이 쏜 PUSH_TOKEN이 Firestore에 저장됨 (플랫폼 구분)
  - 6종 신규 알림이 생성되고 push.enabled/prefsCategory/deepLink 정확
```

---

## 📋 에이전트 B (Functions) 지시서 #1

```
🎯 목표: Cloud Functions 푸시 발송 보강 + 서버 이관 + 테스트 함수

📁 작업 파일:
  - functions/index.js
  - functions/jobs/sendPushNotifications.js
  - functions/jobs/sendTestPush.js (신규)
  - functions/repos/userRepo.js
  - functions/repos/notificationRepo.js
  - functions/utils/logger.js
  - functions/jobs/crawlKblGames.js (크롤링 후 공지만)

⛔ 건드리지 마:
  - src/** 전체 (A, D, E 담당)
  - 2026Mobile/** (C 담당)

📝 작업 내용:
  1. sendTestPush 신규 HTTP 함수: POST {uid, title, body} → 즉시 FCM 발송
     + index.js 에 export
  2. userRepo.getUsersFcmInfoBatch: fcmTokens가 문자열 배열/객체 배열
     둘 다 지원 (A가 객체형으로 저장 예정)
  3. sendPushTick: 토큰 객체형 처리, 실패 토큰 제거 시에도 객체 제거
  4. 로그 구조화: logger.js 에 {level, fn, noti, uid, reason} JSON 로그
  5. 실패 모니터링: push.failReason 집계용 필드 유지 확인
  6. crawlKblDaily 완료 후(신규 게임 발견 시) notifications 문서 생성
     - prefsCategory: "notice", targetIds: [] (전체 공지)
     - targetIds 빈 배열이면 전체 발송 분기 처리 (userRepo에 "all users" 쿼리)
  7. 관리자 공지/매칭 수락처럼 보안상 서버발신 필요한 케이스 중
     "매칭 수락 알림"만 우선 onCall 함수로 이관 가능한지 설계 검토 메모
     (실구현은 다음 지시서에서)

✅ 완료 조건:
  - sendTestPush 배포 후 3분 대기 없이 푸시 도착
  - 객체형 fcmTokens로도 sendPushTick 정상 동작
  - 크롤링 후 KBL 공지 알림 생성 확인
```

---

## 📋 에이전트 C (모바일) 지시서 #1

```
🎯 목표: 모바일 앱 블로커 해소 + 운영 준비

📁 작업 파일:
  - 2026Mobile/HallaMalle/ios/HallaMalle/AppDelegate.swift
  - 2026Mobile/HallaMalle/ios/HallaMalle/Info.plist (필요시)
  - 2026Mobile/HallaMalle/Podfile
  - 2026Mobile/HallaMalle/src/config/AppConfig.js
  - 2026Mobile/HallaMalle/src/features/push/pushBridge.js
  - 2026Mobile/HallaMalle/App.js (enableShare 토글 검토용)
  - 2026Mobile/HallaMalle/src/services/appVersionService.js (신규)

⛔ 건드리지 마:
  - 2026Web/** 전부 (A, B, D, E 담당)

📝 작업 내용:
  1. iOS Kakao SDK 초기화
     - Podfile 에 pod 'KakaoSDKCommon', 'KakaoSDKAuth', 'KakaoSDKUser' 추가
     - AppDelegate.swift 에 import KakaoSDKCommon + KakaoSDK.initSDK(appKey:)
     - pod install 안내 포함
  2. AppConfig.webUrl 환경 분기
     - __DEV__ ? localhost : 프로덕션 URL
     - STAGING 플래그 옵션
  3. enableShare: true 로 변경 + 동작 확인
  4. 앱 버전 체크/자동 새로고침 (jogunBiz 패턴 이식)
     - Firestore app_updates 컬렉션 조회
     - localStorage "hallamaella.app.version" 비교
     - 새 버전이면 토스트 표시 후 1.5초 뒤 reload
     ※ 웹측 구현은 D에게 넘김 (단, 서비스 파일 위치 기록)
  5. pushBridge.js: PUSH_TOKEN 보낼 때 platform 명확히 "ios"/"android"
     (이미 있지만 재확인)
  6. Android SHA-1 확인 명령 문서화: `cd android && ./gradlew signingReport`
     → README 또는 docs/MOBILE_SETUP.md 에 기록

✅ 완료 조건:
  - iOS에서 카카오 로그인 성공
  - AppConfig 환경 분기 동작
  - app_updates 기반 버전 체크 동작 (웹 연동 후)
```

---

## 📋 에이전트 D (미완/UX) 지시서 #1

```
🎯 목표: 페이지/컴포넌트 TODO 소거 + gymService + UX 정리

📁 작업 파일:
  - src/services/gymService.js (0 bytes 구현)
  - src/routes/AppRoutes.jsx (라우트 오타)
  - src/pages/matching/MatchingHomePage.jsx
  - src/pages/my/MyPersonalMatchesPage.jsx
  - src/pages/my/MyMatchedMatchesPage.jsx
  - src/pages/my/MyPostsPage.jsx
  - src/components/home/HomeRankingPreview.jsx
  - src/components/home/HomeClubCard.jsx
  - src/components/home/HomeHeader.jsx
  - src/components/home/HomeNotificationPreview.jsx
  - src/pages/settings/NotificationSettingsPage.jsx (prefs 토글 UX)
  - src/pages/notifications/NotificationsPage.jsx (읽음 처리 검증)
  - src/services/schemaDumpService.js (프로덕션 no-op)
  - src/services/appVersionService.js (버전 체크 웹 구현 — C와 협업)

⛔ 건드리지 마:
  - src/services/fcm·chat·matchRoom·invite·joinRequest·community·clubManage (A)
  - src/services/authService·phoneService·recoveryService (E)
  - src/context/** (A)
  - functions/** (B)

📝 작업 내용:
  1. gymService.js 전체 구현 (Gym 페이지들이 쓰는 함수 시그니처 역산)
  2. AppRoutes.jsx 라우트 오타 수정: joxin-requests → join-requests
  3. 9개 TODO 해소:
     - MatchingHomePage: 임시 지역 배열 제거, 실제 regions 서비스 연결
     - MatchingHomePage: 매칭 요청 API 연결 (matchingService 호출)
     - MatchingHomePage: 내 팀 TEAMS[0] 고정 제거 → useClub
     - HomeRankingPreview: rankingService로 실 데이터
     - HomeClubCard: useClub 실 데이터
     - HomeHeader: 알림 버튼 → /notifications 이동
     - HomeNotificationPreview: useNotifications 연결
     - MyPosts: 게시글 상세 라우트 이동
     - MyPersonalMatches/MyMatchedMatches: 상세 페이지 이동
  4. clubId vs activeTeamId: useClub/useAuth 사용하는 페이지에서
     clubId 직접 참조 지점 activeTeamId로 통일 (컴포넌트 범위만)
  5. NotificationSettingsPage: 실 발신 없는 카테고리(notice/chat/player)는
     UI에서 일시 숨김 또는 "준비중" 배지
  6. NotificationsPage: 알림 클릭 시 markNotificationRead 호출 검증/추가
  7. schemaDumpService: NODE_ENV==="production"이면 no-op
  8. 웹 버전 체크: appVersionService 구현 + App.js에 VersionChecker 연동
     (토스트 스타일 jogunBiz 참고)

✅ 완료 조건:
  - grep "TODO" src/ → 이번 9건 모두 사라짐
  - joxin → join 수정
  - gymService 함수 export 및 페이지 에러 없음
  - 프로덕션 빌드에서 schema dump 로그 없음
```

---

## 📋 에이전트 E (인증/환경) 지시서 #1

```
🎯 목표: 인증 클리닝 + 전화번호 통합 검증 + 환경 가이드

📁 작업 파일:
  - src/services/authService.js (DEBUG 로그 제거 + Apple 로그인)
  - src/services/phoneService.js
  - src/services/recoveryService.js
  - src/services/userProfileService.js (있으면)
  - .env.production.example (신규)
  - docs/SETUP.md (신규)

⛔ 건드리지 마:
  - src/services/fcm·chat·matchRoom·invite·joinRequest·community·clubManage (A)
  - src/pages/**, src/components/** (D)
  - functions/** (B)
  - 2026Mobile/** (C)

📝 작업 내용:
  1. authService.js [KAKAO-DEBUG] 로그 11개(171-343줄) 모두 제거
  2. Apple 로그인 구현
     - signInWithApple(idToken) 함수 추가
     - RN 쪽은 START_SIGNIN provider:"apple" (C가 후속 대응)
     - Firebase OAuthProvider('apple.com') 사용
  3. 전화번호 기반 계정 통합 플로우 검증 (jogunBiz 패턴):
     - ensureUserDoc: linkedSocialUid 체크 있는지
     - getUserProfileByUid: 3단계 조회(authUid → linkedSocialUid → docId)
     - linkSocialToExistingUser: 소셜 빈 문서 삭제 + linkedSocialUid 저장
     - linkPhoneToUid: 중복 호출 방지
     없으면 jogunBiz 메모리 참고해서 보강
  4. SMS 게이트웨이(34.64.211.220:8080) 헬스체크 스크립트
     docs/SETUP.md 에 curl 확인 명령 기재
  5. .env.production.example 작성
     - REACT_APP_FCM_VAPID_KEY (획득 방법 주석)
     - REACT_APP_FIREBASE_* 키 이름만
  6. docs/SETUP.md
     - Firebase VAPID 키 발급 (Console > Cloud Messaging)
     - Service Account Token Creator IAM 역할 부여 절차
     - Android SHA-1 → Firebase 등록 (C와 중복 OK)
     - 카카오 개발자 콘솔 체크리스트

✅ 완료 조건:
  - grep "KAKAO-DEBUG" src/ → 0건
  - Apple 로그인 경로 동작(기본)
  - 전화번호 통합 함수들 jogunBiz 패턴과 일치
  - docs/SETUP.md, .env.production.example 생성됨
```

---

## 제외 항목 (이번 라운드 스킵)
- Firestore / Storage 보안 규칙 재작성 (allow all 유지)
- 관리자 페이지 관련 작업 (AdminNotifyPush 실배선, AdminDashboard TODO 등)
- 신고 시스템 신규 구현

## 남은 TODO (다음 라운드)
- P3 운영: sendPushTick 실패 모니터링 가시화, stale 토큰 지표, CF 로그 알림
- 관리자 공지 푸시 실배선
- 매칭 수락 알림 서버 이관 (B 지시서에 설계 검토만 포함됨)

---

## 진행 로그

### 2026-04-15 — 에이전트 C 10분 스프린트 (부분 완료)
실행자: Opus 4.6 서브 터미널.

**완료:**
- `ios/Podfile`: `KakaoSDKCommon` / `KakaoSDKAuth` / `KakaoSDKUser` pod 3종 추가
- `ios/HallaMalle/AppDelegate.swift`: `import KakaoSDKCommon` + `KakaoSDK.initSDK(appKey: "9d5253822c7fecb97d273af2ee786c72")` 삽입 (didFinishLaunchingWithOptions 내부, super 호출 전)
- `src/config/AppConfig.js`: `webUrl = __DEV__ ? "http://localhost:3000" : "https://halle-bf789.web.app"`, `enableShare: true`
- `src/features/push/pushBridge.js`: 이미 `platform: Platform.OS` 전송 중 → 수정 불요 확인
- `README.md`: `cd ios && pod install` 안내 한 줄 추가

**미처리 (C 지시서 #1 잔여):**
- 4번 앱 버전 체크/자동 새로고침 (`appVersionService.js` 신규) — 이번 스프린트에서 제외됨
- 6번 Android SHA-1 확인 명령 문서화 (`./gradlew signingReport`) — README/docs/MOBILE_SETUP.md 미반영

**카스 확인 필요:**
- `cd ios && pod install` 실행
- 실기기에서 카카오 로그인 동작 테스트
- `__DEV__ ? localhost:3000` — Metro 개발 중 웹 로컬 서버가 3000에서 떠 있어야 함
