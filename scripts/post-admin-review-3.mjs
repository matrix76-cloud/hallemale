// 관리자 도메인 — 4차 라운드에서 나온 "조치가 헛도는" 3건 수정 기록.
//   · 숨김 처리한 글이 링크로는 열리던 것 (10-13/10-14)
//   · 메시지를 지워도 채팅 목록 미리보기에 남던 것 (10-23)
//   · 잠금 사유 입력을 취소해도 방이 잠기던 것 (10-23)
//
// 사용: node scripts/post-admin-review-3.mjs          → dry-run
//       node scripts/post-admin-review-3.mjs --apply  → 실제 기록

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
    text: `✅ 고쳤음 — 숨긴 글이 링크로는 그대로 열리던 문제 (10-13·10-14)
● 무엇이 문제였나: 신고된 글을 "숨김" 처리해도 목록에서만 사라지고, 알림·공유 링크·뒤로가기로 들어오면 그대로 보였어요. 운영자는 가렸다고 믿는데 실제로는 계속 노출되던 상태입니다.
● 어떻게 했나: 게시글 상세를 열 때도 숨김 여부를 확인하게 했어요. 숨겨진 글은 "운영자가 숨긴 게시글입니다"라고 사유까지 알려줍니다. 어드민 화면에서는 계속 볼 수 있어요(해제 판단이 필요하니까).
● 확인 방법: 커뮤니티 글 → 숨김 처리 → 그 글의 주소를 일반 계정으로 직접 열어보기.
● 기술 상세: communityService.js loadCommunityPostDetail — data.hidden 차단 추가(reason: hidden_by_admin)`,
  },
  {
    screenId: "admin-chat-detail",
    text: `✅ 고쳤음 — 채팅 조치 2건 (10-23)
● 무엇이 문제였나:
  ① 부적절한 메시지를 지워도 채팅 목록의 "최신 메시지" 미리보기에 그 문장이 그대로 남았어요. 어드민 목록뿐 아니라 사용자 채팅 목록에도요 — 지운 의미가 없었습니다.
  ② 방 잠금에서 사유 입력창을 "취소"해도 방이 잠겼어요. 안 잠갔다고 믿은 채 자리를 뜨게 됩니다.
● 어떻게 했나: ① 메시지를 지운 직후 남아 있는 마지막 메시지로 미리보기를 다시 맞춥니다(다 지우면 비웁니다). ② 취소를 눌렀는지 먼저 판정하도록 순서를 바로잡았습니다.
● 확인 방법: 채팅방 상세 → 마지막 메시지 삭제 → 채팅 목록의 미리보기가 그 이전 메시지로 바뀌는지. / 방 잠금 → 사유 입력창에서 취소 → 잠기지 않는지.
● 기술 상세: adminChatService.js refreshLastMessageMeta 추가 / AdminChatRoomDetailPage.jsx toggleLock prompt null 판정`,
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
