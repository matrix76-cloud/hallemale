---
name: 의뢰자 요청 6건 + 스피너 작업 (2026-04-29)
description: 2026-04-29 의뢰자 요청사항 6건 처리 내역과 결과물 위치
type: project
originSessionId: 9a737b87-3984-466d-9cd1-195e329acd01
---
# 의뢰자 요청 처리 (2026-04-29)

## 처리 내역

| # | 요청 | 핵심 변경 |
|---|------|-----------|
| 1 | OS별 뒤로가기 (Android 시스템/iOS 스와이프) | RN App.js: `allowsBackForwardNavigationGestures` iOS only. Android는 기존 BackHandler+BACK_REQUEST 유지 |
| 2 | 홈 매칭룸 "내 팀 경기만" | `listFinishedMatchesPage`에 `clubId` 옵션 추가, actor/target 두 쿼리 병합 |
| 3 | 팀/개인 랭킹 메인-전체보기 동기화 | 정렬 기준 통일(점수→승률→승수). `listAllTeamsForRanking` 신규, `listPlayerRankingPage` 정렬을 `stats.wins desc`로 변경 |
| 4 | 커뮤니티 조회수 반영 | `incrementCommunityPostViews` 신규 (sessionStorage 세션당 1회) |
| 5 | 내 정보 실데이터 | `listMyCommunityPosts` 신규. 매칭/개인 경기는 `loadMatchRoomListPageData` 재사용 |
| 6 | Safe Area / 반응형 | TopHeader/SubHeaderBar/BottomTabBar/PageContainer/SheetWrap 등에 `env(safe-area-inset-*)` 적용. `100dvh` 추가 |
| 추가 | Spinner 디자인 변경 | 회색 ring + 가운데 "로딩중" 텍스트. CenterBox 화면 중앙 정렬 |

## 검증 안 된 부분 (의뢰자가 확인 필요)
- **RN iOS 빌드**: 좌측 스와이프 동작은 실 디바이스 빌드 후 확인
- **Firestore 인덱스**: `community_posts (authorUid, createdAt)` 복합 인덱스 자동 생성 링크 필요할 수 있음 (코드는 fallback 포함)
- **"개인 활동 경기" 정의**: 의뢰자가 픽업게임 등 별도 컬렉션을 의도했는지 미확인. 현재 정의 = "내 팀이 참여한 finished 경기"

## 산출물
- 웹 배포: https://halle-bf789.web.app
- APK: `~/Desktop/HallaMalle-20260429.apk` (50MB, release 빌드)
- PDF 보고서: `~/Desktop/할래말래_작업보고서_20260429.pdf`

## 커밋
- 웹: `bb205b3` (matrix76-cloud/hallemale.git push 완료)
- RN: `c5d9cc5` (App.js만 — 로컬 커밋, remote 없음)

## 향후 재발 가능 이슈

### 랭킹 메인-전체보기 불일치
홈 Top과 전체보기 Top이 달라지는 원인 = **후보 풀 차이 + 정렬 기준 차이**.
- 후보 풀: 홈은 `wins desc`로 200명 가져오고, 전체보기도 `stats.wins desc` 페이지네이션이라 일치해야 함
- 정렬 기준: 홈/전체보기 모두 `(승×5+무×2+패×1) desc → 승률 → 승수 → 경기수 → 이름`
- **수정 시 둘 중 하나라도 바뀌면 다시 어긋남** — 한쪽만 바꾸지 말 것

### Firestore OR 쿼리 패턴
`actorClubId` OR `targetClubId` 같은 OR 쿼리는 두 개의 `==` 쿼리를 `Promise.all`로 병렬 실행 후 dedup + 클라 정렬.
페이지네이션 시 cursor를 `{actorClubId: cursor1, targetClubId: cursor2}` 객체로 관리 (`listFinishedMatchesPage` 참조).
