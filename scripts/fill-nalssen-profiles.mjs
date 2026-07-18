// 날쎈초급이 팀원들의 개인 프로필(실력/포지션/키/몸무게/소개)을 채운다.
// - 비어있는 필드만 채움(기존 값은 유지). skillLevel 위주.
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/fill-nalssen-profiles.mjs          → 조회만 (dry-run)
//       node scripts/fill-nalssen-profiles.mjs --apply  → 실제 반영

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
const SKILL_LABEL = { beginner: "입문", amateur: "아마추어", intermediate: "중급", advanced: "상급" };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toStr = (v) => String(v || "").trim();

// 멤버 인덱스별 프로필 프리셋 (초급 팀이라 입문~중급 위주, 다양하게)
const PRESETS = [
  { mainPosition: "guard",   skillLevel: "amateur",      heightCm: 176, weightKg: 70, intro: "허슬과 외곽이 강점인 포인트 가드." },
  { mainPosition: "center",  skillLevel: "intermediate", heightCm: 188, weightKg: 85, intro: "골밑 리바운드를 책임지는 센터." },
  { mainPosition: "forward", skillLevel: "beginner",     heightCm: 182, weightKg: 78, intro: "열심히 뛰는 신입 포워드." },
  { mainPosition: "guard",   skillLevel: "intermediate", heightCm: 178, weightKg: 72, intro: "스피드가 좋은 슈팅 가드." },
  { mainPosition: "forward", skillLevel: "amateur",      heightCm: 184, weightKg: 80, intro: "돌파와 미드레인지가 강점." },
];

// 1) 팀 찾기
const allSnap = await getDocs(collection(db, "clubs"));
const matches = allSnap.docs.filter((d) => toStr(d.data()?.name).includes(TEAM_KEYWORD));
if (matches.length === 0) {
  console.error(`❌ 이름에 "${TEAM_KEYWORD}" 가 포함된 팀을 찾지 못했습니다.`);
  process.exit(1);
}
const clubDoc = matches[0];
const clubId = clubDoc.id;
console.log(`✅ 팀: ${clubDoc.data().name} (clubId=${clubId})`);

// 2) 멤버 목록
const memSnap = await getDocs(collection(db, "clubs", clubId, "members"));
const memberIds = memSnap.docs.map((d) => d.id);
console.log(`\n멤버 ${memberIds.length}명 처리:`);

let presetIdx = 0;
for (const uid of memberIds) {
  const uRef = doc(db, "users", uid);
  const uSnap = await getDoc(uRef);
  const u = uSnap.exists() ? uSnap.data() || {} : {};
  const nick = toStr(u.nickname) || "(닉네임 없음)";

  // 비어있는 필드만 채움
  const preset = PRESETS[presetIdx % PRESETS.length];
  presetIdx += 1;

  const patch = {};
  if (!toStr(u.skillLevel)) patch.skillLevel = preset.skillLevel;
  if (!toStr(u.mainPosition)) patch.mainPosition = preset.mainPosition;
  if (u.heightCm == null || Number(u.heightCm) <= 0) patch.heightCm = preset.heightCm;
  if (u.weightKg == null || Number(u.weightKg) <= 0) patch.weightKg = preset.weightKg;
  if (!toStr(u.intro)) patch.intro = preset.intro;

  const filledSkill = patch.skillLevel || toStr(u.skillLevel);
  const skillKo = SKILL_LABEL[filledSkill] || filledSkill || "-";

  if (Object.keys(patch).length === 0) {
    console.log(`   - ${nick} (${uid}) : 이미 작성됨 → 변경 없음 (실력 ${skillKo})`);
    continue;
  }

  console.log(
    `   - ${nick} (${uid}) : ${Object.keys(patch).join(", ")} 채움 ` +
      `→ 실력 ${skillKo} / ${patch.mainPosition || toStr(u.mainPosition) || "-"}`
  );

  if (APPLY) {
    await setDoc(uRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  }
}

if (!APPLY) {
  console.log("\n(dry-run) 실제 반영하려면 --apply 붙여서 다시 실행.");
} else {
  console.log("\n완료: 날쎈초급이 팀원 프로필 작성 반영됨.");
}
process.exit(0);
