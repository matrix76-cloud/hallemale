// 행렬(kakao:4941822135 / kkan22@naver.com) → "다산왕" 팀장으로 이동
//
//  1) 리바운드5: 팀장을 가장 먼저 합류한 팀원에게 이임하고 행렬은 탈퇴
//     (src/services/clubLeaderService.js 의 pickHeirUid + transferLeadershipOnWithdraw 동작 그대로)
//  2) 다산왕: 행렬을 멤버로 추가한 뒤 팀장 이임, 기존 AI 팀장은 일반 팀원으로 강등
//     (src/services/clubLeaderService.js 의 transferTeamLeader 동작 그대로)
//
// 사용:
//   node scripts/move-haengryeol-to-dasan.mjs            # dry-run (읽기만, 계획 출력)
//   node scripts/move-haengryeol-to-dasan.mjs --commit   # 실제 쓰기

import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, getDocs, doc, getDoc,
  writeBatch, serverTimestamp, query, where, arrayRemove,
} from "firebase/firestore";
import { writeFileSync } from "node:fs";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const db = getFirestore(initializeApp(firebaseConfig));

const COMMIT = process.argv.includes("--commit");

const USER = "kakao:4941822135";        // 행렬 / kkan22@naver.com
const REBOUND5 = "Qi3p8WeTw8nhdls1ViFC"; // 현재 팀장으로 있는 팀
const DASAN = "Ej2fnm7WPFq5xROaDXb1";    // 옮겨갈 팀

const tsToMillis = (v) => {
  try {
    if (v && typeof v.toMillis === "function") return v.toMillis();
  } catch {}
  return Number.MAX_SAFE_INTEGER;
};

/** clubLeaderService.pickHeirUid 와 동일: 본인 제외, joinedAt 가장 이른 멤버 (동률이면 문서순 첫번째) */
async function pickHeir(clubId, excludeUid) {
  const snap = await getDocs(collection(db, "clubs", clubId, "members"));
  let heir = "";
  let best = Infinity;
  snap.forEach((d) => {
    const data = d.data() || {};
    const uid = String(data.uid || data.userId || d.id);
    if (!uid || uid === excludeUid) return;
    const ms = tsToMillis(data.joinedAt || data.createdAt);
    if (ms < best) { best = ms; heir = uid; }
  });
  return heir;
}

const nick = async (uid) => {
  const s = await getDoc(doc(db, "users", uid));
  const v = s.exists() ? s.data() : {};
  return v.nickname || v.displayName || "?";
};

