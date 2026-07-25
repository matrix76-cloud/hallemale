# [MY·설정] 도메인 점검 기록 — 지시서 #6

- 점검일: 2026-07-19
- 범위: my·settings 17개 화면 + 관련 서비스 7종
- 성격: **점검·기록 전용. 코드 수정 없음.**
- 제외(타 담당): `clubManageService` · `joinRequestService`(홈·팀) · `ownerWithdrawService`(구장앱)
  → 단, `leaveClub`/`forceRemoveClubMember`는 ★2 검증 목적으로 **읽기만** 수행

---

## 0. 레이아웃 전제 (오판 방지)

`MainLayout.jsx:266-286` 기준:

- `/my/*` → `isFullScreenPage` = **PageContainer 패딩 없음** → **각 페이지가 하단 safe-area를 직접 책임**
- `/settings/*` → full-screen 아님 → `PageContainer.jsx:8-10`이 `calc(24px + env(safe-area-inset-bottom))` 제공 → **페이지에 safe-area 코드가 없어도 정상**

`grep env(safe-area-inset-bottom)` 단독 결과로는 settings 5종이 0으로 나오지만 **결함 아님**. 실제 누락은 `/my/inquiry` 1건뿐.

---

## 1. ★ 중점 항목 검증 결과

### ★2. 탈퇴/강퇴 시 clubId limbo — **해소 확인, 단 잔여 결함 2건**

기존 수정(2026-07-16)이 현재 코드에 **그대로 살아있음**:

| 경로 | clubId 정리 | 위치 |
|---|---|---|
| 자발적 팀 탈퇴 | ✅ `clubId: ""` | `clubManageService.js:479-484` |
| 강퇴 | ✅ 조건부 `clubId: ""` + 배치 원자화 | `clubManageService.js:928-931` |
| 회원 탈퇴 | ✅ users 문서 자체 삭제 → limbo 불성립 | `withdrawService.js:207` |

**탈퇴 처리 순서도 정상** — 뒤집히지 않았음:
팀장 이임/해체(`:171`) → 멤버십 제거(`:181`) → 알림 정리(`:190`) → 차단데이터(`:197`) → FCM(`:200`) → phones(`:204`) → **users 문서(`:207`)** → **Auth 계정(`:211`)**.
users 문서 삭제 전에 팀 정리가 끝나므로 권한이 유효하고, Auth 삭제가 최후라 "데이터만 소실 + 계정 잔존"이 발생하지 않음. 서버(Admin SDK) 우선 경로도 `:118-131`에 존재.

잔여 결함:

- **[중] `withdrawService.js:181-185` — 멤버십 제거 실패가 탈퇴를 막지 않음.**
  `removeMembershipsOnWithdraw`가 try/catch로 흡수되고 그 뒤 `:207`에서 users 문서가 무조건 삭제됨.
  → 실패 시 `clubs.members` 배열에 **삭제된 유저를 가리키는 유령 멤버**가 영구 잔존. limbo의 거울상.
- **[중] `withdrawService.js:197` — 차단 데이터가 `uid`로만 삭제됨.**
  FCM(`:200-201`)·users(`:207-208`)는 `uid`/`userDocId` 양쪽을 지우는데 `user_blocks`만 `uid` 단독.
  → 소셜 연결 계정(`userDocId ≠ uid`)은 `user_blocks/{userDocId}`가 남음. 탈퇴 화면이 "차단/숨김 목록 영구 삭제"라고 고지(`WithdrawPage.jsx:157`)하는 것과 불일치.

### ★3. 프로필 미디어 편집(7-07) 이미지 유실 — **신규 유실 경로 1건 발견 (본 점검 최대 결함)**

기존 방어는 견고함(확인): 4개 경로 전부 실패 시 `setMediaItems(prev)` 롤백(`:120,:137,:167-171,:193-196`), 업로드 후 저장 실패 시 고아 파일 정리(`:169`), 삭제는 doc 먼저 → Storage 나중(`:190-201`).

**그러나 이 방어는 "쓰기 실패"만 막고 "잘못된 원본 위에 쓰는 것"은 막지 못함.**

