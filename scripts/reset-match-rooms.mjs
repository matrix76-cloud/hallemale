// 테스트용: match_requests 상태를 처음(accepted, 구장 정하기 전)으로 리셋.
// Firestore 규칙이 전면 허용이라 클라이언트 SDK로 인증 없이 동작.
// 사용: node scripts/reset-match-rooms.mjs          → 조회만 (dry-run)
//       node scripts/reset-match-rooms.mjs --apply  → 실제 리셋

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
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
const RESET_FROM = new Set(["proposed", "confirmed"]); // 이 상태들을 accepted로

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const snap = await getDocs(collection(db, "match_requests"));
console.log(`총 match_requests: ${snap.size}건`);

const targets = [];
snap.forEach((d) => {
  const data = d.data() || {};
  const st = String(data.status || "");
  if (RESET_FROM.has(st)) {
    targets.push({ id: d.id, status: st, data });
  }
});

console.log(`리셋 대상(proposed/confirmed): ${targets.length}건`);
for (const t of targets) {
  const a = t.data.actorClubId || t.data.actorTeamName || "?";
  const b = t.data.targetClubId || t.data.targetTeamName || "?";
  console.log(`  - ${t.id}  [${t.status}]  addr=${t.data.fieldAddress || t.data.field?.address || "-"}  when=${t.data.scheduledAt || "-"}`);
}

if (!APPLY) {
  console.log("\n(dry-run) 실제 변경하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

for (const t of targets) {
  await updateDoc(doc(db, "match_requests", t.id), {
    status: "accepted",
    scheduledAt: deleteField(),
    field: deleteField(),
    fieldAddress: deleteField(),
    fieldLat: deleteField(),
    fieldLng: deleteField(),
    proposedByClubId: deleteField(),
    proposedAt: deleteField(),
    confirmedByClubId: deleteField(),
    confirmedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
  console.log(`  ✓ reset → accepted: ${t.id}`);
}
console.log(`\n완료: ${targets.length}건 accepted로 리셋됨.`);
process.exit(0);
