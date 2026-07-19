# 화면 리뷰 시스템 (`/review`) — 협업 가이드

할래말래(Hallamaella) 웹의 **개발 전용 화면 리뷰 허브**입니다. 기획자·개발자·리뷰어(카스, Claude Code)가 **같은 화면을 나란히 보며 피드백을 남기고 답하는** 도구입니다. 이 문서 하나로 다른 컴퓨터에서도 리뷰 시스템을 이해하고 그대로 운영할 수 있게 정리했습니다.

> 이 폴더는 협업용 산출물입니다. 실제 리뷰 도구 소스는 `src/dev/`, `scripts/seed-review-demo.mjs` 에 있습니다.

---

## 1. 한눈에

- **접속 경로**: `/review` (→ 첫 화면으로 리다이렉트) 또는 `/review/:screenId`
- **성격**: 개발 전용. 실서비스 사용자 동선에는 노출되지 않음.
- **구성(화면당 3분할)**
  - 좌측: **실제 화면**을 iframe으로 그대로 띄움 (핀 찍기 가능)
  - 우측 상단: **기획 내용**(해당 화면의 스펙/정책)
  - 우측 하단: **기록 스레드**(개발자 ↔ 카스, Firestore 실시간 공유)
- **11개 도메인**: 인증·가입 / 홈·랭킹·프로필 / 매칭 / 구장 예약 / 팀 / 커뮤니티·채팅·알림 / MY·설정 / 약관·정책 / 구장앱(구장주) / 관리자(PC) / RN 앱

---

## 2. 빠른 시작 (다른 컴퓨터에서)

```bash
# 1) 의존성 설치
npm install

# 2) 리뷰 데모 계정 시드 (Firestore에 데모 계정 + 팀 소속 생성)
#    dry-run(계획만):
node scripts/seed-review-demo.mjs
#    실제 적용:
node scripts/seed-review-demo.mjs --apply
#    특정 팀에 붙이고 싶으면:
node scripts/seed-review-demo.mjs --apply --team=리바운드5

# 3) 개발 서버 실행 후 /review 접속
tail -f /dev/null | PORT=3000 BROWSER=none npm start
#   → http://localhost:3000/review
```

`tail -f /dev/null | ...` 은 CRA를 백그라운드로 띄울 때 stdin이 닫혀 컴파일 직후 죽는 문제를 막는 트릭입니다. 포그라운드로 그냥 `npm start` 해도 됩니다.

### 데모 계정 (자동 로그인)

리뷰 도구는 **iframe(리뷰 프레임) 안에서만** 아래 데모 계정으로 자동 로그인해서, 홈·기록·매칭·마이·관리자 화면이 **실제 Firestore 데이터**로 뜹니다.

```
이메일 : review-demo@hallamalle.com
비밀번호: reviewDemo2026!
```

- 이 계정은 `isAdmin=true` + 데이터가 가장 풍부한 팀의 클럽장으로 세팅됩니다(시드 스크립트가 처리).
- 자동 로그인 코드: `src/dev/reviewDemo.js` — 값이 바뀌면 `scripts/seed-review-demo.mjs` 의 상수와 **반드시 동일**하게 유지하세요.

### 인증 게이트 우회 원리 (중요)

앱은 평소 iframe 안에서 돌지 않습니다(RN 앱은 WebView라 `window.top === window.self`). 그래서 `src/routes/AppRoutes.jsx` 의 `inReviewFrame()` 이 참이 되는 건 **오직 `/review` 미리보기 프레임 안**뿐입니다. 이 조건이 참일 때만 인증/전화인증/동의/환영/클럽 게이트를 통과시켜, 로그인 없이도 화면 레이아웃과 실데이터를 볼 수 있습니다. **실서비스 동선에는 영향이 없습니다.**

---

## 3. 사용법

