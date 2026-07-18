// 청춘사자 팀에 더미 팀원 3명을 추가한다. (선수 프로필 전체 입력)
// - clubs/{clubId}/members/{uid} 멤버 ref 생성
// - users/{uid} 선수 실데이터 생성 (activeTeamId = 청춘사자 clubId)
//   → PlayerProfilePage / TeamProfilePage 가 users doc 을 조인해 렌더링하므로
//     users doc 에 프로필 필드를 모두 채운다.
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/add-members-cheongchunsaja.mjs          → 조회만 (dry-run)
//       node scripts/add-members-cheongchunsaja.mjs --apply  → 실제 추가

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
const TEAM_KEYWORD = "청춘사자"; // "청춘사자" / "팀 청춘사자" 모두 매칭

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1) 청춘사자 club 찾기 (이름에 키워드 포함)
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

// 2) 추가할 팀원 3명 (청춘사자 지역 정보 상속, 프로필 전체 입력)
const region = String(club.region || "").trim();
const regionSido = String(club.regionSido || "").trim();
const regionGu = String(club.regionGu || "").trim();

const NEW_MEMBERS = [
  {
    nickname: "김도현",
    mainPosition: "guard",
    skillLevel: "intermediate",
    heightCm: 180,
    weightKg: 74,
    birthYear: 1996,
    intro: "코트 비전이 좋은 포인트 가드. 빠른 트랜지션과 픽앤롤 운영이 강점이에요.",
    careers: ["대학 동아리 농구부 주장", "구민 3x3 대회 8강"],
  },
  {
    nickname: "이준서",
    mainPosition: "forward",
    skillLevel: "advanced",
    heightCm: 187,
    weightKg: 82,
    birthYear: 1994,
    intro: "미드레인지와 돌파가 모두 되는 스윙맨. 수비 리바운드 가담이 적극적입니다.",
    careers: ["사회인 리그 득점왕", "직장인 농구대회 MVP"],
  },
  {
    nickname: "박지훈",
    mainPosition: "center",
    skillLevel: "intermediate",
    heightCm: 195,
    weightKg: 92,
    birthYear: 1992,
    intro: "골밑 스크린과 림 프로텍션을 책임지는 빅맨. 박스아웃이 확실해요.",
    careers: ["지역 클럽 리그 리바운드 1위"],
  },
];

const ZERO_STATS = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };

console.log(`\n추가 예정 팀원: ${NEW_MEMBERS.length}명`);
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
      isAi: true,
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
      isAi: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`  ✓ 추가: ${m.nickname} (uid=${uid})`);
}

console.log(`\n완료: 청춘사자(${clubId})에 팀원 ${NEW_MEMBERS.length}명 추가.`);
process.exit(0);
