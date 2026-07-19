---
name: kakao-login-debug
description: "카카오 로그인 검증 결과 — 코드는 정상, 블로커는 Firebase 결제(billing) 비활성화"
metadata: 
  node_type: memory
  type: project
  originSessionId: af025b7b-8b78-4c94-b057-ce888ff07dc9
---

# 카카오 로그인 검증 (2026-06-12 갱신)

## 🔴 핵심 블로커: Firebase 결제 비활성화
- 함수 로그: `E kakaocustomtoken: The request failed because billing is disabled for this project.`
- 프로젝트 `halle-bf789`의 **Blaze 결제가 꺼져 있어** Cloud Functions v2가 인스턴스를 못 띄움.
- 증상: `kakaoCustomToken` 엔드포인트 → **HTTP 503** (`sendTestPush`는 404 = 미배포).
- 결과: 카카오 로그인 6단계(`accessToken → kakaoCustomToken → Custom Token`)에서 함수 호출 실패 → 앱에서 "로그인 중" 멈춤.
- **해결**: 행렬이 형이 콘솔에서 결제 재활성화 (2026-06-12 형이 직접 변경하기로 함).
  - https://console.firebase.google.com/project/halle-bf789/usage/details
  - 결제 켠 뒤 함수 재배포 필요할 수 있음(특히 미배포된 sendTestPush).

## 코드 상태 (전부 정상 — 2026-06-12 확인)
- 웹 `authService.signInWithSocial` kakao 분기: 정상.
- RN `authDispatcher.js` kakao: `K.login()` → accessToken → 1초 딜레이 → forceSend. 정상.
- Cloud Function `functions/auth/kakaoCustomToken.js`: 정상 (kakao /v2/user/me 검증 → createCustomToken).
- Android: `AndroidManifest.xml`에 AppKey + AuthCodeHandlerActivity + redirect scheme 등록됨 (Kotlin 초기화 불필요, 정상).
- iOS: `AppDelegate.swift`에 `KakaoSDK.initSDK` 이미 있음 (옛 메모의 "누락"은 틀림).

## 2026-06-12 적용한 수정 (iOS)
- `AppDelegate.swift`에 카카오톡 앱 복귀 URL 핸들러 추가:
  - `import KakaoSDKAuth`
  - `application(_:open:options:)` → `AuthApi.isKakaoTalkLoginUrl` / `AuthController.handleOpenUrl`
- 이거 없으면 카톡 앱(app-to-app)으로 로그인 시 복귀 안 됨. KakaoSDKAuth 팟(2.22.0) 설치 확인됨.
- Info.plist: URL scheme `kakao9d5253822c7fecb97d273af2ee786c72` + `LSApplicationQueriesSchemes`(kakaokompassauth, kakaolink) 등록 확인.
- **TODO**: iOS 앱 재빌드 후 기기 테스트 (결제 켜진 뒤).

## 관련
- [[login-kakao-only-pending]] — 카카오 단일 로그인 전환 (2026-06-12 웹 적용 완료: LoginPage 카카오 버튼 단독 + 전화번호 게이트 제거).