### 기록 남기기 (우측 하단 스레드)
- 작성자를 **개발자 / 카스** 중 선택 → 텍스트 입력 → `Enter` 전송 (`Shift+Enter` 줄바꿈).
- 스샷 첨부: 파일 선택 또는 클립보드 `Ctrl+V` 붙여넣기. (Firestore 1MB 제한 대비 자동 리사이즈+JPEG 압축)
- **답글 구조**: 개발자 글(root) 밑에 카스 답글(`replyTo`)이 들여쓰기로 붙습니다.

### 화면에 핀 찍기 (좌측, 모바일 화면만)
- `핀 찍기` 켠 뒤 화면을 클릭하면 그 지점에 `작성자+번호`(예: `카스1`) 라벨 핀이 박힙니다.
- 핀은 가리킨 실제 DOM 요소 정보(태그/텍스트/aria-label)도 함께 저장합니다.
- `핀 박아 캡처`: **화면공유**를 허용하면 카카오맵 같은 지도 배경까지 포함해 핀 박힌 스샷을 자동 첨부합니다. 취소하면 html2canvas 폴백(지도 배경은 빠질 수 있음).
- 기록 카드의 `화면 핀 N개 위치 보기` 로 그 핀을 화면 위에 다시 띄워볼 수 있습니다.

### 미답변 뱃지 (코랄색 숫자)
- **개발자가 올린 질문/지시(root) 중 카스 답글이 안 달린 것**의 수를 도메인 탭·화면 칩에 코랄 뱃지로 표시합니다.
- 카스(리뷰어)는 이 뱃지를 보고 **미답변부터** 처리하면 됩니다.

---

## 4. 데이터 / 백엔드

- **컬렉션**: Firestore `reviewThreads` (배포 URL에서도 개발자·카스가 같은 기록을 실시간 공유)
- **문서 1건 = 기록 1건**:
  ```
  { screenId, by, at, text, replyTo?, imgs?, pins?, ts }
  ```
  - `pid` = Firestore 문서 id (댓글의 `replyTo` 가 이 id 를 가리킴)
  - `imgs` = 압축된 dataURL 배열 (Storage 미사용, 문서에 인라인 저장)
  - `pins` = 최대 30개, `{x, y, label, target}` (x/y는 뷰포트 % 좌표)
  - `ts` = serverTimestamp(정렬용), `at` = KST 표시 문자열
- **서비스 코드**: `src/dev/reviewThreadService.js`
  - `subscribeThread(cb)` — 전체 스레드 실시간 구독
  - `postEntry({screenId, by, text, replyTo, imgs, pins})` — 기록 추가
  - `deleteEntry(pid)` — 삭제(글 삭제 시 달린 댓글도 함께)

---

## 5. 리뷰 항목(도메인/화면) 추가·수정

모든 화면 목록·기획 스펙은 **`src/dev/reviewData.js`** 한 파일에 있습니다.

- `DOMAINS` 배열 = 상단 탭. 각 항목: `{ key, label, screens }`
- 각 도메인의 `screens` 배열 항목:
  ```js
  {
    id:   "auth-login",        // URL·Firestore screenId (고유)
    no:   "1-1",               // 표시용 번호
    name: "로그인",             // 화면 이름
    path: "/login",            // iframe으로 띄울 실제 라우트 (null이면 정책/로직 항목 — 화면 없음)
    spec: ["★핵심 정책...", "일반 항목..."],  // 우측 상단 기획 내용. "★"로 시작하면 강조
  }
  ```
- **화면 추가**: 해당 도메인의 `screens` 에 항목을 추가하기만 하면 탭·칩·iframe·스레드가 자동 연결됩니다.
- **관리자(admin) 도메인**은 PC 풀와이드로 간주해 넓은 프레임(0.6 스케일 축소)으로 띄웁니다.

---

## 6. 카스(Claude Code)와 협업하는 지시서 포맷

여러 작업을 병렬로 돌리거나, 리뷰에서 나온 수정 요청을 카스에게 넘길 때 쓰는 표준 지시서 포맷입니다. **파일 소유권을 명확히 나눠 충돌을 방지**하는 게 핵심입니다.

