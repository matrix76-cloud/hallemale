// 리뷰 도구(/review) 전용 데모 계정 + 시드 데이터 생성.
// - 이메일/비번 데모 계정을 만들고(이미 있으면 로그인) 프로필·동의·관리자권한을 채운다.
// - 데이터가 풍부한 기존 팀(멤버 최다)에 데모 계정을 가입시켜 홈·기록·매칭·마이가 실데이터로 뜨게 한다.
// - isAdmin=true 필드로 /admin 도 이 계정으로 그냥 진입(리뷰 프레임 밖에서도).
// 재실행 안전: 고정 UID(이메일 기반) + merge 쓰기.
//
// 사용:
//   node scripts/seed-review-demo.mjs           → 계획만 (dry-run)
//   node scripts/seed-review-demo.mjs --apply    → 실제 생성/가입
//   node scripts/seed-review-demo.mjs --apply --team=리바운드5   → 특정 팀 지정

import { initializeApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
} from "firebase/auth";
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

// ── 데모 계정 (리뷰 도구 자동 로그인과 동일해야 함: src/dev/reviewDemo.js) ──
const DEMO_EMAIL = "review-demo@hallamalle.com";
const DEMO_PW = "reviewDemo2026!";

const args = process.argv.slice(2);
const getArg = (k, d = "") => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : d;
};
const APPLY = args.includes("--apply");
const TEAM_KEYWORD = getArg("team");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 1) 계정 준비 (없으면 생성, 있으면 로그인)
let uid = "";
try {
  const cred = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PW);
  uid = cred.user.uid;
  console.log(`✅ 데모 계정 생성: ${DEMO_EMAIL} (uid=${uid})`);
} catch (e) {
  if (e?.code === "auth/email-already-in-use") {
    const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PW);
    uid = cred.user.uid;
    console.log(`✅ 데모 계정 로그인(기존): ${DEMO_EMAIL} (uid=${uid})`);
  } else {
    console.error("❌ 계정 준비 실패:", e?.code || e?.message || e);
    process.exit(1);
  }
}

// 2) 가입시킬 팀 선택 — 키워드 지정 or 멤버 최다 팀
const clubsSnap = await getDocs(collection(db, "clubs"));
let target = null;
if (TEAM_KEYWORD) {
  const hit = clubsSnap.docs.find((d) => String(d.data()?.name || "").includes(TEAM_KEYWORD));
  if (hit) target = { id: hit.id, data: hit.data() };
}
if (!target) {
  // 멤버 최다 팀 찾기 (데이터 풍부한 팀)
  let best = null, bestN = -1;
  for (const d of clubsSnap.docs) {
    const memSnap = await getDocs(collection(db, "clubs", d.id, "members"));
    if (memSnap.size > bestN) { bestN = memSnap.size; best = { id: d.id, data: d.data(), members: memSnap.size }; }
  }
  target = best;
  console.log(`\n📌 팀 자동 선택(멤버 최다): ${target?.data?.name} (${target?.members}명)`);
} else {
  console.log(`\n📌 팀 지정: ${target.data?.name}`);
}
if (!target) { console.error("❌ 가입할 팀을 찾지 못했습니다."); process.exit(1); }

const clubId = target.id;
const club = target.data || {};
const region = String(club.region || "").trim();
const regionSido = String(club.regionSido || "").trim();
const regionGu = String(club.regionGu || "").trim();

// 3) 데모 유저 문서 (프로필 + 동의 + 관리자권한 + 팀 소속)
const ZERO = { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] };
const userDoc = {
  uid,
  name: "리뷰데모",
  nickname: "리뷰데모",
  email: DEMO_EMAIL,
  provider: "email",
  mainPosition: "guard",
  skillLevel: "intermediate",
  heightCm: 180,
  weightKg: 75,
  birthYear: 1995,
  intro: "리뷰 도구용 데모 계정입니다.",
  region, regionSido, regionGu,
  avatarUrl: "",
  activeTeamId: clubId,
  clubId,
  roleInTeam: "owner",
  isTeamCaptain: true,
  // 게이트 통과용 (리뷰 프레임 밖에서도 앱을 그냥 볼 수 있게)
  termsConsent: true,
  privacyConsent: true,
  ageOver14Consent: true,
  phoneVerified: true,
  phoneNumber: "01000000000",
  welcomeSeen: true,
  // 관리자 진입용 (커스텀클레임이 없을 때 userDoc.isAdmin 필드로 /admin 통과)
  isAdmin: true,
  isReviewDemo: true,
  stats: { ...ZERO, updatedAt: serverTimestamp() },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

// 데모를 이 팀의 클럽장(owner/captain)으로 — 기존 owner는 일반 멤버로 강등
const memberDoc = {
  uid, role: "owner", status: "active", isCaptain: true,
  joinedAt: serverTimestamp(), updatedAt: serverTimestamp(),
};
const prevOwnerUid = String(club.ownerUid || "").trim();

console.log("\n── 시드 계획 ──");
console.log(`  계정 : ${DEMO_EMAIL} / ${DEMO_PW}`);
console.log(`  UID  : ${uid}`);
console.log(`  팀   : ${club.name} (${clubId}) — 데모를 클럽장(owner)으로 승격`);
console.log(`  기존 owner: ${prevOwnerUid || "(없음)"} → 일반 멤버로 강등`);
console.log(`  권한 : isAdmin=true (관리자 진입 가능)`);
console.log(`  동의 : 약관·개인정보·만14세·전화인증 모두 true`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 적용하려면 --apply 붙여 재실행.");
  process.exit(0);
}

await setDoc(doc(db, "users", uid), userDoc, { merge: true });
await setDoc(doc(db, "clubs", clubId, "members", uid), memberDoc, { merge: true });
// 클럽 문서의 클럽장(ownerUid)을 데모로 교체
await setDoc(doc(db, "clubs", clubId), { ownerUid: uid, updatedAt: serverTimestamp() }, { merge: true });
// 기존 owner 를 일반 멤버로 강등 (데모와 다를 때만)
if (prevOwnerUid && prevOwnerUid !== uid) {
  await setDoc(doc(db, "clubs", clubId, "members", prevOwnerUid), { role: "member", isCaptain: false, updatedAt: serverTimestamp() }, { merge: true });
  const prevSnap = await getDoc(doc(db, "users", prevOwnerUid));
  if (prevSnap.exists()) {
    await setDoc(doc(db, "users", prevOwnerUid), { roleInTeam: "member", isTeamCaptain: false, updatedAt: serverTimestamp() }, { merge: true });
  }
}

console.log("\n✅ 완료!");
console.log(`   users/${uid} + clubs/${clubId}/members/${uid} 작성됨`);
console.log(`   → localhost:3000/review 에서 자동 로그인되어 데이터까지 보입니다.`);
process.exit(0);
