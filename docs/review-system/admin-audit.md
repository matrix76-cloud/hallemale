# 관리자(admin) 도메인 화면 감사 — 지시서 #9

- 대상: `/review` 10번 도메인 30개 화면 (`src/dev/reviewData.js:138-167`)
- 방식: **코드 정적 감사** (dev 서버 미기동, 실행 없음)
- 수정 범위: **치명 등급만 즉시 수정**, 나머지는 기록만
- 작성: 2026-07-19

## 등급 기준

| 등급 | 정의 |
|---|---|
| **치명** | 보안 우회, 데이터 파괴, 금액 오류·중복 정산/환불 |
| **중대** | 기능 미동작, 상태 꼬임, 복구 불가, 허위 지표 노출 |
| **경미** | UX·성능·문구 |
| **결함 아님** | 0.6 스케일 축소 탓으로 깨져 보이는 것 (지시 2번) |

> **축소 관련 주의**: 관리자는 PC 풀와이드라 리뷰 프레임에서 0.6 스케일로 축소됩니다.
> 글자가 작거나 여백이 좁아 보이는 건 결함이 아닙니다. 이 문서에는 코드상 실제로
> 확인된 결함만 올리고, 축소 착시로 판단된 항목은 "결함 아님"으로 남깁니다.

---

## ★ 전 화면 공통 — 권한 검증 (지시 3번)

### **[치명]** 일반 계정이 users 문서에 `isAdmin` 을 직접 써넣어 관리자 콘솔 진입 — **수정 완료**

관리자 콘솔 진입 판정과 서버 권한 판정이 **서로 다른 출처**를 보고 있었습니다.

| | 판정 근거 | 위조 가능? |
|---|---|---|
| 화면 게이트 `RequireAdmin` (수정 전) | `users/{uid}` 문서의 `isAdmin` 필드 | **가능** |
| Firestore 규칙 `isAdmin()` | `request.auth.token.admin` 커스텀 클레임 | 불가 |

`firestore.rules:21` 이 `match /users/{id} { allow write: if signedIn(); }` 이므로,
**로그인만 한 일반 사용자가 자기 users 문서에 `isAdmin:true` 를 써넣을 수 있습니다.**
그 상태로 `/admin/dashboard` 에 직접 URL 접근하면 수정 전 `AppRoutes.jsx:229` 의
`userDoc?.isAdmin === true` 가 통과되어 **관리자 콘솔 전체가 열렸습니다.**

진입 후 실제로 가능했던 행위 (규칙이 `signedIn()` 만 요구하는 컬렉션):

- `users` — 회원 제재/차단 필드 조작, **타인 계정 문서 덮어쓰기**
- `clubs` — 팀 차단·삭제
- `community_posts` — 게시글 삭제
- `match_requests` — 매칭 상태 조작
- `inquiries`, `user_reports`, `team_reports`, `community_reports`, `user_blocks` — **문의·신고 내용 전수 열람**
- `tasks` — 운영 작업 큐 조작

(반대로 `banners`/`notices`/`games`/`event_popups`/`app_updates`/`admin_accounts` 는
클레임을 요구하므로 쓰기는 막혔습니다. 즉 **읽기·개인정보 열람과 상당수 쓰기가 뚫린** 상태.)

**수정 내용**

1. `src/context/AuthContext.jsx:104` — admin 커스텀 클레임으로 세션을 만들 때만 세워지는
   `adminClaim: true` 플래그 추가 (기존 필드는 그대로 두어 사용자앱 영향 없음).
2. `src/routes/AppRoutes.jsx:234` — `RequireAdmin` 판정을 `userDoc?.adminClaim === true` 로 교체.
3. `src/pages/admin/AdminLoginPage.jsx:157` — 로그인 화면의 "이미 로그인됨" 리다이렉트도
   동일 기준으로 교체. (이걸 안 맞추면 위조 계정이 로그인↔대시보드 사이를 오가는
   **무한 리다이렉트 루프**에 빠집니다 — 2번만 고쳤을 때 실제로 발생.)

`/review` 리뷰 프레임은 `inReviewFrame()` 이 게이트보다 먼저 통과시키므로 영향 없습니다.

