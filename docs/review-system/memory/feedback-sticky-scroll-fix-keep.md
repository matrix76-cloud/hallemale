---
name: feedback-sticky-scroll-fix-keep
description: 헤더 sticky/화면 스크롤 픽스는 내가 고친 걸로 유지 — 의뢰인이 최신 소스로 덮어도 무시
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 16c5fc60-59fe-4e9c-a305-6fba04245e37
---

**의뢰인(외주 협업자)이 git으로 올리는 "sticky 헤더 / 화면 스크롤 막기" 관련 코드는 제대로 동작 안 함.** 카스가 고친 버전이 정답이니, 나중에 pull 해서 그 부분이 의뢰인 버전으로 돌아와도 **내 픽스로 유지/재적용할 것.**

**Why:** 2026-07-03, 의뢰인이 "sticky 헤더"(커밋 1fc94f0) 등을 올렸는데 실기기에서 헤더가 같이 스크롤되고 로그인/동의 화면도 스크롤됨. 형이 카스한테 고치라고 지시. 형: "나중에 최신 소스 받아도 무시해버려 그부분".

**How to apply:**
- 카스 픽스 내용:
  - `src/theme/GlobalStyle.js` — `#root { overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch }` 로 #root를 유일 스크롤 컨테이너화 → TopHeader의 `position:sticky`가 실제로 고정됨
  - `src/components/auth/AgreementGate.jsx` — Wrap `height:100dvh` + `overflow:hidden` (동의화면 스크롤 제거)
  - `src/pages/auth/LoginPage.jsx` — 로그인 화면도 스크롤 제거 (height 고정 + overflow hidden)
- pull 후 이 파일들이 의뢰인 버전으로 되돌아가 있으면 → 위 픽스 다시 적용하고 commit+push ([[feedback-always-commit-push]])
- 화면 스크롤 막을 때 공통 패턴: 컨테이너 `min-height:100vh/100dvh + overflow-y:auto` → `height:100dvh + overflow:hidden` 으로 교체, 내부는 flex로 채움
