---
name: kakao-web-login-test
description: 웹 카카오 로그인 구현 — 테스트로 classmanage 카카오 앱 키 임시 사용 중 (나중에 할래말래 키로 교체)
metadata: 
  node_type: memory
  type: project
  originSessionId: af025b7b-8b78-4c94-b057-ce888ff07dc9
---

# 웹 카카오 로그인 (redirect/code 방식) — 2026-06-12 구현

## 방식
- 앱(RN WebView): 기존대로 네이티브 카카오 → accessToken → 함수.
- 웹 브라우저: `Kakao.Auth.authorize` 대신 **직접 리다이렉트** → `kauth.kakao.com/oauth/authorize?client_id={REST}&redirect_uri={origin}/oauth/kakao&response_type=code` → `/oauth/kakao?code=` 복귀 → 함수에 `{code, redirectUri}` → 함수가 토큰 교환 → customToken → `signInWithCustomToken`.

## ⚠️ 테스트용 임시 키 (나중에 교체 필수)
- **classmanage 카카오 앱**의 키를 빌려씀 (콘솔에 web 도메인/redirect URI 등록 완료된 앱):
  - JS 키: `f3884aa215c7467194b2bdaa264ec201` (할래말래 지도 SDK 키와 동일 = 같은 카카오 앱일 가능성)
  - REST 키: `7832790aeece53a32c2da7c1248a033b`
- 하드코딩 위치 2곳:
  - 웹: `src/services/authService.js` → `WEB_KAKAO_REST_KEY`
  - 함수: `functions/auth/kakaoCustomToken.js` → `TEST_KAKAO_REST_KEY` (env `KAKAO_REST_KEY` 우선)
- **교체 시**: 할래말래 전용 카카오 앱 만들고 REST/JS 키 발급 → 위 2곳 교체 + 콘솔에 redirect URI 등록 + 함수 재배포.

## 콘솔 설정 (행렬이 형 작업)
- classmanage는 포트 **3001**, 할래말래는 **3000** → redirect URI가 달라 KOE006 불일치 발생.
- 해결: 카카오 콘솔(REST키 7832 앱) → 카카오 로그인 → Redirect URI에 **`http://localhost:3000/oauth/kakao` 추가**.
- 배포용 web.app 쓰려면 `https://halle-bf789.web.app/oauth/kakao`도 등록 필요.

## 추가/변경된 파일
- `src/services/authService.js` — `webSignInWithKakao`(리다이렉트), `completeWebKakaoLogin(code)`; `signInWithSocial` 웹 분기에 kakao 추가.
- `src/pages/auth/KakaoCallbackPage.jsx` — `/oauth/kakao` 콜백 페이지 (신규).
- `src/routes/AppRoutes.jsx` — `/oauth/kakao` 라우트 추가.
- `functions/auth/kakaoCustomToken.js` — `{code, redirectUri}` 교환 지원 (kauth.kakao.com/oauth/token). **halle-bf789에 배포 완료(2026-06-12)**.

## 검증 상태 (2026-06-12)
- 함수 배포 후 더미 테스트: accessToken 경로 401 정상, code 경로는 카카오가 "authorization code not found" 응답 = REST키 교환 정상 작동 확인.
- 실제 로그인 테스트는 형이 redirect URI 등록 후 localhost:3000에서 진행 예정.

## 관련
- [[kakao-login-debug]], [[login-kakao-only-pending]]
- 결제(billing) 활성화 완료: 계정 `010907-35BCFC-D0FD2D` (이게 꺼져 있어서 함수가 503이었음).
