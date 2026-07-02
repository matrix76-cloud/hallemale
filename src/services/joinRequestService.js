/* eslint-disable */
// src/services/joinRequestService.js
// ✅ 팀 참가 요청(joinRequests) SSOT 서비스
// - SSOT: clubs/{clubId}/joinRequests/{requestId}
// - 팀장: pending 목록/카운트/상세/수락/거절
// - 수락 시:
//   1) joinRequests.accepted
//   2) clubs/{clubId}/members/{playerUid}
//   3) users/{playerUid}.activeTeamId
//   4) ✅ notifications 기록 (팀원에게 "수락됨" 알림) + push 플래그

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

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

export async function listPendingJoinRequestsForClub({ clubId, limitCount = 60 } = {}) {
  if (!clubId) return [];

  const col = collection(db, "clubs", clubId, "joinRequests");

  // ✅ 인덱스 부담 최소: status 단일 where만 사용
  const qy = query(col, where("status", "==", "pending"), limit(limitCount));
  const snap = await getDocs(qy);

  const rows = (snap?.docs || []).map((d) => ({
    id: d.id,
    requestId: d.id,
    ...d.data(),
  }));

  return sortByCreatedAtDesc(rows);
}

export async function countPendingJoinRequestsForClub({ clubId, limitCount = 200 } = {}) {
  const rows = await listPendingJoinRequestsForClub({ clubId, limitCount });
  return Array.isArray(rows) ? rows.length : 0;
}

export async function getJoinRequestById({ clubId, requestId } = {}) {
  if (!clubId) throw new Error("getJoinRequestById: clubId is required");
  if (!requestId) throw new Error("getJoinRequestById: requestId is required");

  const ref = doc(db, "clubs", clubId, "joinRequests", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { id: snap.id, requestId: snap.id, ...snap.data() };
}

export async function acceptJoinRequest({ clubId, requestId, leaderUid } = {}) {
  if (!clubId) throw new Error("acceptJoinRequest: clubId is required");
  if (!requestId) throw new Error("acceptJoinRequest: requestId is required");

  const reqRef = doc(db, "clubs", clubId, "joinRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) throw new Error("acceptJoinRequest: joinRequest not found");

  const req = reqSnap.data() || {};

  // ✅ 서버측 상태 재확인: 이미 처리된 요청이면 중복 수락 차단
  if (String(req.status || "") !== "pending") {
    throw new Error("이미 처리된 요청이에요.");
  }

  const playerUid = String(req.playerUid || "").trim();
  if (!playerUid) throw new Error("acceptJoinRequest: playerUid is empty");

  const memberRef = doc(db, "clubs", clubId, "members", playerUid);
  const userRef = doc(db, "users", playerUid);

  // ✅ 신청자가 이미 다른 팀 소속이면 수락 차단 (더블 멤버십 방지)
  const playerSnap = await getDoc(userRef);
  const playerTeam = String(
    playerSnap.exists() ? playerSnap.data()?.activeTeamId || playerSnap.data()?.clubId || "" : ""
  ).trim();
  if (playerTeam && playerTeam !== clubId) {
    throw new Error("이 사용자는 이미 다른 팀에 소속되어 있어요. 상대가 팀을 탈퇴한 뒤 다시 수락할 수 있어요.");
  }

  // ✅ 팀원에게 보낼 알림 문서(SSOT: notifications)
  const notiRef = doc(collection(db, "notifications"));

  const actorName =
    String(req?.playerSnapshot?.nickname || "").trim() || "신청자";
  const clubName =
    String(req?.clubName || "").trim() ||
    String(req?.meta?.clubName || "").trim() ||
    ""; // 없으면 바디는 기본 문구로

  const title = "팀 참가 요청이 수락되었어요";
  const body = clubName
    ? `${clubName} 팀에서 참가 요청을 수락했습니다.`
    : "팀에서 참가 요청을 수락했습니다.";

  const batch = writeBatch(db);

  // 1) joinRequests 상태 업데이트
  batch.update(reqRef, {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    acceptedBy: leaderUid || null,
    updatedAt: serverTimestamp(),
  });

  // 2) 멤버 등록(SSOT)
  batch.set(
    memberRef,
    {
      uid: playerUid,
      clubId,
      role: "member",
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 3) 유저 activeTeamId 갱신 + joinRequest 상태 정리(무한 pending 방지)
  batch.set(
    userRef,
    {
      activeTeamId: clubId,
      clubId,
      joinRequest: { status: "accepted", updatedAt: serverTimestamp() },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 4) ✅ 알림 기록(팀원에게)
  batch.set(notiRef, {
    // ✅ SSOT: team 알림은 clubId 최상위 보장
    clubId,

    kind: "team",
    subType: "JOIN_REQUEST_ACCEPTED",

    title,
    body,

    targetType: "USER",
    targetIds: [playerUid],

    // 상세 이동/참조용
    linkType: "team",
    linkTargetId: requestId,

    important: true,

    actor: {
      uid: leaderUid || "",
      role: "leader",
    },

    meta: {
      clubId,
      joinRequestId: requestId,
      leaderUid: leaderUid || "",
      playerUid,
      playerSnapshot: req.playerSnapshot || null,
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

  return { ok: true, playerUid, notificationId: notiRef.id };
}

export async function rejectJoinRequest({ clubId, requestId, leaderUid } = {}) {
  if (!clubId) throw new Error("rejectJoinRequest: clubId is required");
  if (!requestId) throw new Error("rejectJoinRequest: requestId is required");

  const reqRef = doc(db, "clubs", clubId, "joinRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  const req = reqSnap.exists() ? reqSnap.data() || {} : {};
  const playerUid = String(req.playerUid || "").trim();
  const clubName = String(req?.clubName || req?.meta?.clubName || "").trim();

  await updateDoc(reqRef, {
    status: "rejected",
    rejectedAt: serverTimestamp(),
    rejectedBy: leaderUid || null,
    updatedAt: serverTimestamp(),
  });

  // ✅ 신청자 users.joinRequest 상태 정리(무한 pending 방지)
  if (playerUid) {
    try {
      await setDoc(
        doc(db, "users", playerUid),
        {
          joinRequest: { status: "rejected", updatedAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("[joinRequest] clear joinRequest failed:", e?.message || e);
    }
  }

  // ✅ 신청자에게 거절 알림
  if (playerUid) {
    try {
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(db, "notifications"), {
        clubId,
        kind: "team",
        subType: "JOIN_REQUEST_REJECTED",
        type: "join_request_rejected",
        title: "팀 참가 요청이 거절되었어요",
        body: clubName
          ? `${clubName} 팀에서 참가 요청을 거절했어요.`
          : "팀에서 참가 요청을 거절했어요.",
        targetType: "USER",
        targetIds: [playerUid],
        actor: { uid: leaderUid || "", role: "leader" },
        linkType: "team",
        linkTargetId: requestId,
        meta: {
          clubId,
          joinRequestId: requestId,
          deepLink: `/my/team-invites`,
        },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "teamDecision",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: {},
      });
    } catch (e) {
      console.warn("[joinRequest] reject notification failed:", e?.message || e);
    }
  }

  return { ok: true };
}