- **[상] `MyProfileMediaEditPage.jsx:43-47` × `AuthContext.jsx:159-176` — 기존 미디어 전량 소실.**

  재현 경로:
  1. `getUserProfileByUid`가 일시적으로 throw (네트워크/권한 블립) → `AuthContext.jsx:161-167`의 `fallback` 객체가 `setUserDoc`됨
  2. 이 fallback에는 **`media` 필드가 없음** (`id/uid/email/nickname/clubId`뿐)
  3. `loading`이 false가 되고, 미디어 편집 페이지 effect가 `userDoc.media` = `undefined` → `setMediaItems([])`, `didInit = true` (**재동기화 영구 차단**)
  4. 사용자에게 빈 그리드가 보임 → 사진 1장 추가 → `next = [newItem]`
  5. `updateUserProfile({ uid, media: [newItem] })` → **서버의 기존 미디어 배열이 1개짜리로 통째 덮어써짐**

  기존 사진·영상이 doc에서 사라지고 Storage 파일은 고아로 남아 복구 불가. 롤백 로직은 쓰기가 *성공*했으므로 작동하지 않음.

- **[중] 동일 원인의 다중 탭 lost-update.** `mediaItems`가 마운트 시 1회 스냅샷(`didInit` 가드)이고 매 저장이 배열 전체를 덮어쓰므로, 탭 A에서 사진 추가 → 탭 B(구 상태)에서 캡션 수정 시 A의 사진이 소실.

### ★4. 차단·신고 관리(7-15) — **해제는 정상, 노출 차단은 불완전**

| 검증 항목 | 결과 |
|---|---|
| 차단 해제가 실제 반영되는가 | ✅ `unblockUser`가 `arrayRemove`로 영속화(`userBlockService.js:66-78`), 목록도 갱신(`SettingsBlockedPage.jsx:165`) |
| 차단 상대 **글**이 안 보이는가 | ✅ 목록(`communityService.js:95-96`) · 상세(`:177-180`) 필터링 |
| 차단 상대 **댓글**이 안 보이는가 | ✅ `communityService.js:237` |
| 차단 상대 **채팅**이 안 보이는가 | ❌ **미구현** |

- **[상] 채팅에 차단 개념이 아예 없음.** `blockedUids` 소비처는 `communityService`와 차단관리 화면뿐. `chatService.js`·`matchRoomService.js`에 block 관련 코드 0건.
  → 차단한 상대의 채팅 메시지·채팅방이 그대로 노출됨. 화면 안내문(`SettingsBlockedPage.jsx:199`)이 "게시글과 댓글"로 한정돼 있어 기술적 거짓말은 아니나, 사용자 기대와 어긋남.
- **[상] `userBlockService.js:38-41` — 차단 목록 조회 실패가 fail-open.**
  catch가 `{ blockedUids: [], hiddenPostIds: [] }`를 반환하고 throw하지 않음. 결과가 이중으로 나쁨:
  1. 차단관리 화면이 "차단한 사용자가 없습니다."를 **확신에 차서** 표시 (`SettingsBlockedPage.jsx:205`). 바깥 catch(`:148`)는 안쪽이 삼켜서 도달 불가.
  2. 더 심각 — `communityService`가 같은 함수를 쓰므로, 일시적 조회 실패 시 **차단한 사용자의 글·댓글이 피드에 그대로 노출됨**. 차단이 조용히 무력화됨.

### ★5. FAQ ↔ 랜딩 FAQ — 지시대로 **기록만**

`FAQPage.jsx:7-99` 하드코딩 `FAQS` 배열, 20문항 6그룹(계정/프로필 4 · 팀 5 · 매칭 3 · 커뮤니티·랭킹·기록 3 · 알림/설정 3 · 문의/탈퇴 2). 페치·서비스·CMS 없음.
랜딩 FAQ 섹션은 현재 제거 상태이므로 **내용 차이는 결함으로 잡지 않음.** 기록만 남김.

---

## 2. 화면별 기록 (17종)

### 7-01 마이 — `my/MyProfilePage.jsx`
허브(프로필 요약·팀·내정보·설정·약관). safe-area 정상(`:1073-1074`), 탈퇴/이임 흐름 견고.
- [중] `:105-116` `needSetup`이 `userDoc` null일 때 true + loading 가드 없음 → 콜드 로드마다 "프로필 완성" 오버레이 깜빡임
- [중] `:94-97` 배지 조회 실패를 `pendingCount=0`으로 위장 → 대기 중 참여요청/초대가 안 보일 수 있음
- [하] `:213-216` signOut 실패를 삼키고 `/login`으로 이동 → 세션 잔존 가능

