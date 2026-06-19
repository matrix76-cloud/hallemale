# 할래말래(Hallamaella) — 프로젝트 인수인계 가이드

> 이 문서는 **새로 합류하는 개발자(또는 AI 에이전트)가 프로젝트 전체를 빠르게 이해**하도록 만든 단일 진입점이다.
> 세부 분석은 같은 폴더(`docs/handover/`)의 개별 문서를 참고. 아래 "추가 문서 인덱스" 참조.

---

## 0. 한 줄 요약
**농구 동호회 매칭 플랫폼**. 팀(클럽)을 만들고, 상대 팀과 매칭을 잡고, 구장·일정을 조율해 경기를 확정하고, 경기 결과를 입력해 전적/랭킹에 반영하는 서비스. 웹(React) + Firebase(Functions/Firestore/Auth/Storage/FCM) + React Native WebView 앱 셸.

---

## 1. 기술 스택
| 영역 | 스택 |
|------|------|
| 프론트 | CRA(react-scripts), **React 19**, **styled-components 6**, **react-router-dom 7** |
| 백엔드 | Firebase **Cloud Functions v2** (Node 20), 리전 `asia-northeast3`(도쿄) |
| DB | **Firestore** (위치 nam5/북미). 클라이언트 직접 접근 + 서버 Repo 패턴 |
| 인증 | Firebase Auth (이메일/비번 + 카카오 커스텀 토큰). **현재 카카오 단일 로그인으로 정리 중** |
| 스토리지 | Firebase Storage (로고, 미디어 업로드) |
| 푸시 | FCM (웹 + RN 브리지) |
| 앱 | React Native **WebView 셸** (별도 레포). webUrl = `https://halle-bf789.web.app/welcome` |

- **Firebase 프로젝트**: `halle-bf789` (messagingSenderId `939913723928`)
- Firebase config는 `src/services/firebase.js`에 하드코딩(웹 공개 키라 정상). 일부는 `.env`(`REACT_APP_*`).

---

## 2. 빌드·실행·배포
```bash
npm start                 # 로컬 개발 (localhost:3000)
npm run build             # 프로덕션 빌드 (CI=false 권장 — 경고를 에러로 안 막음)
npx firebase deploy --only hosting     # 웹 배포 (Firebase Hosting)
npx firebase deploy --only functions   # 함수 배포
```
- `prestart`/`prebuild`에서 `web/`(랜딩) → `public/landing` 자동 복사 세팅 있음.
- 배포 도메인: **https://halle-bf789.web.app**

---

## 3. 디렉터리 지도 (`src/`)
```
src/
  context/        ← 전역 상태 (Context). AuthContext, ClubContext, HomeDataContext,
                    MatchingDataContext, ThemeContext, UIContext, WebviewBridgeContext
  hooks/          ← 위 Context 소비 훅 (useAuth, useClub, useHomeData, useMatchingData,
                    useMatchRoomCounts 등) + 파생 훅
  routes/AppRoutes.jsx   ← 전체 라우팅 정의 (단일 파일)
  pages/          ← 화면. 도메인별 폴더 (home, matching, team, my, auth, admin, settings,
                    community, gym, chat, legal, system, venue, player, notifications, event, invites)
  components/     ← 재사용 컴포넌트. 도메인별 폴더 (home, matchRoom, matching, team, my,
                    common, admin, auth, community, gym, media, player, settings)
  services/       ← Firestore 접근 + 비즈니스 로직 (60+ 파일). 클라이언트가 직접 Firestore 호출
  layouts/        ← 공통 레이아웃 (헤더/바텀탭 등)
  theme/          ← 라이트/다크 테마 토큰
  data/           ← 정적 기본값 (legalDefaults 등)
  mock/           ← 목 데이터 (초상권 이슈로 실인물 사진 제거됨)
  utils/          ← 헬퍼 (imageAssets, matchAnalysis 등)
```

### Context 스택 순서 (중첩)
`Theme → Auth → Club → UI → HomeData → Matching → WebviewBridge → Routes`

---

## 4. 핵심 도메인 흐름

### 4-1. 인증 / 클럽
- `AuthContext`(→`useAuth`): `firebaseUser`, `userDoc`(Firestore `users/{uid}`), `isLoggedIn`, `loading`.
- 로그인 후 **클럽(팀)** 컨텍스트: `ClubContext`(→`useClub`) — `users/{uid}.activeTeamId`가 SSOT.
- 카카오 로그인: 웹은 redirect/code 방식 → `kakaoCustomToken` 함수가 커스텀 토큰 발급. (⚠️ IAM **Service Account Token Creator** 권한 필수)
- 전화번호 기반 계정 통합 패턴 존재(`linkedSocialUid`). 단, **카카오 단일화 진행 중**이라 통합 로직 비중 축소 예정.

