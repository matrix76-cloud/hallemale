// 리바운드5 팀이 날쎈초급 팀에게 "매칭 신청"을 보낸다 (테스트용).
// - 앱의 createMatchRequest(matchingService)와 동일한 match_requests 문서를 생성한다.
//   (status=pending / actorClubId=리바운드5 / targetClubId=날쎈초급 / 빈 라인업 + 사이즈)
// - 받은 매칭함 SSOT = match_requests 이므로 날쎈초급의 "받은 매칭"에 바로 뜬다.
// - notifications 2건 생성: 상대팀장(push ON) + 우리팀장 기록용(push OFF).
//   (notifications 조회는 targetIds array-contains uid)
// 사용: node scripts/rebound5-request-nalssen.mjs          → 조회만 (dry-run)
//       node scripts/rebound5-request-nalssen.mjs --apply  → 실제 신청

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
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
const ACTOR_KEYWORD = "리바운드5";
const TARGET_KEYWORD = "날쎈초급";
const MATCH_SIZE_KEY = "5v5";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toStr = (v) => String(v || "").trim();
const sizeLabel = (k) => (["3v3", "4v4", "5v5"].includes(toStr(k)) ? toStr(k).replace("v", " vs ") : "매칭");

const pickTeamSnapshot = (id, data) => ({
  clubId: toStr(data.clubId || id),
  name: toStr(data.name),
  region: toStr(data.region),
  logoUrl: toStr(data.logoUrl || data.photoUrl || ""),
});

const emptyLineupSnapshot = (matchSizeKey) => ({
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
const clubsSnap = await getDocs(collection(db, "clubs"));
const findClub = (kw) => clubsSnap.docs.find((d) => toStr(d.data()?.name).includes(kw));

const actorDoc = findClub(ACTOR_KEYWORD);
const targetDoc = findClub(TARGET_KEYWORD);

if (!actorDoc) {
  console.error(`❌ "${ACTOR_KEYWORD}" 팀을 clubs에서 찾지 못했습니다.`);
  process.exit(1);
}
if (!targetDoc) {
  console.error(`❌ "${TARGET_KEYWORD}" 팀을 clubs에서 찾지 못했습니다.`);
  process.exit(1);
}

const actorId = actorDoc.id;
const targetId = targetDoc.id;
const actorData = actorDoc.data() || {};
const targetData = targetDoc.data() || {};
const actorName = toStr(actorData.name) || ACTOR_KEYWORD;
const targetName = toStr(targetData.name) || TARGET_KEYWORD;
const actorOwnerUid = toStr(actorData.ownerUid);
const targetOwnerUid = toStr(targetData.ownerUid);

if (actorId === targetId) {
  console.error("❌ 같은 팀끼리는 신청할 수 없습니다.");
  process.exit(1);
}

// 멤버 수(참고용)
const actorMemSnap = await getDocs(collection(db, "clubs", actorId, "members"));
const targetMemSnap = await getDocs(collection(db, "clubs", targetId, "members"));

console.log(`✅ 신청 팀(actor) : ${actorName} (clubId=${actorId}) / 팀장=${actorOwnerUid || "(없음)"} / 멤버 ${actorMemSnap.size}명`);
console.log(`✅ 대상 팀(target): ${targetName} (clubId=${targetId}) / 팀장=${targetOwnerUid || "(없음)"} / 멤버 ${targetMemSnap.size}명`);
console.log(`   매치 사이즈: ${MATCH_SIZE_KEY}`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 신청하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// ===== 실제 반영 =====
const fromTeamSnapshot = pickTeamSnapshot(actorId, actorData);
const toTeamSnapshot = pickTeamSnapshot(targetId, targetData);
const fromLineupSnapshot = emptyLineupSnapshot(MATCH_SIZE_KEY);
const toLineupSnapshot = emptyLineupSnapshot(MATCH_SIZE_KEY);

// 1) match_requests 생성 (SSOT)
const matchRef = await addDoc(collection(db, "match_requests"), {
  actorClubId: actorId,
  targetClubId: targetId,
  status: "pending",
  matchSizeKey: MATCH_SIZE_KEY,
  fromTeamSnapshot,
  toTeamSnapshot,
  fromLineupSnapshot,
  toLineupSnapshot,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
const matchId = matchRef.id;
console.log(`\n  ✓ match_requests/${matchId} 생성 (status=pending)`);

// 2) 상대팀장 알림 (push ON)
const baseNoti = {
  key: "MATCH_REQUEST",
  kind: "match",
  subType: "matchRequest",
  targetScope: "team",
  prefsCategory: "match",
  deepLink: "/matchingmanage",
  readBy: {},
  matchId,
  actorClubId: actorId,
  targetClubId: targetId,
  matchSizeKey: MATCH_SIZE_KEY,
  fromTeamSnapshot,
  toTeamSnapshot,
  fromLineupSnapshot,
  toLineupSnapshot,
};

if (targetOwnerUid) {
  await addDoc(collection(db, "notifications"), {
    ...baseNoti,
    title: "매칭 신청 도착",
    body: `${actorName}이(가) ${sizeLabel(MATCH_SIZE_KEY)}을 신청했어요`,
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    clubId: targetId,
    direction: "received",
    targetIds: [targetOwnerUid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log("  ✓ 상대 팀장 알림 생성 (push ON)");
} else {
  console.log("  ⚠️ 상대 팀장 ownerUid 없음 → 알림 생략");
}

// 3) 우리팀장 기록용 알림 (push OFF)
if (actorOwnerUid) {
  await addDoc(collection(db, "notifications"), {
    ...baseNoti,
    title: "매칭 신청 완료",
    body: `${targetName}에 ${sizeLabel(MATCH_SIZE_KEY)}을 신청했어요`,
    push: { enabled: false, status: "skipped", sentAt: null, failReason: null },
    clubId: actorId,
    direction: "sent",
    targetIds: [actorOwnerUid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log("  ✓ 우리 팀장 기록용 알림 생성 (push OFF)");
}

console.log(`\n완료: ${actorName} → ${targetName} 매칭 신청 (match_requests/${matchId})`);
process.exit(0);
