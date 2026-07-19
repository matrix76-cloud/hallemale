---
name: google-login-redirect-uri-fix
description: 구글 로그인 400 redirect_uri_mismatch 원인/해결 — authDomain은 Firebase 기본 도메인 써야 함
metadata: 
  node_type: memory
  type: project
  originSessionId: ef677d01-a58b-47a7-995a-d7929fb50ca1
---

구글 소셜 로그인에서 `400 오류: redirect_uri_mismatch` ("액세스 차단됨")가 뜨면 **코드 버그가 아니라 authDomain/OAuth 설정 문제**다.

- **원인**: `src/services/firebase.js`의 `authDomain`을 커스텀 도메인(`hallaemallae.com`)으로 두면, 구글 팝업/리다이렉트가 `https://hallaemallae.com/__/auth/handler`로 돌아오는데 **구글 OAuth 클라이언트의 "승인된 리디렉션 URI"에 그 주소가 등록돼 있어야** 한다. 누락 시 전 환경(로컬·모바일·운영)에서 400.
- **해결 (2026-06-22)**: `authDomain`을 **`halle-bf789.firebaseapp.com`(Firebase 기본 도메인)으로 통일.** 이 핸들러는 구글이 OAuth 클라이언트에 **자동 등록**하므로 콘솔 작업 0으로 전 환경 동작. 커밋 `1871307`, 웹 배포 완료.
- **CLI 한계**: OAuth 2.0 클라이언트의 redirect URI는 **gcloud/CLI로 편집 불가**, Google Cloud Console 웹 UI에서만 가능. → 그래서 기본 도메인으로 우회한 것.
- **잔여 주의점**: 기본 도메인 authDomain이면 **iOS Safari 모바일 웹브라우저**의 구글 redirect 로그인이 ITP(쿠키 차단)로 드물게 실패 가능. 단, 실제 앱은 RN WebView 네이티브 구글이라 무관. iOS 모바일웹까지 완벽히 하려면 그때 커스텀 도메인 + 콘솔 redirect URI 등록.
- **승인 도메인 조회법**: `curl "https://identitytoolkit.googleapis.com/v1/projects?key=<apiKey>"` → authorizedDomains 확인 (이건 OAuth redirect URI와는 별개, 둘 다 필요).

관련: [[kakao-web-login-test]]