**부수 효과(의도됨)**: users 문서에만 `isAdmin:true` 가 있고 클레임이 없는 계정
(리뷰 데모 시드 계정 등)은 이제 리뷰 프레임 **밖에서는** 관리자 콘솔에 못 들어갑니다.
정상 관리자는 `/admin/login` → CF `adminLogin` → 커스텀 토큰 경로라 영향 없습니다.

### **[중대·미수정]** 같은 위조 필드로 전화인증·웰컴 게이트도 우회

`AppRoutes.jsx:179`, `:204` 의 `RequirePhone` / `RequireWelcome` 이 여전히
`userDoc?.isAdmin === true` 로 면제 처리합니다. 위조 계정은 **SMS 전화번호 인증을 건너뛰고**
사용자앱에 진입할 수 있습니다. 사용자앱 게이트 동작이라 이번 지시서 범위(admin) 밖으로 보고
수정하지 않았습니다. `adminClaim` 으로 바꾸면 한 줄씩입니다.

### **COMMON — 근본 원인 (지휘 취합 필요)**

`firestore.rules:21` `match /users/{id} { allow read: if true; allow write: if signedIn(); }`
는 **로그인한 누구나 아무 회원의 문서를 덮어쓸 수 있는** 규칙입니다. 이번 권한 우회의
근본 원인이고, 이것만으로도 대량 계정 훼손이 가능합니다. `firestore.rules` 는 공용 파일이라
직접 수정하지 않고 보고만 올립니다. 권장: `allow write: if signedIn() && request.auth.uid == id`
+ 관리자 쓰기는 `isAdmin()` 클레임 허용.

---

## 그룹 ① 10-01~10-02 대시보드·로그인

### 10-01 대시보드 (`/admin/dashboard`)

- 파일: `src/pages/admin/AdminDashboardPage.jsx` (813줄), `src/services/adminDashboardService.js` (454줄)
- 요약: KPI 카드 8종 + 지역별 팀 수 + 최근 7일 일별 요약 + 매치 카드(오늘/지난7일/향후7일) + 우측 액티비티 패널(신고/승인/공지 탭).

**결함**

- **[중대] 누적기부금·총득점이 하드코딩 더미인데 실데이터처럼 노출** — `AdminDashboardPage.jsx:478-479`
  ```js
  const scoreTotal = 32840;
  const donationTotal = scoreTotal * 10;
  ```
  화면에는 `총득점 현황 32,840`, `누적기부금 328,400원`, `득점당 10원 · 누적기부금 328,400원`
  으로 출력됩니다(`:610`, `:614`, `:619`). 주석에만 "(더미)"라 적혀 있고 화면에는 표시가 없어,
  운영자가 이 숫자를 실적으로 오인해 대외 발표할 위험이 있습니다. 기부는 `/impact` 임팩트
  캠페인으로 사용자에게 노출되는 약속이라 허위 수치 파급이 큽니다.

- **[중대] "팀 등록 / 선수 등록" 카드가 항상 0 — 승인 시스템 미구현** — `adminDashboardService.js:450-452`
  ```js
  // 승인 시스템 미구현 → 0 고정
  pendingTeamApprovals: 0,
  pendingPlayerApprovals: 0,
  ```
  `AdminDashboardPage.jsx:649`, `:659` 에서 그대로 카드 값으로 렌더됩니다. 카드 제목이
  "팀 등록", "선수 등록"이라 **대기 건이 0건인 것처럼** 보입니다(실제로는 집계 자체가 없음).
  우측 액티비티의 "승인" 탭도 `adminDashboardService.js:245-248` 에서 항상 빈 배열이라
  탭을 눌러도 영구 빈 화면입니다(`AdminDashboardPage.jsx:787-790`).

- **[중대] finished 매치 전수 무제한 로드** — `adminDashboardService.js:419`
  ```js
  getDocs(query(mrCol, where("status", "==", "finished"))).catch(() => null)
  ```
  `limit` 이 없어 대시보드를 열 때마다 **완료된 전체 경기 문서를 끝까지** 읽습니다. 누적
  경기 수에 비례해 로딩 시간·Firestore 읽기 비용이 무한 증가하고, 결국 대시보드가 뜨지
  않게 됩니다. 같은 파일 `:368` `fetchAdminRegionCounts` 의 `clubs` 전수 조회도 동일 패턴.

