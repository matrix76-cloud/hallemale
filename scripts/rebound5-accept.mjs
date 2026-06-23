// 리바운드5 팀 입장에서 "받은 매칭 신청(pending)"을 수락한다 (테스트용).
// - targetClubId === 리바운드5 이고 status === "pending" 인 match_requests 를 찾는다.
// - acceptMatchRequest(서비스)와 동일하게 status=accepted + acceptedAt + acceptedByClubId + lastActivityAt 로 갱신.
// - 리바운드5 팀장 lastSeenBy 갱신(수락한 나는 본 것으로 처리 → 상대팀에만 조율중 배지).
// Firestore 규칙이 전면 허용이라 클라이언트 SDK로 인증 없이 동작.
// 사용: node scripts/rebound5-accept.mjs          → 조회만 (dry-run)
//       node scripts/rebound5-accept.mjs --apply  → 실제 반영

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
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
const OPP_KEYWORD = "날쎈"; // 신청한 상대팀 이름에 이 키워드가 포함된 것 우선 수락

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toStr = (v) => String(v || "").trim();

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

// 2) 리바운드5가 "받은" pending 매칭 신청 찾기 (targetClubId === reboundId)
const mrSnap = await getDocs(collection(db, "match_requests"));
const pending = mrSnap.docs
  .filter((d) => {
    const x = d.data() || {};
    return toStr(x.status) === "pending" && toStr(x.targetClubId) === reboundId;
  })
  .sort((a, b) => {
    // 신청팀(actor=fromTeamSnapshot)이 OPP_KEYWORD 인 것 우선, 그다음 최신
    const aOpp = toStr(a.data()?.fromTeamSnapshot?.name).includes(OPP_KEYWORD) ? 1 : 0;
    const bOpp = toStr(b.data()?.fromTeamSnapshot?.name).includes(OPP_KEYWORD) ? 1 : 0;
    if (aOpp !== bOpp) return bOpp - aOpp;
    return (b.data()?.createdAt?.seconds || 0) - (a.data()?.createdAt?.seconds || 0);
  });

if (!pending.length) {
  console.error("❌ 리바운드5가 받은 'pending' 매칭 신청이 없습니다.");
  // 참고용: 리바운드5 관련 방 상태 덤프
  const related = mrSnap.docs.filter((d) => {
    const x = d.data() || {};
    return toStr(x.actorClubId) === reboundId || toStr(x.targetClubId) === reboundId;
  });
  if (related.length) {
    console.log("\n참고 — 리바운드5 관련 매칭룸:");
    related.forEach((d) => {
      const x = d.data() || {};
      const dir = toStr(x.targetClubId) === reboundId ? "받음" : "보냄";
      console.log(`  - ${d.id} [${dir}] ${toStr(x.fromTeamSnapshot?.name)} → ${toStr(x.toTeamSnapshot?.name)} (status=${toStr(x.status)})`);
    });
  }
  process.exit(1);
}

console.log(`\n받은 pending 신청 ${pending.length}건:`);
pending.forEach((d) => {
  const x = d.data() || {};
  console.log(`  - ${d.id}  ${toStr(x.fromTeamSnapshot?.name)} → ${toStr(x.toTeamSnapshot?.name)}  / ${toStr(x.matchSizeKey) || "?"}`);
});

const target = pending[0];
const roomId = target.id;
const mr = target.data() || {};
console.log(`\n✅ 수락 대상: match_requests/${roomId}`);
console.log(`   ${toStr(mr.fromTeamSnapshot?.name)}(신청) → ${reboundName}(받음)`);

if (!APPLY) {
  console.log("\n(dry-run) 실제 수락하려면 --apply 붙여서 다시 실행.");
  process.exit(0);
}

// ===== 실제 반영 (acceptMatchRequest 핵심 로직) =====
const patch = {
  status: "accepted",
  updatedAt: serverTimestamp(),
  acceptedAt: serverTimestamp(),
  acceptedByClubId: reboundId,
  lastActivityAt: serverTimestamp(),
};
if (reboundOwnerUid) patch[`lastSeenBy.${reboundOwnerUid}`] = serverTimestamp();

await updateDoc(doc(db, "match_requests", roomId), patch);
console.log(`\n✅ 수락 완료: ${reboundName} 가 신청을 수락 (status=accepted) → 조율중 매칭룸으로 이동`);
process.exit(0);
