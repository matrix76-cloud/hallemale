/* eslint-disable */
// src/services/matchingService.js
// ✅ 매칭 신청/수락/거절/취소 서비스
// - match_requests 상태 업데이트
// - notifications(팀단위) 생성: 상대팀용(push ON) + 우리팀용(push OFF)

import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  buildNotificationDoc,
  buildMatchTitleBody,
} from "../utils/notificationDefinitions";

const toStr = (v) => String(v || "").trim();

function pickTeamSnapshot(team) {
  const t = team || {};
  return {
    clubId: toStr(t.clubId || t.id),
    name: toStr(t.name),
    region: toStr(t.region),
    logoUrl: toStr(t.logoUrl || t.photoUrl || ""),
  };
}



function normalizeMainPosition(pos) {
  const v = toStr(pos).toLowerCase();
  if (!v) return "";

  // ✅ SSOT: guard / forward / center 로만 저장
  if (v === "g" || v.includes("guard") || v.includes("가드")) return "guard";
  if (v === "f" || v.includes("forward") || v.includes("포워드")) return "forward";
  if (v === "c" || v.includes("center") || v.includes("센터")) return "center";

  return "";
}


/**
 * 라인업 스냅샷 생성 (match_requests 저장용)
 * - previewMembers 에 mainPosition 포함 (SSOT: guard/forward/center)
 */
function buildLineupSnapshot({ lineup, members } = {}) {
  const lu = lineup || {};
  const ms = Array.isArray(members) ? members : [];

  const id = toStr(lu?.id || lu?.lineupId);
  const name = toStr(lu?.name);

  const matchSizeKey = toStr(lu?.matchSizeKey);
  const memberIds = Array.isArray(lu?.memberIds) ? lu.memberIds.map(toStr).filter(Boolean) : [];

  // ✅ 스냅샷에는 "보여주기용" 최소 정보만: 닉네임/사진/포지션
  // members 배열은 이미 선택된 라인업 멤버 리스트라고 가정 (형이 넘겨주는 actorMembers/targetMembers)
  const previewMembers = ms.slice(0, 12).map((m) => {
    const userId = toStr(m?.userId || m?.uid || m?.id);
    const nickname = toStr(m?.nickname || m?.name) || "선수";
    const photoUrl = toStr(m?.photoUrl || m?.avatarUrl || m?.profileUrl);

    const mainPosition = normalizeMainPosition(m?.mainPosition);
    // ✅ SSOT: mainPosition 하나만 저장 (없으면 빈 문자열로 둠)
    return { userId, nickname, photoUrl, mainPosition };
  });

  const memberCount =
    typeof lu?.memberCount === "number"
      ? lu.memberCount
      : memberIds.length > 0
      ? memberIds.length
      : ms.length;

  return {
    id,
    name,
    matchSizeKey,
    memberIds,
    memberCount,
    previewMembers,
  };
}

