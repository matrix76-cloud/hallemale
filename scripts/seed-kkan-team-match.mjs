// kkan2222(구글) 계정을 '팀장 + 조율중(accepted) 매칭'에 연결한다 — 구장 정하기 테스트용.
// - kkan2222 소유 클럽 생성(없으면) + 본인 멤버 등록 + users.activeTeamId 세팅
// - 상대팀(기존 클럽) 과 status=accepted 매칭룸 생성
// 사용: node scripts/seed-kkan-team-match.mjs            (실제 적용)
//       node scripts/seed-kkan-team-match.mjs --clean    (이 스크립트가 만든 데이터 제거)
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, getDocs, getDoc, doc, setDoc, addDoc,
  query, where, serverTimestamp, deleteDoc, updateDoc,
} from "firebase/firestore";

const app = initializeApp({ apiKey:"AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU", authDomain:"halle-bf789.firebaseapp.com", projectId:"halle-bf789", storageBucket:"halle-bf789.firebasestorage.app", messagingSenderId:"939913723928", appId:"1:939913723928:web:7c25c0cf712f266d1cc36d" });
const db = getFirestore(app);

const KKAN_UID = "akDknP5TC3P8nzc2iHJwD71JhXV2"; // kkan2222@gmail.com (google)
const KKAN_CLUB_ID = "kkan_test_team";            // 고정 docId (재실행 안전)
const CLEAN = process.argv.includes("--clean");
const s = (v) => String(v || "").trim();

function teamSnapshot(id, d) {
  return { clubId: id, name: s(d?.name), region: s(d?.region), logoUrl: s(d?.logoUrl || d?.photoUrl || "") };
}
const emptyLineup = (k="5v5") => ({ id:"", name:"", matchSizeKey:k, memberIds:[], memberCount:0, previewMembers:[], subMemberIds:[], subPreviewMembers:[], confirmed:false });

const POS = ["PG","SG","SF","PF","C"];
function fakeMembers(prefix, n, first=null) {
  const arr = first ? [first] : [];
  for (let i = arr.length; i < n; i++) {
    arr.push({ userId: `${prefix}_m${i+1}`, nickname: `${prefix}선수${i+1}`, photoUrl: "", mainPosition: POS[i % 5] });
  }
  return arr;
}
function confirmedLineup(matchSizeKey, members) {
  return {
    id: "main", name: "기본 라인업", matchSizeKey,
    memberIds: members.map((m) => m.userId), memberCount: members.length,
    previewMembers: members, subMemberIds: [], subPreviewMembers: [],
    confirmed: true,
  };
}

async function clean() {
  // kkan 클럽이 actor/target 인 매칭 제거
  for (const f of ["actorClubId", "targetClubId"]) {
    const snap = await getDocs(query(collection(db, "match_requests"), where(f, "==", KKAN_CLUB_ID)));
    for (const d of snap.docs) await deleteDoc(d.ref).catch(()=>{});
  }
  await deleteDoc(doc(db, "clubs", KKAN_CLUB_ID, "members", KKAN_UID)).catch(()=>{});
  await deleteDoc(doc(db, "clubs", KKAN_CLUB_ID)).catch(()=>{});
  await setDoc(doc(db, "users", KKAN_UID), { activeTeamId: "" }, { merge: true }).catch(()=>{});
  console.log("🧹 kkan 팀/매칭 정리 완료");
}

