---
name: google-signin-error10-sha1
description: 앱 구글 로그인 오류10(DEVELOPER_ERROR) = Play 앱 서명 SHA-1 Firebase 미등록
metadata: 
  node_type: memory
  type: project
  originSessionId: 8eac1373-9220-4c74-8ce1-84fb90428df1
---

RN 앱(HallaMalle, `com.hongcomms.hallemalle`)에서 구글 로그인 시 **계정 선택 후 "오류 10"(DEVELOPER_ERROR)** = 빌드 서명 SHA-1이 Firebase(`halle-bf789`)에 등록 안 된 것.

**진단 (2026-07-03)**:
- debug.keystore SHA-1 `5E:8F:16:...:F6:25` → google-services.json에 이미 등록됨 (디버그 빌드는 됨)
- upload-keystore.jks(릴리즈 서명키, 비번 `hallamalle2026`, alias `upload-key`) SHA-1 `CF:A8:F1:2D:...:CC:FD:51:64` → 미등록
- **Play 스토어 배포는 Play 앱 서명으로 재서명** → 런타임엔 upload 키가 아니라 **Play 앱 서명 키** SHA-1이 필요
- Play Console → 테스트 및 출시 → 설정 → 앱 무결성 → **앱 서명** 탭 → "앱 서명 키 인증서" SHA-1: `49:DD:0C:C3:5E:AD:41:29:EC:54:C2:E1:D3:E1:16:BC:E1:B6:87:85`

**해결**: 위 Play 앱 서명 SHA-1을 Firebase 콘솔 → 프로젝트 설정 → Android 앱 → SHA 지문 추가. **앱 재배포 불필요**(서버측 검증, 몇 분 내 반영). 웹 저장소는 안 건드림.

**주의/미확인**: Play Integrity API 설정 화면에 연결된 GCP 프로젝트가 `eongwongallae`(507084734176)로, Firebase 프로젝트 `halle-bf789`(939913723928)와 다름. 구글 로그인과 별개일 수 있으나 오류10 계속되면 이 프로젝트 연결부터 의심.

webClientId(`AppConfig.social.googleWebClientId`)는 `939913723928-eemk...`(client_type:3 웹클라) = 정상.
