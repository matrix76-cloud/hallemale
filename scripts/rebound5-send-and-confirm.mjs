// 리바운드5 팀 입장에서 (1) 매칭룸 채팅 메시지 전송 + (2) 라인업 확정 을 수행한다 (테스트용).
// - 조율중(accepted/proposed) 매칭룸 중 리바운드5가 참가한 방을 찾는다.
// - 리바운드5의 라인업(fromLineupSnapshot 또는 toLineupSnapshot)을 confirmed:true 로 채운다.
// - chatRooms/match_{roomId} 에 "라인업 확정" 시스템 메시지 + 리바운드5 팀장의 채팅 메시지를 남긴다.
// - 리바운드5 팀장의 lastReadAtBy 를 now 로 갱신 → 상대(날쎈초급이) 화면에서 내 메시지가 "읽음" 으로 보임.
// ⚠️ firestore.rules 강화(2026-07)로 비로그인 쓰기 차단(allow write: if signedIn()) — 그대로 실행하면
//    PERMISSION_DENIED. 쓰기하려면 로그인 필요(add-ai-members.mjs 의 --email/--pw 방식 참고).
// 사용: node scripts/rebound5-send-and-confirm.mjs          → 조회만 (dry-run)
//       node scripts/rebound5-send-and-confirm.mjs --apply  → 실제 반영

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
const CHAT_TEXT = "저희 라인업 확정했어요! 토요일 경기 잘 부탁드립니다 🙌";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toStr = (v) => String(v || "").trim();
const sortPair = (a, b) => [toStr(a), toStr(b)].filter(Boolean).sort();
const sizeFromKey = (k) => {
  const m = toStr(k).toLowerCase().match(/^(\d+)\s*v\s*\d+$/);
  return m ? Number(m[1]) : 5;
};

// 1) 리바운드5 club 찾기
const clubsSnap = await getDocs(collection(db, "clubs"));
const matches = clubsSnap.docs.filter((d) => toStr(d.data()?.name).includes(TEAM_KEYWORD));
if (!matches.length) {
  console.error(`❌ 이름에 "${TEAM_KEYWORD}" 가 포함된 팀을 clubs에서 찾지 못했습니다.`);
  process.exit(1);
}
const reboundDoc = matches[0];
const reboundId = reboundDoc.id;
const reboundData = reboundDoc.data() || {};
const reboundName = toStr(reboundData.name) || "리바운드5";
const reboundOwnerUid = toStr(reboundData.ownerUid);
console.log(`✅ 팀: ${reboundName} (clubId=${reboundId}) / 팀장 uid=${reboundOwnerUid || "(없음)"}`);
if (!reboundOwnerUid) {
  console.error("❌ 리바운드5 ownerUid 가 없어 채팅 메시지를 보낼 수 없습니다.");
  process.exit(1);
}

// 2) 조율중 매칭룸(accepted/proposed) 중 리바운드5 참가 방 찾기 (최신)
const mrSnap = await getDocs(collection(db, "match_requests"));
const rooms = mrSnap.docs
  .filter((d) => {
    const x = d.data() || {};
    const st = toStr(x.status);
    const joined = toStr(x.actorClubId) === reboundId || toStr(x.targetClubId) === reboundId;
    return joined && (st === "accepted" || st === "proposed");
  })
  .sort((a, b) => (b.data()?.createdAt?.seconds || 0) - (a.data()?.createdAt?.seconds || 0));

if (!rooms.length) {
  console.error("❌ 리바운드5가 참가한 '조율중(accepted/proposed)' 매칭룸이 없습니다.");
  process.exit(1);
}
if (rooms.length > 1) {
  console.log(`⚠️  조율중 방이 ${rooms.length}개 → 가장 최신 방 사용:`);
  rooms.forEach((d) => {
    const x = d.data() || {};
    console.log(`     - ${d.id}  ${toStr(x.fromTeamSnapshot?.name)} vs ${toStr(x.toTeamSnapshot?.name)} (${toStr(x.status)})`);
  });
}
const roomDoc = rooms[0];
const roomId = roomDoc.id;
const mr = roomDoc.data() || {};

const reboundIsActor = toStr(mr.actorClubId) === reboundId;
const oppClubId = reboundIsActor ? toStr(mr.targetClubId) : toStr(mr.actorClubId);
const lineupField = reboundIsActor ? "fromLineupSnapshot" : "toLineupSnapshot";
const teamSnap = reboundIsActor ? mr.fromTeamSnapshot : mr.toTeamSnapshot;
const matchSizeKey = toStr(mr.matchSizeKey) || "5v5";
const size = sizeFromKey(matchSizeKey);
const oppName = toStr(reboundIsActor ? mr.toTeamSnapshot?.name : mr.fromTeamSnapshot?.name) || "상대팀";

