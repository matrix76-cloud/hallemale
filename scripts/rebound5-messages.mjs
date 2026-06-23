// 리바운드5 팀장이 매칭룸 채팅에 메시지 여러 개를 보낸다 (테스트용).
// - 조율중(accepted/proposed) 방 중 리바운드5 참가 최신 방의 chatRooms/match_{roomId} 에 전송.
// - 마지막 메시지 메타 갱신 + 매칭 활동(lastActivityAt) 갱신(상대=날쎈초급이에 안 읽음 배지).
// 사용: node scripts/rebound5-messages.mjs --apply   (조회만: --apply 없이)

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
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
const TEAM_KEYWORD = "리바운드5";
const OPP_KEYWORD = "날쎈"; // 상대팀 이름에 이 키워드가 포함된 방 우선

const MESSAGES = [
  "안녕하세요! 매칭 수락했습니다 😊",
  "라인업이랑 구장은 천천히 맞춰봐요",
  "혹시 선호하시는 요일/시간 있으세요?",
  "저희는 주말 저녁이 제일 편해요 🏀",
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const toStr = (v) => String(v || "").trim();
const sortPair = (a, b) => [toStr(a), toStr(b)].filter(Boolean).sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) 리바운드5
const clubsSnap = await getDocs(collection(db, "clubs"));
const reboundDoc = clubsSnap.docs.find((d) => toStr(d.data()?.name).includes(TEAM_KEYWORD));
if (!reboundDoc) {
  console.error(`❌ "${TEAM_KEYWORD}" 팀을 찾지 못했습니다.`);
  process.exit(1);
}
const reboundId = reboundDoc.id;
const reboundName = toStr(reboundDoc.data()?.name) || "리바운드5";
const reboundOwnerUid = toStr(reboundDoc.data()?.ownerUid);
if (!reboundOwnerUid) {
  console.error("❌ 리바운드5 ownerUid 가 없어 메시지를 보낼 수 없습니다.");
  process.exit(1);
}
console.log(`✅ 팀: ${reboundName} / 팀장 uid=${reboundOwnerUid}`);

// 2) 조율중 방 (상대=OPP_KEYWORD 우선, 그다음 최신)
const mrSnap = await getDocs(collection(db, "match_requests"));
const oppNameOf = (x) =>
  toStr(toStr(x.actorClubId) === reboundId ? x.toTeamSnapshot?.name : x.fromTeamSnapshot?.name);
const rooms = mrSnap.docs
  .filter((d) => {
    const x = d.data() || {};
    const st = toStr(x.status);
    const joined = toStr(x.actorClubId) === reboundId || toStr(x.targetClubId) === reboundId;
    return joined && (st === "accepted" || st === "proposed" || st === "confirmed");
  })
  .sort((a, b) => {
    const aOpp = oppNameOf(a.data() || {}).includes(OPP_KEYWORD) ? 1 : 0;
    const bOpp = oppNameOf(b.data() || {}).includes(OPP_KEYWORD) ? 1 : 0;
    if (aOpp !== bOpp) return bOpp - aOpp; // OPP_KEYWORD 매칭 방 우선
    // 조율중(accepted/proposed) 방을 확정(confirmed)보다 우선
    const tier = (x) => (["accepted", "proposed"].includes(toStr(x.status)) ? 1 : 0);
    const at = tier(a.data() || {});
    const bt = tier(b.data() || {});
    if (at !== bt) return bt - at;
    return (b.data()?.createdAt?.seconds || 0) - (a.data()?.createdAt?.seconds || 0);
  });

if (!rooms.length) {
  console.error("❌ 리바운드5 조율중 매칭룸이 없습니다.");
  process.exit(1);
}
const roomDoc = rooms[0];
const roomId = roomDoc.id;
const mr = roomDoc.data() || {};
const reboundIsActor = toStr(mr.actorClubId) === reboundId;
const oppClubId = reboundIsActor ? toStr(mr.targetClubId) : toStr(mr.actorClubId);
const oppName = toStr(reboundIsActor ? mr.toTeamSnapshot?.name : mr.fromTeamSnapshot?.name) || "상대팀";
const chatId = `match_${roomId}`;

console.log(`\n✅ 매칭룸: match_requests/${roomId} (${reboundName} vs ${oppName})`);
console.log(`   채팅방: chatRooms/${chatId}`);
console.log(`   보낼 메시지 ${MESSAGES.length}개:`);
MESSAGES.forEach((m, i) => console.log(`     ${i + 1}. ${m}`));

if (!APPLY) {
  console.log("\n(dry-run) 실제 전송하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// 채팅방 보장
const roomRef = doc(db, "chatRooms", chatId);
const roomSnap = await getDoc(roomRef);
if (!roomSnap.exists()) {
  const oppClub = oppClubId ? await getDoc(doc(db, "clubs", oppClubId)) : null;
  const oppOwnerUid = toStr(oppClub?.exists() ? oppClub.data()?.ownerUid : "");
  await setDoc(roomRef, {
    id: chatId,
    type: "matchRoom",
    matchRoomId: roomId,
    participantUids: sortPair(reboundOwnerUid, oppOwnerUid),
    createdAt: serverTimestamp(),
    createdByUid: reboundOwnerUid,
    createdFrom: "matchRoom",
    createdFromRefId: roomId,
    lastMessageText: "",
    lastMessageAt: null,
    lastMessageFromUid: "",
    lastReadAtBy: {},
    firstEnterAtBy: {},
    lastEnterAtBy: {},
    remindersBy: {},
    mutedBy: {},
  });
  console.log("  ✓ 채팅방 문서 생성");
}

// 메시지 순차 전송 (createdAt 순서 보장 위해 약간 간격)
let last = "";
for (const text of MESSAGES) {
  await addDoc(collection(db, "chatRooms", chatId, "messages"), {
    chatId,
    fromUid: reboundOwnerUid,
    kind: "text",
    text,
    images: [],
    createdAt: serverTimestamp(),
  });
  last = text;
  console.log(`  ✓ 전송: ${text}`);
  await sleep(400);
}

// 방 메타 + 매칭 활동 갱신 (보낸 사람=읽음, 상대=안 읽음 배지)
await updateDoc(roomRef, {
  lastMessageText: last.slice(0, 140),
  lastMessageAt: serverTimestamp(),
  lastMessageFromUid: reboundOwnerUid,
  [`lastReadAtBy.${reboundOwnerUid}`]: serverTimestamp(),
  [`lastEnterAtBy.${reboundOwnerUid}`]: serverTimestamp(),
});
await updateDoc(doc(db, "match_requests", roomId), {
  lastActivityAt: serverTimestamp(),
  [`lastSeenBy.${reboundOwnerUid}`]: serverTimestamp(),
});
console.log("\n  ✓ 방 메타 + 매칭 활동 갱신");
console.log(`\n완료: ${reboundName} → 메시지 ${MESSAGES.length}개 전송 (match_${roomId})`);
process.exit(0);
