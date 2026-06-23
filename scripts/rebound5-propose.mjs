// 리바운드5 팀 입장에서 구장·일정을 "제안(또는 수정 제안)" 한다 (테스트용).
// - 조율중(accepted/proposed) 매칭룸 중 리바운드5가 참가한 가장 최신 방을 찾는다.
// - proposeMatchSchedule(서비스)와 동일하게 status=proposed + field + scheduledAt + durationMin + proposedByClubId 로 갱신.
// - 채팅에 "구장·일정 (수정) 제안" 시스템 메시지 + 리바운드5 팀장 안내 메시지를 남긴다.
// 사용: node scripts/rebound5-propose.mjs          → 현재 상태 조회 (dry-run)
//       node scripts/rebound5-propose.mjs --apply  → 실제 제안 반영

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

// ===== 제안할 구장·일정 (수정 제안 값) =====
const PROPOSAL = {
  address: "서울 송파구 올림픽로 25 (잠실학생체육관)",
  lat: 37.5159,
  lng: 127.0731,
  scheduledAtISO: "2026-06-27T20:00:00+09:00", // 토요일 저녁 8시
  durationMin: 120,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toStr = (v) => String(v || "").trim();
const sortPair = (a, b) => [toStr(a), toStr(b)].filter(Boolean).sort();
const fmt = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}.${d.getDate()}(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 1) 리바운드5 club
const clubsSnap = await getDocs(collection(db, "clubs"));
const matches = clubsSnap.docs.filter((d) => toStr(d.data()?.name).includes(TEAM_KEYWORD));
if (!matches.length) {
  console.error(`❌ "${TEAM_KEYWORD}" 팀을 찾지 못했습니다.`);
  process.exit(1);
}
const reboundDoc = matches[0];
const reboundId = reboundDoc.id;
const reboundName = toStr(reboundDoc.data()?.name) || "리바운드5";
const reboundOwnerUid = toStr(reboundDoc.data()?.ownerUid);
console.log(`✅ 팀: ${reboundName} (clubId=${reboundId}) / 팀장 uid=${reboundOwnerUid || "(없음)"}`);

// 2) 조율중 방 중 리바운드5 참가 (최신)
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
  console.error("❌ 리바운드5가 참가한 조율중 매칭룸이 없습니다.");
  process.exit(1);
}
if (rooms.length > 1) {
  console.log(`⚠️  조율중 방 ${rooms.length}개 → 가장 최신 방 사용`);
}
const roomDoc = rooms[0];
const roomId = roomDoc.id;
const mr = roomDoc.data() || {};
const reboundIsActor = toStr(mr.actorClubId) === reboundId;
const oppClubId = reboundIsActor ? toStr(mr.targetClubId) : toStr(mr.actorClubId);
const oppName = toStr(reboundIsActor ? mr.toTeamSnapshot?.name : mr.fromTeamSnapshot?.name) || "상대팀";

console.log(`\n✅ 매칭룸: match_requests/${roomId}`);
console.log(`   ${reboundName} vs ${oppName} / status=${toStr(mr.status)}`);
console.log("\n── 현재 제안 상태 ──");
console.log(`   구장: ${toStr(mr.field?.address) || "(없음)"}`);
console.log(`   일정: ${mr.scheduledAt ? fmt(mr.scheduledAt) : "(없음)"}`);
console.log(`   제안한 팀(proposedByClubId): ${toStr(mr.proposedByClubId) || "(없음)"}`);

console.log("\n── 리바운드5가 새로 제안할 값 ──");
console.log(`   구장: ${PROPOSAL.address}`);
console.log(`   일정: ${fmt(PROPOSAL.scheduledAtISO)}`);
console.log(`   경기시간: ${PROPOSAL.durationMin}분`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 제안하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// ===== 실제 반영 (proposeMatchSchedule 핵심 로직) =====
const patch = {
  status: "proposed",
  scheduledAt: PROPOSAL.scheduledAtISO,
  field: { address: PROPOSAL.address, lat: PROPOSAL.lat, lng: PROPOSAL.lng },
  durationMin: PROPOSAL.durationMin,
  proposedByClubId: reboundId,
  proposedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastActivityAt: serverTimestamp(),
};
if (reboundOwnerUid) patch[`lastSeenBy.${reboundOwnerUid}`] = serverTimestamp();

await updateDoc(doc(db, "match_requests", roomId), patch);
console.log("\n  ✓ 구장·일정 제안 반영 (status=proposed)");

// 채팅 시스템/안내 메시지
const chatId = `match_${roomId}`;
const roomRef = doc(db, "chatRooms", chatId);
const roomSnap = await getDoc(roomRef);
const oppClub = oppClubId ? await getDoc(doc(db, "clubs", oppClubId)) : null;
const oppOwnerUid = toStr(oppClub?.exists() ? oppClub.data()?.ownerUid : "");

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
}

const guideText = `구장·일정을 수정 제안했어요 — ${PROPOSAL.address} / ${fmt(PROPOSAL.scheduledAtISO)}`;
await addDoc(collection(db, "chatRooms", chatId, "messages"), {
  chatId,
  fromUid: "system",
  kind: "system",
  text: `${reboundName} 팀이 구장·일정을 제안했어요 📍`,
  images: [],
  meta: { type: "schedule_proposed", clubId: reboundId },
  createdAt: serverTimestamp(),
});
await addDoc(collection(db, "chatRooms", chatId, "messages"), {
  chatId,
  fromUid: reboundOwnerUid,
  kind: "text",
  text: guideText,
  images: [],
  createdAt: serverTimestamp(),
});
await updateDoc(roomRef, {
  lastMessageText: guideText.slice(0, 140),
  lastMessageAt: serverTimestamp(),
  lastMessageFromUid: reboundOwnerUid,
  [`lastReadAtBy.${reboundOwnerUid}`]: serverTimestamp(),
  [`lastEnterAtBy.${reboundOwnerUid}`]: serverTimestamp(),
});
console.log("  ✓ 채팅 메시지(제안 안내) 전송");

console.log(`\n완료: ${reboundName} → 구장·일정 제안 (match_${roomId})`);
process.exit(0);
