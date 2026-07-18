// 다산왕 / 치킨덕소 두 팀에 각각 AI 선수 6명씩 추가.
// - clubs/{clubId}/members/{uid} 멤버 ref 생성
// - users/{uid} 선수 실데이터 생성 (activeTeamId = 해당 clubId, 팀 지역 상속)
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/add-members-dasan-chicken.mjs          → 조회만 (dry-run)
//       node scripts/add-members-dasan-chicken.mjs --apply  → 실제 추가

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
const TEAM_KEYWORDS = ["다산왕", "치킨덕소"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ZERO_STATS = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };

// 팀별 6명 로스터 (포지션 밸런스: 가드3/포워드2/센터1)
function rosterFor(tag) {
  return [
    { nickname: `${tag} 포인트`, mainPosition: "guard",   skillLevel: "advanced",     heightCm: 176, weightKg: 71, intro: "경기 조율에 능한 포인트 가드. (AI 생성 팀원)" },
    { nickname: `${tag} 슈터`,   mainPosition: "guard",   skillLevel: "intermediate", heightCm: 180, weightKg: 74, intro: "외곽 3점이 강점인 슈팅 가드. (AI 생성 팀원)" },
    { nickname: `${tag} 돌파`,   mainPosition: "guard",   skillLevel: "amateur",      heightCm: 178, weightKg: 73, intro: "빠른 돌파와 허슬이 강점. (AI 생성 팀원)" },
    { nickname: `${tag} 스윙맨`, mainPosition: "forward", skillLevel: "advanced",     heightCm: 187, weightKg: 82, intro: "공수 밸런스가 좋은 스윙맨. (AI 생성 팀원)" },
    { nickname: `${tag} 파워`,   mainPosition: "forward", skillLevel: "intermediate", heightCm: 190, weightKg: 86, intro: "몸싸움에 강한 파워 포워드. (AI 생성 팀원)" },
    { nickname: `${tag} 빅맨`,   mainPosition: "center",  skillLevel: "advanced",     heightCm: 195, weightKg: 92, intro: "골밑을 지키는 든든한 센터. (AI 생성 팀원)" },
  ];
}

async function findClub(keyword) {
  const allSnap = await getDocs(collection(db, "clubs"));
  const matches = allSnap.docs.filter((d) =>
    String(d.data()?.name || "").includes(keyword)
  );
  return matches;
}

for (const keyword of TEAM_KEYWORDS) {
  console.log(`\n==================== "${keyword}" ====================`);
  const matches = await findClub(keyword);
  if (matches.length === 0) {
    console.error(`❌ 이름에 "${keyword}" 포함된 팀을 clubs에서 찾지 못했습니다. (건너뜀)`);
    continue;
  }
  if (matches.length > 1) {
    console.log(`⚠️  "${keyword}" 포함 팀이 ${matches.length}개 → 첫 번째 사용:`);
    matches.forEach((d) => console.log(`     - ${d.id}  ${d.data()?.name}`));
  }
  const clubDoc = matches[0];
  const clubId = clubDoc.id;
  const club = clubDoc.data() || {};
  console.log(`✅ 팀: ${club.name} (clubId=${clubId})  region=${club.region || "-"}`);

  const memSnap = await getDocs(collection(db, "clubs", clubId, "members"));
  console.log(`   현재 멤버 수: ${memSnap.size}명`);

  const region = String(club.region || "").trim();
  const regionSido = String(club.regionSido || "").trim();
  const regionGu = String(club.regionGu || "").trim();

  // 팀 이름에서 짧은 태그(공백 앞 첫 토큰) 추출해 닉네임 접두어로
  const tag = String(club.name || keyword).trim().split(/\s+/)[0];
  const members = rosterFor(tag);

  console.log(`   추가 예정: ${members.length}명`);
  members.forEach((m, i) => console.log(`     ${i + 1}. ${m.nickname}  ${m.mainPosition}/${m.skillLevel}`));

  if (!APPLY) continue;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
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

    console.log(`     ✓ 추가: ${m.nickname} (uid=${uid})`);
  }
  console.log(`   완료: ${club.name}(${clubId})에 ${members.length}명 추가.`);
}

console.log(APPLY ? "\n전체 완료." : "\n(dry-run) 실제 추가하려면 --apply 붙여서 다시 실행.");
process.exit(0);
