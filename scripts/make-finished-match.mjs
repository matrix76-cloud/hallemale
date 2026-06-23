// 청춘사자 vs 날쎈초급 경기를 "종료(finished)" 처리한다. (시간대 과거로 이동)
// - match_requests/{id} 에 status="finished" 문서 생성 (라인업 스냅샷 memberIds 포함)
// - 양 팀 clubs.stats + 참가 선수 users.stats 반영 (acceptMatchResult 로직 미러)
// - scheduledAt/createdAt/confirmedAt/updatedAt 을 과거로 설정 → "지난 경기" 탭에 노출
// 재실행 안전: 고정 docId + statsAppliedAt 가드(이미 반영됐으면 stats 중복 적용 안 함)
//
// 사용: node scripts/make-finished-match.mjs          → 조회/계획만 (dry-run)
//       node scripts/make-finished-match.mjs --apply  → 실제 생성/반영

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
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

// === 경기 설정 ===
const ACTOR_KEYWORD = "청춘사자"; // 신청팀(=myScore 주인)
const TARGET_KEYWORD = "날쎈"; // 상대팀 (날쎈초급 매칭)
const ACTOR_SCORE = 21; // 청춘사자 점수
const TARGET_SCORE = 15; // 날쎈초급 점수
const DAYS_AGO = 10; // 며칠 전 경기로 처리할지
const FIELD_ADDRESS = "경기 수원시 영통구 영통체육공원 농구장";

const toStr = (v) => String(v || "").trim();
const safeNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const normPos = (p) => {
  const v = toStr(p).toLowerCase();
  if (v === "g" || v.includes("guard") || v.includes("가드")) return "guard";
  if (v === "f" || v.includes("forward") || v.includes("포워드")) return "forward";
  if (v === "c" || v.includes("center") || v.includes("센터")) return "center";
  return "";
};
const sizeKeyByCount = (n) => (n >= 5 ? "5v5" : n === 4 ? "4v4" : "3v3");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---- 팀 찾기 ----
const allSnap = await getDocs(collection(db, "clubs"));
const findClub = (keyword) => {
  const ms = allSnap.docs.filter((d) => String(d.data()?.name || "").includes(keyword));
  return ms;
};

function pickOne(keyword) {
  const ms = findClub(keyword);
  if (ms.length === 0) {
    console.error(`❌ 이름에 "${keyword}" 포함 팀을 찾지 못했습니다. 전체 팀 목록:`);
    allSnap.docs.forEach((d) => console.error(`     - ${d.id}  ${d.data()?.name}`));
    process.exit(1);
  }
  if (ms.length > 1) {
    console.log(`⚠️  "${keyword}" 포함 팀 ${ms.length}개 → 첫 번째 사용:`);
    ms.forEach((d) => console.log(`     - ${d.id}  ${d.data()?.name}`));
  }
  return ms[0];
}

const actorDoc = pickOne(ACTOR_KEYWORD);
const targetDoc = pickOne(TARGET_KEYWORD);
const actorClubId = actorDoc.id;
const targetClubId = targetDoc.id;
const actorClub = actorDoc.data() || {};
const targetClub = targetDoc.data() || {};

console.log(`✅ 신청팀(actor): ${actorClub.name} (${actorClubId})`);
console.log(`✅ 상대팀(target): ${targetClub.name} (${targetClubId})`);

// ---- 멤버 로드 (owner 는 라인업 뒤로 → 더미 선수 우선 포함) ----
async function loadMembers(clubId) {
  const memSnap = await getDocs(collection(db, "clubs", clubId, "members"));
  const refs = memSnap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
  const withUser = [];
  for (const r of refs) {
    const us = await getDoc(doc(db, "users", r.uid));
    withUser.push({ ref: r, user: us.exists() ? us.data() || {} : {} });
  }
  // owner/captain 을 뒤로 보내 더미 선수가 라인업에 우선 포함되도록 정렬
  withUser.sort((a, b) => {
    const ao = a.ref.role === "owner" ? 1 : 0;
    const bo = b.ref.role === "owner" ? 1 : 0;
    return ao - bo;
  });
  return withUser;
}

