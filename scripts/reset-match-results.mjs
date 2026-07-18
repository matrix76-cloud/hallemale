// 테스트용: 경기 결과를 "하나도 입력 안 된 상태"로 리셋.
// - finished(또는 결과 입력된) match_requests → confirmed(결과 미입력)로 되돌림
//   (status=confirmed, resultState/result/점수/statsAppliedAt 제거, 일정·구장은 유지)
// - 관련 팀(clubs)·멤버(users) 전적(stats)을 0으로 초기화 → 0승 0무 0패
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/reset-match-results.mjs          → 조회만 (dry-run)
//       node scripts/reset-match-results.mjs --apply  → 실제 리셋

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  deleteField,
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ZERO_STATS = {
  wins: 0,
  losses: 0,
  draws: 0,
  totalMatches: 0,
  winRate: 0,
  recentResults: [],
};

function memberIdsOf(lineup) {
  if (!lineup || typeof lineup !== "object") return [];
  if (Array.isArray(lineup.memberIds)) return lineup.memberIds.map(String);
  if (Array.isArray(lineup.previewMembers))
    return lineup.previewMembers.map((m) => String(m?.userId || "")).filter(Boolean);
  return [];
}

const snap = await getDocs(collection(db, "match_requests"));
console.log(`총 match_requests: ${snap.size}건`);

// 결과가 입력된(=되돌릴) 대상: finished 이거나 resultState/점수가 있는 것
const targets = [];
snap.forEach((d) => {
  const data = d.data() || {};
  const st = String(data.status || "");
  const hasResult =
    st === "finished" ||
    !!data.resultState ||
    Number.isFinite(Number(data.myScore)) ||
    Number.isFinite(Number(data.oppScore)) ||
    !!data.statsAppliedAt;
  if (hasResult) targets.push({ id: d.id, status: st, data });
});

const clubIds = new Set();
const userIds = new Set();
for (const t of targets) {
  if (t.data.actorClubId) clubIds.add(String(t.data.actorClubId));
  if (t.data.targetClubId) clubIds.add(String(t.data.targetClubId));
  memberIdsOf(t.data.fromLineupSnapshot).forEach((u) => userIds.add(u));
  memberIdsOf(t.data.toLineupSnapshot).forEach((u) => userIds.add(u));
}

console.log(`\n결과 리셋 대상 경기: ${targets.length}건`);
for (const t of targets) {
  const a = t.data.actorTeamName || t.data.actorClubId || "?";
  const b = t.data.targetTeamName || t.data.targetClubId || "?";
  console.log(
    `  - ${t.id} [${t.status}] ${a} vs ${b}  score=${t.data.myScore ?? "-"}:${t.data.oppScore ?? "-"}  when=${t.data.scheduledAt || "-"}`
  );
}
console.log(`\n전적 0으로 초기화할 팀(clubs): ${clubIds.size}개 → ${[...clubIds].join(", ")}`);
console.log(`전적 0으로 초기화할 멤버(users): ${userIds.size}명`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 변경하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// 1) 경기 결과 제거 (finished는 confirmed로, 나머지는 현재 상태 유지 / 일정·구장 유지)
for (const t of targets) {
  const nextStatus = t.status === "finished" ? "confirmed" : t.status;
  await updateDoc(doc(db, "match_requests", t.id), {
    status: nextStatus,
    resultState: deleteField(),
    result: deleteField(),
    myScore: deleteField(),
    oppScore: deleteField(),
    statsAppliedAt: deleteField(),
    resultAcceptedByClubId: deleteField(),
    resultAcceptedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
  console.log(`  ✓ 결과 제거 → confirmed: ${t.id}`);
}

// 2) 팀 전적 0으로
for (const id of clubIds) {
  await setDoc(
    doc(db, "clubs", id),
    { stats: { ...ZERO_STATS, updatedAt: serverTimestamp() }, updatedAt: serverTimestamp() },
    { merge: true }
  );
  console.log(`  ✓ club 전적 0: ${id}`);
}

// 3) 멤버 전적 0으로
for (const uid of userIds) {
  await setDoc(
    doc(db, "users", uid),
    { stats: { ...ZERO_STATS, updatedAt: serverTimestamp() }, updatedAt: serverTimestamp() },
    { merge: true }
  );
  console.log(`  ✓ user 전적 0: ${uid}`);
}

console.log(
  `\n완료: 경기 ${targets.length}건 결과 제거 + 팀 ${clubIds.size}개 / 멤버 ${userIds.size}명 전적 0으로 리셋.`
);
process.exit(0);
