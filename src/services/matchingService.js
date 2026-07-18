/* eslint-disable */
// src/services/matchingService.js
// ✅ 매칭 신청/수락/거절/취소 서비스
// - match_requests 상태 업데이트
// - notifications(팀단위) 생성: 상대팀용(push ON) + 우리팀용(push OFF)
// ✅ 라인업 스냅샷 SSOT: actorLineup/targetLineup 자체 필드(memberIds/memberCount/previewMembers)

import { db, auth } from "./firebase";
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

import { buildNotificationDoc, buildMatchTitleBody } from "../utils/notificationDefinitions";
import { MIN_TEAM_MEMBERS, requiredMembersForMatchSize, matchSizeLabelOf } from "../utils/constants";
import { listClubMemberUidsExceptOwner } from "./clubManageService";
import { getClubMemberCounts } from "./matchingHomeService";

const toStr = (v) => String(v || "").trim();

// 매칭 성사 시 한 팀의 팀원(팀장 제외)에게 "매칭 성사 → 조율 시작" 알림.
// 팀장은 위의 createNoti(팀장 전용)로 이미 받으므로 여기선 팀원만 대상으로 한다.
async function notifyClubMembersAccepted({ matchId, clubId, opponentName }) {
  const mid = toStr(matchId);
  const cid = toStr(clubId);
  if (!mid || !cid) return;

  let uids = [];
  try {
    uids = await listClubMemberUidsExceptOwner(cid);
  } catch (e) {}
  if (!uids.length) return;

  await addDoc(collection(db, "notifications"), {
    kind: "match",
    subType: "matchAccepted",
    type: "match_accepted",
    title: "매칭 성사 🎉",
    body: `팀장이 '${toStr(opponentName) || "상대 팀"}'과(와) 일정·구장을 조율 중이에요. 확정되면 다시 알려드릴게요!`,
    targetType: "USER",
    targetIds: uids,
    linkType: "match",
    linkTargetId: mid,
    meta: { matchId: mid, deepLink: `/match-roomdetail/${mid}` },
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    prefsCategory: "match",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: {},
  });
}

const teamMemberCount = (team) =>
  Array.isArray(team?.members) ? team.members.length : 0;

/**
 * ✅ 경기 형식(3v3/4v4/5v5)에 필요한 인원을 두 팀 모두 채웠는지 검증한다.
 * - 신청(createMatchRequest)·수락(acceptMatchRequest) 공용 게이트
 * - 인원은 clubs/{id}/members를 서버에서 다시 세므로 클라이언트 스냅샷을 신뢰하지 않는다
 * - 인원 미달이면 사람이 읽을 수 있는 메시지로 throw
 */
async function assertBothTeamsCanPlay({
  matchSizeKey,
  myClubId,
  opponentClubId,
  myShortage,
  opponentShortage,
}) {
  const need = requiredMembersForMatchSize(matchSizeKey);
  // 형식을 알 수 없으면 최소 인원(3명)이라도 지킨다
  const required = need || MIN_TEAM_MEMBERS;

  const counts = await getClubMemberCounts([myClubId, opponentClubId]);
  const mine = counts.get(myClubId) || 0;
  const theirs = counts.get(opponentClubId) || 0;

  if (mine < required) throw new Error(myShortage(required, mine));
  if (theirs < required) throw new Error(opponentShortage(required, theirs));
}

// ✅ 매칭 알림 대상: 팀 전체가 아니라 해당 팀의 "팀장(ownerUid)"에게만 전달.
// (팀원은 매칭 신청/수락/거절/취소 알림을 받지 않음 — 경기 종료 후 평점·리뷰만 가능)
async function clubLeaderUids(clubId) {
  const id = toStr(clubId);
  if (!id) return [];
  try {
    const snap = await getDoc(doc(db, "clubs", id));
    const ownerUid = toStr(snap.data()?.ownerUid);
    return ownerUid ? [ownerUid] : [];
  } catch (e) {
    return [];
  }
}

/**
 * ✅ 팀원 → 팀장 매칭 제안. 팀원은 직접 신청 불가 → 팀장에게 "이 팀과 매칭 제안" 알림을 보내
 *    팀장이 알림을 타고 분석 화면으로 가서 실제 신청을 보낼 수 있게 한다. (팀장 독점 병목 완화)
 */
