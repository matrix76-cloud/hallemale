// 블랙비어 팀에 AI 더미 팀원 4명을 추가한다.
// - clubs/{clubId}/members/{uid} 멤버 ref 생성
// - users/{uid} 선수 실데이터 생성 (activeTeamId = 블랙비어 clubId)
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/add-ai-members-blackbeer.mjs          → 조회만 (dry-run)
//       node scripts/add-ai-members-blackbeer.mjs --apply  → 실제 추가

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
const TEAM_KEYWORD = "블랙비어"; // "팀 블랙비어" / "블랙비어" 모두 매칭

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1) 블랙비어 club 찾기 (이름에 키워드 포함)
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
for (const d of memSnap.docs) {
  const u = await getDoc(doc(db, "users", d.id));
  const nick = u.exists() ? u.data().nickname || "" : "(user 없음)";
  console.log(`   - ${d.id}  ${nick}  role=${d.data().role || "-"}`);
}

// 2) 추가할 AI 팀원 4명 (블랙비어 지역 정보 상속)
const region = String(club.region || "").trim();
const regionSido = String(club.regionSido || "").trim();
const regionGu = String(club.regionGu || "").trim();

const AI_MEMBERS = [
  { nickname: "AI 강철수", mainPosition: "center",  skillLevel: "advanced",     heightCm: 192, weightKg: 88, intro: "골밑을 책임지는 든든한 빅맨. (AI 생성 팀원)" },
  { nickname: "AI 박슈터", mainPosition: "guard",   skillLevel: "intermediate", heightCm: 178, weightKg: 72, intro: "외곽 3점이 강점인 슈팅 가드. (AI 생성 팀원)" },
  { nickname: "AI 이날쌘", mainPosition: "forward", skillLevel: "advanced",     heightCm: 185, weightKg: 80, intro: "스피드와 돌파가 좋은 스윙맨. (AI 생성 팀원)" },
  { nickname: "AI 최수비", mainPosition: "guard",   skillLevel: "amateur",      heightCm: 175, weightKg: 70, intro: "허슬과 수비가 강점인 포인트 가드. (AI 생성 팀원)" },
];

const ZERO_STATS = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };

console.log(`\n추가 예정 AI 팀원: ${AI_MEMBERS.length}명`);
AI_MEMBERS.forEach((m, i) => {
  console.log(`   ${i + 1}. ${m.nickname}  ${m.mainPosition}/${m.skillLevel}  ${m.heightCm}cm/${m.weightKg}kg`);
});

if (!APPLY) {
  console.log("\n(dry-run) 실제 추가하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// 3) 실제 추가
for (let i = 0; i < AI_MEMBERS.length; i++) {
  const m = AI_MEMBERS[i];
  // 안정적이고 충돌 없는 uid (재실행 시 동일 uid로 덮어쓰기 → 중복 생성 방지)
  const uid = `ai_${clubId}_${i + 1}`;

  await setDoc(
    doc(db, "users", uid),
    {
      uid,
      nickname: m.nickname,
      isAi: true,
      mainPosition: m.mainPosition,
      skillLevel: m.skillLevel,
      heightCm: m.heightCm,
      weightKg: m.weightKg,
      intro: m.intro,
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

  console.log(`  ✓ 추가: ${m.nickname} (uid=${uid})`);
}

console.log(`\n완료: 블랙비어(${clubId})에 AI 팀원 ${AI_MEMBERS.length}명 추가.`);
process.exit(0);