(async () => {
  // ── 사전 검증 ────────────────────────────────────────────
  const [rbSnap, dsSnap, meSnap] = await Promise.all([
    getDoc(doc(db, "clubs", REBOUND5)),
    getDoc(doc(db, "clubs", DASAN)),
    getDoc(doc(db, "users", USER)),
  ]);
  if (!rbSnap.exists()) throw new Error("리바운드5 클럽 없음");
  if (!dsSnap.exists()) throw new Error("다산왕 클럽 없음");
  if (!meSnap.exists()) throw new Error("대상 사용자 없음");

  const rb = rbSnap.data() || {};
  const ds = dsSnap.data() || {};
  const me = meSnap.data() || {};

  if (me.email !== "kkan22@naver.com") throw new Error(`대상 이메일 불일치: ${me.email}`);
  if (String(rb.ownerUid || rb.ownerId) !== USER) throw new Error(`리바운드5 팀장이 ${USER} 가 아님`);
  if (String(ds.name) !== "다산왕") throw new Error(`다산왕 이름 불일치: ${ds.name}`);

  const dsOwner = String(ds.ownerUid || ds.ownerId || "");
  if (!dsOwner) throw new Error("다산왕 ownerUid 없음");
  if (dsOwner === USER) throw new Error("이미 다산왕 팀장임");

  const heir = await pickHeir(REBOUND5, USER);
  if (!heir) throw new Error("리바운드5 후계자 없음 (혼자뿐인 팀?)");

  // 다산왕에 이미 멤버인지 (재실행 안전)
  const alreadyMember = (await getDoc(doc(db, "clubs", DASAN, "members", USER))).exists();

  console.log("=== 계획 ===");
  console.log(`  대상: ${USER} "${await nick(USER)}" (${me.email})`);
  console.log(`  [1] 리바운드5(${REBOUND5}) 팀장 이임: ${USER} → ${heir} "${await nick(heir)}"`);
  console.log(`      + 리바운드5 members/${USER} 문서 삭제 (탈퇴)`);
  console.log(`  [2] 다산왕(${DASAN}) 멤버 추가: ${USER} ${alreadyMember ? "(이미 멤버 → merge)" : "(신규)"}`);
  console.log(`  [3] 다산왕 팀장 이임: ${dsOwner} "${await nick(dsOwner)}" → ${USER} (기존 팀장은 role=member 강등)`);
  console.log(`  [4] ${USER} 알림 targetIds 정리 (리바운드5 팀장 시절 알림 오작동 방지)`);

  // ── 백업 ────────────────────────────────────────────────
  const rbMembers = await getDocs(collection(db, "clubs", REBOUND5, "members"));
  const dsMembers = await getDocs(collection(db, "clubs", DASAN, "members"));
  const heirUserSnap = await getDoc(doc(db, "users", heir));
  const dsOwnerUserSnap = await getDoc(doc(db, "users", dsOwner));

  const backup = {
    takenAt: new Date().toISOString(),
    clubs: { [REBOUND5]: rb, [DASAN]: ds },
    members: {
      [REBOUND5]: Object.fromEntries(rbMembers.docs.map((d) => [d.id, d.data()])),
      [DASAN]: Object.fromEntries(dsMembers.docs.map((d) => [d.id, d.data()])),
    },
    users: {
      [USER]: me,
      [heir]: heirUserSnap.exists() ? heirUserSnap.data() : null,
      [dsOwner]: dsOwnerUserSnap.exists() ? dsOwnerUserSnap.data() : null,
    },
  };
  const backupPath = `scripts/.backup-move-haengryeol-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
  console.log(`\n  백업 저장: ${backupPath}`);

  if (!COMMIT) {
    console.log("\n[dry-run] 쓰기 없음. 실행하려면 --commit 을 붙이세요.");
    process.exit(0);
  }

  // ── [1] 리바운드5: 후계자 승격 + 행렬 탈퇴 ────────────────
  {
    const batch = writeBatch(db);
    const clubUpdate = { ownerUid: heir, updatedAt: serverTimestamp() };

    // 비정규화 members[] 배열이 있으면 거기서도 제거
    const arr = Array.isArray(rb.members) ? rb.members : [];
    const nextArr = arr.filter((m) => String(m?.userId || m?.id || m?.uid || "") !== USER);
    if (nextArr.length !== arr.length) clubUpdate.members = nextArr;

    batch.update(doc(db, "clubs", REBOUND5), clubUpdate);
    batch.delete(doc(db, "clubs", REBOUND5, "members", USER));
    batch.set(
      doc(db, "clubs", REBOUND5, "members", heir),
      { uid: heir, role: "owner", isCaptain: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
    batch.set(
      doc(db, "users", heir),
      { roleInTeam: "owner", isTeamCaptain: true, activeTeamId: REBOUND5, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await batch.commit();
    console.log("  [1] 리바운드5 이임/탈퇴 완료");
  }

  // ── [2][3] 다산왕: 멤버 추가 + 팀장 이임 ──────────────────
  {
    const batch = writeBatch(db);
    batch.update(doc(db, "clubs", DASAN), { ownerUid: USER, updatedAt: serverTimestamp() });

    const newMember = {
      uid: USER, role: "owner", isCaptain: true, status: "active",
      updatedAt: serverTimestamp(),
    };
    if (!alreadyMember) newMember.joinedAt = serverTimestamp();
    batch.set(doc(db, "clubs", DASAN, "members", USER), newMember, { merge: true });

    batch.set(
      doc(db, "clubs", DASAN, "members", dsOwner),
      { uid: dsOwner, role: "member", isCaptain: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
    batch.set(
      doc(db, "users", USER),
      { roleInTeam: "owner", isTeamCaptain: true, activeTeamId: DASAN, updatedAt: serverTimestamp() },
      { merge: true }
    );
    batch.set(
      doc(db, "users", dsOwner),
      { roleInTeam: "member", isTeamCaptain: false, activeTeamId: DASAN, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await batch.commit();
    console.log("  [2][3] 다산왕 합류 + 팀장 이임 완료");
  }

  // ── [4] 이전 팀장 시절 알림 정리 (best-effort) ────────────
  try {
    const snap = await getDocs(
      query(collection(db, "notifications"), where("targetIds", "array-contains", USER))
    );
    const ids = snap.docs.map((d) => d.id);
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      ids.slice(i, i + 400).forEach((nid) =>
        batch.update(doc(db, "notifications", nid), {
          targetIds: arrayRemove(USER),
          updatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
    }
    console.log(`  [4] 알림 ${ids.length}건 정리 완료`);
  } catch (e) {
    console.warn("  [4] 알림 정리 실패(무시):", e?.message || e);
  }

  console.log("\n완료.");
  process.exit(0);
})().catch((e) => {
  console.error("\n실패:", e?.message || e);
  process.exit(1);
});