### 4-2. 홈
- `HomeDataContext`(→`useHomeData`): 홈 데이터 프리로드/캐시. `preloadHomeData(uid)`.
- `HomePage` 구성: 히어로 배너 → 팀 프로필 섹션(매칭룸 카운트) → 승리팀 티커/하이라이트 → 팀/선수 랭킹 → 즐겨찾기.
- 매칭룸 카운트: `useMatchRoomCounts({clubId})` — `match_requests` 실시간 구독.
  - 분류 기준(**중요, SSOT**): 조율중=`accepted`+`proposed`, 확정=`confirmed`且 시작 전, 지난경기=`finished`+(`confirmed`且 시작됨), 취소=`cancelled`.

### 4-3. 매칭 → 경기 (가장 복잡, 핵심)
**상태 머신: `match_requests.status`**
```
pending → accepted → proposed → confirmed → finished
                                    ↘ cancelled
```
- `accepted`: 매칭 수락됨, 구장/일정 미정 → "구장 정하기"
- `proposed`: 한 팀이 구장·일정 제안함 → 상대 응답 대기
- `confirmed`: 양팀 합의로 일정 확정 (결제 단계 없음 = 현장 정산)
- `finished`: 경기 결과 입력+상대 인정 완료 → 전적/랭킹 반영
- `cancelled`: 취소됨

**결과 입력 흐름 (`src/services/matchRoomService.js`)**
1. `submitMatchResultWithMedia(...)` → `status=confirmed` 유지 + `resultState=waiting_accept` + `result.{comment,photoUrls,submittedByClubId}` 저장. 점수: `myScore`(actor), `oppScore`(target).
2. 상대팀이 `acceptMatchResult(...)` → **트랜잭션**으로 `resultState=confirmed` + `status=finished` + `clubs.stats` + `users.stats`(멤버) 누적. **중복 방지: `statsAppliedAt`** 플래그.
3. 결과 입력 노출 타이밍: **경기 시작(scheduledAt) + 경기시간(durationMin) 경과 후**.

**주요 화면**
- `MatchRoomListPage` — 매칭룸 목록(탭: 조율중/확정/지난/취소). 정렬 최신순.
- `MatchRoomDetailPage` — ⚠️ **~3000줄 거대 파일**. 매칭룸 상세. URL에 따라:
  - 채팅 뷰(`!isVenue`): `MatchRoomChat` (입력창 위 액션바 — 제안/수락/거절)
  - 구장 정하기 뷰(`isVenue`, `/venue`): 캘린더+시간칩 선택, `MapLocationPicker`
  - 확정/종료 뷰(`status==="confirmed"||"finished"`): `ConfWrap` 티켓 + 결과 입력/표시 섹션
- `MapLocationPicker` / `VenueMiniMap` — 카카오 지도 (구장 위치 선택/표시).

### 4-4. 채팅
- `chatService.getOrCreateMatchRoomChat({matchRoomId})` → chatId = `match_{roomId}` (매칭룸별 독립).

### 4-5. 관리자(Admin)
- `src/pages/admin/*` + `src/services/admin*Service.js`. 대시보드, 회원/팀/매칭/커뮤니티/신고/차단/배너/이벤트팝업/푸시/공지/정책 관리. 어드민은 **라이트 모드 강제**.

---

## 5. Cloud Functions (`functions/index.js`)
| 함수 | 트리거 | 비고 |
|------|--------|------|
| `crawlKblInitOnce` | onRequest | KBL 초기 크롤 1회 |
| `crawlKblDaily` | schedule 05:00 KST | KBL 일일 크롤 + 신규경기 공지 |
| `crawlKblTick` | schedule 15분 | KBL 갱신 |
| `sendPushTick` | schedule 3분 | `notifications` → FCM 발송 (targetIds 비면 broadcast) |
| `sendTestPush` | onRequest | 즉시 FCM 테스트 발송(디버깅용) |
| `matchStartReminderTick` | schedule 5분 | 확정 경기 시작시각 지나면 양팀에 알림 |
| `resetPasswordViaProxy` | onRequest | 비번 재설정 프록시 |
| `sendSmsProxy` | onRequest | SMS GW 프록시 |
| `kakaoCustomToken` | onRequest | 카카오 로그인 커스텀 토큰 |

- 서버는 **Repo 패턴**: `functions/repos/`가 DB 접근 계층. `functions/{auth,crawlers,jobs,password,sms,utils}`로 분리.
- 크롤러: Naver Sports API 기반 (KBL/NBA).

