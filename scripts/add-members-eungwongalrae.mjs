// 팀응원갈래 팀에 "입문" 유저 팀원 4명을 추가한다.
// - clubs/{clubId}/members/{uid} 멤버 ref 생성
// - users/{uid} 선수 실데이터 생성 (activeTeamId = 팀응원갈래 clubId)
//   → PlayerProfilePage / TeamProfilePage 가 users doc 을 조인해 렌더링하므로
//     users doc 에 프로필 필드를 모두 채운다.
// - skillLevel 은 전원 "beginner"(=입문), isAi:false (일반 유저처럼 표시).
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/add-members-eungwongalrae.mjs          → 조회만 (dry-run)
//       node scripts/add-members-eungwongalrae.mjs --apply  → 실제 추가

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
const TEAM_KEYWORD = "응원갈래"; // "팀응원갈래" / "팀 응원갈래" / "응원갈래" 모두 매칭

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1) 팀 찾기 (이름에 키워드 포함)
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

// 2) 추가할 입문 팀원 4명 (팀 지역 정보 상속, 프로필 전체 입력)
const region = String(club.region || "").trim();
const regionSido = String(club.regionSido || "").trim();
const regionGu = String(club.regionGu || "").trim();

const NEW_MEMBERS = [
  {
    nickname: "정민재",
    mainPosition: "guard",
    skillLevel: "beginner",
    heightCm: 174,
    weightKg: 70,
    birthYear: 1999,
    intro: "농구 시작한 지 얼마 안 된 입문자예요. 열심히 뛰며 배우겠습니다!",
    careers: [],
  },
  {
    nickname: "한서준",
    mainPosition: "forward",
    skillLevel: "beginner",
    heightCm: 181,
    weightKg: 78,
    birthYear: 2000,
    intro: "운동 좋아해서 농구 입문했어요. 체력 하나는 자신 있습니다.",
    careers: [],
  },
  {
    nickname: "오지후",
    mainPosition: "guard",
    skillLevel: "beginner",
    heightCm: 172,
    weightKg: 68,
    birthYear: 2001,
    intro: "룰부터 배우는 중인 왕초보입니다. 즐겁게 함께해요!",
    careers: [],
  },
  {
    nickname: "강태윤",
    mainPosition: "center",
    skillLevel: "beginner",
    heightCm: 186,
    weightKg: 84,
    birthYear: 1998,
    intro: "키 덕분에 골밑 도전 중인 입문 빅맨이에요. 리바운드 열심히 하겠습니다.",
    careers: [],
  },
];

const ZERO_STATS = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };

console.log(`\n추가 예정 팀원: ${NEW_MEMBERS.length}명 (전원 입문/beginner)`);
NEW_MEMBERS.forEach((m, i) => {
  console.log(`   ${i + 1}. ${m.nickname}  ${m.mainPosition}/${m.skillLevel}  ${m.heightCm}cm/${m.weightKg}kg`);
});

if (!APPLY) {
  console.log("\n(dry-run) 실제 추가하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// 3) 실제 추가
for (let i = 0; i < NEW_MEMBERS.length; i++) {
  const m = NEW_MEMBERS[i];
  // 안정적이고 충돌 없는 uid (재실행 시 동일 uid로 덮어쓰기 → 중복 생성 방지)
  const uid = `dummy_${clubId}_${i + 1}`;

  await setDoc(
    doc(db, "users", uid),
    {
      uid,
      nickname: m.nickname,
      isAi: false,
      mainPosition: m.mainPosition,
      skillLevel: m.skillLevel,
      heightCm: m.heightCm,
      weightKg: m.weightKg,
      birthYear: m.birthYear,
      intro: m.intro,
      careers: m.careers,
      region,
      regionSido,
      regionGu,
      avatarUrl: "",
      media: [],
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
      isAi: false,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`  ✓ 추가: ${m.nickname} (uid=${uid})`);
}

console.log(`\n완료: ${club.name}(${clubId})에 입문 팀원 ${NEW_MEMBERS.length}명 추가.`);
process.exit(0);