- **[경미] 주간 요약이 2000건에서 조용히 잘림** — `adminDashboardService.js:275`
  `limit(2000)` 으로 자르는데 잘렸다는 표시가 없어, 급성장 구간에서 그래프가 실제보다
  낮게 나오고 아무도 눈치채지 못합니다.

- **[경미] 시각 표시가 KST 가 아니라 브라우저 로컬 시간** — `adminDashboardService.js:61-63`
  ```js
  function fmtHm(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  ```
  날짜 버킷팅은 `startOfDayKstFor` 로 KST 를 정확히 맞춰놨는데, 정작 화면에 찍는 시:분은
  `getHours()`(로컬)입니다. 국내에서만 운영하면 증상이 없지만, 해외 출장 중 접속하면
  "오늘 예정" 목록의 시간만 어긋나 보입니다.

- **[경미] 총득점/누적기부금 칩이 클릭 가능한 모양인데 동작 없음** — `:608`, `:612`
  `<Chip type="button" onClick={() => {}}>` — 빈 핸들러.

- **[경미·추정] "누적 승/무/패 · 전체 경기 결과 합산" 라벨과 집계 기준 불일치** — `adminDashboardService.js:432-437`
  `myScore`/`oppScore` 는 문서를 만든 쪽(actor) 관점 필드입니다. 이를 전 매치에 걸쳐
  합산하면 "신청한 팀이 이긴 횟수"가 되는데, 화면 라벨은 "전체 경기 결과 합산"
  (`AdminDashboardPage.jsx:669-672`)이라 플랫폼 전체 전적처럼 읽힙니다. 서비스 주석
  `:398` 에 "(actor 기준)"이라 적혀 있어 의도된 집계로 보이나, 라벨이 오해를 부릅니다.

- **결함 아님**: 4열 KPI 그리드·좌우 2단 레이아웃이 리뷰 프레임에서 좁아 보이는 것은
  0.6 스케일 축소 때문입니다. `Grid`/`Row2` 는 `min-width:0` 와 반응형 컬럼을 갖추고 있어
  실제 PC 해상도에서는 정상입니다.

### 10-02 관리자 로그인 (`/admin/login`)

- 파일: `src/pages/admin/AdminLoginPage.jsx` (294줄), `src/services/adminAuthService.js` (73줄)
- 요약: 아이디/비번 → CF `adminLogin` 서버 검증 → 커스텀 토큰 → `signInWithCustomToken`.
  localStorage 플래그 방식을 걷어낸 진짜 인증 경로.

**결함**

- **[치명·수정 완료] 로그인↔대시보드 무한 리다이렉트** — `AdminLoginPage.jsx:157`
  위 권한 수정 항목 3번 참고. 진입 판정 기준을 `adminClaim` 으로 통일해 해소했습니다.

- **[중대] "자동로그인" 체크박스가 아무 동작도 하지 않음** — `AdminLoginPage.jsx:149`, `:256-262`
  `const [auto, setAuto] = useState(false)` 의 `auto` 는 **어디에서도 읽히지 않습니다**.
  `adminSignIn()` 에도 전달되지 않고 persistence 설정도 없습니다. 게다가 Firebase 기본
  persistence 는 `local` 이라 **체크를 해제해도 세션이 유지**됩니다. 공용 PC 에서 관리자가
  "자동로그인 끔"을 믿고 자리를 뜨면 세션이 남는, 신뢰를 배신하는 컨트롤입니다.
  → 체크박스를 제거하거나 `browserSessionPersistence` / `browserLocalPersistence` 를 실제로 분기해야 합니다.

- **[경미] 아이디·비밀번호 입력에 `autoComplete` / `name` 속성 없음** — `:228`, `:234-239`
  비밀번호 관리자가 인식하지 못해 관리자가 매번 수동 입력하게 됩니다.

- **[경미] 클라이언트 측 시도 횟수 제한 없음** — 서버 CF `adminLogin` 이 rate limit 을
  하는지는 이 저장소 범위 밖(`functions/`)이라 확인하지 못했습니다. **미확인 항목**으로 남깁니다.