```
[에이전트명] 지시서 #번호
─────────────────────
목표: (한 줄 요약)
작업 파일: (수정할 파일 목록 — 다른 에이전트와 겹치지 않게)
건드리지 마: (다른 에이전트가 담당하는 파일)

작업 내용:
1. ...
2. ...

완료 조건: (이걸 만족하면 끝)
```

운영 흐름:
1. 리뷰(`/review`)에서 나온 피드백을 화면별로 모읍니다(미답변 뱃지 기준).
2. 지휘 역할이 작업을 분석 → **파일이 겹치지 않게** 분배 → 에이전트별 지시서 작성.
3. 각 작업 터미널(또는 서브 에이전트)에 지시서를 전달.
4. 완료 보고 → 다음 지시서 발행.

핵심 원칙:
- **파일 충돌 절대 금지** — 같은 파일을 두 곳에서 동시 수정하지 않도록 소유권을 배분.
- 공통 컴포넌트(`components/`, `layout/`, `theme`)는 read-only + 변경 필요 시 "COMMON:" 리포트만 올리고, 실제 반영은 지휘 역할이 취합.
- **작업이 끝나면 무조건 commit + push** (이 프로젝트는 두 군데서 병렬 작업 중이라 즉시 올려야 서로 최신본을 받습니다).

---

## 7. 프로젝트 컨텍스트 (`memory/`)

`docs/review-system/memory/` 에는 이 프로젝트를 카스와 작업하며 쌓아온 **컨텍스트 메모**를 넣어뒀습니다. 다른 컴퓨터에서 리뷰/개발을 이어갈 때 배경 지식으로 참고하세요.

- `MEMORY.md` — 전체 인덱스(프로젝트 개요·기술 스택·아키텍처·이슈)
- `frontend-analysis.md` / `services-analysis.md` / `backend-analysis.md` — 레이어별 구조 분석
- `firestore-schema.md` / `infrastructure.md` — 스키마·인프라
- `fcm-push-implementation.md` — FCM 푸시 구현 내역
- `owner-venue-system.md` / `rn-project.md` / `rn-owner-project.md` — 구장주 시스템·RN 앱
- `kakao-*` / `google-*` / `phone-otp-*` — 로그인/인증 관련 이슈·해결 기록
- `agent-instructions.md` / `agent-*-report.md` — 과거 병렬 에이전트 지시서·완료 보고 (지시서 실사용 예시)
- `work-*.md` / `client-request-*.md` — 작업 로그·의뢰 내역
- `feedback-*.md` — 작업 규칙(무조건 commit+push, sticky/스크롤 픽스 유지 등)

> 참고: 이 메모들은 작성 시점의 상태 기록입니다. 파일·함수·설정을 그대로 쓰기 전에 현재 소스에 존재하는지 먼저 확인하세요. 카카오/구글 앱키, SMS 게이트웨이 주소 등 운영 값이 포함돼 있으니 외부 공유에 유의하세요.

---

## 8. 관련 파일 맵

| 파일 | 역할 |
|------|------|
| `src/dev/AuthReview.jsx` | 리뷰 허브 UI 본체 (3분할·핀·캡처·스레드) |
| `src/dev/reviewData.js` | 도메인·화면 목록 + 기획 스펙 (여기만 고치면 항목 추가/수정) |
| `src/dev/reviewThreadService.js` | Firestore `reviewThreads` 읽기/쓰기 |
| `src/dev/reviewDemo.js` | 리뷰 프레임 안 데모 계정 자동 로그인 |
| `src/routes/AppRoutes.jsx` | `/review` 라우트 + `inReviewFrame()` 게이트 우회 |
| `src/index.js` | 부팅 시 `maybeAutoLoginReviewDemo()` 호출 |
| `scripts/seed-review-demo.mjs` | 데모 계정 + 팀 소속 + isAdmin 시드 |
