# 프론트엔드 분석

## 라우팅 구조 (src/routes/AppRoutes.jsx)

### 인증 레이아웃 (공개)
- `/` → SplashPage (1.2초 후 리다이렉트)
- `/welcome` → WelcomePage
- `/login` → LoginPage
- `/signup` → SignupPage
- `/signup/success` → SignupSuccessPage
- `/find-id` → FindIdPage
- `/find-password` → FindPasswordPage

### 메인 레이아웃 (RequireAuth + RequireClub)
- `/home` → HomePage
- `/matchingmanage` → MatchingManagePage
- `/matching` → MatchingPage
- `/match-roomlist` → MatchRoomListPage
- `/match-roomdetail/:roomId` → MatchRoomDetailPage
- `/matches/finished` → FinishedMatchesPage
- `/team/:teamId` → TeamProfilePage
- `/team/create` → TeamCreatePage
- `/team/:clubId/manage` → TeamManagePage
- `/player/:playerId` → PlayerProfilePage
- `/playerRanking` → PlayerRankingFullPage
- `/teamRanking` → TeamRankingFullPage
- `/community` → CommunityListPage
- `/my` → MyProfilePage
- `/notifications` → NotificationsPage
- `/chats` → ChatListPage
- `/settings/*` → 설정 페이지들

### 어드민 (/admin/*) — RequireAdmin
- AdminDashboardPage, AdminPlayersListPage, AdminTeamsListPage 등 25개

### 특수 로직
- **RequireAuth**: 미로그인 → `/login` 리다이렉트
- **RequireClub**: 팀 미지정 확인
- **RequireAdmin**: `userDoc.isAdmin` 또는 `localStorage HALLE_ADMIN_AUTHED`
- **ROOT_PATHS**: `["/", "/welcome", "/home", "/matchingmanage", "/community", "/my"]` → 하단 탭바 표시
- **BridgeNavSync**: RN 웹뷰 네비게이션 동기화
- **ScrollToTop**: 라우트 변경 시 스크롤 리셋

## Context 시스템

### AuthContext
- `firebaseUser`, `userDoc`, `loading`, `isLoggedIn`
- `refreshUser()`, `signOut()` (FCM 토큰 해제 포함)
- `watchAuthState()` 구독, activeTeamId/clubId 정규화

### ClubContext
- SSOT: `users/{uid}.activeTeamId`
- `club`, `members`, `loading`, `isTeamLeader`, `activeTeamId`
- `refreshClub()`, `refreshMembers()`
- onSnapshot으로 activeTeamId 실시간 구독

### UIContext
- `globalLoading`, `toast` (2초 자동닫힘), `modal`, `bottomSheet`
- `showToast()`, `showModal()`, `hideModal()`, `showBottomSheet()`, `hideBottomSheet()`

### WebviewBridgeContext
- `sendToApp(type, payload)`, `subscribe(type, callback)`, `isWebView`
- 자동: WEB_READY 발송, NAV_STATE 발송, BACK_REQUEST/APP_EXIT_REQUEST 수신

### HomeDataContext
- `homeData` (myTeam, teamRankingTop5, playerRankingTop5, favoriteTeams 등)
- `preloadHomeData(uid)`, `refreshHomeData(uid)`, `refreshFavorites(uid)`
- inflightRef로 중복 방지, 팀 변경시 캐시 무효화

### MatchingDataContext
- `myTeam`, `opponentTeams`, `matches` (pending/accepted)
- `preloadMatchingHomeData(teamId)`, `refreshMatchingHomeData(teamId)`

## Custom Hooks
| Hook | 용도 |
|------|------|
| useAuth() | AuthContext 래퍼 |
| useClub() | ClubContext 래퍼 |
| useUI() | UIContext 래퍼 |
| useHomeData() | HomeDataContext 래퍼 |
| useMatchingData() | MatchingDataContext 래퍼 |
| useMatchBadgeCount({clubId}) | match_requests pending 실시간 카운트 |
| useMatchRoomCounts({clubId}) | 매칭룸 상태별 카운트 (ongoing/confirmed/past) |
| useUnreadChatCount() | 읽지않은 채팅 수 |
| useBottomTab() | 하단 탭바 상태 |

## 레이아웃 (MainLayout)
```
TopHeader (조건부)
  ├ 홈: BrandHeader + 알림/채팅 아이콘
  └ 기타: 뒤로가기 + 타이틀
Main (Outlet)
  ├ 풀스크린: 직접 렌더링
  └ 일반: PageContainer 래핑
BottomTabBar (4탭: 홈, 매칭관리, 커뮤니티, 내정보)
모달/토스트/바텀시트 오버레이
```

## 주요 페이지 요약

### 홈 (HomePage)
- HomeHeroBanner (4개 자동 스크롤), TeamProfileSection, PlayerRankingSection
- WinningTeamsSection, TeamRankingSection, FavoriteTeams/Players
- useMatchRoomCounts 실시간 배지

### 매칭 (MatchingPage)
- 라인업 선택/생성, 상대팀 필터 (포지션/실력/승률/지역)
- AI 추천팀, 상대팀 목록

### 매칭관리 (MatchingManagePage)
- 받은/보낸 매칭 요청, 수락/거절

### 매치룸 (MatchRoomDetailPage)
- 경기 상세, 일정 제안/확정, 결과 입력 (스코어+사진)

### 팀 프로필 (TeamProfilePage)
- 팀 정보, 통계, 멤버, 경기 기록, 매칭 신청 버튼

### 팀 생성 (TeamCreatePage)
- 3단계: 로고 → 정보 → 확인&생성

### 팀 관리 (TeamManagePage)
- 4탭: PROFILE, INTRO, MEMBERS, MEDIA (팀장 전용)

### 마이페이지 (MyProfilePage)
- 프로필, 팀 정보, 포스팅/경기/초대 메뉴, 팀장 이임, 팀 나가기

### 회원가입 (SignupPage)
- 3단계: 약관 → 계정 → 전화인증
- SMS Gateway, 테스트 번호: 01010001000~01010002000

### 커뮤니티 (CommunityListPage)
- TodayMatchesStripFlat (오늘 경기), 게시글 목록, 검색/필터

## 주요 컴포넌트 (62개)
- **common/**: Button, Input, Select, Spinner, BottomSheet, RegionPickerSheet, TeamSelectModal
- **home/**: HomeHeroBanner, TeamProfileSection, PlayerRankingSection, FavoriteTeams/PlayersSection
- **team/**: TeamSummaryCard, TeamStatsSection, TeamMembersSection, TeamMatchHistorySection
- **matching/**: ClubOpponentCard, MatchRequestCard, AiRecommendedTeamsSection
- **player/**: PlayerCard, PlayerSummaryCard, PlayerCareerSection
- **auth/**: BrandHeader, WelcomeHero, WelcomeButtonGroup

## 성능 최적화
- SplashPage에서 홈/매칭 데이터 병렬 preload
- inflightRef로 동일 요청 중복 방지
- onSnapshot 실시간 구독 (배지 카운트)
- 이미지 압축 업로드 (350x350 아바타, 1080x1080 미디어)
- 모바일 우선 설계 (420px max-width)