async function createNoti({ key, payload, title, body, pushEnabled }) {
  const docData = buildNotificationDoc({
    key,
    payload,
    title,
    body,
    pushEnabled,
  });

  await addDoc(collection(db, "notifications"), {
    ...docData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 매칭 신청 생성 (내 라인업 + 상대 라인업 선택)
 */
export async function createMatchRequest({
  actorClubId,
  actorTeam,
  actorLineup,
  actorMembers,

  targetClubId,
  targetTeam,
  targetLineup,
  targetMembers,
} = {}) {
  const _actorClubId = toStr(actorClubId);
  const _targetClubId = toStr(targetClubId);

  if (!_actorClubId) throw new Error("createMatchRequest: actorClubId is required");
  if (!_targetClubId) throw new Error("createMatchRequest: targetClubId is required");
  if (_actorClubId === _targetClubId) throw new Error("createMatchRequest: same club is not allowed");

  const fromTeamSnapshot = pickTeamSnapshot(actorTeam);
  const toTeamSnapshot = pickTeamSnapshot(targetTeam);

  const fromLineupSnapshot = buildLineupSnapshot({
    lineup: actorLineup,
    members: actorMembers,
  });

  const toLineupSnapshot = buildLineupSnapshot({
    lineup: targetLineup,
    members: targetMembers,
  });

  if (!toStr(fromLineupSnapshot?.id) || !toStr(fromLineupSnapshot?.name)) {
    throw new Error("createMatchRequest: actorLineup is required");
  }
  if (!toStr(toLineupSnapshot?.id) || !toStr(toLineupSnapshot?.name)) {
    throw new Error("createMatchRequest: targetLineup is required");
  }

  const matchRef = await addDoc(collection(db, "match_requests"), {
    actorClubId: _actorClubId,
    targetClubId: _targetClubId,
    status: "pending",
    fromTeamSnapshot,
    toTeamSnapshot,
    fromLineupSnapshot,
    toLineupSnapshot,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const matchId = matchRef.id;

  // 상대팀 알림 (푸시 ON)
  {
    const payload = {
      matchId,
      actorClubId: _actorClubId,
      targetClubId: _targetClubId,
      clubId: _targetClubId,
      direction: "received",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const { title, body } = buildMatchTitleBody("MATCH_REQUEST", payload);

    await createNoti({
      key: "MATCH_REQUEST",
      payload,
      title,
      body,
      pushEnabled: true,
    });
  }

  // 우리팀 기록용 (푸시 OFF)
  {
    const payload = {
      matchId,
      actorClubId: _actorClubId,
      targetClubId: _targetClubId,
      clubId: _actorClubId,
      direction: "sent",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const title = "매칭 신청 완료";
    const body = `${toStr(toTeamSnapshot?.name) || "상대 팀"}의 '${toStr(toLineupSnapshot?.name) || "라인업"}'에 신청했어요`;

    await createNoti({
      key: "MATCH_REQUEST",
      payload,
      title,
      body,
      pushEnabled: false,
    });
  }

  return matchId;
}

/**
 * 매칭 수락
 * - match_requests.status = accepted
 * - 상대팀(신청팀) 알림 push ON
 * - 우리팀 기록용 push OFF
 *
 * 입력은 "인박스 최신 알림(latest)" payload 기반으로 처리 가능
 */
export async function acceptMatchRequest({ myClubId, latestNoti } = {}) {
  const myId = toStr(myClubId);
  const n = latestNoti || {};

  const matchId = toStr(n?.matchId);
  const actorClubId = toStr(n?.actorClubId);  // 신청팀
  const targetClubId = toStr(n?.targetClubId); // 받은팀
  if (!matchId) throw new Error("acceptMatchRequest: matchId is required");
  if (!myId) throw new Error("acceptMatchRequest: myClubId is required");

  // 내가 받은 팀이어야 수락 가능
  if (myId !== targetClubId) throw new Error("수락 권한이 없습니다.");

  // status 업데이트
  await updateDoc(doc(db, "match_requests", matchId), {
    status: "accepted",
    updatedAt: serverTimestamp(),
    acceptedAt: serverTimestamp(),
    acceptedByClubId: myId,
  });

  const fromTeamSnapshot = n?.fromTeamSnapshot || null; // 신청팀
  const toTeamSnapshot = n?.toTeamSnapshot || null;     // 받은팀(우리팀)
  const fromLineupSnapshot = n?.fromLineupSnapshot || null;
  const toLineupSnapshot = n?.toLineupSnapshot || null;

  // 신청팀에게 알림(푸시 ON)
  {
    const payload = {
      matchId,
      actorClubId: myId,         // ✅ 액션 주체(수락한 팀)
      targetClubId: actorClubId, // ✅ 상대(신청팀)
      clubId: actorClubId,
      direction: "received",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const { title, body } = buildMatchTitleBody("MATCH_ACCEPTED", {
      ...payload,
      toTeamSnapshot,
      toLineupSnapshot,
    });

    await createNoti({
      key: "MATCH_ACCEPTED",
      payload,
      title,
      body,
      pushEnabled: true,
    });
  }

  // 우리팀 기록용(푸시 OFF)
  {
    const payload = {
      matchId,
      actorClubId: myId,
      targetClubId: actorClubId,
      clubId: myId,
      direction: "sent",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const title = "매칭 수락 완료";
    const body = `${toStr(fromTeamSnapshot?.name) || "상대 팀"}의 신청을 수락했어요`;

    await createNoti({
      key: "MATCH_ACCEPTED",
      payload,
      title,
      body,
      pushEnabled: false,
    });
  }

  return true;
}

export async function rejectMatchRequest({ myClubId, latestNoti } = {}) {
  const myId = toStr(myClubId);
  const n = latestNoti || {};

  const matchId = toStr(n?.matchId);
  const actorClubId = toStr(n?.actorClubId);   // 신청팀
  const targetClubId = toStr(n?.targetClubId); // 받은팀
  if (!matchId) throw new Error("rejectMatchRequest: matchId is required");
  if (!myId) throw new Error("rejectMatchRequest: myClubId is required");

  if (myId !== targetClubId) throw new Error("거절 권한이 없습니다.");

  await updateDoc(doc(db, "match_requests", matchId), {
    status: "rejected",
    updatedAt: serverTimestamp(),
    rejectedAt: serverTimestamp(),
    rejectedByClubId: myId,
  });

  const fromTeamSnapshot = n?.fromTeamSnapshot || null;
  const toTeamSnapshot = n?.toTeamSnapshot || null;
  const fromLineupSnapshot = n?.fromLineupSnapshot || null;
  const toLineupSnapshot = n?.toLineupSnapshot || null;

  // 신청팀에게 알림(푸시 ON)
  {
    const payload = {
      matchId,
      actorClubId: myId,
      targetClubId: actorClubId,
      clubId: actorClubId,
      direction: "received",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const { title, body } = buildMatchTitleBody("MATCH_REJECTED", {
      ...payload,
      toTeamSnapshot,
    });

    await createNoti({
      key: "MATCH_REJECTED",
      payload,
      title,
      body,
      pushEnabled: true,
    });
  }

  // 우리팀 기록용(푸시 OFF)
  {
    const payload = {
      matchId,
      actorClubId: myId,
      targetClubId: actorClubId,
      clubId: myId,
      direction: "sent",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const title = "매칭 거절 완료";
    const body = `${toStr(fromTeamSnapshot?.name) || "상대 팀"}의 신청을 거절했어요`;

    await createNoti({
      key: "MATCH_REJECTED",
      payload,
      title,
      body,
      pushEnabled: false,
    });
  }

  return true;
}

export async function cancelMatchRequest({ myClubId, latestNoti } = {}) {
  const myId = toStr(myClubId);
  const n = latestNoti || {};

  const matchId = toStr(n?.matchId);
  const actorClubId = toStr(n?.actorClubId);   // 신청팀
  const targetClubId = toStr(n?.targetClubId); // 받은팀
  if (!matchId) throw new Error("cancelMatchRequest: matchId is required");
  if (!myId) throw new Error("cancelMatchRequest: myClubId is required");

  // 내가 신청팀이어야 취소 가능
  if (myId !== actorClubId) throw new Error("취소 권한이 없습니다.");

  await updateDoc(doc(db, "match_requests", matchId), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
    cancelledAt: serverTimestamp(),
    cancelledByClubId: myId,
  });

  const fromTeamSnapshot = n?.fromTeamSnapshot || null;
  const toTeamSnapshot = n?.toTeamSnapshot || null;
  const fromLineupSnapshot = n?.fromLineupSnapshot || null;
  const toLineupSnapshot = n?.toLineupSnapshot || null;

  // 상대팀에게 알림(푸시 ON)
  {
    const payload = {
      matchId,
      actorClubId: myId,
      targetClubId: targetClubId,
      clubId: targetClubId,
      direction: "received",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const { title, body } = buildMatchTitleBody("MATCH_CANCELLED", payload);

    await createNoti({
      key: "MATCH_CANCELLED",
      payload,
      title,
      body,
      pushEnabled: true,
    });
  }

  // 우리팀 기록용(푸시 OFF)
  {
    const payload = {
      matchId,
      actorClubId: myId,
      targetClubId: targetClubId,
      clubId: myId,
      direction: "sent",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const title = "매칭 취소 완료";
    const body = `${toStr(toTeamSnapshot?.name) || "상대 팀"} 매칭 요청을 취소했어요`;

    await createNoti({
      key: "MATCH_CANCELLED",
      payload,
      title,
      body,
      pushEnabled: false,
    });
  }

  return true;
}