- **양호**: 실패 메시지가 `not_found` / `wrong_password` 를 같은 문구로 합쳐(`adminAuthService.js:38-41`)
  아이디 존재 여부를 노출하지 않습니다. 계정 열거 방어가 되어 있습니다.

- **결함 아님**: 좌측 다크 패널 + 우측 폼의 2단 구성이 축소 시 답답해 보이나,
  `Wrap` 에 `@media (max-width: 960px)` 단일 컬럼 폴백이 있어(`:15-17`) 실제로는 정상입니다.

---

## 2차 라운드 (2026-08-06) — 그룹 ②~⑥

- 방식: 앞과 동일한 **코드 정적 감사**. 이번 라운드는 **기록 전용 · 코드 수정 없음**.
- 커버리지: admin 서비스 계층 **전수**(admin\*Service 14종 + banners/eventPopups/settlement/refund/task)
  + 위험도가 높은 화면의 로직. 화면 단위로 아직 안 본 것은 맨 끝 "미착수" 목록에 적었다.
- ①에서 고친 `adminClaim` 판정은 지금도 유효하다(`AppRoutes.jsx:247`, `AdminLoginPage.jsx:159`).

---

### ★ 치명 1 — 어드민 로그인 엔드포인트가 `admin/admin` 을 자동 시드한다 (신규)

`functions/auth/adminLogin.js:46-56`

```js
// 슈퍼관리자(admin/admin) 최초 자동 시드
if (!snap.exists && id === SUPER_ADMIN_ID) {
  await ref.set({ id: "admin", role: "super", passwordHash: sha256("admin"), ... });
  snap = await ref.get();
}
```

`adminLogin` 은 `onRequest({ cors: true })` 의 **인증 없는 공개 HTTP 엔드포인트**다.
`admin_accounts/admin` 문서가 없는 상태라면 **누구나** `{id:"admin", password:"admin"}` 을 한 번
POST 하는 것으로 슈퍼관리자 계정을 만들고 `{admin:true}` 클레임 커스텀 토큰을 받는다. 그 토큰이면
`isAdmin()` 으로 잠근 규칙(`payments` 정산 플래그, `banners`/`notices`/`app_updates`,
`admin_accounts`)이 전부 열리고 관리자 콘솔 전체에 진입한다. ①에서 게이트를 클레임 기준으로
바꾼 보람이 여기서 사라진다 — 클레임 자체를 누구나 받을 수 있기 때문이다.

문서가 이미 있으면 시드는 막히지만 남은 문제가 셋:

- **시도 횟수 제한이 없다.** ①에서 "미확인"으로 남겼던 항목의 답이다 — rate limit·잠금·지연이 없다.
- **비밀번호가 무솔트 SHA-256 1회**(`adminLogin.js:19-21`, `adminAccountService.js:36-42`).
  최소 길이는 4자(`adminAccountService.js:118`). 온라인 무차별 대입과 레인보우 양쪽에 열려 있다.
- 운영 DB의 `admin` 계정 비밀번호가 아직 `admin` 인지는 **미확인**(확인하려면 관리자 로그인 필요).

권장: 시드 로직 제거(계정은 스크립트로 1회 생성) · 실패 횟수 제한 · bcrypt/scrypt 로 교체 ·
비밀번호 최소 길이 상향.

### ★ 치명 2 — 환불 화면이 "가짜 잔액"을 주고, 서버는 별도로 진짜 환불을 한다 (10-27)

`src/services/refundService.js:108-133`

`processRefund` 가 하는 일은 둘이다. ① `chargeFizz(userId, 환불액)` ② 예약 `status="cancelled"`.

- ①의 피지는 **가짜 충전**이다(`fizzService.js:7` 주석 그대로). 실결제 수단은 토스이고,
  사용자에게 이 잔액은 환불이 아니다.
- ②로 `status` 가 `cancelled` 가 되는 순간 서버 트리거 `venuePaidConfirm`
  (`functions/jobs/venuePaymentJobs.js:105-137`)이 **진짜 토스 환불**을 실행한다.

