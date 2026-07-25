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

<!-- 그룹 ②~⑥ 이어서 추가 -->
