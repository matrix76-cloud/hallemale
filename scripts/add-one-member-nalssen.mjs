// 날쎈초급이 팀에 AI 더미 팀원 1명을 추가한다.
// - clubs/{clubId}/members/{uid} 멤버 ref 생성
// - users/{uid} 선수 실데이터 생성 (activeTeamId = 날쎈초급이 clubId)
// Firestore 규칙이 전면 허용이라 클라이언트 SDK로 인증 없이 동작.
// 사용: node scripts/add-one-member-nalssen.mjs          → 조회만 (dry-run)
//       node scripts/add-one-member-nalssen.mjs --apply  → 실제 추가

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
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
const TEAM_KEYWORD = "날쎈초급이";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1) 날쎈초급이 club 찾기 (이름에 키워드 포함)
const allSnap = await getDocs(collection(db, "clubs"));
const matches = allSnap.docs.filter((d) =>
  String(d.data()?.name || "").includes(TEAM_KEYWORD)
);
if (matches.length === 0) {
  console.error(`❌ 이름에 "${TEAM_KEYWORD}" 가 포함된 팀을 clubs에서 찾지 못했습니다.`);
  process.exit(1);
}
if (matches.length > 1) {
  console.log(`⚠️  "${TEAM_KEYWORD}" 포함 팀이 ${matches.length}개:`);
  matches.forEach((d) => console.log(`     - ${d.id}  ${d.data()?.name}`));
  console.log(`   → 첫 번째를 사용합니다.`);
}
const clubDoc = matches[0];
const clubId = clubDoc.id;
const club = clubDoc.data() || {};
console.log(`✅ 팀 찾음: ${club.name} (clubId=${clubId})`);
console.log(`   region=${club.region || "-"} / regionSido=${club.regionSido || "-"} / regionGu=${club.regionGu || "-"}`);

// 현재 멤버 확인
const memSnap = await getDocs(collection(db, "clubs", clubId, "members"));
console.log(`\n현재 멤버 수: ${memSnap.size}명`);
const existingIdx = [];
for (const d of memSnap.docs) {
  const u = await getDoc(doc(db, "users", d.id));
  const nick = u.exists() ? u.data().nickname || "" : "(user 없음)";
  console.log(`   - ${d.id}  ${nick}  role=${d.data().role || "-"}`);
  // ai_{clubId}_{n} 형태의 기존 AI uid 번호 수집 → 다음 번호 계산(충돌/덮어쓰기 방지)
  const m = String(d.id).match(new RegExp(`^ai_${clubId}_(\\d+)$`));
  if (m) existingIdx.push(Number(m[1]));
}
const nextIdx = (existingIdx.length ? Math.max(...existingIdx) : 0) + 1;

// 2) 추가할 AI 팀원 1명 (날쎈초급이 지역 정보 상속)
const region = String(club.region || "").trim();
const regionSido = String(club.regionSido || "").trim();
const regionGu = String(club.regionGu || "").trim();

const NEW_MEMBER = {
  nickname: "AI 정날쎈",
  mainPosition: "forward",
  skillLevel: "intermediate",
  heightCm: 183,
  weightKg: 78,
  intro: "코트를 넓게 쓰는 스윙 포워드. (AI 생성 팀원)",
};

const ZERO_STATS = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };

const uid = `ai_${clubId}_${nextIdx}`;

console.log(`\n추가 예정 AI 팀원: ${NEW_MEMBER.nickname}  ${NEW_MEMBER.mainPosition}/${NEW_MEMBER.skillLevel}  ${NEW_MEMBER.heightCm}cm/${NEW_MEMBER.weightKg}kg`);
console.log(`   uid=${uid}`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 추가하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// 3) 실제 추가
await setDoc(
  doc(db, "users", uid),
  {
    uid,
    nickname: NEW_MEMBER.nickname,
    isAi: true,
    mainPosition: NEW_MEMBER.mainPosition,
    skillLevel: NEW_MEMBER.skillLevel,
    heightCm: NEW_MEMBER.heightCm,
    weightKg: NEW_MEMBER.weightKg,
    intro: NEW_MEMBER.intro,
    region,
    regionSido,
    regionGu,
    avatarUrl: "",
    activeTeamId: clubId,
    clubId,
    roleInTeam: "member",
    isTeamCaptain: false,
    stats: { ...ZERO_STATS, updatedAt: serverTimestamp() },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);

await setDoc(
  doc(db, "clubs", clubId, "members", uid),
  {
    uid,
    role: "member",
    status: "active",
    isCaptain: false,
    isAi: true,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);

console.log(`\n완료: 날쎈초급이(${clubId})에 AI 팀원 1명 추가 → ${NEW_MEMBER.nickname} (uid=${uid})`);
process.exit(0);
