// 관리자 도메인 4차 라운드 — 화면 레이어만 남겨뒀던 5화면(10-13·14·15·21·23) 추가 기록.
// 앞 라운드에서 "화면 레이어는 다음 회차" 라고 적어둔 화면들의 후속 기록이다.
// 상세 근거는 docs/review-system/admin-audit.md "4차 라운드" 절.
//
// 사용: node scripts/post-admin-review-2.mjs          → dry-run
//       node scripts/post-admin-review-2.mjs --apply  → 실제 기록

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
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
const BY = "AI";
const COL = "reviewThreads";

const kstNow = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

const ENTRIES = [
  {
    screenId: "admin-community-posts",
    text: `[10-13 커뮤니티 글 — 화면 레이어 추가 감사]
● 결함:
  1) [중대] 숨김 처리한 글이 링크로는 그대로 열린다. 목록에서만 빠지고, 알림·공유 링크·뒤로가기로 상세에 들어오면 신고된 글이 계속 보인다. 숨김 조치의 실효가 절반이다.
  2) [중대] "공지로 고정"이 오래된 글에는 안 먹는다. 사용자 목록은 최근 30건을 받은 뒤 그 안에서만 공지를 위로 올리기 때문에, 30건 밖의 글을 고정하면 첫 화면에 안 올라온다. 어드민에는 "공지"로 보인다.
  3) [경미] 검색이 제목·작성자만 된다(본문 검색 불가) — 신고 내용으로 글을 찾을 수 없다.
  4) [경미] 삭제 확인 문구가 "댓글까지 함께 사라진다"고 하는데 댓글 500건이 넘으면 실제로는 남는다.
● 재현: 글을 숨김 처리 → 그 글의 URL을 사용자 계정으로 직접 열면 그대로 보인다.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: communityService.js:107 vs :185-193(상세엔 hidden 검사 없음), :93/:158-161
● 심각도: 중대 2 · 경미 2`,
  },
  {
    screenId: "admin-community-detail",
    text: `[10-14 커뮤니티 글 상세 — 화면 레이어 추가 감사]
● 결함:
  1) [중대] 10-13과 같은 뿌리 — 여기서 "숨김 처리"를 해도 사용자가 링크로 들어오면 글이 보인다.
  2) [경미] 누가 언제 숨겼는지 화면에 안 나온다. 데이터는 넘어오는데 "숨김" 표시만 찍는다 — 조치 이력을 볼 수 없다.
  3) [경미] 신고로 넘어와도 신고 사유가 상세에 안 보인다. 무엇 때문에 들어왔는지 모른 채 판단하게 된다.
  4) [경미] 댓글을 상한 없이 전부 불러온다.
● 이미지·본문 렌더는 사용자 저장 형식과 일치한다(결함 아님).
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminCommunityPostDetailPage.jsx:443-456 / adminCommunityService.js:150-152
● 심각도: 중대 1 · 경미 3`,
  },
  {
    screenId: "admin-community-reports",
    text: `[10-15 커뮤니티 신고 — 화면 레이어 추가 감사]
● 결함:
  1) [중대] 글을 숨기거나 지워도 같은 글에 달린 다른 신고는 "대기"로 남는다. 남은 신고를 누르면 이미 지워진 글로 이동해 "게시글을 찾을 수 없습니다"가 뜬다. 회원 신고(10-05)·팀 신고(10-09)와 완전히 같은 모양이다.
  2) [경미] 처리자가 항상 "admin" — 어느 운영자가 처리했는지 안 남는다.
  3) [경미] 신고 전수 조회(상한 없음).
● 재현: 한 글에 신고 2건 → 하나를 "삭제"로 종결 → 나머지 신고를 클릭.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminCommunityReportsPage.jsx:325-345 / postReportService.js:66-76
● 심각도: 중대 1 · 경미 2`,
  },
  {
    screenId: "admin-games-past",
    text: `[10-21 지난 경기 — 화면 레이어 추가 감사]
● 결함:
  1) [중대] 지역 필터를 바꿔도 목록이 안 바뀐다. 필터는 조회할 때만 적용되는데 드롭다운을 바꿔도 다시 조회하지 않는다(조회 버튼도 없다). 검색창에서 Enter를 쳐야 그제서야 반영된다 — 필터가 고장난 것처럼 보인다.
  2) [중대] 검색창에 "팀명/장소/스코어 검색"이라 써 있지만 스코어로는 안 걸린다. 실제 대상은 팀명·장소·경기규격뿐이다.
  3) [중대] "기간" 열이 경기 날짜가 아니라 문서를 마지막으로 고친 시각이다. 결과를 나중에 입력하면 실제 경기일과 다른 값이 뜬다.
● 정정: 2차에 "정렬 없이 200건을 자른다"고 적었는데 지난 경기는 최신순 정렬이 있다. 다만 updatedAt이 없는 옛 문서가 통째로 빠지는 문제는 그대로다.
● 재현: 지역을 "제주"로 바꿔본다 → 목록 그대로. 검색창에서 Enter → 그제서야 바뀜.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminGamesPastPage.jsx:241-247, :277 / adminGamesService.js:166-171, :243
● 심각도: 중대 3`,
  },
  {
    screenId: "admin-chat-detail",
    text: `[10-23 채팅방 상세 — 화면 레이어 추가 감사]
● 결함:
  1) [중대] 잠금 사유 입력을 "취소"해도 방이 잠긴다. 취소를 누른 운영자는 안 잠갔다고 믿는데 실제로는 잠겨 있다.
  2) [중대] 메시지를 지워도 채팅 목록의 "최신 메시지"에 그대로 남는다. 어드민 목록은 물론 사용자 채팅 목록 미리보기에도 지운 문장이 계속 보인다 — 부적절 메시지를 지운 의미가 없어진다.
  3) [중대] 이미지 메시지를 지워도 파일 자체는 남는다. URL을 아는 사람은 계속 볼 수 있다. 방 삭제도 마찬가지.
  4) [경미] 메시지를 상한 없이 전부 불러온다.
  5) [COMMON] 방 잠금은 화면에서만 막는다. 서버 규칙이 채팅 쓰기를 로그인만으로 허용하고, 읽기는 아예 공개라 로그인 없이도 모든 채팅 내용을 볼 수 있다(커뮤니티·채팅 감사와 같은 뿌리).
● 재현: 방 잠금 → 사유 입력창에서 취소 → 방이 잠김. / 메시지 삭제 후 채팅 목록 확인.
● 근거: spec 비어 있음(기준 없음).
● 추정 원인 파일: AdminChatRoomDetailPage.jsx:315-319 / adminChatService.js:222-228 / firestore.rules:196-197
● 심각도: 중대 3 · 경미 1 · COMMON 1`,
  },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  for (const e of ENTRIES) {
    console.log(`── ${e.screenId} (${e.text.split("\n")[0]})  ${e.text.length}자`);
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
