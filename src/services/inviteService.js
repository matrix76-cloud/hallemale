/* eslint-disable */
// src/services/inviteService.js
// ✅ 팀 초대(invites) SSOT 서비스
// - SSOT: clubs/{clubId}/invites/{inviteId}
// - 멤버십 SSOT: clubs/{clubId}/members/{uid} (문서ID=uid)
// - 프로필 SSOT: users/{uid}
// - ✅ 초대 수락 시: 팀장에게 notifications 기록 + push 플래그

import { db } from "./firebase";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

/* ===== util ===== */

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sortByCreatedAtDesc(list) {
  return [...(list || [])].sort((a, b) => {
    const ta = toDateSafe(a.createdAt)?.getTime() || 0;
    const tb = toDateSafe(b.createdAt)?.getTime() || 0;
    return tb - ta;
  });
}

/* ===== 카운트 ===== */

export async function countPendingInvitesForUser({ uid, limitCount = 200 } = {}) {
  if (!uid) return 0;

  const col = collectionGroup(db, "invites");
  const q = query(col, where("toUid", "==", uid), limit(limitCount));

  const snap = await getDocs(q);

  const rows = (snap?.docs || []).map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  const pending = rows.filter((x) => String(x?.status || "") === "pending");
  return pending.length;
}

/* ===== 리스트 ===== */

export async function listMyReceivedInvites({ uid, limitCount = 60 } = {}) {
  if (!uid) return [];

  const col = collectionGroup(db, "invites");
  const q = query(col, where("toUid", "==", uid), limit(limitCount));

  const snap = await getDocs(q);

  const rows = (snap?.docs || []).map((d) => ({
    id: d.id,
    ...d.data(),
    _path: d.ref?.path || "",
  }));

  return sortByCreatedAtDesc(rows);
}

/* ===== 상세 ===== */

export async function getClubInviteById({ clubId, inviteId } = {}) {
  if (!clubId) throw new Error("getClubInviteById: clubId is required");
  if (!inviteId) throw new Error("getClubInviteById: inviteId is required");

  const ref = doc(db, "clubs", clubId, "invites", inviteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return { id: snap.id, inviteId: snap.id, ...snap.data(), _path: ref.path };
}

/* ===== 수락/거절 ===== */

export async function acceptClubInvite({ clubId, inviteId, uid } = {}) {
  if (!clubId) throw new Error("acceptClubInvite: clubId is required");
  if (!inviteId) throw new Error("acceptClubInvite: inviteId is required");
  if (!uid) throw new Error("acceptClubInvite: uid is required");

  const inviteRef = doc(db, "clubs", clubId, "invites", inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error("acceptClubInvite: invite not found");

  const inv = inviteSnap.data() || {};
  const fromUid = String(inv.fromUid || "").trim(); // ✅ 팀장(초대한 사람)
  const toUid = String(inv.toUid || "").trim();
  if (toUid && toUid !== uid) {
    throw new Error("acceptClubInvite: uid mismatch");
  }
  if (!fromUid) {
    throw new Error("acceptClubInvite: fromUid is empty");
  }

  const userRef = doc(db, "users", uid);
  const memberRef = doc(db, "clubs", clubId, "members", uid);

  // ✅ 팀장에게 보낼 알림 문서
  const notiRef = doc(collection(db, "notifications"));

  const actorName = String(inv?.toSnapshot?.nickname || "").trim() || "선수";
  const clubName = String(inv?.clubSnapshot?.name || "").trim() || String(inv?.meta?.clubName || "").trim() || "";

  const title = "팀 초대가 수락되었어요";
  const body = clubName
    ? `${actorName}님이 ${clubName} 팀 초대를 수락했습니다.`
    : `${actorName}님이 팀 초대를 수락했습니다.`;

  const batch = writeBatch(db);

  // 1) 초대 수락
  batch.update(inviteRef, {
    status: "accepted",
    updatedAt: serverTimestamp(),
    acceptedAt: serverTimestamp(),
  });

  // 2) 유저 activeTeamId 갱신
  batch.set(
    userRef,
    {
      activeTeamId: clubId,
      clubId: clubId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 3) 팀 멤버 추가(문서ID=uid)
  batch.set(
    memberRef,
    {
      uid,
      clubId,
      role: "member",
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 4) ✅ 팀장에게 알림 기록
  batch.set(notiRef, {
    clubId,

    kind: "team",
    subType: "CLUB_INVITE_ACCEPTED",

    title,
    body,

    targetType: "USER",
    targetIds: [fromUid],

    linkType: "team",
    linkTargetId: inviteId,

    important: true,

    actor: {
      uid,
      nickname: String(inv?.toSnapshot?.nickname || "").trim() || "",
      avatarUrl: String(inv?.toSnapshot?.avatarUrl || "").trim() || "",
    },

    meta: {
      clubId,
      inviteId,
      fromUid,
      toUid: uid,
    },

    push: {
      enabled: true,
      sent: false,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: {},
  });

  await batch.commit();

  return { ok: true, inviteId, notificationId: notiRef.id };
}

export async function rejectClubInvite({ clubId, inviteId, uid } = {}) {
  if (!clubId) throw new Error("rejectClubInvite: clubId is required");
  if (!inviteId) throw new Error("rejectClubInvite: inviteId is required");
  if (!uid) throw new Error("rejectClubInvite: uid is required");

  const inviteRef = doc(db, "clubs", clubId, "invites", inviteId);

  await updateDoc(inviteRef, {
    status: "rejected",
    updatedAt: serverTimestamp(),
    rejectedAt: serverTimestamp(),
    rejectedBy: uid,
  });

  return { ok: true };
}
