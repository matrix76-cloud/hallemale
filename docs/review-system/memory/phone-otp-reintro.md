---
name: phone-otp-reintro
description: 전화번호 SMS 인증 재도입(Solapi) — 카카오/구글 계정 전화번호 통합
metadata: 
  node_type: memory
  type: project
  originSessionId: 4d8efd6f-e57c-4f9a-b012-6b64d8868b3f
---

2026-07-06. 소셜(카카오+구글) 로그인에 전화번호 SMS 인증을 붙여 전화번호를 키로 동일인 계정을 통합. [[login-kakao-only-pending]](카카오 단일화 보류)와 방향 전환 — 카카오/구글 둘 다 쓰되 전화번호로 묶는다.

**흐름**: 소셜 로그인 → 약관동의(RequireConsent) → 전화번호 인증(RequirePhone) → 홈.

**구현 (커밋 fe64b6c, main)**:
- `functions/otp/phoneOtp.js` — `requestPhoneOtp`/`verifyPhoneOtp` (Solapi SDK v5.5.4, `phone_verifications` 컬렉션, 6자리·3분만료·5회제한·1시간5회 레이트리밋, 테스트번호 01099991000~005). region asia-northeast3. 이음(ieum) 이식.
- `src/services/phoneOtpService.js` — CF 래퍼 + `toE164Kr`
- `src/pages/auth/PhoneVerifyPage.jsx` — 전화번호 입력 + plhouse식 숫자패드(점6+넘패드) 코드 입력 + 3분 타이머/재전송
- `AppRoutes` `RequirePhone` 부활: `userDoc.phoneVerified !== true`면 PhoneVerifyPage. 어드민 면제.
- 인증 성공 시 `getPrimaryUidByPhone`→있으면 `linkSocialToExistingUser`, 없으면 `linkPhoneToUid` (둘 다 기존 phoneService/userService 함수)
- `AuthContext`: `getUserDoc`→`getUserProfileByUid` (linkedSocialUid 추적, 2번째 소셜 로그인도 기존 프로필 로드)

**Solapi 설정** (halle-bf789 형 계정): API Key `NCS4CF8Z3BJ7IBWD`, 발신번호 `01063357687` (콘솔 등록됨). 시크릿은 Firebase Secret Manager(`SOLAPI_API_KEY`/`SOLAPI_API_SECRET`). SDK는 5.x라야 `sendOne` 존재(6.x는 API 다름). 테스트 발송 성공 확인(01062149756 수신).

**배포 필수** (형이 실행): (1) `firebase functions:secrets:set SOLAPI_API_KEY` / `SOLAPI_API_SECRET` (2) `firebase deploy --only functions:requestPhoneOtp,functions:verifyPhoneOtp` (3) `firebase deploy --only hosting`.
