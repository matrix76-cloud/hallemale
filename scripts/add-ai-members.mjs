// 임의 팀에 AI 더미 팀원 N명 추가 (테스트용 라인업 채우기).
// - clubs/{clubId}/members/{uid} 멤버 ref + users/{uid} 선수 데이터 생성.
// - ✅ firestore.rules 강화(2026-07) 이후: 비로그인 쓰기 차단됨.
//   → 이메일/비번 테스트 계정으로 signInWithEmailAndPassword 후 씀(로그인 상태면 규칙 허용).
//
// 사용:
//   node scripts/add-ai-members.mjs --team=리바운드5 --email=appreview@hallamalle.com --pw=**** --count=6           (dry-run)
//   node scripts/add-ai-members.mjs --team=리바운드5 --email=appreview@hallamalle.com --pw=**** --count=6 --apply    (실제 추가)
//   (pw 는 --pw= 대신 환경변수 HALLE_PW 로도 전달 가능)

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const args = process.argv.slice(2);
const getArg = (k, d = "") => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : d;
};
const TEAM_KEYWORD = getArg("team");
const EMAIL = getArg("email");
const PW = getArg("pw") || process.env.HALLE_PW || "";
const COUNT = Math.max(1, Math.min(12, parseInt(getArg("count", "6"), 10) || 6));
const APPLY = args.includes("--apply");

if (!TEAM_KEYWORD) { console.error("❌ --team=<팀이름키워드> 필요"); process.exit(1); }
if (!EMAIL || !PW) { console.error("❌ --email= 과 --pw=(또는 HALLE_PW) 필요 (로그인해야 규칙 통과)"); process.exit(1); }

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 후보 AI 선수 풀 (필요 수만큼 앞에서 자름)
const POOL = [
  { nickname: "AI 강철수", mainPosition: "center",  skillLevel: "advanced",     heightCm: 192, weightKg: 88, intro: "골밑 빅맨. (AI)" },
  { nickname: "AI 박슈터", mainPosition: "guard",   skillLevel: "intermediate", heightCm: 178, weightKg: 72, intro: "외곽 슈팅가드. (AI)" },
  { nickname: "AI 이날쌘", mainPosition: "forward", skillLevel: "advanced",     heightCm: 185, weightKg: 80, intro: "돌파형 스윙맨. (AI)" },
  { nickname: "AI 최수비", mainPosition: "guard",   skillLevel: "amateur",      heightCm: 175, weightKg: 70, intro: "허슬 포인트가드. (AI)" },
  { nickname: "AI 정리바", mainPosition: "forward", skillLevel: "intermediate", heightCm: 188, weightKg: 84, intro: "리바운드 파워포워드. (AI)" },
  { nickname: "AI 한블락", mainPosition: "center",  skillLevel: "advanced",     heightCm: 195, weightKg: 92, intro: "블록 센터. (AI)" },
  { nickname: "AI 오어시", mainPosition: "guard",   skillLevel: "intermediate", heightCm: 180, weightKg: 74, intro: "패스형 가드. (AI)" },
  { nickname: "AI 서포워", mainPosition: "forward", skillLevel: "amateur",      heightCm: 183, weightKg: 78, intro: "성실한 포워드. (AI)" },
];
const ZERO = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };

console.log(`🔑 로그인: ${EMAIL}`);
await signInWithEmailAndPassword(auth, EMAIL, PW);
console.log("   ✓ 로그인 성공\n");

const allSnap = await getDocs(collection(db, "clubs"));
const matches = allSnap.docs.filter((d) => String(d.data()?.name || "").includes(TEAM_KEYWORD));
if (matches.length === 0) { console.error(`❌ "${TEAM_KEYWORD}" 팀 없음`); process.exit(1); }
if (matches.length > 1) {
  console.log(`⚠️  "${TEAM_KEYWORD}" 포함 ${matches.length}개 — 첫번째 사용:`);
  matches.forEach((d) => console.log(`     - ${d.id}  ${d.data()?.name}`));
}
const clubDoc = matches[0];
const clubId = clubDoc.id;
const club = clubDoc.data() || {};
console.log(`✅ 팀: ${club.name} (clubId=${clubId})`);

const memSnap = await getDocs(collection(db, "clubs", clubId, "members"));
console.log(`   현재 멤버: ${memSnap.size}명 → AI ${COUNT}명 추가 예정\n`);

if (!APPLY) {
  POOL.slice(0, COUNT).forEach((m, i) => console.log(`   ${i + 1}. ${m.nickname}  ${m.mainPosition}/${m.skillLevel}`));
  console.log("\n(dry-run) 실제 추가하려면 --apply 붙여 재실행.");
  process.exit(0);
}

const region = String(club.region || "").trim();
const regionSido = String(club.regionSido || "").trim();
const regionGu = String(club.regionGu || "").trim();

for (let i = 0; i < COUNT; i++) {
  const m = POOL[i % POOL.length];
  const uid = `ai_${clubId}_${i + 1}`;
  await setDoc(doc(db, "users", uid), {
    uid, nickname: m.nickname, isAi: true,
    mainPosition: m.mainPosition, skillLevel: m.skillLevel,
    heightCm: m.heightCm, weightKg: m.weightKg, intro: m.intro,
    region, regionSido, regionGu, avatarUrl: "",
    activeTeamId: clubId, clubId, roleInTeam: "member", isTeamCaptain: false,
    stats: { ...ZERO, updatedAt: serverTimestamp() },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
  await setDoc(doc(db, "clubs", clubId, "members", uid), {
    uid, role: "member", status: "active", isCaptain: false, isAi: true,
    joinedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ ${m.nickname} (uid=${uid})`);
}
console.log(`\n완료: ${club.name}(${clubId})에 AI 팀원 ${COUNT}명 추가.`);
process.exit(0);
