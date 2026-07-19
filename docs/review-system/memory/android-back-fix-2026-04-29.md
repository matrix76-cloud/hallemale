---
name: Android 뒤로가기 안 먹힘 핫픽스 (2026-04-29)
description: RN WebView에서 RN→Web 메시지가 Android는 document에 dispatch되는데 웹은 window만 listen해서 BACK_REQUEST가 안 잡혔던 이슈
type: project
originSessionId: 579f26ea-53bf-47be-9997-e1bcba5835f4
---
# Android 뒤로가기 핫픽스 (2026-04-29)

## 의뢰자 보고
"안드로이드 아래 뒤로가기 버튼이 아예 먹히지 않습니다. 그 외 기능은 정상."

## 근본 원인 (2개 동시 발생)

### 1) 웹 측: 메시지 리스너 OS 차이
React Native WebView에서 RN→Web 메시지 전달 방식이 OS별로 다름.
- **iOS**: `window`에 `message` 이벤트 dispatch
- **Android**: `document`에 `message` 이벤트 dispatch

웹쪽 리스너가 `window.addEventListener("message", ...)` 만 등록되어 있어서 Android에서 RN이 보낸 메시지가 들어오지 않음.

**Why:** 웹+RN 양방향 브릿지 설계 시 OS별 메시지 dispatch 차이.
**How to apply:** RN WebView 프로젝트에서 RN→Web 글로벌 리스너는 반드시 `window` + `document` 양쪽 등록.

### 2) RN 측: webReady 데드락 (실제 결정타)
`App.js`의 `onLoadStart`가 SPA 내부 페이지 변경에서도 가끔 발화 → `bridge.setWebReady(false)` 호출.
그런데 웹쪽은 `WEB_READY`를 최초 1회만 보내서 영영 복구 불가 → RN→Web 메시지가 큐에만 쌓이고 도달 안 함.

**logcat 증거**:
```
WEB_READY received → flushQueue size=9   ← 1회 정상
... 5초 후 ...
queue (web not ready). size=1, 2, 3, ... 13   ← 데드락
```

**해결**: `onMessage` 진입 시 `bridge.setWebReady(true)` + `bridge.flushQueue()` 무조건 호출.
메시지가 한 개라도 들어왔다는 건 web이 살아있다는 신호이므로 webReady=true 보장.

**Why:** Android WebView의 onLoadStart는 SPA 라우팅에서도 발화할 수 있음 (RN WebView 알려진 이슈).
**How to apply:** RN WebView shell에서 webReady/flushQueue 큐잉 패턴을 쓸 때, onMessage 콜백에서 webReady=true로 회복시키는 안전망 필수. 큐 데드락의 흔한 원인.

## 수정 파일
- `src/context/WebviewBridgeContext.jsx` — message 리스너 window+document 양쪽 등록
- `src/bridge/webviewBridge.js` — 글로벌 1회성 핸들러 동일 처리
- `src/routes/AppRoutes.jsx` — 푸터 탭 뒤로가기 정책 분리:
  - ROOT_PATHS (`/`, `/welcome`, `/home`)에서만 "앱을 종료하시겠습니까?" 모달
  - FOOTER_NON_HOME (`/matchingmanage`, `/community`, `/my`)에서 BACK → `/home`로 이동
  - 그 외 일반 페이지 → `navigate(-1)`
  - 모달/바텀시트 떠 있으면 그것부터 닫기 (가드)
- `src/layouts/MainLayout.jsx` — 종료 모달 디자인 정돈 (회색 기본 button → primary 컬러 "확인" + 옅은 회색 "취소", border-radius 14px, 그림자 강화)
- `src/pages/my/MyProfilePage.jsx` — 프로필 미설정 시 화면 덮는 SetupOverlay 차단 카드 제거 (의뢰자 요청)
- `src/pages/player/PlayerProfilePage.jsx` — `playerSessions` 변수 미선언으로 ReferenceError → 흰 화면 → `player.sessions || []` fallback 추가
- **RN App.js** — `onMessage` 진입 시 setWebReady(true) + flushQueue() (큐 데드락 fix)

## 산출물
- 웹: https://halle-bf789.web.app
- APK: `~/Desktop/HallaMalle-20260429-v2.apk` (RN App.js webReady fix 포함, 의뢰자 전달용)

## 추가 UX 개선
홈/루트 페이지(`/`, `/welcome`, `/home`, `/matchingmanage`, `/community`, `/my`)에서 안드로이드 뒤로가기 → 종료 확인 모달.
일반 페이지에서는 그대로 `navigate(-1)`. 모달/바텀시트가 떠 있으면 그것부터 닫음.

## 배포
- 웹만 수정 → APK 재빌드 불필요 (WebView 셸이라 웹 hosting deploy만으로 즉시 반영)
- `firebase deploy --only hosting` 2회 (1차: 핵심 fix, 2차: 종료 모달 추가)
- 의뢰자: 앱 완전 종료 후 재실행하면 반영됨
