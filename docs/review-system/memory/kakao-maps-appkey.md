---
name: kakao-maps-appkey
description: "카카오 지도 SDK appkey — public/index.html에 박혀있고, 할래말래 본인 JS 키여야 함"
metadata: 
  node_type: memory
  type: project
  originSessionId: be5f59ce-c8b0-4299-9a99-d1fb7b077e45
---

카카오 지도(Maps) SDK는 `public/index.html`의 `dapi.kakao.com/v2/maps/sdk.js?appkey=...` 한 군데에서 로드됨.

- **올바른 키 = 할래말래 앱 JavaScript 키 `2d8b1df3e4634162cb9753b1a328dc21`** (`Default JS Key`). 이 키에 `http://localhost:3000`, `https://hallaemallae.com`, `http://halle-bf789.web.app` 도메인이 모두 등록돼 있어 로컬·운영 다 작동.
- 2026-06-18 이전엔 classmanage 임시 키 `f3884aa215c7467194b2bdaa264ec201`이 박혀 있었음 → 그 키엔 localhost:3000 미등록이라 **지도 타일이 401로 막혀 회색 화면**(워터마크만 뜸). 본인 키로 교체하여 해결.

**증상 진단 팁**: 카카오 워터마크/로고는 뜨는데 타일만 회색 = SDK는 떴고 타일 요청이 도메인 인증에서 막힌 것 → appkey가 그 도메인 등록 안 된 다른 앱 키이거나, 해당 키 JavaScript SDK 도메인에 현재 도메인 미등록.

`index.html` 수정은 CRA 핫리로드 안 먹으니 하드 새로고침(Cmd+Shift+R) 필요. 관련: [[kakao-web-login-test]]
