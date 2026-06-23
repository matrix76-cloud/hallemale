// 리바운드5 vs 날쎈초급이 "조율중(accepted)" 매칭룸을 하나 생성한다 (테스트용).
// - match_requests/{autoId} 문서 생성 (status: "accepted" → 매칭룸 리스트 "조율중 경기" 탭에 표시)
// - 라인업은 비워둠(수락 후 룸에서 각 팀이 확정하는 실제 흐름과 동일)
// Firestore 규칙이 전면 허용이라 클라이언트 SDK로 인증 없이 동작.
// 사용: node scripts/add-test-matchroom-adjusting.mjs          → 조회만 (dry-run)
//       node scripts/add-test-matchroom-adjusting.mjs --apply  → 실제 생성

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
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

// actor(신청팀) → target(상대팀)
const ACTOR_KEYWORD = "리바운드5";
const TARGET_KEYWORD = "날쎈초급이";
const MATCH_SIZE_KEY = "5v5";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toStr = (v) => String(v || "").trim();

function findClubByKeyword(docs, keyword) {
  const matches = docs.filter((d) => toStr(d.data()?.name).includes(keyword));
  if (matches.length === 0) {
    console.error(`❌ 이름에 "${keyword}" 가 포함된 팀을 clubs에서 찾지 못했습니다.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.log(`⚠️  "${keyword}" 포함 팀이 ${matches.length}개 → 첫 번째 사용:`);
    matches.forEach((d) => console.log(`     - ${d.id}  ${d.data()?.name}`));
  }
  return matches[0];
}

function pickTeamSnapshot(id, data) {
  const d = data || {};
  return {
    clubId: id,
    name: toStr(d.name),
    region: toStr(d.region),
    logoUrl: toStr(d.logoUrl || d.photoUrl || ""),
  };
}

const emptyLineupSnapshot = (matchSizeKey = "") => ({
  id: "",
  name: "",
  matchSizeKey: toStr(matchSizeKey),
  memberIds: [],
  memberCount: 0,
  previewMembers: [],
  subMemberIds: [],
  subPreviewMembers: [],
  confirmed: false,
});

// 1) 두 팀 찾기
const allSnap = await getDocs(collection(db, "clubs"));
const actorDoc = findClubByKeyword(allSnap.docs, ACTOR_KEYWORD);
const targetDoc = findClubByKeyword(allSnap.docs, TARGET_KEYWORD);

const actorClubId = actorDoc.id;
const targetClubId = targetDoc.id;

if (actorClubId === targetClubId) {
  console.error("❌ 두 키워드가 같은 팀을 가리킵니다. 키워드를 더 구체적으로 지정하세요.");
  process.exit(1);
}

const fromTeamSnapshot = pickTeamSnapshot(actorClubId, actorDoc.data());
const toTeamSnapshot = pickTeamSnapshot(targetClubId, targetDoc.data());

console.log("✅ 신청팀(actor):", fromTeamSnapshot.name, `(${actorClubId})`);
console.log("✅ 상대팀(target):", toTeamSnapshot.name, `(${targetClubId})`);
console.log("   사이즈:", MATCH_SIZE_KEY, "/ 상태: accepted (조율중)");

if (!APPLY) {
  console.log("\n(dry-run) 실제 생성하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// 2) 조율중(accepted) 매칭룸 생성
const payload = {
  actorClubId,
  targetClubId,
  status: "accepted", // 매칭룸 리스트 "조율중 경기" 탭 (accepted | proposed)
  matchSizeKey: MATCH_SIZE_KEY,

  fromTeamSnapshot,
  toTeamSnapshot,
  fromLineupSnapshot: emptyLineupSnapshot(MATCH_SIZE_KEY),
  toLineupSnapshot: emptyLineupSnapshot(MATCH_SIZE_KEY),

  // 수락 흐름과 동일한 메타
  acceptedByClubId: targetClubId,
  acceptedAt: serverTimestamp(),
  lastActivityAt: serverTimestamp(),

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

const ref = await addDoc(collection(db, "match_requests"), payload);

console.log(`\n완료: 조율중 매칭룸 생성됨 (match_requests/${ref.id})`);
console.log(`   ${fromTeamSnapshot.name} vs ${toTeamSnapshot.name}`);
process.exit(0);