---

## 6. 코드 컨벤션 (지켜야 함)
- 서비스 파일 상단 `/* eslint-disable */` 흔함.
- 클라이언트 Firestore: `import { db } from "./firebase"`.
- 서버 Firestore: `const { getDb, getAdmin } = require("../firebaseAdmin")`.
- **Context + Hook 조합**: `XxxContext.jsx` ↔ `useXxx.js` 1:1.
- styled-components **transient props**는 `$` 접두사(`$on`, `$isSelected`) — DOM에 안 새어나감.
- 인덱스 최소화: 클라이언트 메모리 정렬, `array-contains`만 사용.
- 중복 호출 방지: `inflightRef` 패턴 (HomeData/MatchingData).
- 스냅샷 패턴: `match_requests`에 팀/라인업 스냅샷 저장(역사 보존, `fromLineupSnapshot`/`toLineupSnapshot`).
- SSOT 키: `users/{uid}.activeTeamId`(팀), `notifications.targetIds`(알림 대상).

---

## 7. 주의사항 / 함정 (Gotchas)
1. **MatchRoomDetailPage.jsx는 ~3000줄**. 수정 시 해당 status 브랜치(채팅/venue/ConfWrap)를 정확히 찾을 것.
2. **Firestore 보안규칙이 현재 전면 허용** ⚠️ (운영 전 반드시 강화). Storage는 전면 차단.
3. 카카오 커스텀 토큰 함수는 **IAM Service Account Token Creator** 권한 없으면 `iam.serviceAccounts.signBlob denied`.
4. **구글 OAuth는 RN WebView 안에서 막힘**(`disallowed_useragent`) — 앱에선 카카오만 동작. (테스트용 구글 버튼은 webview에서 무시)
5. 카카오 지도: 키/도메인 인증 안 되면 회색 타일. 위/경도 `{0,0}`(Null Island)면 타일 없음 → 유효성 검사 후 서울 기본값.
6. 전적/랭킹은 `acceptMatchResult` 트랜잭션에서만 반영. 결과를 되돌리려면 stats도 같이 롤백해야 함(`scripts/reset-match-results.mjs` 참고).
7. RN WebView ↔ 웹 메시지: Android는 `document`에, 그 외는 `window`에 dispatch. 웹은 양쪽 리스너 등록.

---

## 8. 테스트 유틸 스크립트 (`scripts/`)
- `reset-match-rooms.mjs` — `match_requests`를 `accepted`(구장 정하기 전)로 리셋.
- `reset-match-results.mjs` — 경기 결과를 "미입력" 상태로 + 팀/멤버 전적 0으로 리셋(테스트용).
  - 클라이언트 SDK + 전면허용 규칙이라 인증 없이 동작. `--apply` 없으면 dry-run.

---

## 9. 추가 문서 인덱스 (같은 폴더)
> 아래는 작업 히스토리 기반 분석 메모. 시점별 스냅샷이라 현재 코드와 일부 다를 수 있음 — 의심되면 코드 확인.

| 문서 | 내용 |
|------|------|
| `frontend-analysis.md` | 페이지·컴포넌트·Context·Hook·라우팅 상세 |
| `services-analysis.md` | Firestore 서비스·스키마·데이터 흐름 |
| `backend-analysis.md` | Cloud Functions·Repo·크롤러·SMS/비번 |
| `firestore-schema.md` | 전체 컬렉션/문서 스키마 |
| `infrastructure.md` | firebase.json·보안규칙·환경변수·의존성 |
| `fcm-push-implementation.md` | FCM 상세 구현 |
| `rn-project.md` | RN WebView 앱 셸 |
| `kakao-*.md` | 카카오 로그인/지도 관련 이슈·해결 |
| `work-*.md`, `agent-*.md`, `client-request-*.md` | 작업/요청 히스토리 |
| `MEMORY.md` | 위 문서들의 원본 인덱스 |

---

## 10. 빠른 시작 체크리스트 (새 개발자)
1. `npm install` → `npm start` → `localhost:3000`에서 로그인 흐름 확인.
2. `src/routes/AppRoutes.jsx`로 전체 화면 지도 파악.
3. `src/context/`의 7개 Context를 읽고 전역 상태 흐름 이해.
4. 매칭 도메인은 `matchRoomService.js` → `MatchRoomDetailPage.jsx` → `MatchRoomListPage.jsx` 순으로 정독.
5. 데이터 구조는 `firestore-schema.md` + 실제 `match_requests` 문서 1건을 콘솔에서 확인.
6. 함수는 `functions/index.js`의 exports부터.
