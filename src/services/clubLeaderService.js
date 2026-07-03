/* eslint-disable */
// src/services/clubLeaderService.js
// ✅ 팀장 권한 이임(팀원에게) 전용 서비스
// - 페이지에서 DB 직접 접근 금지 준수
// - clubs/{clubId}.ownerUid 갱신 + members/{uid} role/isCaptain + users/{uid} roleInTeam/isTeamCaptain 갱신

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { clearNotificationsForUser } from "./notificationService";

function safeStr(v) {
  return String(v ?? "").trim();
}

async function loadUserSnap(uid) {
  const id = safeStr(uid);
  if (!id) return null;
  const s = await getDoc(doc(db, "users", id));
  if (!s.exists()) return { uid: id, id, nickname: "", avatarUrl: "" };
  const d = s.data() || {};
  return {
    uid: id,
    id,
    nickname: safeStr(d.nickname),
    avatarUrl: safeStr(d.avatarUrl),
    region: safeStr(d.region),
  };
}

/**
 * 팀원 목록 로드 (이임 대상 선택용)
 * - clubs/{clubId}/members 에서 uid 목록 가져오고 users/{uid}를 합침
 */
export async function listClubMembersForLeaderTransfer({ clubId, excludeUid = "" }) {
  const cid = safeStr(clubId);
  if (!cid) throw new Error("clubId is required");

  const ex = safeStr(excludeUid);

  const snap = await getDocs(collection(db, "clubs", cid, "members"));
  const uids = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    const uid = safeStr(data.uid || data.userId || d.id);
    if (!uid) return;
    if (ex && uid === ex) return;
    uids.push(uid);
  });

  const uniq = Array.from(new Set(uids));
  const users = await Promise.all(uniq.map((u) => loadUserSnap(u)));
  return (users || []).filter(Boolean);
}

/**
 * 팀장 권한 이임
 * - fromUid(기존 팀장) → toUid(새 팀장)
 */
