---
name: login-kakao-only-pending
description: 심사 통과 후 진행할 작업 — 로그인을 카카오 단일 방식으로 변경(전화번호·이메일·구글·애플 모두 제거)
metadata: 
  node_type: memory
  type: project
  originSessionId: a7c050d8-f326-480d-b989-6dc5e44b42e0
---

# 로그인 방식 변경 — 카카오 로그인 단일화 (애플 심사 후 진행)

2026-06-02 행렬이 형 지시. **애플 App Store 심사 중이라 작업 보류**. 심사 완료 후 진행.

## 최종 방향 (확정)
- **카카오 로그인 하나만** 남긴다.
- 제거 대상: 전화번호 인증, 이메일(아이디/비밀번호) 로그인, 구글 로그인, 애플 로그인.
- 계정 통합(`linkedSocialUid`) 로직도 **불필요** — 안 써도 됨.

## 보류 이유
- 애플 심사 진행 중. 심사 중 로그인 흐름을 바꾸면 영향 줄 수 있어 형이 중지 지시.
- "심사 다 되면" 재개.

## 현재 상태
- 로그인 화면(`LoginPage.jsx`)은 지금 **이메일+비밀번호만** 노출. 소셜 버튼은 화면에 없음(authService엔 구현은 있음).
- 이번 세션에 **건드린 건 카피 한 줄뿐**: `LoginPage.jsx:285` HeroSub "풋살 매칭의 시작" → "생활체육 팀 매칭의 시작" (로그인 방식과 무관, 유지).

## 재개 시 작업 범위 (예상 영향 파일)
- `src/services/authService.js` — `signInWithEmail`/`signUpWithEmail`/소셜 분기(`signInWithSocial`의 google/apple) 정리, 카카오만 유지.
- `src/pages/auth/LoginPage.jsx` — 이메일/비번 폼 제거, 카카오 버튼 단독 노출.
- `src/pages/auth/SignupPage.jsx`, `FindIdPage.jsx`, `FindPasswordPage.jsx`, `LinkPhonePage.jsx`, `WelcomePage.jsx`, `SignupSuccessPage.jsx` — 이메일/전화 가입·찾기 흐름 제거 검토.
- `src/services/phoneService.js`, `userService.js`(전화번호/통합 필드) — 전화번호 인증·통합 로직 제거 검토.
- 라우팅(`AppRoutes.jsx`)에서 signup/find-id/find-password/link-phone 라우트 정리.

## 주의
- 재개 전 **카카오 로그인이 실제 작동하는지 먼저 검증**할 것. 카카오만 남기면 백업 수단이 없어 깨지면 아무도 로그인 못 함.
- 관련: [[kakao-login-debug]] (iOS AppDelegate 카카오 SDK 초기화 누락 이슈) — 카카오 로그인 안정성 먼저 확인.
- 카카오 Custom Token: Cloud Function `kakaoCustomToken` + IAM Service Account Token Creator 권한 필요.