즉 토스로 결제된 예약을 어드민이 환불하면 **카드로도 환불되고 앱 잔액도 지급된다 — 이중 환불**이다.
지급된 피지는 `payFizz` 로 다시 예약 결제에 쓰일 수 있어 그대로 손실이 된다.

같은 자리에서 파생되는 문제:

- **어드민이 입력한 환불액이 실제 환불액이 아니다.** 카드 환불액은 서버의
  `refundPolicy.refundDecision(취소 시점·귀책)` 이 정한다. 화면에서 "50,000원 중 20,000원 환불"을
  입력해도 카드로는 정책률(예: 전액)이 나갈 수 있다. 화면과 원장이 다른 말을 한다.
- **부분환불인데 상태는 항상 `cancelled`**(`refundService.js:124`). 부분환불 개념이 서버에 없다.
- `chargeFizz` 성공 후 `updateDoc` 이 실패하면 잔액만 지급된 채 남고, 재시도하면 또 지급된다.

**정정(앞 라운드 가정과 다름)**: 슬롯 반납과 `payments.netVenueAmount` 차감은 같은 서버 트리거가
경로와 무관하게 처리한다(`venuePaymentJobs.js:100-103`, `toss.js:374-386`). 이 둘은 결함이 아니다.

### ★ 치명 3 — 구장 삭제가 `venues` 문서만 지운다 (10-25)

`src/services/venuesService.js:137-149` ← `AdminVenuesPage.jsx:404-412`

예약(`venueReservations`)·슬롯락(`venueSlotLocks`)·결제(`payments`) 를 하나도 정리하지 않는다.
삭제 후:

- 사용자의 "내 예약"에는 예약이 남지만 구장 문서가 없어 상세·지도·연락처가 깨진다.
- 구장주 화면에서는 구장이 사라져 그 예약을 처리할 방법이 없다(승인·취소·노쇼 전부 불가).
- `payments` 는 남아 **정산(10-26) 지급 대상에 계속 잡힌다** — 존재하지 않는 구장에 지급.

확인 문구는 "되돌릴 수 없습니다"만 말하고 **걸린 예약이 몇 건인지 알려주지 않는다.**
대조: 구장주 탈퇴(`ownerWithdrawService`)는 예약·블록·사진까지 정리하고 진행 중 예약이 있으면
막는다. 어드민 삭제만 이 가드가 없다.

### ★ COMMON — 어드민의 제재를 당사자가 되돌릴 수 있다 (①의 근본 원인이 낳는 결과)

`firestore.rules:81, 198-199, 215-217` — 전부 `allow write: if signedIn()`.

| 어드민 조치 | 기록 위치 | 되돌리는 방법 |
|---|---|---|
| 회원 차단 | `users/{uid}.blocked` | 본인이 자기 문서에 `blocked:false` |
| 팀 차단 | `clubs/{id}.blocked` | 로그인한 누구나 |
| 글 숨김 | `community_posts/{id}.hidden` | 로그인한 누구나 |
| 신고 처리 | `user_reports`·`team_reports`·`community_reports` | 신고 대상이 읽고 `status` 변경·삭제 |

특히 회원 차단은 화면 오버레이(`BlockedAuthGate.jsx`)일 뿐 서버에서 아무 쓰기도 막지 않는다 —
차단된 계정도 글·채팅·매칭 신청이 그대로 된다. 신고 컬렉션은 **신고자 uid·닉네임이 그대로 들어
있어** 대상이 읽으면 누가 신고했는지 알 수 있다(보복 위험).

`firestore.rules` 는 공용 파일이라 이번에도 수정하지 않고 보고만 올린다.

---

### 그룹 ② 10-03~10-10 회원·팀

**10-03 선수 목록** (`AdminPlayersListPage.jsx`, `adminPlayersService.js`)

- **[중대] 최근 200명만 보이고, 검색도 그 200명 안에서만 된다** — `AdminPlayersListPage.jsx:596`
  `limitCount: 200` 으로 한 번 받아 클라에서 25개씩 페이징한다. 키워드 검색은 `filteredRows`
  (`:642-650`)로 **이미 받아온 배열만** 훑는다. 회원이 200명을 넘는 순간 201번째부터는 목록에도
  검색에도 영영 안 나온다. 잘렸다는 표시도 없다.