const actorMembers = await loadMembers(actorClubId);
const targetMembers = await loadMembers(targetClubId);

console.log(`\n${actorClub.name} 멤버 ${actorMembers.length}명 / ${targetClub.name} 멤버 ${targetMembers.length}명`);

const size = Math.min(actorMembers.length, targetMembers.length, 5);
if (size < 3) {
  console.error(`❌ 양 팀 모두 최소 3명이 필요합니다. (가능 인원=${size})`);
  process.exit(1);
}
const matchSizeKey = sizeKeyByCount(size);
console.log(`→ 매치 사이즈: ${matchSizeKey} (각 팀 ${size}명)`);

// ---- 스냅샷 빌더 ----
function teamSnapshot(clubId, club) {
  return {
    clubId,
    name: toStr(club.name),
    region: toStr(club.region),
    regionSido: toStr(club.regionSido),
    regionGu: toStr(club.regionGu),
    logoUrl: toStr(club.logoUrl || club.photoUrl || ""),
  };
}

function lineupSnapshot(members, n) {
  const chosen = members.slice(0, n);
  const memberIds = chosen.map((m) => toStr(m.ref.uid)).filter(Boolean);
  const previewMembers = chosen.map((m) => ({
    userId: toStr(m.ref.uid),
    nickname: toStr(m.user.nickname),
    photoUrl: toStr(m.user.avatarUrl || m.user.photoUrl || ""),
    mainPosition: normPos(m.user.mainPosition),
    heightCm: m.user.heightCm != null ? safeNum(m.user.heightCm, null) : null,
    weightKg: m.user.weightKg != null ? safeNum(m.user.weightKg, null) : null,
  }));
  return {
    id: "",
    name: "",
    matchSizeKey,
    memberIds,
    memberCount: memberIds.length,
    previewMembers,
    subMemberIds: [],
    subPreviewMembers: [],
    confirmed: true,
  };
}

const fromTeamSnapshot = teamSnapshot(actorClubId, actorClub);
const toTeamSnapshot = teamSnapshot(targetClubId, targetClub);
const fromLineupSnapshot = lineupSnapshot(actorMembers, size);
const toLineupSnapshot = lineupSnapshot(targetMembers, size);

// 결과(승패)
let actorResult = "D";
let targetResult = "D";
if (ACTOR_SCORE > TARGET_SCORE) {
  actorResult = "W";
  targetResult = "L";
} else if (ACTOR_SCORE < TARGET_SCORE) {
  actorResult = "L";
  targetResult = "W";
}

// 과거 시각
// ⚠️ scheduledAt 은 앱(proposeMatchSchedule)이 ISO "문자열"로 저장 → 상세 페이지가 new Date(room.scheduledAt) 로 파싱.
//    Firestore Timestamp 로 저장하면 new Date(Timestamp) = Invalid Date → toISOString RangeError.
const scheduledDate = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000);
const scheduledISO = scheduledDate.toISOString();
// createdAt/confirmedAt 등 정렬용 메타는 Timestamp 로 둬도 됨(tsMs/toDate 로만 읽음)
const scheduledTs = Timestamp.fromDate(scheduledDate);

const matchId = `demo_finished_${actorClubId}_${targetClubId}`;