### 7-02 프로필 상세 — `my/MyProfileDetailPage.jsx`
- **[상] 도달 불가 화면.** `/my/profile/detail`로 가는 `nav()`/`Link`가 코드 전체에 없음(`AppRoutes.jsx:531`·`MainLayout` 매핑·dev 도구에만 존재). `MyProfileEditPage.jsx:384`는 `/player/{uid}`로 보냄
- [중] `:163-170` 미디어 섹션이 "추가 예정" 플레이스홀더 하드코딩 → 저장된 `userDoc.media`가 여기 안 뜸
- [하] `:6,10,73` `goBackOrHome`·`SubHeaderBar`·`handleBack` 임포트/정의 후 미사용 (기존 dead code, 삭제 안 함)
- [하] `:63` `club?.name || "팀 미지정"` 로딩 게이트 없음

### 7-03 프로필 편집 — `my/MyProfileEditPage.jsx`
safe-area·showBack 정상.
- [중] `:179-189` 아바타를 Storage에 **먼저** 올리고 `updateUserProfile` 나중 → 닉네임 쿨다운/중복으로 throw 시 고아 파일 + 실제 저장 안 된 이미지가 미리보기에 표시
- [중] `:393` 취소가 dirty 체크 없이 `nav("/my")` → `useBackInterceptor`(`:77-87`) 우회. 하드웨어 백은 경고, 화면 취소는 무경고 폐기
- [하] `:198-200` `refreshUser` 실패 삼킴 → `/my`가 저장 전 값 표시
- [하] `:171-174` 도달 불가 분기

### 7-04 실력 편집 — `my/MyProfileSkillsEditPage.jsx`
- **[중] `:113` 하단 패딩에 `bottomTabHeight` 누락** → 저장/취소 버튼이 탭바에 가림 (아래 공통 결함)
- [중] `:51,:63,:100` `nav(-1)` → 딥링크·새로고침 시 앱 밖으로 이탈. 프로젝트 `goBackOrHome` 미사용
- [하] dirty 가드 없음, `refreshUser` 실패 삼킴(`:50`)

### 7-05 신체 편집 — `my/MyProfileBodyEditPage.jsx`
- [중] `:123` `bottomTabHeight` 누락 / `:56,:68,:110` `nav(-1)`
- [하] `:10-17` 옵션 범위(150-210cm·45-100kg·80년) 밖 레거시 값은 매칭 `<option>`이 없어 select가 **빈칸**으로 렌더 — 값은 살아있는데 사용자는 못 봄

### 7-06 소개 편집 — `my/MyProfileIntroEditPage.jsx`
- [중] `:124` `bottomTabHeight` 누락 / `:49,:61,:111` `nav(-1)`
- **[중] dirty 가드 부재의 최대 피해처** — `:111` 취소가 자유 입력 소개글 + `:28-33`으로 추가한 경력 전부를 무경고 폐기
- [중] `:67-89` `maxLength` 없음, `:31` 경력 배열 길이 제한·중복 제거 없음. `userService.js:345-346`도 타입만 검사 → **타인에게 보이는 프로필**에 무제한 입력 유입
- [하] `:98` key `${c}-${idx}` 충돌 가능

### 7-07 미디어 편집 — `my/MyProfileMediaEditPage.jsx`
→ **★3 참조.** 기존 롤백·고아정리·삭제순서는 견고. 신규 [상] 전량 소실 경로 + [중] 다중 탭 lost-update.

### 7-08 팀 가입 신청 — `my/MyProfileTeamJoinEditPage.jsx`
- **[상] `:42-45` + `:100-104` 조작된 팀 정보 표시.** `getClubForPickerRow` throw와 "해체된 팀"(`teamService.js:763,766`이 null 반환)이 같은 분기로 떨어져 **"팀 · 지역 미지정 · 0경기 · 승률 0%"**를 실재하는 정상 신청처럼 렌더
- **[중] `:85-139` 영구 정체.** 대기 상태에서 닫기(`:134`)만 가능 — 신청 취소 수단 없고 `TeamSelectModal`도 하드 차단. 상대 팀이 응답 안 하면 빠져나올 길 없음
- [중] `:20` `joinRequest`가 `userDoc` 기반인데 realtime 구독 아님 → 화면 열어둔 채 승인/거절돼도 계속 "신청 중"
- [중] `:150` `bottomTabHeight` 누락 / `:77,:134` `nav(-1)`
- [하] `:34` `if (!clubId) return;`이 `pendingClubRow`를 리셋 안 함