- **[중대] 조회 창과 표시 순서가 다르다** — 서비스는 `orderBy("updatedAt","desc")`
  (`adminPlayersService.js:212`)로 200명을 고르는데 화면은 그걸 `createdAt` 내림차순으로 다시
  정렬하며 "새로 가입한 사람 순"이라고 적는다(`:603`). 프로필을 최근 수정한 회원이 창을 차지하면
  더 최근 가입자가 밀려난다. 또 `updatedAt` 필드가 없는 문서는 `orderBy` 특성상 **결과에서 통째로
  빠진다** — 레거시 계정이 관리자 눈에 안 보인다.
- **[경미] 운영 코드에 디버그 로그** — `adminPlayersService.js:236` `console.log("meta information", meta)`.
  목록을 열 때마다 소속팀 수만큼 찍힌다.
- **[경미] 차단 후 목록을 갱신하지 않고 이동** — `:578-582`. 뒤로 돌아오면 차단된 회원이 그대로 보인다.

**10-04 선수 순위** — 사용자 화면(`PlayerRankingFullPage`)을 그대로 감싼 래퍼(48줄). 자체 로직 없음.
기준 스펙이 비어 있어 **기준 없음**으로 넘어간다.

**10-05 회원 신고** (`AdminUsersReportsPage.jsx`, `userReportService.js`)

- **[중대] `user_reports` 전수 조회** — `userReportService.js:85-95`. `limit` 이 없다. 신고가 쌓일수록
  화면이 느려지고 결국 안 뜬다. `countReportsByTarget`(`:147`)도 같은 패턴.
- **[중대] 대상을 차단해도 그 대상의 다른 신고는 대기열에 남는다** — `AdminUsersReportsPage.jsx:381-390`
  은 **누른 신고 1건만** `resolved` 로 바꾼다. 같은 사람에 대한 신고 5건이 있으면 4건이 계속
  "처리 대기"로 남아 이미 차단된 회원을 다시 차단하게 만든다.
- **[경미] 처리자가 항상 문자열 `"admin"`** — `:381`, `:385`. 어느 운영자가 처리했는지 남지 않는다.
  실제 운영자 id 는 클레임(`adminId`)에 있는데 쓰지 않는다.

**10-06 차단 회원** (`AdminUsersBlocksPage.jsx`, `adminUserBlockService.js`) — 화면 자체는 정상 동작.

- **[중대] 차단이 서버에서 강제되지 않는다** — 위 COMMON 표 참고. 화면 오버레이뿐이다.
- **[경미] "차단자" 열이 항상 `admin`** — 차단을 실행하는 `AdminPlayersListPage.jsx:578` 이
  `byAdmin: "admin"` 을 하드코딩한다. 열이 있는데 정보가 없다.

**10-07 팀 목록** (`AdminTeamsListPage.jsx`, `adminTeamsService.js`)

- **[중대] 필터가 최근 200팀 안에서만 동작** — `:629` `limitCount: 200` → 서비스가 지역·기간·키워드를
  **받아온 200팀에 대해서만** 적용한다(`adminTeamsService.js:233-251`). "제주" 로 걸러도 실제
  제주 팀 전체가 아니라 최근 업데이트 200팀 중 제주다. 건수를 그대로 믿으면 잘못된 판단이 된다.
- **[중대] 팀 하나당 쿼리 2회 — 최대 400회** — `adminTeamsService.js:258-272`. 멤버 수(`getMembersCount`)
  와 가입신청 수를 팀마다 조회한다(동시 10개). 목록 한 번 여는 데 400 왕복이라 느리고 비싸다.
  멤버 수는 `clubs` 문서에 캐시 필드를 두는 쪽이 맞다.
- **[중대] `updatedAt` 없는 팀은 목록에서 사라진다** — `listRecentClubs` 의 `orderBy("updatedAt")`.

**10-08 팀 순위** — 미착수(래퍼로 보이나 확인 안 함).
**10-09 팀 신고** — 미착수. 10-05 와 같은 구조로 추정되나 확인 안 함.
**10-10 차단 팀** (`adminTeamBlockService.js`) — 서비스는 10-06 과 대칭으로 정상.
`clubs.blocked` 는 `teamService.js:370` → `TeamProfilePage.jsx:1460` 에서 실제로 소비된다(정상).
서버 강제는 위 COMMON 과 동일하게 없다.