console.log(`\n✅ 매칭룸: match_requests/${roomId}`);
console.log(`   ${reboundName}(${reboundIsActor ? "actor" : "target"}) vs ${oppName}  / ${matchSizeKey} / status=${toStr(mr.status)}`);
console.log(`   리바운드5 라인업 필드: ${lineupField} (현재 confirmed=${!!mr?.[lineupField]?.confirmed})`);

// 3) 리바운드5 멤버 → 주전 size명
const memSnap = await getDocs(collection(db, "clubs", reboundId, "members"));
let memberUids = memSnap.docs.map((d) => toStr(d.id)).filter(Boolean);
// 팀장 먼저
memberUids = [reboundOwnerUid, ...memberUids.filter((u) => u !== reboundOwnerUid)];
const starterUids = memberUids.slice(0, size);

const previewMembers = [];
for (const uid of starterUids) {
  const u = await getDoc(doc(db, "users", uid));
  const ud = u.exists() ? u.data() : {};
  previewMembers.push({
    userId: uid,
    nickname: toStr(ud.nickname) || "선수",
    photoUrl: toStr(ud.avatarUrl),
    mainPosition: toStr(ud.mainPosition),
  });
}
console.log(`\n   주전 ${starterUids.length}명 (사이즈 ${size}):`);
previewMembers.forEach((p, i) => console.log(`     ${i + 1}. ${p.nickname} (${p.userId})`));

// 4) 상대 팀장 uid (채팅방 participant 구성용)
const oppClub = oppClubId ? await getDoc(doc(db, "clubs", oppClubId)) : null;
const oppOwnerUid = toStr(oppClub?.exists() ? oppClub.data()?.ownerUid : "");

const chatId = `match_${roomId}`;
console.log(`\n   채팅방: chatRooms/${chatId}  (참가자: ${reboundOwnerUid}, ${oppOwnerUid || "?"})`);
console.log(`   보낼 메시지: "${CHAT_TEXT}"`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 반영하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// ===== 실제 반영 =====

// 4-1) 라인업 확정
const lineupSnapshot = {
  id: `lineup_${reboundId}`,
  name: `${reboundName} 라인업`,
  matchSizeKey,
  memberIds: starterUids,
  memberCount: starterUids.length,
  previewMembers,
  subMemberIds: [],
  subPreviewMembers: [],
  confirmed: true,
  confirmedAt: serverTimestamp(),
};
await updateDoc(doc(db, "match_requests", roomId), {
  [lineupField]: lineupSnapshot,
  updatedAt: serverTimestamp(),
  lastActivityAt: serverTimestamp(),
  [`lastSeenBy.${reboundOwnerUid}`]: serverTimestamp(),
});
console.log("  ✓ 라인업 확정 반영");

// 4-2) 채팅방 문서 보장 (없으면 생성)
const roomRef = doc(db, "chatRooms", chatId);
const roomSnap = await getDoc(roomRef);
if (!roomSnap.exists()) {
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

// 4-3) 라인업 확정 시스템 메시지
await addDoc(collection(db, "chatRooms", chatId, "messages"), {
  chatId,
  fromUid: "system",
  kind: "system",
  text: `${reboundName} 팀이 라인업을 확정했어요 ✅`,
  images: [],
  meta: { type: "lineup_confirmed", clubId: reboundId },
  createdAt: serverTimestamp(),
});
console.log("  ✓ 시스템 메시지(라인업 확정) 전송");

// 4-4) 리바운드5 팀장의 채팅 메시지
await addDoc(collection(db, "chatRooms", chatId, "messages"), {
  chatId,
  fromUid: reboundOwnerUid,
  kind: "text",
  text: CHAT_TEXT,
  images: [],
  createdAt: serverTimestamp(),
});
console.log("  ✓ 채팅 메시지 전송 (리바운드5 팀장)");

// 4-5) 방 메타 갱신 + 리바운드5 팀장 읽음시각 갱신(상대 메시지 → "읽음")
await updateDoc(roomRef, {
  lastMessageText: CHAT_TEXT.slice(0, 140),
  lastMessageAt: serverTimestamp(),
  lastMessageFromUid: reboundOwnerUid,
  [`lastReadAtBy.${reboundOwnerUid}`]: serverTimestamp(),
  [`lastEnterAtBy.${reboundOwnerUid}`]: serverTimestamp(),
});
console.log("  ✓ 방 메타 + 읽음시각 갱신");

console.log(`\n완료: ${reboundName} → 라인업 확정 + 메시지 전송 (match_${roomId})`);
process.exit(0);