### 7-09 내가 쓴 글 — `my/MyPostsPage.jsx`
safe-area 정상(`:100`).
- [중] `:32` + `communityService.js:689` 50건 하드 캡, 페이지네이션·더보기 없음 → 51번째부터 무단 비노출
- [중] `communityService.js:693-698` catch가 모든 실패를 "복합 인덱스 없음"으로 단정하고 동일 쿼리 재시도 → 실제 에러 노출 지연
- [하] `:22-26` auth 미수화 중 "작성한 게시글이 없습니다" 선노출 / `:61-62` 에러에 재시도 없음

### 7-10 개인 경기 — `my/MyPersonalMatchesPage.jsx`
safe-area 정상(`:206`).
- **[상] `:97-98` "개인 경기"인데 `myClubId`로만 필터.** `matchRoomService.js:626-630`이 `myLineupUids`("내가 포함된 경기 필터용")를 이미 반환하는데 미사용 → **라인업에 없던 팀원도 팀 경기 전부를 자기 기록으로 봄**
- **[상] `matchRoomService.js:547-548` `limit(200)`에 `orderBy` 없음** → 최신 200이 아닌 임의 200. `:569` 정렬은 도착분만 정렬
- **[상] `:98` `finished` 필터가 200 캡 *이후* 클라 측 적용** → 실제 완료 경기가 있어도 "기록 없음"으로 표시 (적재 절단의 결과 없음 위장)
- [하] `:135` 빈 상태에 CTA 없음 / `:132-133` 재시도 없음

### 7-11 신고 내역 — `my/MyReportsPage.jsx`
**기존 수정 검증: 사실.** `:147` `loadErr` state, `:169` `setLoadErr(true)` + 주석, `:215-216` 에러+"다시 시도" 렌더, `:177` deps에 `reloadTick` → 재시도가 실제로 재조회. 배선 완결. safe-area·말줄임 정상.
- [중] `:160-163` `Promise.all` 전부-아니면-전무 → 팀 신고만 실패해도 성공한 선수 신고까지 폐기
- **[중] `postReportService.js`에 `listMyPostReports` 부재** — `createPostReport`(`:30`)로 게시글 신고는 가능한데 조회 함수가 없음. 3종 중 2종만 노출 → **게시글을 신고한 사용자는 그 내역을 어디서도 못 봄**
- [하] `:151-155` auth 미수화 중 "신고한 내역이 없습니다" 표시

### 7-12 1:1 문의 — `my/InquiryPage.jsx`
- **[중] `:222` `padding: 16px 16px 60px` — `env(safe-area-inset-bottom)` 누락.** `/my/*`라 레이아웃 보정이 없어 노치 기기에서 마지막 카드/등록 버튼이 홈 인디케이터에 가림. **17종 중 유일한 실제 safe-area 결함**
- [중] `inquiryService.js:73-75` Firestore `limit` 없이 전량 페치 후 클라에서 200 절단 → 읽기 비용 무제한, 200 초과분 비노출
- [중] `inquiryService.js:40-47` 서버 검증이 존재 여부뿐 — 제목 60자·본문 1000자(`InquiryPage.jsx:142,152`)는 클라이언트 전용
- [하] `:105-108` 제출 성공 확인 메시지 없이 폼만 비워짐 / `:89-91` 도달 불가 분기 + 비활성 버튼 막다른 길 / `inquiryService.js:83` 미확정 `serverTimestamp`가 0으로 정렬돼 방금 등록한 문의가 맨 아래로

### 7-13 알림 설정 — `settings/NotificationSettingsPage.jsx`
**기존 수정 검증: 사실.** `:57` `prevPrefs` 캡처, `:67-68` 복원 + `showAlert`. safe-area는 레이아웃이 제공.
- **[상] `:58-59` `if (!uid) return;`이 낙관적 `setPrefs(next)` *뒤*에 위치.** `:37-40`에서 uid 없어도 화면이 정상 렌더되므로 → 토글이 움직이고, 에러도 없고, **아무것도 저장 안 됨.** 롤백이 막으려던 바로 그 실패 모드가 이 경로에만 열려 있음
- **[상] `notificationPrefsService.js:23-30,:55-61` 화이트리스트 6키로 재구성 후 `notificationPrefs` 전체 덮어쓰기.** 실제 운영 코드가 쓰는 `venue`·`inquiry`·`owner` 카테고리(`ownerVenueService.js:598,687,932,1110,1369,1514`, `adminInquiryService.js:63`, `functions/jobs/venueReservationAutoComplete.js:76`)가 (i) UI에 없어 사용자가 못 끄고 (ii) 이 화면에서 저장할 때마다 **조용히 삭제됨**
- [중] `:44-46` 로드 실패 catch가 비어 있고 기본값이 전부 true → 전부 끈 사용자에게 전부 켜짐으로 표시되고, 이후 토글이 그 **잘못된 기준선을 저장**
- [중] OS 푸시 권한/토큰 상태 미표시. `registerFcmToken`은 로그인 시 1회(`AuthContext.jsx:154`), 거부 시 조용히 null(`fcmService.js:41-45,51-54`) → 권한 거부 사용자에게 토글은 전부 ON인데 푸시는 영영 안 옴, 재요청 수단도 없음
- [하] `:63-64` `persist._t` 타이머 언마운트 시 미해제

