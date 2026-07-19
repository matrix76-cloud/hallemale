---
name: 에이전트 E 완료 보고 (10분 스프린트)
description: 2026-04-15 DEBUG 제거 + Apple 로그인 + 전화번호 통합 + 환경 가이드 작업 결과. 지휘 에이전트 참고용
type: project
originSessionId: d3f3c6ed-41ea-4a34-a2a9-472ff9c8b6e7
---
# 📋 에이전트 E 완료 보고 — 2026-04-15

**스프린트**: DEBUG 제거 + Apple + 전화번호 통합 + 환경 가이드 (10분)

## ✅ 완료 항목

### 1. KAKAO-DEBUG 제거
- `src/services/authService.js` — `[KAKAO-DEBUG]` console.log **11개 전부 제거**
- grep 검증: `src/` 내 0건

### 2. Apple 로그인 추가
- `src/services/authService.js` 에 `signInWithApple(idToken)` export
  - `OAuthProvider('apple.com').credential({ idToken })` → `signInWithCredential`
  - `ensureUserDoc({ uid, email, provider: 'apple' })` 호출
- `signInWithSocial` 에도 `apple` provider RN flow 연결 (`res.idToken` 받아 `signInWithApple` 위임)

### 3. 전화번호 기반 계정 통합 (jogunBiz 패턴 이식)
- **`src/services/userService.js`**:
  - `ensureUserDoc`: 시작 시 `linkedSocialUid == uid` 쿼리 → 기존 사용자 있으면 빈 문서 생성 스킵, `updatedAt`만 갱신하고 `{linked:true}` 반환
  - `getUserProfileByUid(uid)` 신규: **3단계 조회** (1) `users/{uid}` 직접 → (2) `linkedSocialUid` 쿼리 → (3) null
  - `linkSocialToExistingUser({existingUid, socialUid, provider})` 신규: 기존 user 문서에 `linkedSocialUid` 기록 + 빈 소셜 문서(`nickname` 없고 `onboardingDone` false)만 삭제
- **`src/services/phoneService.js`**:
  - `linkPhoneToUid`: 트랜잭션 내에서 `linkedUids` 에 uid 이미 있으면 users 업데이트만 하고 phones 재쓰기 스킵 (중복 방지)

### 4. 환경 가이드 파일 생성
- **`.env.production.example`** — 키 이름만 (값 비움): Firebase 7종 + `REACT_APP_FCM_VAPID_KEY` + `REACT_APP_SCHEMA_DUMP`
- **`docs/SETUP.md`** — 한 페이지 운영 가이드:
  - VAPID 키 발급 (Firebase Console > Cloud Messaging > Web Push 인증서)
  - IAM: `halle-bf789@appspot.gserviceaccount.com` 에 **Service Account Token Creator** 역할 부여
  - SMS GW 헬스체크: `curl http://34.64.211.220:8080/health`
  - 카카오 개발자 콘솔 체크리스트 (키, 플랫폼, 키해시, 로그인 활성화)
  - 배포 전 최종 체크

## 📁 수정/생성 파일
- 수정: `src/services/authService.js`, `src/services/userService.js`, `src/services/phoneService.js`
- 생성: `.env.production.example`, `docs/SETUP.md`

## ⛔ 미건드림 (금지 영역 준수)
- `src/pages/**`, `src/components/**`, `functions/**`, `2026Mobile/**`
- fcm/chat/matchRoom/invite/joinRequest/community/clubManage 서비스

## 🔗 다음 에이전트 참고 포인트
- **페이지 측 연동 필요**: 로그인 성공 후 UID 기반 프로필 조회 시 `getUserDoc(uid)` 쓰는 곳은 `getUserProfileByUid(uid)` 로 교체 검토 (소셜 UID ≠ docId 케이스 대응)
- **전화번호 인증 페이지**에서 기존 user 발견 시 `linkSocialToExistingUser({ existingUid, socialUid: auth.currentUser.uid, provider })` 호출 지점 필요 (LinkPhonePage 류)
- **Apple 로그인 UI 버튼**은 아직 미추가 (services 레이어만 준비됨)
- **.env.production** 에 `REACT_APP_FCM_VAPID_KEY` 실제 값 채워야 웹 푸시 동작
