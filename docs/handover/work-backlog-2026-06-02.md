---
name: work-backlog-2026-06-02
description: "2026-06-02 작업 백로그 — 완료(미커밋)/보류/남은 작업 전체 현황, 다음 세션 시작점"
metadata: 
  node_type: memory
  type: project
  originSessionId: a7c050d8-f326-480d-b989-6dc5e44b42e0
---

# 작업 백로그 (2026-06-02 기준)

행렬이 형이 준 작업 목록의 현재 상태. **다음 세션은 이 파일부터 보고 이어서 진행.**

## ✅ 완료 — 단, 아직 커밋 안 됨 (다음에 커밋 필요)
버그 4건 + 텍스트 1건. `CI=true npm run build` 통과 확인 완료.

1. **뒤로가기 통일** — 일부 화면 `navigate(-1)`만 호출해 history 없으면 무동작이던 문제.
   - 신규 `src/utils/navigation.js` `goBackOrHome(navigate)` (history 없으면 /home fallback)
   - 적용: `TopHeader.jsx`, `AppRoutes.jsx`(BACK_REQUEST), `MatchRoomDetailPage.jsx`, `MyProfileDetailPage.jsx`, `VenueDetailPage.jsx`, `NotificationDetailPage.js`
   - 이미 fallback 있던 Terms/Privacy/Team/Player는 미수정(정상)
2. **매칭 공간 '선수보기' 빈 명단** — 라인업 스냅샷에 `previewMembers` 미저장이 원인.
   - `matchRoomService.js` `loadMatchRoomDetail`에 `hydrateLineupPlayers` 추가: players 비면 `memberIds`로 `getUserProfileByUid` 조회해 채움 → 기존 매칭룸까지 복구.
3. **알림 삭제 동기화** — 사용자단 1회 로드만 해서 관리자 삭제 미반영.
   - 공지: `noticesService.subscribePublishedNotices`(onSnapshot) + `NoticeListPage.jsx`
   - 종 알림: `notificationService.subscribeNotificationsForUser`(onSnapshot) + `NotificationsPage.jsx`
4. **매칭하기 지역 필터 미작동** — 필터 적용 로직 자체가 없었고 팀 데이터에 region 미노출.
   - `matchingHomeService.normalizeOpponentClubDoc`에 `regionSido`/`regionGu` 노출
   - `MatchingPage.jsx`: 필터 로직 + filters 초기값 + countAppliedFilters에 지역 추가
5. **로그인 카피** — `LoginPage.jsx:285` "풋살 매칭의 시작" → "생활체육 팀 매칭의 시작"

## ⏸️ 보류 — 애플 심사 후 진행
6. **로그인 카카오 단일화** → 상세 [[login-kakao-only-pending]]
   - 카카오만 남기고 전화번호·이메일·구글·애플 전부 제거, 통합 로직 불필요.
   - 애플 심사 중이라 중지. 심사 완료 후 재개.

## 📋 남은 작업 — 시작 전 형에게 확인 필요
7. **홈화면 상단: 기부 시스템 → 보상 시스템 전환**
   - 방향: 상/하반기 종료 시 랭킹 1·2·3등 팀 보상 시스템으로 전환.
   - **정책 미정 → 형에게 물어볼 것**: 보상 내용(상품/포인트/뱃지?), 자동 vs 수동 지급, 화면에 표시만 할지 실제 지급 로직까지, 상/하반기 기준 날짜.
   - 현재 홈 상단은 기부 캠페인(`/impact`, "할래말래 기부금 캠페인") 노출 중.
8. **AI 매칭 동작 검증**
   - 코드 수정 아님. 실제 AI 매칭 로직이 동작하는지 추적·진단하는 작업.
   - 매칭 추천/상대팀 추천 관련 서비스·함수 찾아서 실제 동작 여부 확인.

## 다음 세션 첫 액션 제안
- (a) 완료분 4건+텍스트 **커밋** (main 직접 말고 브랜치 권장)
- (b) 7번 보상 시스템은 정책부터 형에게 확인
- (c) 8번 AI 매칭은 코드 진단부터 (내가 먼저 까보고 보고 가능)