### 7-14 공지사항 — `settings/NoticeListPage.jsx`
- **[상] `noticesService.js:96-98` `onSnapshot` 에러를 `console.error`만 하고 `onChange` 미호출.** `NoticeListPage.jsx:149-152`가 성공 콜백에서만 `loading`을 내리므로 → 권한/네트워크 실패 시 **영구 스피너**. 에러도 빈 상태도 재시도도 없음
- [중] `:140,:172-173` `err` state와 `ErrorBox`가 렌더되지만 `:146`에서 `""`로만 세팅 → **도달 불가 dead code**. 서비스에 에러 채널 자체가 없음
- [중] `noticesService.js:83,:87` `limit(100)`을 `published` 필터 *전에* 적용 → 전체 공지 100건 초과 시 미게시 초안이 자리를 먹어 게시된 공지가 사라짐. `listPublishedNotices`(`:66-68`)도 동일
- [하] `:192` `content` 빈 공지는 탭해도 아무것도 안 나옴(폴백 없음)
- 확인(정상): 브로드캐스트 딥링크 `/notificationsdetail/{noticeId}`는 `NotificationDetailPage.js:105`의 `getNotice` 폴백으로 해결됨

### 7-15 차단·신고 관리 — `settings/SettingsBlockedPage.jsx`
→ **★4 참조.** 해제 동작 정상, `myUid` 계산 주석(`:106-110`)도 커뮤니티와 일치. 핵심 결함은 fail-open 조회 + 채팅 미필터.
- [하] `:41` `Empty` styled 컴포넌트 정의 후 `EmptyState`를 대신 사용 (기존 dead code, 삭제 안 함)

### 7-16 회원 탈퇴 — `settings/WithdrawPage.jsx`
**가장 견고한 화면.** 이중 확인(`:125`) + 문구 타이핑(`:121`) + busy 가드 + `requires-recent-login` 전용 안내(`:137-140`) + Auth 상태 레이스 처리(`:129-134`). 고지 문구도 정확(게시글 잔존·팀장 자동 이임 명시).
- 결함 없음. 단 `:157`의 "차단/숨김 목록 영구 삭제" 고지는 ★2의 `user_blocks` `uid` 단독 삭제 결함과 충돌.

### 7-17 FAQ — `settings/FAQPage.jsx`
→ **★5 참조** (내용 인벤토리).
- [중] `:113-133` 목록 뒤 막다른 길. FAQ 본문이 1:1 문의로 유도(`:93`)하면서 정작 `/my/inquiry` 링크가 없음
- [하] 하드코딩이라 배포 없이는 수정 불가. 이미 드리프트 발생 — `:83`은 알림 미수신 시 "앱 최신 버전 업데이트"를 안내하지만 실제 원인(웹푸시 권한 거부/토큰 없음)에는 앱 내 해결 수단이 없음(7-13 결함 참조)

---

## 3. 공통 결함

**[중] 프로필 편집 서브페이지 4종이 탭바에 가림.**
`MainLayout.jsx:231-264` `showBack`에 `/my/profile/edit`은 있으나 `/skills|/body|/intro|/team-join`은 없음 → `:312`가 `BottomTabBar`를 렌더. 해당 4종은 `calc(32px + env(safe-area-inset-bottom))`만 두고 `theme.layout.bottomTabHeight`를 빼먹음(`7-04:113`, `7-05:123`, `7-06:124`, `7-08:150`). 올바른 패턴은 `MyProfilePage.jsx:1073-1074`.
같은 원인으로 이 4종은 헤더 제목이 "내 정보"로 폴백되고(`MainLayout.jsx:218`) 헤더 백 화살표도 없으며, `TopHeader.jsx:26`이 이미 `padding-top: env(safe-area-inset-top)`을 주는데 페이지가 또 더해 **상단 인셋을 이중 계산**.

