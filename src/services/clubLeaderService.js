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
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

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
  return true;
}