async function main() {
  if (CLEAN) { await clean(); process.exit(0); }

  // 0) 유저 닉네임
  const userSnap = await getDoc(doc(db, "users", KKAN_UID));
  if (!userSnap.exists()) { console.error(`❌ users/${KKAN_UID} 없음 — kkan2222로 한 번 로그인 필요`); process.exit(1); }
  const nickname = s(userSnap.data()?.nickname) || "행렬이형";
  const region = s(userSnap.data()?.region) || "서울 성북구";

  // 1) kkan 클럽 생성/갱신 (ownerUid=kkan → 팀장)
  const memberSummary = { userId: KKAN_UID, nickname, photoUrl: "", mainPosition: "" };
  await setDoc(doc(db, "clubs", KKAN_CLUB_ID), {
    name: "카스 농구단",
    region, regionSido: "서울", regionGu: "성북구",
    description: "테스트용 팀 (구장 예약 흐름 점검)",
    tags: [], promo: "",
    logoUrl: "", logoPath: "",
    ownerUid: KKAN_UID,
    stats: { totalMatches: 0, wins: 0, losses: 0, draws: 0, winRate: 0, recentResults: [], updatedAt: serverTimestamp() },
    activity: { days: ["토","일"], time: "오전" },
    members: [memberSummary],
    memberIds: [KKAN_UID],
    memberCount: 1,
    lineups: [{
      id: "main", name: "기본 라인업", matchSizeKey: "5v5",
      memberIds: [KKAN_UID], memberCount: 1,
      previewMembers: [memberSummary], source: "user",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }],
    media: [],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });

  // 2) 멤버 서브문서 + 본인 activeTeamId
  await setDoc(doc(db, "clubs", KKAN_CLUB_ID, "members", KKAN_UID), {
    uid: KKAN_UID, nickname, avatarUrl: "", role: "owner", joinedAt: serverTimestamp(),
  }, { merge: true });
  await setDoc(doc(db, "users", KKAN_UID), {
    activeTeamId: KKAN_CLUB_ID, roleInTeam: "owner", isTeamCaptain: true, updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log(`✅ 팀 생성: 카스 농구단 (ownerUid=kkan) + activeTeamId 세팅`);

  // 3) 상대팀 찾기 (kkan 클럽 아닌 첫 클럽)
  const all = await getDocs(collection(db, "clubs"));
  const target = all.docs.find((d) => d.id !== KKAN_CLUB_ID && s(d.data()?.name));
  if (!target) { console.error("❌ 상대팀으로 쓸 다른 클럽이 없음"); process.exit(1); }
  console.log(`✅ 상대팀: ${s(target.data()?.name)} (${target.id})`);

  // 4) 라인업 확정된 스냅샷 (라인업 단계 건너뛰고 바로 구장 선택으로)
  const kkanMember = { userId: KKAN_UID, nickname, photoUrl: "", mainPosition: "PG" };
  const fromLU = confirmedLineup("5v5", fakeMembers("카스", 5, kkanMember));
  const toLU = confirmedLineup("5v5", fakeMembers(s(target.data()?.name) || "상대", 5));

  const fromSnap = teamSnapshot(KKAN_CLUB_ID, { name: "카스 농구단", region, logoUrl: "" });
  const toSnap = teamSnapshot(target.id, target.data());

  // 이미 조율중 매칭 있으면 라인업만 확정으로 업데이트, 없으면 생성
  const exist = await getDocs(query(collection(db, "match_requests"), where("actorClubId", "==", KKAN_CLUB_ID)));
  const already = exist.docs.find((d) => d.data()?.status === "accepted");
  if (already) {
    await updateDoc(already.ref, {
      fromLineupSnapshot: fromLU, toLineupSnapshot: toLU, matchSizeKey: "5v5", updatedAt: serverTimestamp(),
    });
    console.log(`✅ 기존 매칭 라인업 확정 처리 (match_requests/${already.id})`);
    console.log("\n→ kkan2222로 로그인 → 조율중 경기 → 라인업 done → 바로 구장 정하기");
    process.exit(0);
  }

  const ref = await addDoc(collection(db, "match_requests"), {
    actorClubId: KKAN_CLUB_ID, targetClubId: target.id,
    status: "accepted", matchSizeKey: "5v5",
    fromTeamSnapshot: fromSnap, toTeamSnapshot: toSnap,
    fromLineupSnapshot: fromLU, toLineupSnapshot: toLU,
    acceptedByClubId: target.id, acceptedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  console.log(`✅ 조율중(라인업 확정) 매칭 생성: 카스 농구단 vs ${toSnap.name} (match_requests/${ref.id})`);
  console.log("\n→ kkan2222로 로그인 → 조율중 경기 → 라인업 done → 바로 구장 정하기");
  process.exit(0);
}

main().catch((e) => { console.error("실패:", e); process.exit(1); });