**[중] `nav(-1)` 관용구가 편집 서브페이지 전반에 퍼짐** (7-04·7-05·7-06·7-08). 딥링크/새로고침 진입 시 히스토리가 외부라 저장·취소·백이 앱 밖으로 이탈. 프로젝트에 `goBackOrHome`(`utils/navigation`, `MyProfileEditPage.jsx:22`에서 사용 중)이 이미 있음.

**[중] `refreshUser` 실패를 전 화면이 일괄 삼킴** (7-03:198, 7-04:50, 7-05:55, 7-06:48). 저장은 됐는데 화면은 이전 값 — 사용자에겐 저장 실패로 보임.

**[중] auth 미수화 구간을 "결과 없음"으로 표시** (7-01:105, 7-09:22, 7-11:151). 빈 상태가 권위 있는 사실처럼 렌더됨.

---

## 4. 발견된 dead code (기존 코드 — 보고만, 삭제 안 함)

| 파일 | 상태 |
|---|---|
| `settings/SettingsHelpPage.jsx` | **0바이트**, 미라우팅 |
| `settings/SettingsNotificationsPage.jsx` | **0바이트**, 미라우팅 |
| `settings/SettingsHomePage.jsx` | 225바이트 스텁, 미라우팅 |
| `settings/BlockReportPage.jsx` | 미라우팅 (`/settings/block-report`는 `SettingsBlockedPage`로 감) |
| **`pages/notifications/NotificationSettingsPage.js`** | **294줄 실동작 중복 구현**, 미라우팅 |

마지막 항목 주의 — 알림 설정의 **두 번째 완전 구현체**이며 크게 갈라짐: `player`/`team` 카테고리 노출(`:146-147`)하나 `normalizePrefs`가 쓰기 때 제거하므로 저장 불가능한 토글이고, 450ms 디바운스 저장에 **롤백 없음**(`:207-209` — 즉 수정 전 버전), 헤더 주석(`:2`)은 settings 경로를 가리킴.
`docs/handover/firestore-schema.md:17`이 이 구버전의 `player`/`team` 카테고리와 일치 → **스키마 문서도 현행 6키와 어긋난 상태**.

`/settings/blocked`와 `/settings/block-report`가 같은 컴포넌트를 가리키는 것(`AppRoutes.jsx:548-549`)은 의도된 별칭으로 보임.

---

## 5. 우선순위 요약

| 순위 | 위치 | 결함 |
|---|---|---|
| 1 | `MyProfileMediaEditPage.jsx:43-47` × `AuthContext.jsx:159-176` | userDoc 폴백에 `media` 부재 → 기존 미디어 전량 덮어쓰기 소실 |
| 2 | `userBlockService.js:38-41` | 차단목록 조회 fail-open → 차단이 조용히 무력화, 피드에 상대 글 노출 |
| 3 | `chatService`·`matchRoomService` | 채팅에 차단 미적용 |
| 4 | `NotificationSettingsPage.jsx:58-59` | uid 없을 때 토글이 저장 없이 동작하는 것처럼 보임 |
| 5 | `notificationPrefsService.js:23-30` | 화이트리스트 덮어쓰기가 `venue`/`inquiry`/`owner` 설정 삭제 |
| 6 | `noticesService.js:96-98` | onSnapshot 에러 → 공지 화면 영구 스피너 |
| 7 | `MyPersonalMatchesPage.jsx:97-98`, `matchRoomService.js:547-548` | 개인 경기가 팀 경기 전체 표시 + orderBy 없는 200 캡으로 기록 누락 |
| 8 | `MyProfileTeamJoinEditPage.jsx:100-104` | 조회 실패/해체된 팀을 정상 신청으로 위장 + 신청 취소 불가 |
| 9 | `MyProfileDetailPage.jsx` | 도달 불가 화면 |
| 10 | `withdrawService.js:181-185`, `:197` | 멤버십 제거 실패 시 유령 멤버 / `user_blocks` 부분 삭제 |
| 11 | `MainLayout.jsx:231-264` 외 4파일 | 편집 서브페이지 탭바 가림 + 상단 인셋 이중 계산 |
| 12 | `InquiryPage.jsx:222` | safe-area 하단 인셋 누락 |
| 13 | `postReportService.js` | `listMyPostReports` 부재 → 게시글 신고 내역 조회 불가 |

★2(clubId limbo·탈퇴 순서)는 기존 수정이 유효하게 살아있음을 확인. ★3·★4는 기존 수정이 덮지 못한 신규 경로가 있어 위 표에 반영.