### 그룹 ③ 10-11~10-15 매칭·커뮤니티

**10-11 매칭 목록** (`adminMatchesService.js`)

- **[중대] 상태 필터에 실제 상태가 빠져 있다** — `ALLOWED_STATUS`(`:135-141`)가
  `pending/accepted/rejected/cancelled/finished` 뿐이다. 매칭 생명주기에는
  `proposed`·`awaiting_venue_approval`·`confirmed` 가 실재한다(`matchingService.js:343`,
  `ownerVenueService.js:2094`, `matchRoomService.js:1477`). 제휴구장 결제 경로로 확정된 경기는
  상태로 걸러낼 방법이 없다.

**10-12 분쟁/신고** — 이번 라운드에서 신규 구현(커밋 392d5ac). 자기 구현이라 감사 대상에서 제외.

**10-13~15 커뮤니티** (`adminCommunityService.js`)

- **[중대] 게시글 전수 조회 + 작성자마다 순차 왕복** — `:57-77`. `limit` 없이 전 게시글을 받고,
  작성자 uid 마다 `await getUserPublicMeta(uid)` 를 **직렬 루프**로 호출한다. 작성자 200명이면
  200번을 줄 세워 기다린다. `Promise.all` 로만 바꿔도 크게 줄어든다.
- **[중대] 댓글 500개 넘는 글을 지우면 댓글이 고아로 남는다** — `:254-283`. Firestore 배치는 500건
  제한인데 분할이 없다. 게다가 실패를 `catch` 로 삼키고(`:266`) **게시글 삭제는 그대로 진행**해서,
  부모 없는 댓글 서브컬렉션이 영구히 남는다. 같은 파일 `settlementService.js:136` 은 450개씩
  분할하고 있어 대조된다.
- **[중대] 첨부 이미지가 Storage 에 그대로 남는다** — 글 삭제 경로에 Storage 정리가 없다.
- **[경미] 댓글 수 감소가 원자적이지 않다** — `:297-306` 읽고-쓰기. `increment(-1)` 이면 될 자리다.

### 그룹 ④ 10-16~10-19 공지·푸시·계정·정책

**10-17 푸시 발송 / 10-31 발송 로그 / 10-32 앱 업데이트** — 이번 라운드 신규 구현(f49d731, 6a5b540).
자기 구현이라 제외.

**10-18 관리자 계정** (`adminAccountService.js`) — ★치명 1 참고. 추가로:

- **[경미] `verifyAdminLogin`(`:183-206`)은 죽은 코드** — 호출부가 전 소스 0건이다. 로그인은 CF 경로로
  바뀌었는데 클라이언트 해시 비교 함수가 남아 있어, 읽는 사람이 "클라에서 검증한다"고 오해한다.
- **[경미] `ensureSuperAdmin` 이 목록 조회 때마다 실행**(`:77`) — 규칙상 어차피 관리자만 도달하지만
  화면 로드마다 불필요한 `getDoc` 이 붙는다.

**10-16 공지 관리 / 10-19 정책 설정** — 미착수.

### 그룹 ⑤ 10-20~10-24 경기·채팅·배너

**10-20 예정 경기** (`adminGamesService.js:181-212`)

- **[중대] 제휴구장으로 확정된 경기가 목록에서 통째로 빠진다** — 쿼리가
  `where("status","==","accepted")` 하나다. 구장 승인·결제를 거쳐 `confirmed` 가 된 경기,
  승인 대기 중인 `awaiting_venue_approval` 경기가 "예정 경기"에 안 나온다.
- **[중대] 목업과 실제 쿼리가 다르다** — 같은 함수의 목업 분기(`:189`)는 4개 상태를 포함한다.
  **리뷰 화면에서는 정상으로 보이고 운영에서만 비어 보인다.** 리뷰로 잡히지 않는 종류의 결함이다.