console.log(`\n경기 결과: ${actorClub.name} ${ACTOR_SCORE} : ${TARGET_SCORE} ${targetClub.name}  (${actorResult}/${targetResult})`);
console.log(`경기 일시: ${scheduledDate.toISOString().slice(0, 10)} (${DAYS_AGO}일 전)`);
console.log(`docId: ${matchId}`);
console.log(`actor 라인업: ${fromLineupSnapshot.previewMembers.map((p) => p.nickname).join(", ")}`);
console.log(`target 라인업: ${toLineupSnapshot.previewMembers.map((p) => p.nickname).join(", ")}`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 처리하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// ---- 중복 가드 ----
const existing = await getDoc(doc(db, "match_requests", matchId));
if (existing.exists() && existing.data()?.statsAppliedAt) {
  console.log("\n⏩ 이미 종료 처리 + stats 반영된 경기입니다. 중복 적용 방지를 위해 중단.");
  process.exit(0);
}

// ---- stats 반영 헬퍼 (computeNextStats 미러) ----
function nextStats(prev, result) {
  const p = prev && typeof prev === "object" ? prev : {};
  const wins = safeNum(p.wins, 0) + (result === "W" ? 1 : 0);
  const losses = safeNum(p.losses, 0) + (result === "L" ? 1 : 0);
  const draws = safeNum(p.draws, 0) + (result === "D" ? 1 : 0);
  const prevTotal = safeNum(p.totalMatches, safeNum(p.wins, 0) + safeNum(p.losses, 0) + safeNum(p.draws, 0));
  const totalMatches = prevTotal + 1;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;
  const recentRaw = Array.isArray(p.recentResults) ? p.recentResults : [];
  const recent = recentRaw.map((x) => toStr(x).toUpperCase()).filter((v) => ["W", "L", "D"].includes(v));
  const recentResults = [result, ...recent].slice(0, 5);
  return { ...p, wins, losses, draws, totalMatches, winRate, recentResults, updatedAt: serverTimestamp() };
}

async function applyClubStats(clubId, club, result) {
  const cur = club.stats || {};
  await setDoc(
    doc(db, "clubs", clubId),
    { stats: nextStats(cur, result), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

async function applyUserStats(members, n, result) {
  const chosen = members.slice(0, n);
  for (const m of chosen) {
    const cur = m.user.stats || {};
    await setDoc(
      doc(db, "users", m.ref.uid),
      { stats: nextStats(cur, result), updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
}

// ---- 1) match_requests 문서 생성 (finished) ----
await setDoc(doc(db, "match_requests", matchId), {
  actorClubId,
  targetClubId,
  status: "finished",
  resultState: "confirmed",
  matchSizeKey,

  fromTeamSnapshot,
  toTeamSnapshot,
  fromLineupSnapshot,
  toLineupSnapshot,

  myScore: ACTOR_SCORE,
  oppScore: TARGET_SCORE,

  field: { address: FIELD_ADDRESS, lat: null, lng: null },
  durationMin: 60,

  proposedByClubId: actorClubId,
  confirmedByClubId: targetClubId,

  result: {
    submittedByClubId: actorClubId,
    authorUid: "",
    authorName: "",
    authorRole: "",
    comment: "좋은 경기 감사합니다!",
    photoUrls: [],
    opponentRating: 5,
    submittedAt: scheduledTs,
  },

  scheduledAt: scheduledISO, // ✅ ISO 문자열 (앱 규약)
  createdAt: scheduledTs,
  acceptedAt: scheduledTs,
  confirmedAt: scheduledTs,
  proposedAt: scheduledTs,
  resultAcceptedByClubId: targetClubId,
  resultAcceptedAt: scheduledTs,
  statsAppliedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
console.log("\n  ✓ match_requests 문서 생성 (finished)");

// ---- 2) stats 반영 ----
await applyClubStats(actorClubId, actorClub, actorResult);
await applyClubStats(targetClubId, targetClub, targetResult);
console.log("  ✓ 양 팀 clubs.stats 반영");

await applyUserStats(actorMembers, size, actorResult);
await applyUserStats(targetMembers, size, targetResult);
console.log("  ✓ 참가 선수 users.stats 반영");

console.log(`\n완료: ${actorClub.name} ${ACTOR_SCORE}:${TARGET_SCORE} ${targetClub.name} 경기를 ${DAYS_AGO}일 전 종료 경기로 처리했습니다.`);
process.exit(0);
