// 매칭 도메인 감사 결과를 리뷰 허브 기록 스레드에 올린다.
// 매칭 지시서 — 3-01~3-10 화면 10개 점검·기록. (기록 전용 · 코드 수정 없음)
//
// reviewThreads 는 현재 전면 공개(firestore.rules, AI 에이전트 기록용) — 인증 불필요.
// ⚠️ 리뷰 작업이 끝나면 signedIn() 으로 되돌려야 한다.
//
// 사용: node scripts/post-matching-review.mjs          → 올릴 내용만 출력 (dry-run)
//       node scripts/post-matching-review.mjs --apply  → 실제 기록

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

// screenId 는 src/dev/reviewData.js 의 MATCHING 도메인과 일치해야 한다.
const ENTRIES = [
  {
    screenId: "matching",
    text: `3-01 매칭 시작 — 진입·게이트·빈 상태 방어는 촘촘. 죽은 필터 로직만.

· 팀 유무 분기(effMyTeam/browseTeams), 로드실패 재시도, 8초 무한스피너 타임아웃, safe-area 하단 패딩(Wrap:54) 방어가 촘촘. QuickMatchHero onStart 이 팀 미소속·3명 미만을 토스트로 막고서야 /matching/region 진입(:297-309). showBack=true 라 하단탭 겹침 없음.

[경미] position·skill 필터가 UI에서 설정 불가한 죽은 로직 — MatchingPage.jsx:24-33,208-248. countAppliedFilters·filteredOpponentTeams 는 position/skill 분기를 갖지만 실제 필터 시트(TeamOpponentListSection.jsx:353-360)는 winRate·regionSido·regionGu 만 세팅 → position/skill 은 항상 "" 라 분기 미실행.
[경미] ClubOpponentCard.jsx 빈 파일(죽은 파일, import 0건) · TeamOpponentListSection.jsx:9 FilterBottomSheet 미사용 import.`,
  },
  {
    screenId: "match-region",
    text: `3-02 지역 선택 — 결함 없음(경미만).

· GPS→카카오 역지오코딩→KR_AREAS 정규화(합쳐진 "성남시 분당구" 폴백까지), 권한거부 시 설정유도, 미지원지역 직접선택 안내 등 실패경로가 전부 대체동작을 가짐. Footer 고정 CTA safe-area(:168), Body pb 120px 로 겹침 방지. region 없으면 CTA disabled.

[경미] 이 화면은 팀 소속/인원을 자체 검증 안 하고 searching 으로 넘김(:341-346). 실제 게이트는 홈(3-01)·상대공개(3-04)·서버에서 걸려 데드엔드는 아니나, 직접 URL 진입 시 3초 광고 후 3-04 에러화면으로 가는 낭비만 있음.`,
  },
  {
    screenId: "match-searching",
    text: `3-03 상대 탐색 — 결함 없음.

· 3초 후 navState 유지한 채 replace 로 /matching/opponent 이동(뒤로가기 로딩 재진입 방지, :190-192). RAF 진행바 + 언마운트 시 정리. 전체몰입(헤더·탭바 없음), Page/Footer safe-area(:28,:124). state 없이 딥링크 진입해도 region="내 주변" 폴백으로 안전.`,
  },
  {
    screenId: "match-opponent",
    text: `3-04 상대 공개 — 흐름·빈상태 방어는 우수. 승률 표기 불일치 + 전체팀 인원조회 스케일(각 보통).

· 지역 정확매칭→없으면 전체로 확장(안내), 3명+ 팀만 대상, 로드실패/무팀/8초 타임아웃 시 재시도·홈·친구초대 CTA 로 데드엔드 방지. ★인원 적격은 클라 상태가 아니라 서버 집계(getClubMemberCounts = clubs/{id}/members 카운트, :494-518) → 인원 스냅샷 우회 불가. null 렌더 폴백 안전, Footer safe-area(:351).

[보통] 같은 상대 승리확률이 이 화면과 3-08에서 다르게 표시 — :557-564 vs MatchAnalysisPage.jsx:840-846. 여기선 estimateWinProbability 를 opts 없이 호출(H2H·리그랭킹 미반영), 3-08은 h2h+랭킹 넣어 호출. 재현: 공개화면 "52%" 보고 매칭요청 → 분석 진입 시 "47%" 로 바뀜. 같은 상대인데 숫자가 달라 혼란.
[보통] 인원조회를 전체 상대팀 수만큼 발사 — :485-508. getClubMemberCounts 가 팀 N개 aggregate 병렬 실행(AI추천 섹션은 16개 제한인데 이 화면은 무제한). 팀 수백 개로 늘면 진입마다 수백 읽기 → 지연·비용. 현 규모 체감 낮으나 스케일 리스크.
[경미] 로스터 인원(members.length, :735)과 적격판정 서브컬렉션 카운트가 소스 달라 드물게 어긋날 수 있음(표기상 사소).`,
  },
  {
    screenId: "matching-manage",
    text: `3-05 매칭 관리 — ★치명 1건(도메인 공유 규칙) / 상태 로직은 정상.

· 받은/보낸/철회·거절 3탭이 match_requests SSOT 인박스(listMatchInboxForClub)로 구성, 수락/거절/철회는 팀장만. 수락 시 인원 재검증이 클라(myMemberCount)와 서버(acceptMatchRequest→assertBothTeamsCanPlay) 양쪽에서 걸림. 거절/철회는 서비스에서 소유권·pending 상태를 runTransaction 으로 가드 → stale 인박스로 종료된 제안 되살리기 차단. 상태 desync 없음.

★[치명·COMMON] match_requests 쓰기 규칙 무방비 — firestore.rules:28-30. allow write: if signedIn() 뿐, 소유권 검사 없음. 로그인만 하면 콘솔에서 남의 pending 제안을 updateDoc 으로 강제 수락시키거나, 취소권한 게이트(cancelMatchRequest 의 myId!==actorClubId throw)를 우회해 상대 신청을 직접 cancelled 처리 가능. 서비스단 소유권 검사가 전부 클라에서만 도는 셈. (도메인 공유 치명 — match-roomdetail 참조) ※firestore.rules 는 COMMON — 기록만, 수정은 지휘 취합.
[경미] 인박스 라인업 폴백 필드명 불일치 — matchingInboxService.js:95-96,105-106 이 actorLineupSnapshot/targetLineupSnapshot 참조하나 실제 저장은 fromLineupSnapshot/toLineupSnapshot(createMatchRequest 계열). 최상위 matchSizeKey 가 항상 저장돼 카드 표시엔 무영향(죽은 폴백).`,
  },
  {
    screenId: "match-roomlist",
    text: `3-06 매치룸 목록 — 결함 없음(표시 전용). 공유 치명은 match-roomdetail 로 귀속.

· loadMatchRoomListPageData 가 actor/target 양방향 쿼리를 uniqById 로 합쳐 조율중·확정·지난·취소로 분류. 취소 카드는 acceptedAt||confirmedAt 있는 것만(=매치룸 성사 후 취소)으로 좁혀(:1332-1340) "수락 전 철회"가 취소 카드로 새는 것 방지. 점수 관점 정렬(iAmActor 기준 스왑) 일관.

· 자체적으로 데이터를 손상시키는 경로 없음. 단 표시하는 status/점수의 신뢰성은 match_requests 쓰기 규칙(치명)에 의존.`,
  },
  {
    screenId: "match-roomdetail",
    text: `3-07 매치룸 상세 — ★치명 2건.

· 결과 흐름 설계는 견고: submitMatchResultWithMedia 가 트랜잭션으로 상대 선제출 시 덮어쓰기 차단(:1621), acceptMatchResult 는 statsAppliedAt 가드로 전적 이중반영 차단(:1757), disputeMatchResult 는 finished 면 되돌리기 차단(:2037). 팀 평판은 결과확정이 아니라 참가자 리뷰에서만 집계(opponentRating 경로 제거) → 이중집계 없음. 인원·팀장 게이트 정상.

★[치명·COMMON] match_requests·clubs 쓰기 규칙 무방비 → 전적 조작 — firestore.rules:24,28-30. clubs(:24)·match_requests(:28)가 allow write: if signedIn(). 콘솔에서 clubs/{id}.stats.wins 직접 증가 또는 match_requests 에 status:finished·점수·statsAppliedAt 직접 써 전적/랭킹 위조 가능. 재현: updateDoc(doc(db,'clubs',myClubId),{stats:{wins:999}}) → 홈/랭킹/전적 즉시 오염. 리뷰 서브컬렉션도 개방이라 평판 위조 가능. ※COMMON.
★[치명] acceptMatchResult 에 "확정자≠제출자" 서버 가드 없음 → 자기 결과 자가승인 — matchRoomService.js:1738-1743. 결과 인정은 상대 팀이 해야 성립하나, 서비스가 confirmedByClubId 를 클라 값 그대로 신뢰하고 statsAppliedAt(중복)만 검사, confirmer 가 제출팀과 다른 참가팀인지 미검증. UI는 제출팀 버튼을 막지만(MatchRoomDetailPage.jsx:3932) 클라 게이트일 뿐. 재현: 유리한 점수 제출 후 콘솔에서 acceptMatchResult({matchRequestId, confirmedByClubId: myClubId}) → 상대 승인 없이 status=finished + 전적 반영. 상호확정 스펙 우회.
[보통] 제휴구장 이중예약 가드가 비트랜잭션(레이스) — 매칭 확정이 제휴구장을 잡을 때 assertSlotFree 로 겹침 검사(ownerVenueService.js:1416,1468)하나 getDocs 후 addDoc 비원자 구조라 동시 요청 시 둘 다 통과 가능(venueBooking.doubleBooking.test.js 가 재현). 근본은 구장 도메인 — 매칭 고유 신규결함 아님. 미확인: 매칭측 제휴구장 write 호출부 정확한 라인.`,
  },
  {
    screenId: "match-analysis",
    text: `3-08 매칭 분석 — 계산식·서버 재검증은 정상. 무팀 진입 시 무한 스피너(중대).

· 승률식은 실데이터 가중합(승률차·H2H·리그랭킹·최근폼·득점·키·인원·포지션밸런스) + 소표본 베이지안 셰이드로 과잉반응 억제, 신뢰도·불확실폭 분리 안내. 최종 신청은 createMatchRequest→assertBothTeamsCanPlay 가 서버에서 clubs/{id}/members 재조회로 검증(matchingService.js:331-339) → 클라 스냅샷 우회 불가. 중복 매칭도 서버 차단(:341-351). 하단 CTA safe-area(:511).

[중대] 팀 없는 사용자가 진입하면 로딩이 영원히 안 끝남 — MatchAnalysisPage.jsx:780-820,980-986. run() 이 !activeTeamId 면 조기반환하는데 loading 초기값 true, setLoading(false)는 finally 에서만 실행 → 조기반환 경로에선 false 가 안 됨. 렌더는 loading 이면 스피너라 무한 스피너(에러문구·CTA 없음). 재현: 팀 미소속 사용자가 3-01의 찜한 팀 도전 버튼(favTeams 는 activeTeamId 무관 렌더)을 누르면 /matching/analysis/:clubId 진입 → 빈 스피너. RequireClub 이 팀 보유를 강제 안 해(AppRoutes.jsx:209-214) 무팀 진입 실제 가능. 헤더 뒤로가기로만 탈출.
[경미] Page min-height:calc(100vh - 56px) 하드코딩(:127)이 실제 헤더 52px+safe-area-top 과 어긋남(시각 영향 미미).`,
  },
  {
    screenId: "my-team-matches",
    text: `3-09 내 팀 경기(기록탭 /records) — 결함 없음(표시 전용).

· loadMatchRoomListPageData 로 finished 경기만 추려 "리뷰 남길/완료" 2탭으로 분류. 무효(resultState==='void')는 항상 완료로 분류·리뷰 대상 제외(:333-334), 리뷰 여부는 listMyReviewedMatchIds 가 reviews/{raterUid} 문서 직접 read 로 판정(:303-306)해 rules-안전. 쓰기 없음 → 자체 결함 없음.

· 표시 신뢰성은 match-roomdetail 의 전적 조작 치명에 의존.`,
  },
  {
    screenId: "matches-finished",
    text: `3-10 지난 경기(/matches/finished) — 결함 없음(표시 전용).

· listFinishedMatchesPage 로 페이지네이션(pageSize 16, cursor) 조회 후 내 팀 관점(iAmActor 기준 actor/target 스왑, :348-352)으로 점수·승패·랭킹 표시. 무효 경기는 "무효·전적 미반영" 배지로 구분(:431-432), permission-denied 는 사용자 메시지로 구분 처리(:306-308). 쓰기 없음.

· 미확인: listFinishedMatchesPage 내부 쿼리 구현은 로직만 신뢰, 라인 단위 미열람.`,
  },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log(`\n[매칭 감사 기록] ${ENTRIES.length}건 · by="${BY}" · ${kstNow()}`);
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
