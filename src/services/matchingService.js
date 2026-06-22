/* eslint-disable */
// src/services/matchingService.js
// ✅ 매칭 신청/수락/거절/취소 서비스
// - match_requests 상태 업데이트
// - notifications(팀단위) 생성: 상대팀용(push ON) + 우리팀용(push OFF)
// ✅ 라인업 스냅샷 SSOT: actorLineup/targetLineup 자체 필드(memberIds/memberCount/previewMembers)

import { db, auth } from "./firebase";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { buildNotificationDoc, buildMatchTitleBody } from "../utils/notificationDefinitions";

const toStr = (v) => String(v || "").trim();

const MATCH_SIZE_KEYS = ["3v3", "4v4", "5v5"];
const matchSizeLabel = (k) => {
  const v = toStr(k);
  return MATCH_SIZE_KEYS.includes(v) ? v.replace("v", " vs ") : "";
};
// 빈 라인업 스냅샷(수락 후 룸에서 각 팀이 확정 → 주전 memberIds + 후보 subMemberIds 채움)
const emptyLineupSnapshot = (matchSizeKey = "") => ({
  id: "",
  name: "",
  matchSizeKey: toStr(matchSizeKey),
  memberIds: [],
  memberCount: 0,
  previewMembers: [],
  subMemberIds: [],
  subPreviewMembers: [],
  confirmed: false,
});

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
 * ✅ SSOT:
 * - id/name/matchSizeKey/memberIds/memberCount/previewMembers = lineup 자체에서 가져옴
 * - members(별도 배열)로 스냅샷을 "추정"해서 만들지 않음
 */
function buildLineupSnapshot({ lineup } = {}) {
  const lu = lineup || {};

  const id = toStr(lu?.id || lu?.lineupId);
  const name = toStr(lu?.name);
  const matchSizeKey = toStr(lu?.matchSizeKey);

  const memberIds = Array.isArray(lu?.memberIds)
    ? lu.memberIds.map(toStr).filter(Boolean)
    : [];

  const memberCount =
    typeof lu?.memberCount === "number"
      ? lu.memberCount
      : memberIds.length;

  // ✅ previewMembers는 lineupService에서 users 기반으로 만들어 저장해둔 값을 그대로 사용
  // ✅ 폴백 텍스트 금지: 값 없으면 "" 로 유지
  const previewMembers = Array.isArray(lu?.previewMembers)
    ? lu.previewMembers.slice(0, 12).map((m) => ({
        userId: toStr(m?.userId || m?.uid || m?.id),
        nickname: toStr(m?.nickname),
        photoUrl: toStr(m?.photoUrl || m?.avatarUrl || m?.profileUrl),
        mainPosition: normalizeMainPosition(m?.mainPosition),
        heightCm:
          m?.heightCm != null && Number.isFinite(Number(m.heightCm)) ? Number(m.heightCm) : null,
        weightKg:
          m?.weightKg != null && Number.isFinite(Number(m.weightKg)) ? Number(m.weightKg) : null,
      }))
    : [];

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
 * 매칭 신청 생성 (사이즈만 선택: 3v3 / 4v4 / 5v5)
 * ✅ 라인업은 수락 후 매칭룸(조율)에서 각 팀이 직접 확정 → 생성 시엔 빈 스냅샷 + 사이즈만 저장
 */
export async function createMatchRequest({
  actorClubId,
  actorTeam,

  targetClubId,
  targetTeam,

  matchSizeKey,
} = {}) {
  const _actorClubId = toStr(actorClubId);
  const _targetClubId = toStr(targetClubId);
  const _matchSizeKey = toStr(matchSizeKey);

  if (!_actorClubId) throw new Error("createMatchRequest: actorClubId is required");
  if (!_targetClubId) throw new Error("createMatchRequest: targetClubId is required");
  if (_actorClubId === _targetClubId) throw new Error("createMatchRequest: same club is not allowed");
  if (!MATCH_SIZE_KEYS.includes(_matchSizeKey)) throw new Error("매치 사이즈(3v3/4v4/5v5)를 선택해 주세요.");

  const fromTeamSnapshot = pickTeamSnapshot(actorTeam);
  const toTeamSnapshot = pickTeamSnapshot(targetTeam);

  // 라인업은 룸에서 확정 → 빈 스냅샷(사이즈만)
  const fromLineupSnapshot = emptyLineupSnapshot(_matchSizeKey);
  const toLineupSnapshot = emptyLineupSnapshot(_matchSizeKey);

  const matchRef = await addDoc(collection(db, "match_requests"), {
    actorClubId: _actorClubId,
    targetClubId: _targetClubId,
    status: "pending",
    matchSizeKey: _matchSizeKey,
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
      matchSizeKey: _matchSizeKey,
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
      matchSizeKey: _matchSizeKey,
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const title = "매칭 신청 완료";
    const body = `${toStr(toTeamSnapshot?.name) || "상대 팀"}에 ${matchSizeLabel(_matchSizeKey) || "매칭"}을 신청했어요`;

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
  const actorClubId = toStr(n?.actorClubId); // 신청팀
  const targetClubId = toStr(n?.targetClubId); // 받은팀
  if (!matchId) throw new Error("acceptMatchRequest: matchId is required");
  if (!myId) throw new Error("acceptMatchRequest: myClubId is required");

  if (myId !== targetClubId) throw new Error("수락 권한이 없습니다.");

  // 미확인 배지: 수락 = 새 활동 → 신청팀(상대)에게 "조율중" 배지. 수락한 나는 본 것으로 처리.
  const acceptorUid = toStr(auth.currentUser?.uid);
  const acceptPatch = {
    status: "accepted",
    updatedAt: serverTimestamp(),
    acceptedAt: serverTimestamp(),
    acceptedByClubId: myId,
    lastActivityAt: serverTimestamp(),
  };
  if (acceptorUid) acceptPatch[`lastSeenBy.${acceptorUid}`] = serverTimestamp();

  await updateDoc(doc(db, "match_requests", matchId), acceptPatch);

  const fromTeamSnapshot = n?.fromTeamSnapshot || null;
  const toTeamSnapshot = n?.toTeamSnapshot || null;
  const fromLineupSnapshot = n?.fromLineupSnapshot || null;
  const toLineupSnapshot = n?.toLineupSnapshot || null;

  // 신청팀에게 알림(푸시 ON)
  {
    const payload = {
      matchId,
      actorClubId: myId, // ✅ 수락한 팀
      targetClubId: actorClubId, // ✅ 신청팀
      clubId: actorClubId,
      direction: "received",
      fromTeamSnapshot,
      toTeamSnapshot,
      fromLineupSnapshot,
      toLineupSnapshot,
    };

    const { title, body } = buildMatchTitleBody("MATCH_ACCEPTED", payload);

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
  const actorClubId = toStr(n?.actorClubId); // 신청팀
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

    const { title, body } = buildMatchTitleBody("MATCH_REJECTED", payload);

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
  const actorClubId = toStr(n?.actorClubId); // 신청팀
  const targetClubId = toStr(n?.targetClubId); // 받은팀
  if (!matchId) throw new Error("cancelMatchRequest: matchId is required");
  if (!myId) throw new Error("cancelMatchRequest: myClubId is required");

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