export async function proposeMatchToLeader({ myClubId, targetClubId, targetTeamName, proposerUid, proposerName } = {}) {
  const mine = toStr(myClubId);
  const target = toStr(targetClubId);
  if (!mine || !target) throw new Error("팀 정보가 없어요.");
  const leaders = await clubLeaderUids(mine);
  if (!leaders.length) throw new Error("팀장을 찾을 수 없어요.");
  const who = toStr(proposerName) || "팀원";
  const opp = toStr(targetTeamName) || "상대 팀";
  const uid = toStr(proposerUid);

  // 제안 원장(match_proposals/{from}_{to}) — 팀장 알림 도배 방지(dedup) + 성사 시 통보 대상 누적
  const propRef = doc(db, "match_proposals", `${mine}_${target}`);
  let alreadyPending = false;
  try {
    const ps = await getDoc(propRef);
    alreadyPending = ps.exists() && toStr(ps.data()?.status) === "pending";
  } catch (e) {}

  // 이미 팀장에게 전달돼 대기 중인 제안 → 알림 재발송하지 않고(도배 방지) 제안자만 누적
  if (alreadyPending) {
    try {
      const patch = { updatedAt: serverTimestamp() };
      if (uid) { patch.proposerUids = arrayUnion(uid); patch.proposerNames = arrayUnion(who); }
      await updateDoc(propRef, patch);
    } catch (e) {}
    return { deduped: true };
  }

  // 새 제안 → 원장 생성(status=pending) + 팀장 알림 1회
  try {
    await setDoc(propRef, {
      fromClubId: mine,
      toClubId: target,
      targetTeamName: opp,
      proposerUids: uid ? [uid] : [],
      proposerNames: [who],
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {}

  await addDoc(collection(db, "notifications"), {
    kind: "match",
    subType: "matchProposal",
    type: "match_proposal",
    title: "매칭 제안 📮",
    body: `${who}님이 '${opp}'과(와) 매칭을 제안했어요. 확인하고 신청해보세요.`,
    targetType: "USER",
    targetIds: leaders,
    linkType: "match",
    linkTargetId: target,
    meta: { deepLink: `/matching/analysis/${target}` },
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    prefsCategory: "match",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: {},
  });
  return { deduped: false };
}

// 팀장이 실제 신청(createMatchRequest)하면, 그 팀→상대 pending 제안을 성사 처리:
//  제안한 팀원들에게 "제안한 매칭이 신청됐어요" 통보 + status=fulfilled 로 마킹(중복 통보 방지).
async function fulfillMatchProposal(fromClubId, toClubId, matchId, oppName) {
  const from = toStr(fromClubId);
  const to = toStr(toClubId);
  const mid = toStr(matchId);
  if (!from || !to || !mid) return;
  const propRef = doc(db, "match_proposals", `${from}_${to}`);
  try {
    const ps = await getDoc(propRef);
    if (!ps.exists() || toStr(ps.data()?.status) !== "pending") return;
    const uids = Array.isArray(ps.data()?.proposerUids)
      ? ps.data().proposerUids.map(toStr).filter(Boolean)
      : [];
    await updateDoc(propRef, {
      status: "fulfilled",
      matchId: mid,
      fulfilledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (uids.length) {
      await addDoc(collection(db, "notifications"), {
        kind: "match",
        subType: "matchProposalFulfilled",
        type: "match_proposal",
        title: "제안한 매칭이 신청됐어요! ✅",
        body: `팀장이 '${toStr(oppName) || "상대 팀"}'과(와)의 매칭을 신청했어요. 매칭룸에서 진행 상황을 확인해보세요.`,
        targetType: "USER",
        targetIds: uids,
        linkType: "match",
        linkTargetId: mid,
        meta: { matchId: mid, deepLink: `/match-roomdetail/${mid}` },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: {},
      });
    }
  } catch (e) {
    console.warn("[fulfillMatchProposal] failed:", e?.message || e);
  }
}

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
  // ✅ 수신 대상은 payload.clubId 팀의 팀장 1명. (앱내 알림 쿼리 + 푸시 모두 팀장에게만)
  const targetIds = await clubLeaderUids(payload?.clubId);

  const docData = buildNotificationDoc({
    key,
    payload: { ...payload, targetIds },
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

  // ✅ 경기 형식에 필요한 인원을 양 팀 모두 채웠는지 검증 (3명뿐인 팀의 4v4·5v5 신청 차단).
  //    클라이언트가 넘긴 스냅샷 대신 서버에서 다시 세어 우회를 막는다.
  await assertBothTeamsCanPlay({
    matchSizeKey: _matchSizeKey,
    myClubId: _actorClubId,
    opponentClubId: _targetClubId,
    myShortage: (need, count) =>
      `${matchSizeLabelOf(_matchSizeKey)} 경기는 팀원이 ${need}명 이상이어야 신청할 수 있어요. (현재 ${count}명)`,
    opponentShortage: (need) =>
      `상대 팀이 아직 팀원 ${need}명을 채우지 못해 ${matchSizeLabelOf(_matchSizeKey)} 경기를 받을 수 없어요.`,
  });

  // ✅ 중복 매칭 요청 방지: 두 팀 사이에 이미 진행 중인 요청/경기가 있으면 차단
  {
    const activeStatuses = ["pending", "accepted", "proposed", "awaiting_venue_approval", "confirmed"];
    const col = collection(db, "match_requests");
    const [s1, s2] = await Promise.all([
      getDocs(query(col, where("actorClubId", "==", _actorClubId), where("targetClubId", "==", _targetClubId))),
      getDocs(query(col, where("actorClubId", "==", _targetClubId), where("targetClubId", "==", _actorClubId))),
    ]);
    const dup = [...s1.docs, ...s2.docs].some((d) => activeStatuses.includes(toStr(d.data()?.status)));
    if (dup) throw new Error("이미 이 팀과 진행 중인 매칭이 있어요. 매칭룸에서 확인해 주세요.");
  }

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

  // 팀원 제안으로 시작된 매칭이면 제안자들에게 성사 통보 (실패해도 매칭 생성엔 영향 없음)
  try {
    await fulfillMatchProposal(_actorClubId, _targetClubId, matchId, toTeamSnapshot?.name);
  } catch (e) {}

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

  // ✅ 수락 시점에도 경기 형식에 필요한 인원을 다시 검증한다.
  //    (신청 이후 팀원이 빠졌을 수 있고, 알림 딥링크 등 UI 게이트를 우회하는 경로가 있다)
  {
    const msnap = await getDoc(doc(db, "match_requests", matchId));
    const md = msnap.data() || {};
    const sizeKey =
      toStr(md.matchSizeKey) ||
      toStr(md?.fromLineupSnapshot?.matchSizeKey) ||
      toStr(md?.toLineupSnapshot?.matchSizeKey);
    const sizeLabel = matchSizeLabelOf(sizeKey) || "이";

    await assertBothTeamsCanPlay({
      matchSizeKey: sizeKey,
      myClubId: myId,
      opponentClubId: actorClubId,
      myShortage: (need, count) =>
        `${sizeLabel} 경기는 팀원이 ${need}명 이상이어야 수락할 수 있어요. (현재 ${count}명)`,
      opponentShortage: (need) =>
        `상대 팀 인원이 ${need}명 미만이 되어 지금은 수락할 수 없어요.`,
    });
  }

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

  // ✅ 상태 가드: 이미 취소/거절/성사된 제안을 stale 인박스로 되살리지 못하게 pending일 때만 수락.
  await runTransaction(db, async (tx) => {
    const mref = doc(db, "match_requests", matchId);
    const msnap = await tx.get(mref);
    if (!msnap.exists()) throw new Error("경기를 찾을 수 없어요.");
    const st = toStr(msnap.data()?.status);
    if (st !== "pending") {
      throw new Error(st === "cancelled" || st === "rejected" ? "이미 종료된 매칭 제안이에요." : "이미 처리된 매칭 제안이에요.");
    }
    tx.update(mref, acceptPatch);
  });

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
      // 클릭 시 조율중 매칭룸으로 이동 + "매칭 성사" 축하 애니메이션 트리거
      deepLink: `/matchroom/${matchId}?celebrate=accepted`,
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

  // 양 팀 팀원에게도 "매칭 성사" 알림 (팀장 제외 — 팀장은 위에서 받음)
  // - 신청팀(actorClubId) 팀원 → 상대는 수락팀(toTeamSnapshot)
  // - 수락팀(myId) 팀원 → 상대는 신청팀(fromTeamSnapshot)
  try {
    await Promise.all([
      notifyClubMembersAccepted({
        matchId,
        clubId: actorClubId,
        opponentName: toTeamSnapshot?.name,
      }),
      notifyClubMembersAccepted({
        matchId,
        clubId: myId,
        opponentName: fromTeamSnapshot?.name,
      }),
    ]);
  } catch (e) {
    console.warn("[acceptMatchRequest] member notify failed:", e?.message || e);
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

  // ✅ 상태 가드: pending일 때만 거절 (진행/종료된 매칭 오전이 방지)
  await runTransaction(db, async (tx) => {
    const mref = doc(db, "match_requests", matchId);
    const msnap = await tx.get(mref);
    if (!msnap.exists()) throw new Error("경기를 찾을 수 없어요.");
    if (toStr(msnap.data()?.status) !== "pending") throw new Error("이미 처리된 매칭 제안이에요.");
    tx.update(mref, {
      status: "rejected",
      updatedAt: serverTimestamp(),
      rejectedAt: serverTimestamp(),
      rejectedByClubId: myId,
    });
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

  // ✅ 상태 가드: 이미 종료된(취소/거절/종료) 매칭은 재취소 불가 (stale/중복 방지)
  await runTransaction(db, async (tx) => {
    const mref = doc(db, "match_requests", matchId);
    const msnap = await tx.get(mref);
    if (!msnap.exists()) throw new Error("경기를 찾을 수 없어요.");
    const st = toStr(msnap.data()?.status);
    if (["cancelled", "rejected", "finished"].includes(st)) throw new Error("이미 종료된 매칭이에요.");
    tx.update(mref, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
      cancelledAt: serverTimestamp(),
      cancelledByClubId: myId,
    });
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