export async function transferTeamLeader({ clubId, fromUid, toUid }) {
  const cid = safeStr(clubId);
  const from = safeStr(fromUid);
  const to = safeStr(toUid);

  if (!cid) throw new Error("clubId is required");
  if (!from) throw new Error("fromUid is required");
  if (!to) throw new Error("toUid is required");
  if (from === to) throw new Error("same uid");

  const clubRef = doc(db, "clubs", cid);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error("club not found");

  const club = clubSnap.data() || {};
  const ownerUid = safeStr(club.ownerUid || club.ownerId || "");
  if (ownerUid && ownerUid !== from) {
    throw new Error("not club owner");
  }

  const fromMemberRef = doc(db, "clubs", cid, "members", from);
  const toMemberRef = doc(db, "clubs", cid, "members", to);

  const fromMemberSnap = await getDoc(fromMemberRef);
  const toMemberSnap = await getDoc(toMemberRef);

  if (!fromMemberSnap.exists()) throw new Error("from member not found");
  if (!toMemberSnap.exists()) throw new Error("target member not found");

  const batch = writeBatch(db);

  // 1) club owner 변경
  batch.update(clubRef, {
    ownerUid: to,
    updatedAt: serverTimestamp(),
  });

  // 2) members role/captain 변경
  batch.set(
    fromMemberRef,
    {
      uid: from,
      role: "member",
      isCaptain: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    toMemberRef,
    {
      uid: to,
      role: "owner",
      isCaptain: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 3) users 문서도 동기화(있으면)
  const fromUserRef = doc(db, "users", from);
  const toUserRef = doc(db, "users", to);

  batch.set(
    fromUserRef,
    {
      roleInTeam: "member",
      isTeamCaptain: false,
      activeTeamId: cid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    toUserRef,
    {
      roleInTeam: "owner",
      isTeamCaptain: true,
      activeTeamId: cid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  // 팀장→팀원 전환: 기존 팀장 시절 알림(라인업 확정 요청·매칭룸 메시지 등)이 남아
  // 클릭 시 팀장 전용 경로로 이동해 오작동하는 문제 방지 → 기존 팀장 알림창 리셋.
  try {
    await clearNotificationsForUser({ uid: from });
  } catch (e) {
    console.warn("[transferTeamLeader] clear notifications failed:", e?.message || e);
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// ✅ 회원탈퇴 시 내가 팀장인 팀 자동 처리
// - 다른 멤버가 있으면: 가장 먼저 합류한 멤버에게 팀장 자동 위임
// - 혼자뿐이면: 팀 해체
// - best-effort: 팀 처리 실패가 탈퇴를 막지 않도록 내부에서 에러를 흡수
// ─────────────────────────────────────────────────────────────

function tsToMillis(v) {
  try {
    if (v && typeof v.toMillis === "function") return v.toMillis();
  } catch (e) {}
  return Number.MAX_SAFE_INTEGER;
}

/** 위임 대상(후계자) 선정: 본인 제외, 가장 먼저 합류한 멤버 */
async function pickHeirUid({ clubId, excludeUid }) {
  const cid = safeStr(clubId);
  const ex = safeStr(excludeUid);
  const candidates = new Map(); // uid -> joinedAt(ms)

  // 1) members 서브컬렉션 우선(합류 시각 기준 정렬 가능)
  try {
    const snap = await getDocs(collection(db, "clubs", cid, "members"));
    snap.forEach((d) => {
      const data = d.data() || {};
      const uid = safeStr(data.uid || data.userId || d.id);
      if (!uid || uid === ex) return;
      candidates.set(uid, tsToMillis(data.joinedAt || data.createdAt));
    });
  } catch (e) {}

  // 2) 서브컬렉션이 비어 있으면 SSOT(users.activeTeamId)로 보강
  if (candidates.size === 0) {
    try {
      const usnap = await getDocs(
        query(collection(db, "users"), where("activeTeamId", "==", cid))
      );
      usnap.forEach((d) => {
        if (d.id && d.id !== ex) candidates.set(d.id, Number.MAX_SAFE_INTEGER);
      });
    } catch (e) {}
  }

  let heir = "";
  let best = Infinity;
  for (const [uid, ms] of candidates) {
    if (ms < best) {
      best = ms;
      heir = uid;
    }
  }
  return heir;
}

/** 떠나는 팀장 → 새 팀장으로 위임 (떠나는 팀장 member 문서는 삭제) */
async function transferLeadershipOnWithdraw({ clubId, fromUid, toUid, clubData }) {
  const cid = safeStr(clubId);
  const from = safeStr(fromUid);
  const to = safeStr(toUid);

  const batch = writeBatch(db);

  // clubs.members 배열(비정규화)에서도 떠나는 팀장 제거
  const arr = Array.isArray(clubData?.members) ? clubData.members : [];
  const nextArr = arr.filter(
    (m) => safeStr(m?.userId || m?.id || m?.uid) !== from
  );

  const clubUpdate = { ownerUid: to, updatedAt: serverTimestamp() };
  if (nextArr.length !== arr.length) clubUpdate.members = nextArr;
  batch.update(doc(db, "clubs", cid), clubUpdate);

  // 떠나는 팀장 멤버십 제거 (users 문서는 탈퇴 로직에서 삭제됨)
  batch.delete(doc(db, "clubs", cid, "members", from));

  // 새 팀장 승격
  batch.set(
    doc(db, "clubs", cid, "members", to),
    { uid: to, role: "owner", isCaptain: true, updatedAt: serverTimestamp() },
    { merge: true }
  );
  batch.set(
    doc(db, "users", to),
    {
      roleInTeam: "owner",
      isTeamCaptain: true,
      activeTeamId: cid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

/** 혼자뿐인 팀 해체 (best-effort) */
async function disbandSoloClub({ clubId }) {
  const cid = safeStr(clubId);
  const subNames = ["members", "invites", "joinRequests"];
  for (const sub of subNames) {
    try {
      const snap = await getDocs(collection(db, "clubs", cid, sub));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    } catch (e) {}
  }
  try {
    await deleteDoc(doc(db, "clubs", cid));
  } catch (e) {}
}

/** 새 팀장에게 위임 알림 */
async function notifyNewLeader({ clubId, toUid, clubName, actorUid }) {
  try {
    await addDoc(collection(db, "notifications"), {
      clubId,
      kind: "team",
      subType: "TEAM_LEADER_TRANSFERRED",
      type: "team_leader_transferred",
      title: "팀장이 되었습니다",
      body: clubName
        ? `${clubName} 팀의 팀장 권한이 위임되었습니다.`
        : "팀장 권한이 위임되었습니다.",
      targetType: "USER",
      targetIds: [safeStr(toUid)],
      actorUid: actorUid || "",
      linkType: "team",
      linkTargetId: clubId,
      meta: { clubId, deepLink: "/my" },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "teamDecision",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[withdraw] notifyNewLeader failed:", e?.message || e);
  }
}

/**
 * 회원탈퇴 시 호출 — 내가 팀장(ownerUid)인 모든 팀을 자동 처리.
 * @returns {Promise<{reassigned: Array<{clubId:string,newOwnerUid:string}>, disbanded: string[]}>}
 */
export async function reassignOrDisbandOwnedClubsOnWithdraw({ uid }) {
  const u = safeStr(uid);
  const reassigned = [];
  const disbanded = [];
  if (!u) return { reassigned, disbanded };

  let ownedDocs = [];
  try {
    const snap = await getDocs(
      query(collection(db, "clubs"), where("ownerUid", "==", u))
    );
    ownedDocs = snap.docs;
  } catch (e) {
    console.warn("[withdraw] query owned clubs failed:", e?.message || e);
    return { reassigned, disbanded };
  }

  for (const clubDoc of ownedDocs) {
    const cid = clubDoc.id;
    const clubName = safeStr(clubDoc.data()?.name);
    try {
      const heir = await pickHeirUid({ clubId: cid, excludeUid: u });
      if (heir) {
        await transferLeadershipOnWithdraw({
          clubId: cid,
          fromUid: u,
          toUid: heir,
          clubData: clubDoc.data(),
        });
        await notifyNewLeader({ clubId: cid, toUid: heir, clubName, actorUid: u });
        reassigned.push({ clubId: cid, newOwnerUid: heir });
      } else {
        await disbandSoloClub({ clubId: cid });
        disbanded.push(cid);
      }
    } catch (e) {
      console.warn(`[withdraw] handle owned club ${cid} failed:`, e?.message || e);
    }
  }

  return { reassigned, disbanded };
}

/**
 * 회원탈퇴 시 호출 — 내가 (팀장이 아닌) 팀원으로 소속된 팀에서 내 멤버십을 제거.
 * - clubs/{clubId}/members/{uid} 서브컬렉션 doc 삭제
 * - clubs/{clubId}.members 배열(비정규화)에서 제거
 * - 팀장인 팀은 reassignOrDisbandOwnedClubsOnWithdraw 가 별도 처리하므로 건너뜀
 * - best-effort: 실패해도 탈퇴를 막지 않음
 *
 * ※ 카카오 uid 는 고정(kakao:{id})이라, 재가입해도 같은 uid → 정리하지 않으면
 *   예전 팀에 내 멤버 데이터가 그대로 되살아난다.
 */
export async function removeMembershipsOnWithdraw({ uid, clubIds = [] }) {
  const u = safeStr(uid);
  if (!u) return { removed: [] };

  const ids = Array.from(new Set((clubIds || []).map(safeStr).filter(Boolean)));
  const removed = [];

  for (const cid of ids) {
    try {
      const clubRef = doc(db, "clubs", cid);
      const snap = await getDoc(clubRef);
      if (!snap.exists()) continue;

      const club = snap.data() || {};
      // 팀장인 팀은 위임/해체 로직이 처리 → 중복 처리 방지
      if (safeStr(club.ownerUid || club.ownerId) === u) continue;

      const batch = writeBatch(db);

      const arr = Array.isArray(club.members) ? club.members : [];
      const nextArr = arr.filter(
        (m) => safeStr(m?.userId || m?.id || m?.uid) !== u
      );
      if (nextArr.length !== arr.length) {
        batch.update(clubRef, { members: nextArr, updatedAt: serverTimestamp() });
      }

      batch.delete(doc(db, "clubs", cid, "members", u));

      await batch.commit();
      removed.push(cid);
    } catch (e) {
      console.warn(`[withdraw] remove membership ${cid} failed:`, e?.message || e);
    }
  }

  return { removed };
}