- **[중대] `orderBy` 없는 `limit(200)`** — 정렬 기준 없이 200건을 자른 뒤 클라에서 시간순 정렬한다.
  경기가 200건을 넘으면 **오늘 경기가 빠질 수 있다**. 지난 경기(`fetchAdminPastGames`)도 동일.

**10-22 채팅 목록** (`adminChatService.js:42-111`)

- **[중대] 채팅방 전수 + 참여자마다 순차 왕복** — 커뮤니티와 같은 패턴. `limit` 없음,
  `for (const uid of uniqUids) await getUserPublicMeta(uid)`.

**10-24 배너 관리** (`bannersService.js`)

- **[중대] 노출수·클릭수가 영원히 0 이다** — `incrementBannerImpression/Click`(`:141-161`)은 사용자
  화면에서 호출되는데(`HomeHeroBanner.jsx:245,254`, `MatchSearchingPage.jsx:204,216`)
  규칙은 `banners` 쓰기를 `isAdmin()` 으로 막는다(`firestore.rules:206`). 요청은 매번 거부되고
  `catch` 가 조용히 삼킨다(`:148`, `:159`). 관리자 화면의 "노출/클릭" 열은 항상 0 이다.
  **광고를 팔 때 근거로 쓰는 숫자라 파급이 크다.** 서버 집계(CF)로 옮겨야 한다.

**10-21 지난 경기 / 10-23 채팅방 상세** — 서비스 계층만 확인.

### 그룹 ⑥ 10-25~10-30 구장·정산·환불·문의·팝업

**10-25 구장 관리(승인)** — ★치명 3 참고. 승인 자체(`setVenueStatus`)는 정상이다:
`approved` 일 때만 `active:true` 로 노출시키고, 구장주에게 승인·반려 알림을 보낸다.

**10-26 정산 관리** (`settlementService.js`) — 설계는 이 도메인에서 가장 견고하다.
`payments.netVenueAmount`(환불 차감 후 구장 몫)를 단일 기준으로 삼아 구장주 화면과 금액이 일치하고,
정산 시점 재공제를 `PLATFORM_FEE_RATE = 0` 으로 명시해 이중 공제를 막았다. 배치도 450개씩 분할한다.

- **[중대] `payments` 전수 조회** — `:68-79`. `limit` 도 기간 서버필터도 없이 전 결제를 받아 클라에서
  기간을 자른다. 결제가 쌓이면 정산 화면이 가장 먼저 무너진다.

**10-27 환불 관리** — ★치명 2 참고. 추가로 `venueReservations` 전수 조회가 탭마다 한 번씩(`:69`, `:84`).

**10-28 문의 관리** (`adminInquiryService.js`)

- **[중대] `limitCount` 가 방어가 아니다** — `:37-42` 는 `inquiries` **전체를 읽은 뒤** `slice` 한다.
  읽기 비용은 그대로다.
- 답변 저장·사용자 알림 생성 경로는 정상.

**10-30 예약 현황** (`adminReservationsService.js`) — 매칭 예약을 "A vs B" 로 보여주는 등 모델링은 정상.

- **[중대] `venueReservations` 전수 조회** — `:75-92`. 주석에 "컬렉션 전체를 읽고 클라에서 필터한다"고
  의도가 적혀 있으나, 예약은 이 서비스에서 가장 빨리 늘어나는 컬렉션이라 상한이 필요하다.

**10-29 이벤트 팝업** — 미착수.

---

### 이번 라운드 미착수 (다음 회차)

10-08 팀 순위 · 10-09 팀 신고 · 10-16 공지 관리 · 10-19 정책 설정 · 10-29 이벤트 팝업,
그리고 10-13~15·10-21·10-23 의 **화면 레이어**(서비스 계층은 확인함).

### 반복되는 뿌리 하나

중대 항목 대부분이 같은 모양이다 — **컬렉션을 통째로 읽고 클라이언트에서 자른다.**
회원·팀은 200건에서 조용히 잘리고, 신고·문의·예약·결제·게시글·채팅은 상한이 아예 없다.
데이터가 적은 지금은 증상이 없지만, 늘어나는 순서대로 화면이 하나씩 안 뜨게 된다.
화면별로 고치기보다 "서버 필터 + 커서 페이징 + 잘림 표시" 를 한 번에 정하는 편이 낫다.
