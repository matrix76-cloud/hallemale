// 구장앱(구장주) 도메인 감사 결과를 리뷰 허브 기록 스레드에 올린다.
// 지시서 #8 — 9-01~9-15 화면 15개 점검·기록. (기록 전용 · 코드 수정 없음)
//
// reviewThreads 는 현재 전면 공개(firestore.rules:125, AI 에이전트 기록용) — 인증 불필요.
// ⚠️ 규칙 주석대로 리뷰 작업이 끝나면 signedIn() 으로 되돌려야 한다. 그때 이 스크립트를
//    다시 쓰려면 리뷰 데모 계정(src/dev/reviewDemo.js) 로그인을 추가하면 된다.
//
// 사용: node scripts/post-owner-review.mjs          → 올릴 내용만 출력 (dry-run)
//       node scripts/post-owner-review.mjs --apply  → 실제 기록

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const APPLY = process.argv.includes("--apply");
const BY = "카스";
const COL = "reviewThreads";

const kstNow = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

// screenId 는 src/dev/reviewData.js 의 OWNER 도메인과 일치해야 한다.
const ENTRIES = [
  {
    screenId: "owner-login",
    text: `9-01 구장주 로그인 — 화면 자체 결함 없음.

· ownerAuth(사용자앱과 분리된 세션) 이메일/비밀번호 로그인 + 비밀번호 재설정. mode 2모드(login|reset) 단일 폼. safe-area 상/하 정상(:153, :187).
· 진입: RequireOwnerAuth 미로그인 리다이렉트(AppRoutes.jsx:222) · OwnerAgreementGate 로그아웃(:56) · OwnerLegalPage 뒤로 폴백(:112).

★96be206 카카오 제거 검증 — 실행코드 잔재 0건.
· 소셜 버튼 0개. KAKAO_CUSTOM_TOKEN_URL · WEB_KAKAO_REST_KEY · LS_OWNER_KAKAO_FLOW · completeOwnerWebKakaoLogin 전부 소멸 확인. KakaoCallbackPage.jsx 에 ownerAuthService import 없음.
· 남은 것: OwnerLoginPage.jsx:4-5 주석, ownerAuthService.js:223-226 kakao_not_supported 가드 — 후자는 ownerSignInWithSocial 호출부가 전 소스 0건이라 죽은 코드.
· owner/components/addressSearch.js · VenueMapPicker.jsx 의 window.kakao.maps 는 지도용으로 살아있음(인증과 무관, 정상).

[경미] ownerAuthService.js:14 signInWithRedirect · :17 signInWithCustomToken · :28-31 isMobileBrowser() — 외부 참조 0건. 카카오/redirect 경로 삭제 후 미회수 잔여물.`,
  },
  {
    screenId: "owner-signup",
    text: `9-02 구장주 가입 — ★중대 2건.

· 이메일/비번 + 담당자(이름·휴대폰 SMS 인증) → /owner/onboarding.
· 지목된 "인증 후 번호 수정" 버그는 없음 — 인증 성공 시 input disabled(:190) + changePhone(:31-36) 리셋. 정상 구현.

★[중대·보안] SMS 인증이 클라이언트 신뢰 — 우회 가능
OwnerSignupPage.jsx:101 → ownerAuthService.js:113-115. phoneVerified 는 React state 의 순수 boolean. 서버(functions/otp/phoneOtp.js:208)는 verified:true 를 Firestore 에 쓰지만 verifyPhoneOtp 가 토큰/서명을 반환하지 않고(phoneOtpService.js:51-67), 가입 시 서버 상태를 재조회하지 않는다. 커밋 메시지의 "서비스단에서도 거부"는 같은 번들 안 JS 함수일 뿐.
재현: 콘솔에서 ownerSignUpEmail({email,password:"abcd1234",managerName:"홍",managerPhone:"01000000000",phoneVerified:true}) → SMS 0통으로 구장주 계정 생성 + users/{uid}.phoneVerified=true 기록(:123-129). firestore.rules:21 이 /users/{id} 를 allow write: if signedIn() 로 열어둬 사후 위조도 가능.

★[중대·법적] 가입 화면에 약관·개인정보 동의 절차 없음
OwnerSignupPage.jsx:132-233. 담당자 이름·휴대폰번호(개인정보)를 수집해 saveOwnerManagerInfo(userService.js:206-219)로 기록하는데, 화면에 개인정보 수집·이용 동의도 /owner/privacy 링크도 없다. 동의는 로그인 이후 OwnerLayout.jsx:181 게이트에서 받음 → 수집이 동의에 선행(개인정보보호법 제15조 소지). 96be206 이 담당자 필드를 추가하며 만든 회귀.

[보통] 가입 부분 실패 시 계정 잔존 — ownerAuthService.js:117-135 + OwnerSignupPage.jsx:80-85,104-106. createUser 성공 후 ensureUserDoc/saveOwnerManagerInfo 가 던지면 success:false 를 반환하지만 Auth 계정·세션은 이미 생성됨 → "실패" 알럿과 동시에 /owner/onboarding 진입. 재시도 시 email-already-in-use, ownerManagerName/Phone 은 영구 미기록(재수집 경로 없음).

[경미] :213 OTP 확인 버튼이 otpCode.length<4 에서 활성 — 실제 코드는 6자리(maxLength=6). 4-5자리로 확인 시 서버 왕복 + OTP_MAX_ATTEMPTS 차감(phoneOtp.js:190-192).
[경미] 전화번호 정규식 이중화 — ownerAuthService.js:66 ^01[0-9]{8,9}$ vs phoneOtpService.js:9 ^01[016789]\\d{7,8}$. 최종 방어선이 더 느슨(012~015 통과).
[경미] 필수 표시 부재 — 전 필드가 placeholder 뿐, * / 라벨 없음. (반대 방향 불일치는 없음)
[경미] :125 🏟️ 이모지 vs OwnerLoginPage:93 images.logo — 연속 화면 브랜딩 불일치.`,
  },
  {
    screenId: "owner-terms",
    text: `9-03 구장주 약관 — OwnerLegalPage.jsx (type="owner_terms").

· 콘텐츠 소스: Firestore legal_documents/owner_terms 우선(legalService.js:29) → 내용 공백/문서 없음/throw 전부 LEGAL_DEFAULTS 폴백(:91,100,102). 로드 실패 처리 정상.
· 제목 "구장 관리자 이용약관"(legalDefaults.js:739). AppRoutes.jsx:607 — 인증 밖 공개 라우트.
· UI: violet600 헤더(뒤로 ‹ + 제목) + Body(updatedAt Meta + white-space:pre-wrap). safe-area 상/하 정상(:20,:55).

[보통] 약관 '보기' 이동 시 동의 체크박스 전체 초기화 — OwnerAgreementGate.jsx:87,95. /owner/terms 가 OwnerLayout 밖 라우트(AppRoutes.jsx:607-608)라 게이트가 언마운트되고 상태는 로컬 useState(:19-22). 3개 체크 → 약관 보기 → 뒤로 → 4개 전부 해제. 개인정보까지 보려면 2회 반복.

[경미] :110-113 뒤로가기 폴백이 /owner/login — history.length<=1(딥링크·새 탭)일 때. 이미 로그인된 구장주는 로그인 화면 → useEffect(OwnerLoginPage:30) → /owner 로 2단 튕김.
[경미] :15 background: C.white 하드코딩 + C.slate800 텍스트 — 로그인·가입은 theme.colors.bg 사용. 다크모드에서 약관 진입 시 흰 화면 전환.

※ 본문 정합성(사업자정보·통신판매업번호·연락처)은 약관·정책 담당(지시서 #7) 영역.`,
  },
  {
    screenId: "owner-privacy",
    text: `9-04 구장주 개인정보 — OwnerLegalPage.jsx (type="privacy").

· /owner/privacy → type="privacy" → 제목 "개인정보처리방침"(legalDefaults.js:30). 사용자앱과 동일 문서 공유 — 구장주 전용 개인정보 방침 없음.
· 9-03 과 동일 컴포넌트의 prop 분기이므로 결함 공유: 동의 체크박스 초기화 / 뒤로가기 2단 튕김 / 다크모드 미대응.

[중대·법적 — 9-02 와 짝] 방침 본문에는 SMS 인증 정보가 명시돼 있으나(제2조 ①-2 휴대폰 본인확인: 전화번호·인증번호·요청완료일시·시도횟수), 정작 구장주 가입 화면에 동의 절차와 이 페이지로의 링크가 없다. 문서는 갖췄는데 수집 시점 고지가 빠진 구조.

[검토 필요] 구장주는 담당자 이름·휴대폰 + 사업자정보(사업자등록번호·통신판매업·정산계좌, OwnerMyPage BusinessSection)를 추가로 수집하는데 공유 중인 사용자앱 방침에 이 항목들이 반영돼 있는지 — 약관·정책 담당(#7)과 교차확인 요청.`,
  },
  {
    screenId: "owner-entry",
    text: `9-05 구장주 진입 — OwnerEntry.jsx:8-10.

· 분기 없음. 무조건 <Navigate to="/owner/home" replace/>. 로그인·구장·status 어느 것도 보지 않는다.
· 실질 분기는 두 곳으로 이동: OwnerGate(OwnerLayout.jsx:139-147, 구장 없으면 /owner/onboarding) + OwnerHomePage:227(status 별 안내 카드).
· 미처리 분기·백지화면 없음.

[보통] /owner/pending(9-08)로 보내는 분기가 사라져 해당 화면이 고아가 됨 — 상세는 9-08 기록 참조.`,
  },
  {
    screenId: "owner-onboarding",
    text: `9-06 구장 온보딩 — OwnerOnboardingPage.jsx.

· 10단계 위저드 STEPS=[intro,name,location,photos,facilities,courts,notice,keywords,contact,review](:37). 단계 진행 조건 :150-157, 최종 검증 :173-177.
· 제출 → registerVenue 또는 updateMyVenue+resubmitVenue → /owner/home. ?new=1 로 다구장 추가(OwnerVenueSwitcher.jsx:33) — 정상 동작.
· courts 갱신 시 ...c 스프레드로 기존 필드 보존(:91-92) — 9-07 과 대조되는 올바른 구현.
· safe-area 정상(Footer :524).

[보통] 진행 상태 미저장 — 10단계 입력이 전부 useState. 새로고침·헤더 뒤로가기·앱 백그라운드 종료 시 전부 소실, 업로드한 사진은 Storage 고아로 잔존(removePhoto :124 도 Storage 삭제 안 함). 최소 sessionStorage 스냅샷 필요.

[보통] 구장 없는 오너의 온보딩 트랩 — OwnerGate(OwnerLayout:145)가 venue 없으면 여기로 replace 리다이렉트하는데, 온보딩은 TAB_PATHS(:109)에 없어 하단탭이 없고 intro 단계엔 뒤로 버튼도 없다(:219-222). 결과: 가입 직후 오너는 내정보·로그아웃·문의로 갈 UI 경로가 전무. 헤더 ‹ 는 navigate(-1)(:171)로 오너 앱 밖(로그인/가입)으로 튕김. OwnerLayout:136 주석은 이 경로들을 "열어뒀다"고 하나 링크가 없어 URL 직접 입력만 가능.

[보통] :151-157,:162 좌표 없는 구장 등록 허용 — location 단계 통과 조건이 form.address 문자열뿐인데 안내는 "지도에서 핀을 맞춰주세요". 주소 수기 입력 시 lat/lng 가 빈 값 → registerVenue 가 toNum("")→null 저장 → 사용자앱 지도/거리순 정렬에서 누락.

[보통] 2번째 구장 추가 시 영업 중인 구장이 사라져 보임 — :190-196 이 새 pending 구장을 active 로 지정 → /owner/home 이 status!=="approved" 게이트(:227)로 심사중 카드 표시. 성공 직후 예약 데스크가 사라짐. 스위처로 복구 가능하나 회귀로 읽힘.

[경미] 중복 등록 무제한 — registerVenue 에 소유자당 구장 수·동일 주소 중복 검사 없음. ?new=1 반복으로 pending 구장 무한 생성 → 어드민 심사 큐 오염 가능.`,
  },
  {
    screenId: "owner-register",
    text: `9-07 구장 등록 — ★중대 3건. 다구장 전환에서 미이관된 구버전 화면. 삭제 검토 권고.

· 스크롤 단일 폼(사진/기본정보/편의시설/코트/안내/사업자). 필수는 구장명·주소·코트명뿐(:242-245).
· 어떤 UI 에서도 링크되지 않음 — 유일한 진입은 OwnerStatusPage:110 의 재신청 CTA. AppRoutes.jsx:618 에 라우트는 살아있음.

★[중대] 저장 시 코트 id 소실 → 기존 예약 고아화 — :186-194
프리필이 {name,type,pricePerHour,slotMinutes,hours} 만 복사하고 id 를 빼먹는다. 저장하면 updateMyVenue→normalizeCourt(ownerVenueService.js:135)가 id: safeStr(o.id)||makeCourtId() 로 새 id 를 발급.
재현: 승인된 구장 오너가 /owner/register 에서 아무것도 안 고치고 저장 → 기존 venueReservations.courtId 가 어느 코트와도 매칭되지 않아 예약이 시간표에서 소멸(OwnerHomePage:137 필터), 사용자앱 예약 링크도 단절. 동시에 surface·priceBands·priceOverrides·notices·cautions 전부 삭제. (온보딩 :91-92 는 ...c 로 보존 — 같은 버그를 이미 한 번 고친 흔적)

★[중대] 승인된 구장이 오프라인으로 강등 — :141 + :257-262
editingId = venue ? venue.id : null 이라 제목이 "구장 등록"인 화면이 실은 활성 구장 편집기. 제출 시 resubmitVenue → status:"pending", active:false. 반려 재신청이 아닌 오너가 저장하는 순간 영업 중인 구장이 사용자앱에서 사라진다. 복구엔 어드민 재승인 필요. 되돌림 경고·확인 모달 없음.

★[중대] 다구장 미대응 — :140-141 이 ?new=1 을 읽지 않는다. 기존 구장 보유 오너가 여기 오면 2번째 구장 생성이 아니라 활성 구장 편집 모드로 조용히 진입 → 위 두 결함이 그대로 발동.

[경미] 검증 비대칭 — 여기는 사진 0장·사업자번호 오타를 그대로 통과(:242-245), 온보딩은 사진 1장 필수 + isValidBizNo 체크섬(:153,155). 같은 심사 대상이 어느 화면을 쓰느냐로 품질이 갈림.`,
  },
  {
    screenId: "owner-pending",
    text: `9-08 승인 대기 — OwnerStatusPage.jsx. ★승인 게이팅 판정: 뚫림.

· 구장명/주소/코트수/상태 배지, 반려 시 사유 박스 + 재신청 CTA, 새로고침. !venue→/owner/register(:61), approved→/owner/home(:62).
· 어떤 화면에서도 링크되지 않음 — URL 직접 입력으로만 도달(진입점은 reviewData.js:128 뿐). 같은 역할을 VenueGateNotice(pending 카드, :121-140)가 홈에서 수행 중.

■ 상태 머신
venues/{id}.status = pending|approved|rejected (ownerVenueService.js:183-185). 구장 단위이지 오너 단위가 아님. 필드 없으면 approved 로 폴백(:183) — 레거시 문서는 자동 승인 취급. registerVenue→pending+active:false(:308-353), resubmitVenue→pending(:450-459), approve/reject/setVenueStatus(:610,:621,:646). OwnerContext.status(:140)는 어디서도 소비되지 않고 모든 화면이 venue.status 를 직접 본다.

■ 승인 전 접근 판정
라우트 가드 없음 — AppRoutes.jsx:609-628 오너 트리엔 RequireOwnerAuth(로그인만, :218-224) 하나뿐이고 :620 에 "// 소프트 게이트: 막지 않고 입장" 명시. OwnerGate(OwnerLayout:139-147)도 !venue 만 검사.
· /owner/home 예약관리 — 차단됨 (OwnerHomePage.jsx:227 렌더 게이트)
· /owner/sales 매출 — 차단됨 (OwnerSalesPage.jsx:133-134)
· /owner/venue 구장정보 — ★뚫림. OwnerVenuePage.jsx:129 가 !venue 만 보고 status 검사 없음 → pending 오너가 구장 전체 편집 가능. 게이팅 비일관.
· 로딩 윈도우 폴스루는 없음(OwnerGate 스피너 :144, 각 페이지 ownerLoading 조기 리턴) — 이 부분은 정상.
· 다만 게이트가 "차단"이 아니라 "가리기": OwnerHomePage:141 useEffect 가 조기 리턴(:227)보다 위에 선언돼 status 무관하게 listReservations 를 호출하고, OwnerLayout:166-174 도 예약 전건을 조회해 배지를 만든다.

★[중대] 진짜 구멍은 서버 — firestore.rules:56 (firestore.rules.prod:33 동일)
match /venues/{id} { allow read: if true; allow write: if signedIn(); } — 소유권 검사 없음.
재현: pending 오너가 콘솔에서 updateDoc(doc(db,"venues",myVenueId),{status:"approved",active:true}) → 성공 → refresh() 후 /owner/home·/owner/sales 정식 개방 + active:true 라 사용자앱 구장 목록 노출 → 실제 예약 수신 시작. 어드민 심사가 무의미해진다. 동일 규칙으로 타인 소유 구장의 status·가격·주소 변경 및 삭제, ownerUid 재지정까지 가능.
대조: venueReservations 는 :62-85 에서 isVenueOwner/예약자 uid 로 제대로 좁혀져 있고, 6줄 위 :50-53 에 isVenueOwner(venueId) 헬퍼가 이미 존재 — venues 만 방치됨.
※ firestore.rules 는 #8 작업 파일 밖(구장예약·관리자 담당 교차) — 기록만 남기고 수정은 지휘 취합 요청.

[보통] 다구장에서 심사중 구장 조회 불가 — :61-62 가 활성 구장만 보고 approved 면 /owner/home 으로 리다이렉트. A(승인)+B(심사중) 보유 시 B 의 심사 상태·반려 사유를 영영 볼 수 없다.
[보통] 반려 CTA 가 위험 화면으로 — :110 "정보 수정하고 다시 신청"이 정상 경로(/owner/onboarding, VenueGateNotice:155 가 쓰는 것)가 아니라 중대 결함 2건을 가진 /owner/register 로 보낸다.`,
  },
  {
    screenId: "owner-home",
    text: `9-09 구장주 홈(예약관리) — ★중대 1건.

· 주간 캘린더 + 코트 칩 Row + 슬롯 그리드 + 4종 통계 + 코트 교차 승인대기 큐. 승인/거절/완료/노쇼/취소, 수동 예약(정기대관 반복), 시간막기.
· 승인대기 큐는 구장 전체 예약을 조회(:132)해 다른 코트·날짜를 놓치지 않고, 그리드만 선택 코트로 좁힘 — 올바른 설계.
· safe-area 정상(OwnerLayout:86-90, Sheet :77).

★[중대] 시간막기가 화면에 안 뜨고 해제도 불가 — :131-139
const [rsAll,bs] = await Promise.all([listReservations, listBlocks]) 인데 bs 를 버린다 — setBlocks(bs) 가 아예 없다. blocks 는 :111,:139 에서 [] 로만 설정되므로 dayBlocks(:148)가 영구히 비고 slotKind() 는 "blocked" 를 반환할 수 없다.
재현: 19:00-20:00 막기 → addBlock 이 문서 기록 → load() → 슬롯이 초록 "예약가능 · 40,000원" 으로 렌더. 차단은 사용자 쪽엔 실제로 걸려 있어(CourtBookingPage:114, VenueBookingPage:182, VenueListPage:201 모두 listBlocks 조회) 조용한 사장 재고가 된다. 해제 경로(:170)는 info.k==="blocked" 를 요구해 도달 불가이고 :272 캡션 "막은 슬롯을 다시 누르면 해제"는 사실이 아니다. 다시 누르면 액션시트가 뜨고 addBlock 은 중복 가드가 없어(ownerVenueService.js:1612-1629 는 예약 충돌만 검사) 중복 문서가 쌓인다.
→ 수정은 setBlocks(bs) 한 줄. 기능 전체가 복구되는 최고 효율 지점.

[보통] 다구장 배지가 활성 구장만 카운트 — OwnerLayout.jsx:166-174. 비활성 구장의 신규 예약 요청은 탭 배지를 만들지 않는다. 오너가 이미 의심하고 수동 전환해야 알 수 있어 배지의 목적이 무너짐.
[경미] 구장 전환 직후 이전 구장 데이터 잔상 — :141 setLoading(true) 가 슬롯 그리드만 가려서, Summary 행과 승인대기 큐는 async 완료 전까지 이전 구장 값을 계속 렌더.`,
  },
  {
    screenId: "owner-sales",
    text: `9-10 매출(예약통계) — ★중대 1건.

· 현장 정산 전환에 맞춰 "매출"에서 예약 건수 중심으로 재배치됨 — 금액은 "예상 이용료(참고)" 라벨. 월 이동, 가동률 vs 운영분, 취소·노쇼, 요일 분포, 내역 + 상세 시트.
· 구장 전환 시 refetch 는 정상 동작(:87 이 venue?.id 키).

★[중대] 구장 전환 후 영구 0건 + 복구 불가 — :66,:90,:140
courtId state 가 구장 변경 시 리셋되지 않는다.
재현: 구장 A(코트 2개+)에서 코트 칩 a2 선택 → courtId="a2". 구장 B 로 전환 → rows 는 B 로 정상 refetch 되지만 filtered = rows.filter(r=>r.courtId==="a2") → 빈 배열. 전 패널이 0 을 읽는다(0건, 가동률 0% via :110, 요일별·내역 공백).
결정적으로 구장 B 의 코트가 1개면 ChipRow 가 courts.length>1 조건(:140)이라 렌더되지 않아 "전체"로 되돌릴 UI 자체가 없다 → 페이지 새로고침 없이는 복구 불가.
→ venue.id 변경 시 courtId 리셋. 9-11 의 sel 과 동일 원인(다구장 전환의 실제 비용).

[경미] "이 구장 기준" 표기 없음 — :81-87. 스위처 바가 헤더 위에 있고 숫자 옆엔 아무 표시가 없어 다구장 오너는 계정 전체 집계로 읽는다.
[경미] OwnerSettlementPage.jsx 완전 고아 — 라우트·import 전 소스 0건. PG 2.9% + 플랫폼 3% 수수료 분개를 계산해 현재 현장 정산 모델과 모순되고, 그라데이션 HeroCard 는 프로젝트 UI 원칙(다색/그라데이션 카드 지양)과도 충돌. 삭제 권고.`,
  },
  {
    screenId: "owner-venue",
    text: `9-11 구장 정보 — ★중대 2건. 오너 도메인 최대 화면.

· 사진, 지도 피커, 소개/오시는길/전화, 코트별 기본정보·운영시간·3단 가격·안내·주의, 키워드, 편의시설, 규정, 환불정책, 예약확정 안내문, 노출 모드, 미리보기 시트.

★[중대] 승인 게이트 누락 + 승인 후 무심사 변경 — :129
(a) if (!venue) return <VenueGateNotice venue={null}/> — status 검사가 없다. pending 오너가 구장 전체를 편집 가능(홈·매출은 막혀 있어 비일관).
(b) 더 큰 문제는 approved 구장: save()(:170-187)가 name·address·lat/lng·photos·가격을 바꾸면서 status 를 건드리지 않는다 → 심사 통과한 구장이 재심사 없이 다른 주소·다른 업소로 교체 가능. 핵심 필드(상호·주소·좌표·사업자번호) 변경 시 resubmitVenue 또는 어드민 알림 필요.

★[중대] 구장 전환 후 코트 편집기 무음 동결 — :73,:131-132
sel(코트 인덱스)이 구장 변경 시 리셋되지 않는다.
재현: 구장 A(코트 3개)에서 3번째 선택 → sel=2. 구장 B(코트 1개)로 전환 → 렌더는 courts[2]||courts[0] 로 안전 폴백해 폼이 정상으로 보이고 값도 채워진다. 그러나 setCourt 가 cs.map((c,i)=>i===sel?{...c,...patch}:c) 라 1개짜리 배열에서 인덱스 2 는 영원히 매칭되지 않는다 → 코트명·가격·운영시간을 타이핑해도 필드가 바뀌지 않는다. 에러도 피드백도 없음.

[보통] 저장 실패 완전 무음 — :184-186 catch (e) { /* 토스트 대신 조용히 */ }. 성공 토스트도 없다. 오프라인·규칙 거부 시 updateMyVenue 가 던져도 버튼이 성공과 똑같이 "구장정보 저장"으로 복귀 → 오너는 운영시간·가격이 저장된 줄 알고 이탈. 사용자 과금 기준을 다루는 화면에서의 무음 데이터 유실.
[보통] 코트 삭제 시 예약 고아화 — :134 removeCourt 가 기존 예약 확인 없이 배열에서 제거. 해당 venueReservations 는 매칭 코트가 없어 홈 슬롯 그리드에서 사라지지만 문서는 남아 탈퇴 차단 카운트에는 계속 잡힌다. addBlock 은 예약 충돌을 가드하는데 여기만 없어 일관성이 깨짐.
[보통] 편집 중 구장 전환 시 미저장 내용 무음 소실 — :101-126 의 venue?.id 키 effect 가 dirty 체크·경고 없이 폼 상태를 덮어씀.
[경미] 죽은 코드 — :69 navigate, :70 signOut, :48 LogoutRow, :8 LuLogOut import 전부 미사용. 로그아웃 행이 내정보로 이관되며 미회수.`,
  },
  {
    screenId: "owner-my",
    text: `9-12 구장주 내정보 — 화면 결함 없음.

· 프로필, 내 구장 요약 카드, BusinessSection(사업자·통신판매업·정산계좌), 고객지원, 약관, 로그아웃, 탈퇴. 구장 없을 때 빈 상태 정상.
· safe-area 정상(OwnerLayout:86-90).

[경미] 활성 구장만 표시 — :141-152. 다구장 오너에게 "이 구장 기준"이라는 표기가 없어 계정 전체로 오독될 수 있다.

[교차확인 요청 — #7 약관·정책] BusinessSection 이 사업자등록번호·통신판매업 신고번호·정산계좌를 수집·표시하는데, 구장주가 동의하는 문서는 사용자앱과 공유하는 privacy 방침이다(9-04 참조). 해당 방침에 이 항목들의 수집·이용 근거가 반영돼 있는지 확인 필요.`,
  },
  {
    screenId: "owner-notifications",
    text: `9-13 구장주 알림 — 결함 없음. audience 분리 정상 작동 확인.

· audience 필터링 목록, 진입 시 자동 읽음 처리, 빈 상태 정상.
· 특히 좋은 구현: openItem()(:58-64)이 이동 전에 알림의 meta.venueId 로 활성 구장을 전환한다 — 다구장 막다른 길을 예방.

■ audience 교차점검(커뮤니티 담당과 교차) — 양방향 누출 없음
· 모델: NOTI_AUDIENCE={USER,OWNER} (notificationDefinitions.js:17). resolveNotiAudience()(:30-40)가 명시 audience → prefsCategory==="owner" → deepLink.startsWith("/owner") → 기본 USER 순으로 해석.
· 읽기: notificationService.js:153 이 .filter(n=>resolveNotiAudience(n)===audience) 적용. OwnerNotificationsPage:43 · OwnerNotifBell:19 모두 NOTI_AUDIENCE.OWNER 전달. 사용자앱 알림이 섞이지 않음.
· 쓰기: 오너향 생성 5건 중 4건이 audience:"owner" 명시(ownerVenueService.js:597,686,1109,1513), 사용자향은 "user" 명시(:829,:931). Cloud Functions 측 문제 없음.

[경미] bookVenue 오너 알림만 audience 누락 — ownerVenueService.js:1356-1372. deepLink:"/owner/home" 폴백(notificationDefinitions.js:36-37)으로 현재는 정확히 해석돼 누출은 없다. 다만 오너 알림 중 최대 물량(신규 예약 요청)이 SSOT 필드가 아닌 추론에 의존하는 상태 — deepLink 가 바뀌면 사용자 수신함으로 넘어간다. 명시 권고.`,
  },
  {
    screenId: "owner-inquiry",
    text: `9-14 구장주 문의 — 결함 없음.

· 카테고리 선택, 제목/내용, 공용 inquiries 컬렉션으로 제출, 고객센터 연락처 블록, 내 문의 내역 + 답변 + 빈 상태.
· safe-area 정상(OwnerLayout:86-90, 탭 없는 화면이라 env(safe-area-inset-bottom) 경로).

[경미] :121 문의에 활성 구장명만 스탬프 — 다구장 오너가 비활성 구장 건으로 문의하면 엉뚱한 구장명이 붙는다. 구장 선택 필드 또는 "이 구장 기준" 표기 권고.`,
  },
  {
    screenId: "owner-withdraw",
    text: `9-15 구장주 탈퇴 — 서비스 로직은 견고. 고지 문구만 문제.

■ 실제 삭제 범위(ownerWithdrawService.js) — 익명화가 아닌 하드 삭제
ownerUid==uid 인 venues 전체(:125) → 해당 venueReservations + venueBlocks(:137-140) → ownerUid 기준 고아 예약(:142) → Storage 구장 사진(:150) → 서버 Admin SDK 로 Auth 계정 + users 문서, 실패 시 클라 deleteUser 폴백(:154-174). 고아 데이터 없음 — venue 문서 삭제로 사용자 쪽 목록에서 즉시 사라진다.

■ 가드 — 실재하고 이중이다
countActiveReservations() 가 requested|pending|confirmed 이면서 오늘 이후인 예약을 차단. 페이지 진입 시(OwnerWithdrawPage.jsx:86-100)와 withdrawOwnerAccount() 내부(:188-195) 양쪽에서 재확인해 레이스를 닫는다. 확인 절차 3중: 체크박스 + "탈퇴합니다" 타이핑 + 네이티브 confirm.

[보통] 한 구장만 고지하고 전 구장을 삭제 — OwnerWithdrawPage.jsx:136
"등록한 구장 정보 (venue.name)·코트" 로 활성 구장만 표시하는데, purgeOwnerData(:125-147)는 ownerUid 가 일치하는 모든 구장을 삭제한다. 구장 3개 보유 오너는 1개가 위험하다고 안내받고 3개를 잃는다. 되돌릴 수 없는 법적 동의 화면이므로 venues 전체를 열거해야 한다.`,
  },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log(`\n[구장앱 감사 기록] ${ENTRIES.length}건 · by="${BY}" · ${kstNow()}`);
  console.log(APPLY ? "모드: --apply (실제 기록)\n" : "모드: dry-run (출력만)\n");

  // 재실행 시 중복 방지 — 같은 screenId 에 이미 카스 기록이 있으면 경고
  const existing = await getDocs(
    query(collection(db, COL), where("by", "==", BY))
  );
  const already = new Set(
    existing.docs
      .map((d) => d.data().screenId)
      .filter((s) => ENTRIES.some((e) => e.screenId === s))
  );

  for (const e of ENTRIES) {
    const dup = already.has(e.screenId) ? "  ⚠ 기존 카스 기록 있음" : "";
    console.log(`── ${e.screenId} (${e.text.split("\n")[0]})${dup}`);
    console.log(`   ${e.text.length}자`);
  }

  if (already.size) {
    console.log(
      `\n⚠ ${already.size}개 화면에 이미 카스 기록이 있습니다. --apply 하면 중복 기록됩니다.`
    );
  }

  if (!APPLY) {
    console.log("\n실제 기록하려면 --apply 를 붙이세요.\n");
    process.exit(0);
  }

  for (const e of ENTRIES) {
    await addDoc(collection(db, COL), {
      screenId: e.screenId,
      by: BY,
      text: e.text,
      at: kstNow(),
      ts: serverTimestamp(),
    });
    console.log(`✓ ${e.screenId}`);
  }

  console.log(`\n완료 — ${ENTRIES.length}건 기록.\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error("실패:", e?.message || e);
  process.exit(1);
});
