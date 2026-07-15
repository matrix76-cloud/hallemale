/* eslint-disable */
// src/services/matchRoomService.js
// ✅ 실데이터 버전 (match_requests 기반)
// - ✅ SSOT: pending/accepted/proposed/confirmed/cancelled/finished
// - ✅ 결과 흐름:
//   - submitResult: status=confirmed 유지 + resultState=waiting_accept (상대 승인 대기)
//   - acceptResult: resultState=confirmed + status=finished + clubs.stats + users.stats 트랜잭션 반영(중복 방지)
// - ✅ 사진/코멘트: match_requests.result.{comment, photoUrls, submittedByClubId, submittedAt} 저장

import { db, auth } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  orderBy,
  startAfter,
  documentId,
  addDoc,
  onSnapshot,
  increment,
} from "firebase/firestore";
import { uploadCompressedImageMedia } from "./mediaService";
import { getUserProfileByUid } from "./userService";
import { listClubMembers, listClubMemberUidsExceptOwner } from "./clubManageService";
import { fetchLineupRosterProfiles } from "./lineupRosterService";
import { sendSystemMessage } from "./chatService";
import { chargeFizz } from "./fizzService";
import { predictFromStats } from "../utils/matchAnalysis";

// 경기 취소 사유 프리셋 (상대팀에 표시)
export const MATCH_CANCEL_REASONS = [
  { key: "shortage", label: "팀원이 부족해요" },
  { key: "schedule", label: "일정이 안 맞아요" },
  { key: "injury", label: "부상·컨디션 문제" },
  { key: "venue", label: "구장 사정(예약 문제 등)" },
  { key: "weather", label: "날씨 문제" },
  { key: "mutual", label: "상대팀과 합의 취소" },
  { key: "etc", label: "기타(직접 입력)" },
];
const MATCH_CANCEL_REASON_LABELS = MATCH_CANCEL_REASONS.reduce((m, r) => { m[r.key] = r.label; return m; }, {});

// ⚠️ 테스트 단계: 실제 환불(피지 잔액 복구)은 보류. 환불 "기록/구조"만 남김.
//    PG/실결제 연동 후 true 로 바꾸면 실제 환불(chargeFizz)이 실행됨.
const REFUND_CREDIT_ENABLED = false;

// 제휴구장 결제 예약이 있으면 취소 + 환불(구조) 처리. 직접입력 등 결제 없으면 null 반환.
async function refundPartnerReservationIfPaid(matchId, reasonStr) {
  const snap = await getDocs(
    query(collection(db, "venueReservations"), where("matchId", "==", toStr(matchId)))
  );
  let resvDoc = null;
  snap.forEach((d) => {
    const st = toStr(d.data()?.status);
    if (st === "confirmed" || st === "pending") resvDoc = d;
  });
  if (!resvDoc) return null; // 결제 없음(직접입력 등)

  const data = resvDoc.data() || {};
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const shareA = num(data.shareA);
  const shareB = num(data.shareB);
  const breakdown = [];
  if (data.paidByA && toStr(data.teamAPayerUid)) breakdown.push({ team: "A", uid: toStr(data.teamAPayerUid), amount: shareA });
  if (data.paidByB && toStr(data.teamBPayerUid)) breakdown.push({ team: "B", uid: toStr(data.teamBPayerUid), amount: shareB });
  const total = breakdown.reduce((s, r) => s + r.amount, 0);

  // 실제 잔액 복구는 테스트 단계 보류
  if (REFUND_CREDIT_ENABLED) {
    for (const r of breakdown) {
      if (r.uid && r.amount > 0) { try { await chargeFizz(r.uid, r.amount); } catch (e) {} }
    }
  }

  const refundStatus = REFUND_CREDIT_ENABLED ? "refunded" : "pending";
  await updateDoc(doc(db, "venueReservations", resvDoc.id), {
    status: "cancelled",
    refunded: REFUND_CREDIT_ENABLED,
    refundStatus, // "refunded"(완료) | "pending"(환불 대기 — PG 연동 전)
    refundAmount: total,
    refundReason: toStr(reasonStr),
    refundBreakdown: breakdown,
    refundedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { status: refundStatus, amount: total, breakdown };
}

// 한 팀의 팀원(팀장 제외)에게 매치 라이프사이클 알림 발송.
// 팀장은 별도 알림(notifyMatchRoomEvent 등)으로 이미 받으므로 여기선 팀원만 대상으로 한다.
async function notifyClubMembersEvent({ matchId, clubId, subType, type, title, body }) {
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
    subType,
    type,
    title,
    body,
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

// 경기 종료(결과 입력) 후 팀원들에게 "상대 팀 리뷰 작성" 알림 (팀장 제외)
async function notifyClubMembersToReview(matchId, clubId) {
  await notifyClubMembersEvent({
    matchId,
    clubId,
    subType: "matchReviewRequest",
    type: "match_review_request",
    title: "경기 후기를 남겨주세요",
    body: "경기가 끝났어요! 상대 팀에 대한 평점·후기를 남겨주세요.",
  });
}

/* ========================= util ========================= */

const toStr = (v) => String(v || "").trim();

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function tsMs(v) {
  return toDateSafe(v)?.getTime() || 0;
}

function uniqById(list) {
  const map = {};
  for (const x of list || []) {
    const id = toStr(x?.id);
    if (!id) continue;
    map[id] = x;
  }
  return Object.values(map);
}

function uniqStr(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    const v = toStr(x);
    if (!v) return;
    if (seen.has(v)) return;
    seen.add(v);
    out.push(v);
  });
  return out;
}

function normalizeRoomStatus(matchReqStatus) {
  const s = toStr(matchReqStatus);
  if (s === "accepted") return "accepted";
  if (s === "awaiting_venue_approval") return "awaiting_venue_approval";
  if (s === "proposed") return "proposed";
  if (s === "confirmed") return "confirmed";
  if (s === "finished") return "finished";
  if (s === "cancelled") return "cancelled";
  return "accepted";
}

function safeNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRate(stats) {
  if (!stats) return 0;
  const winRate = Number(stats.winRate);
  if (Number.isFinite(winRate)) return winRate;

  const wins = safeNum(stats.wins, 0);
  const losses = safeNum(stats.losses, 0);
  const draws = safeNum(stats.draws, 0);
  const total = safeNum(stats.totalMatches, wins + losses + draws);
  if (total <= 0) return 0;
  return wins / total;
}

function normalizeClubDocToTeam(id, data) {
  const stats = data?.stats || {};
  const wins = safeNum(stats.wins, 0);
  const losses = safeNum(stats.losses, 0);
  const draws = safeNum(stats.draws, 0);
  const totalMatches = safeNum(stats.totalMatches, wins + losses + draws);

  return {
    clubId: id,
    id,
    name: toStr(data?.name) || "팀",
    region: toStr(data?.region),
    regionSido: toStr(data?.regionSido),
    regionGu: toStr(data?.regionGu),
    logoUrl: data?.logoUrl || "",
    logoPath: data?.logoPath || "",
    ownerUid: data?.ownerUid || "",
    stats: {
      wins,
      losses,
      draws,
      totalMatches,
      winRate: calcWinRate({ ...stats, wins, losses, draws, totalMatches }),
      recentResults: Array.isArray(stats?.recentResults) ? stats.recentResults : [],
    },
    createdAt: data?.createdAt || null,
    updatedAt: data?.updatedAt || null,
  };
}

function buildRecentFromStats(teamDoc) {
  const stats = teamDoc?.stats || {};
  const recent = Array.isArray(stats?.recentResults) ? stats.recentResults : [];

  return (recent || []).slice(0, 5).map((r) => {
    const v = toStr(r).toLowerCase();
    if (v === "w" || v.includes("win") || v === "승") return "W";
    if (v === "d" || v.includes("draw") || v === "무") return "D";
    return "L";
  });
}

function buildFallbackTeamFromSnapshot(snap, clubId) {
  const s = snap || {};
  return {
    clubId: toStr(clubId || s.clubId || s.id),
    id: toStr(clubId || s.clubId || s.id),
    name: toStr(s.name) || "팀",
    region: toStr(s.region),
    regionSido: toStr(s.regionSido),
    regionGu: toStr(s.regionGu),
    logoUrl: toStr(s.logoUrl || s.photoUrl || ""),
    stats: { wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: 0, recentResults: [] },
  };
}

async function runBatches(ids, batchSize, worker) {
  const out = [];
  const list = Array.isArray(ids) ? ids : [];
  for (let i = 0; i < list.length; i += batchSize) {
    const chunk = list.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const res = await Promise.all(chunk.map((x) => worker(x)));
    out.push(...res);
  }
  return out;
}

async function safeGetClubTeamSummary(clubId) {
  const id = toStr(clubId);
  if (!id) return null;

  try {
    const ref = doc(db, "clubs", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return normalizeClubDocToTeam(snap.id, snap.data());
  } catch (e) {
    return null;
  }
}

/* ========================= lineup helpers (SSOT) ========================= */

function parseMatchSizeKeyToLimit(matchSizeKey) {
  const k = toStr(matchSizeKey).toLowerCase();
  const m = k.match(/^(\d+)\s*v\s*\d+$/);
  if (m && m[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.min(Math.max(n, 1), 20);
  }
  return null;
}

function pickPreviewMembersFromUsers(usersById, memberIds, limit) {
  const ids = Array.isArray(memberIds) ? memberIds : [];
  const take = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : ids.length;

  const out = [];
  for (let i = 0; i < ids.length && out.length < take; i += 1) {
    const uid = toStr(ids[i]);
    if (!uid) continue;
    const u = usersById[uid] || null;
    if (!u) {
      out.push({
        userId: uid,
        nickname: "선수",
        photoUrl: "",
        mainPosition: "",
      });
      continue;
    }
    out.push({
      userId: uid,
      nickname: toStr(u.nickname) || "선수",
      photoUrl: toStr(u.avatarUrl),
      mainPosition: toStr(u.mainPosition),
    });
  }
  return out;
}

/**
 * ✅ 라인업 스냅샷 정합성 강제(저장 시 사용)
 * - memberIds SSOT
 * - memberCount = memberIds.length
 * - previewMembers = memberIds 기준(최대 matchSize 인원)
 *
 * @param {object} args
 * @param {string[]} args.memberIds
 * @param {string} args.matchSizeKey
 * @param {object} args.usersById  // { [uid]: usersDocData }
 * @param {string} args.id
 * @param {string} args.name
 */
export function buildLineupSnapshotSSOT({
  memberIds = [],
  matchSizeKey = "",
  usersById = {},
  id = "",
  name = "",
} = {}) {
  const ids = uniqStr(memberIds);
  const limit = parseMatchSizeKeyToLimit(matchSizeKey) || ids.length;

  const previewMembers = pickPreviewMembersFromUsers(usersById, ids, limit);

  return {
    id: toStr(id) || "",
    name: toStr(name) || "",
    matchSizeKey: toStr(matchSizeKey) || "",
    memberIds: ids,
    memberCount: ids.length,
    previewMembers,
  };
}

/* ========================= 룸 라인업 확정 (조율 단계) ========================= */

// 매칭룸 라인업 선택용 로스터(우리 팀 전체 멤버 + 프로필) 로드
export async function loadClubRosterForLineup(clubId) {
  const cid = toStr(clubId);
  if (!cid) return [];

  const members = await listClubMembers({ clubId: cid, limitCount: 100 });
  const uids = uniqStr((members || []).map((m) => toStr(m?.uid)));
  if (!uids.length) return [];

  const profiles = await fetchLineupRosterProfiles(uids);
  return profiles
    .map((p) => ({
      userId: toStr(p?.userId),
      nickname: toStr(p?.nickname) || "선수",
      photoUrl: toStr(p?.photoUrl),
      mainPosition: toStr(p?.mainPosition),
      heightCm: p?.heightCm != null ? p.heightCm : null,
      weightKg: p?.weightKg != null ? p.weightKg : null,
    }))
    .filter((p) => p.userId);
}

// 한 팀(clubId)의 라인업 확정 — 주전(starterIds, =사이즈) + 후보(subIds, 선택)
// roster: loadClubRosterForLineup 결과(미리보기 빌드용)
export async function confirmMatchLineup({
  matchRequestId,
  clubId,
  starterIds = [],
  subIds = [],
  roster = [],
} = {}) {
  const id = toStr(matchRequestId);
  const cid = toStr(clubId);
  if (!id) throw new Error("confirmMatchLineup: matchRequestId is required");
  if (!cid) throw new Error("confirmMatchLineup: clubId is required");

  const ref = doc(db, "match_requests", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

  const mr = snap.data() || {};
  const actorClubId = toStr(mr.actorClubId);
  const targetClubId = toStr(mr.targetClubId);
  if (cid !== actorClubId && cid !== targetClubId) {
    throw new Error("이 경기의 참가 팀이 아닙니다.");
  }

  const isActorTeam = cid === actorClubId;
  const sizeKey =
    toStr(mr.matchSizeKey) ||
    toStr(mr?.fromLineupSnapshot?.matchSizeKey) ||
    toStr(mr?.toLineupSnapshot?.matchSizeKey);
  const size = parseMatchSizeKeyToLimit(sizeKey) || 0;

  const starters = uniqStr(starterIds);
  if (size && starters.length !== size) {
    throw new Error(`주전 ${size}명을 선택해 주세요.`);
  }
  if (!starters.length) throw new Error("주전 선수를 선택해 주세요.");

  const subs = uniqStr(subIds).filter((x) => !starters.includes(x));

  // 미리보기 빌드용 usersById ({ uid: { nickname, avatarUrl, mainPosition } })
  const usersById = {};
  (Array.isArray(roster) ? roster : []).forEach((p) => {
    const uid = toStr(p?.userId);
    if (!uid) return;
    usersById[uid] = {
      nickname: toStr(p?.nickname),
      avatarUrl: toStr(p?.photoUrl || p?.avatarUrl),
      mainPosition: toStr(p?.mainPosition),
      heightCm: p?.heightCm != null ? p.heightCm : null,
      weightKg: p?.weightKg != null ? p.weightKg : null,
    };
  });

  const teamSnap = isActorTeam ? mr.fromTeamSnapshot : mr.toTeamSnapshot;
  const teamName = toStr(teamSnap?.name);

  const base = buildLineupSnapshotSSOT({
    memberIds: starters,
    matchSizeKey: sizeKey,
    usersById,
    id: `lineup_${cid}`,
    name: teamName ? `${teamName} 라인업` : "라인업",
  });

  const lineupSnapshot = {
    ...base,
    subMemberIds: subs,
    subPreviewMembers: pickPreviewMembersFromUsers(usersById, subs, subs.length),
    confirmed: true,
    confirmedAt: serverTimestamp(),
  };

  const field = isActorTeam ? "fromLineupSnapshot" : "toLineupSnapshot";
  const seenUid = toStr(auth.currentUser?.uid);
  const patch = {
    [field]: lineupSnapshot,
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };
  if (seenUid) patch[`lastSeenBy.${seenUid}`] = serverTimestamp();

  await updateDoc(ref, patch);

  // ✅ 라인업에 포함된 우리 팀원들에게 알림 (확정한 팀장 본인은 제외)
  try {
    const includedUids = uniqStr([...starters, ...subs]).filter((u) => u && u !== seenUid);
    if (includedUids.length) {
      const sizeLabel = ["3v3", "4v4", "5v5"].includes(sizeKey)
        ? sizeKey.replace("v", " vs ")
        : "";
      await addDoc(collection(db, "notifications"), {
        kind: "match",
        subType: "matchLineupIncluded",
        type: "match_lineup_included",
        title: "라인업에 포함됐어요",
        body: `${teamName || "우리 팀"} ${sizeLabel || "경기"} 라인업에 포함됐어요. 다가오는 경기를 확인하세요!`,
        targetType: "USER",
        targetIds: includedUids,
        linkType: "match",
        linkTargetId: id,
        meta: { matchId: id, deepLink: `/match-roomdetail/${id}` },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: {},
      });
    }
  } catch (e) {
    console.warn("[confirmMatchLineup] lineup included notify failed:", e?.message || e);
  }

  // ✅ 라인업 확정을 양 팀 채팅에 시스템 메시지로 남김 (상대팀/내가 모두 볼 수 있게)
  // 채팅 id 규칙: match_{matchRequestId} (getOrCreateMatchRoomChat 참고)
  try {
    await sendSystemMessage({
      chatId: `match_${id}`,
      text: teamName ? `${teamName} 팀이 라인업을 확정했어요 ✅` : "라인업이 확정됐어요 ✅",
      meta: { type: "lineup_confirmed", clubId: cid },
    });
  } catch (e) {
    console.warn("[confirmMatchLineup] system message failed:", e?.message || e);
  }

  // ✅ 라인업 확정 알림 → 상대 팀장
  try {
    const oppForLineup = await getOpponentClubId(id, cid);
    if (oppForLineup) {
      await notifyMatchRoomEvent({
        matchId: id,
        recipientClubId: oppForLineup,
        subType: "matchLineupConfirmed",
        type: "match_lineup_confirmed",
        title: "상대팀 라인업 확정",
        body: teamName
          ? `${teamName} 팀이 라인업을 확정했어요.`
          : "상대팀이 라인업을 확정했어요.",
      });
    }
  } catch (e) {
    console.warn("[confirmMatchLineup] notify failed:", e?.message || e);
  }

  return { ok: true };
}

/* ========================= list loader ========================= */

export async function loadMatchRoomListPageData(myTeamId = null) {
  const myClubId = toStr(myTeamId);
  if (!myClubId) {
    return { rooms: [], myTeam: null };
  }

  const col = collection(db, "match_requests");

  const qActor = query(col, where("actorClubId", "==", myClubId), limit(200));
  const qTarget = query(col, where("targetClubId", "==", myClubId), limit(200));

  const [snapA, snapB] = await Promise.all([getDocs(qActor), getDocs(qTarget)]);

  const rowsA = (snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  const rowsB = (snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

  const merged = uniqById([...(rowsA || []), ...(rowsB || [])]);

  const filtered = merged.filter((r) => {
    const st = toStr(r?.status);
    return (
      st === "accepted" ||
      st === "awaiting_venue_approval" ||
      st === "proposed" ||
      st === "confirmed" ||
      st === "finished" ||
      st === "cancelled"
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta =
      tsMs(a?.confirmedAt) ||
      tsMs(a?.proposedAt) ||
      tsMs(a?.acceptedAt) ||
      tsMs(a?.updatedAt) ||
      tsMs(a?.createdAt);
    const tb =
      tsMs(b?.confirmedAt) ||
      tsMs(b?.proposedAt) ||
      tsMs(b?.acceptedAt) ||
      tsMs(b?.updatedAt) ||
      tsMs(b?.createdAt);
    return tb - ta;
  });

  const teamIdSet = new Set();
  for (const mr of sorted) {
    const a = toStr(mr?.actorClubId);
    const t = toStr(mr?.targetClubId);
    if (a) teamIdSet.add(a);
    if (t) teamIdSet.add(t);
  }
  const teamIds = Array.from(teamIdSet);

  const teamMap = {};
  const fetched = await runBatches(teamIds, 24, async (cid) => {
    const t = await safeGetClubTeamSummary(cid);
    return { cid, team: t };
  });

  fetched.forEach(({ cid, team }) => {
    if (team) teamMap[cid] = team;
  });

  const myTeam = teamMap[myClubId] || (await safeGetClubTeamSummary(myClubId)) || null;

  const rooms = sorted.map((mr) => {
    const matchId = toStr(mr?.id);
    const actorClubId = toStr(mr?.actorClubId);
    const targetClubId = toStr(mr?.targetClubId);

    const iAmActor = actorClubId === myClubId;

    const myId = iAmActor ? actorClubId : targetClubId;
    const oppId = iAmActor ? targetClubId : actorClubId;

    const myFallbackSnap = iAmActor ? mr?.fromTeamSnapshot : mr?.toTeamSnapshot;
    const oppFallbackSnap = iAmActor ? mr?.toTeamSnapshot : mr?.fromTeamSnapshot;

    const myTeamResolved = teamMap[myId] || buildFallbackTeamFromSnapshot(myFallbackSnap, myId);
    const oppTeamResolved = teamMap[oppId] || buildFallbackTeamFromSnapshot(oppFallbackSnap, oppId);

    const myRecent = buildRecentFromStats(myTeamResolved);
    const oppRecent = buildRecentFromStats(oppTeamResolved);

    // ✅ 내 팀 라인업에 포함된 선수 uid(주전+후보) — "내가 포함된 경기" 필터용
    const myLineupSnap = iAmActor ? mr?.fromLineupSnapshot : mr?.toLineupSnapshot;
    const myLineupUids = [
      ...(Array.isArray(myLineupSnap?.memberIds) ? myLineupSnap.memberIds : []),
      ...(Array.isArray(myLineupSnap?.subMemberIds) ? myLineupSnap.subMemberIds : []),
    ].map(toStr).filter(Boolean);

    return {
      id: matchId,
      myTeam: myTeamResolved,
      oppTeam: oppTeamResolved,

      myLineupUids,
      myLineupConfirmed: !!myLineupSnap?.confirmed,

      status: normalizeRoomStatus(mr?.status),
      scheduledAt: mr?.scheduledAt || null,
      durationMin: Number.isFinite(Number(mr?.durationMin)) ? Number(mr.durationMin) : null,

      // ✅ 경기 형식(몇대몇) — 카드 표시용
      matchSizeKey:
        toStr(mr?.matchSizeKey) ||
        toStr(mr?.fromLineupSnapshot?.matchSizeKey) ||
        toStr(mr?.toLineupSnapshot?.matchSizeKey),

      proposedByClubId: toStr(mr?.proposedByClubId),
      confirmedByClubId: toStr(mr?.confirmedByClubId),

      // ✅ 제휴구장 예약(분할결제) 상태/정보 — 조율중·확정 카드 표시용
      partnerBooking: mr?.partnerBooking
        ? {
            accepted: mr.partnerBooking.accepted === true,
            payState: toStr(mr.partnerBooking.payState),
            finalized: mr.partnerBooking.finalized === true,
            paidByA: mr.partnerBooking.paidByA === true,
            paidByB: mr.partnerBooking.paidByB === true,
            venueName: toStr(mr.partnerBooking.venueName),
            courtName: toStr(mr.partnerBooking.courtName),
            totalPrice: Number.isFinite(Number(mr.partnerBooking.totalPrice)) ? Number(mr.partnerBooking.totalPrice) : null,
          }
        : null,

      field: mr?.field || null,
      fieldAddress: toStr(mr?.field?.address || mr?.fieldAddress || ""),
      fieldLat:
        mr?.field?.lat != null && Number.isFinite(Number(mr.field.lat)) ? Number(mr.field.lat) : null,
      fieldLng:
        mr?.field?.lng != null && Number.isFinite(Number(mr.field.lng)) ? Number(mr.field.lng) : null,

      // ✅ 문서 myScore=actorScore, oppScore=targetScore → 조회 팀(myClubId) 관점으로 정렬
      //    (loadPlayerFinishedMatches와 동일 규약: myScore=우리팀 점수, oppScore=상대 점수)
      myScore: iAmActor ? (mr?.myScore ?? null) : (mr?.oppScore ?? null),
      oppScore: iAmActor ? (mr?.oppScore ?? null) : (mr?.myScore ?? null),
      resultState: mr?.resultState ?? null,
      result: mr?.result || null,
      iAmActor,

      // ✅ 취소된 경기 카드용 — 상세페이지와 동일 정보(취소 주체·사유·환불 금액) 표시
      cancelledByClubId: toStr(mr?.cancelledByClubId),
      cancelReason: toStr(mr?.cancelReason),
      cancelledAt: mr?.cancelledAt || null,
      refund: mr?.refund && typeof mr.refund === "object" ? mr.refund : null,

      // 미확인 배지용
      lastActivityAt: mr?.lastActivityAt || null,
      lastSeenBy: mr?.lastSeenBy || {},

      // 매칭 성사/조율 진행 표시용
      createdAt: mr?.createdAt || null,
      acceptedAt: mr?.acceptedAt || null,
      myLineupConfirmed: !!(iAmActor ? mr?.fromLineupSnapshot?.confirmed : mr?.toLineupSnapshot?.confirmed),
      oppLineupConfirmed: !!(iAmActor ? mr?.toLineupSnapshot?.confirmed : mr?.fromLineupSnapshot?.confirmed),

      myRecent,
      oppRecent,
    };
  });

  return { rooms, myTeam };
}

// ✅ 팀 월별 활동 + 선수 참여율 데이터
// - 팀의 finished(무효 제외) 경기들을 모아 경기별 [우리팀 라인업 memberIds + 경기일]을 반환.
// - 월별 집계/참여율 계산은 화면(컴포넌트)에서 members와 함께 수행.
export async function loadTeamMonthlyActivity({ clubId } = {}) {
  const myClubId = toStr(clubId);
  if (!myClubId) return { games: [], totalGames: 0 };

  const col = collection(db, "match_requests");
  const [snapA, snapB] = await Promise.all([
    getDocs(query(col, where("actorClubId", "==", myClubId), limit(300))),
    getDocs(query(col, where("targetClubId", "==", myClubId), limit(300))),
  ]);

  const merged = uniqById([
    ...(snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() })),
    ...(snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() })),
  ]);

  // 완료(finished) 경기만, 무효(void)는 제외 → 전적/활동에 반영되는 경기 기준
  const finished = merged.filter(
    (r) => toStr(r?.status) === "finished" && toStr(r?.resultState) !== "void"
  );

  const games = finished.map((mr) => {
    const iAmActor = toStr(mr?.actorClubId) === myClubId;
    const snap = iAmActor ? mr?.fromLineupSnapshot : mr?.toLineupSnapshot;
    const memberIds = Array.isArray(snap?.memberIds)
      ? snap.memberIds.map((x) => toStr(x)).filter(Boolean)
      : [];
    return {
      id: toStr(mr?.id),
      scheduledAt: mr?.scheduledAt || mr?.confirmedAt || mr?.updatedAt || null,
      memberIds,
    };
  });

  return { games, totalGames: games.length };
}

// ✅ AI 예측 적중률: 내 팀이 참여한 finished 경기 중 예측이 "찍은"(confident) 경기의 hit/miss 집계.
//    - push(못 찍은 경기/무승부)와 무효(void)는 제외 → 정직한 적중률.
//    - 기능 도입 이후 종료된 경기만 predictionOutcome을 가지므로, 초기엔 표본이 작다.
export async function getTeamPredictionAccuracy(clubId) {
  const cid = toStr(clubId);
  if (!cid) return { rate: null, sample: 0 };

  const col = collection(db, "match_requests");
  const [snapA, snapB] = await Promise.all([
    getDocs(query(col, where("actorClubId", "==", cid), limit(300))),
    getDocs(query(col, where("targetClubId", "==", cid), limit(300))),
  ]);

  const merged = uniqById([
    ...(snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() })),
    ...(snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() })),
  ]);

  let hits = 0;
  let total = 0;
  merged.forEach((mr) => {
    if (toStr(mr?.status) !== "finished") return;
    if (toStr(mr?.resultState) === "void") return;
    const r = toStr(mr?.predictionOutcome?.result);
    if (r === "hit") {
      hits += 1;
      total += 1;
    } else if (r === "miss") {
      total += 1;
    }
  });

  const rate = total > 0 ? Math.round((hits / total) * 100) : null;
  return { rate, sample: total };
}

// ✅ 상대전적(H2H): 두 팀이 직접 맞붙은 finished(무효 제외) 경기를 내 팀 관점으로 집계.
//    반환 { wins, losses, draws, games, recent:[최신순 W/L/D] } — estimateWinProbability(opts.h2h)에 주입.
export async function getHeadToHeadRecord(myClubId, oppClubId) {
  const me = toStr(myClubId);
  const opp = toStr(oppClubId);
  const empty = { wins: 0, losses: 0, draws: 0, games: 0, recent: [] };
  if (!me || !opp || me === opp) return empty;

  const col = collection(db, "match_requests");
  const [snapA, snapB] = await Promise.all([
    getDocs(query(col, where("actorClubId", "==", me), limit(300))),
    getDocs(query(col, where("targetClubId", "==", me), limit(300))),
  ]);

  const merged = uniqById([
    ...(snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() })),
    ...(snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() })),
  ]);

  const games = merged.filter((mr) => {
    if (toStr(mr?.status) !== "finished") return false;
    if (toStr(mr?.resultState) === "void") return false;
    const a = toStr(mr?.actorClubId);
    const t = toStr(mr?.targetClubId);
    return (a === me && t === opp) || (a === opp && t === me);
  });

  // 최신순 정렬(맞대결 흐름용)
  const sorted = [...games].sort((x, y) => {
    const tx = tsMs(x?.scheduledAt) || tsMs(x?.resultAcceptedAt) || tsMs(x?.updatedAt) || tsMs(x?.createdAt);
    const ty = tsMs(y?.scheduledAt) || tsMs(y?.resultAcceptedAt) || tsMs(y?.updatedAt) || tsMs(y?.createdAt);
    return ty - tx;
  });

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const recent = [];
  sorted.forEach((mr) => {
    const iAmActor = toStr(mr?.actorClubId) === me;
    const myScore = Number(iAmActor ? mr?.myScore : mr?.oppScore);
    const oppScore = Number(iAmActor ? mr?.oppScore : mr?.myScore);
    if (!Number.isFinite(myScore) || !Number.isFinite(oppScore)) return;
    if (myScore > oppScore) {
      wins += 1;
      recent.push("W");
    } else if (myScore < oppScore) {
      losses += 1;
      recent.push("L");
    } else {
      draws += 1;
      recent.push("D");
    }
  });

  return { wins, losses, draws, games: wins + losses + draws, recent: recent.slice(0, 5) };
}

// ✅ 선수 월별 활동(팀 대비 참여율)용 데이터
// - 팀 경기(games: 경기별 라인업 memberIds) + 팀원 uid 목록을 반환.
// - 참여율/순위/팀평균은 화면(컴포넌트)에서 myUid와 함께 계산.
export async function loadPlayerMonthlyActivity({ clubId, uid } = {}) {
  const cid = toStr(clubId);
  if (!cid) return { games: [], memberUids: [] };

  const [{ games }, memberUids] = await Promise.all([
    loadTeamMonthlyActivity({ clubId: cid }),
    (async () => {
      try {
        const ms = await getDocs(collection(db, "clubs", cid, "members"));
        const ids = (ms?.docs || [])
          .map((d) => {
            const data = d.data() || {};
            return toStr(data.uid || data.userId || d.id);
          })
          .filter(Boolean);
        return Array.from(new Set(ids));
      } catch (e) {
        return [];
      }
    })(),
  ]);

  return { games, memberUids };
}

/**
 * ✅ 특정 선수(uid)가 "라인업에 실제로 참가한" 종료(finished) 경기만 반환
 * - clubId(선수의 소속 팀)의 finished 경기 중, 내 팀 라인업 memberIds에 uid가 포함된 것만 필터
 * - rooms는 선수 팀 관점으로 myTeam/oppTeam/myScore/oppScore 정렬 → TeamMatchHistorySection 그대로 사용 가능
 */
export async function loadPlayerFinishedMatches({ clubId, uid } = {}) {
  const myClubId = toStr(clubId);
  const myUid = toStr(uid);
  if (!myClubId || !myUid) return { rooms: [] };

  const col = collection(db, "match_requests");
  const qActor = query(col, where("actorClubId", "==", myClubId), limit(200));
  const qTarget = query(col, where("targetClubId", "==", myClubId), limit(200));
  const [snapA, snapB] = await Promise.all([getDocs(qActor), getDocs(qTarget)]);

  const rowsA = (snapA?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  const rowsB = (snapB?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
  const merged = uniqById([...(rowsA || []), ...(rowsB || [])]);

  const finished = merged.filter((r) => toStr(r?.status) === "finished");

  // 라인업 참가 필터: 내 팀(actor/target) 라인업 스냅샷 memberIds에 uid 포함
  const participated = finished.filter((mr) => {
    const iAmActor = toStr(mr?.actorClubId) === myClubId;
    const snap = iAmActor ? mr?.fromLineupSnapshot : mr?.toLineupSnapshot;
    const ids = Array.isArray(snap?.memberIds) ? snap.memberIds.map((x) => toStr(x)) : [];
    return ids.includes(myUid);
  });

  // 정렬: 최신 경기 먼저
  const sorted = [...participated].sort((a, b) => {
    const ta = tsMs(a?.scheduledAt) || tsMs(a?.confirmedAt) || tsMs(a?.updatedAt) || tsMs(a?.createdAt);
    const tb = tsMs(b?.scheduledAt) || tsMs(b?.confirmedAt) || tsMs(b?.updatedAt) || tsMs(b?.createdAt);
    return tb - ta;
  });

  // 팀 요약(이름/로고)
  const teamIdSet = new Set();
  sorted.forEach((mr) => {
    const a = toStr(mr?.actorClubId);
    const t = toStr(mr?.targetClubId);
    if (a) teamIdSet.add(a);
    if (t) teamIdSet.add(t);
  });
  const teamMap = {};
  await runBatches(Array.from(teamIdSet), 24, async (cid) => {
    const team = await safeGetClubTeamSummary(cid);
    if (team) teamMap[cid] = team;
    return null;
  });

  const rooms = sorted.map((mr) => {
    const iAmActor = toStr(mr?.actorClubId) === myClubId;
    const myId = iAmActor ? toStr(mr?.actorClubId) : toStr(mr?.targetClubId);
    const oppId = iAmActor ? toStr(mr?.targetClubId) : toStr(mr?.actorClubId);

    const myFallbackSnap = iAmActor ? mr?.fromTeamSnapshot : mr?.toTeamSnapshot;
    const oppFallbackSnap = iAmActor ? mr?.toTeamSnapshot : mr?.fromTeamSnapshot;

    const myTeam = teamMap[myId] || buildFallbackTeamFromSnapshot(myFallbackSnap, myId);
    const oppTeam = teamMap[oppId] || buildFallbackTeamFromSnapshot(oppFallbackSnap, oppId);

    // 문서 myScore=actorScore, oppScore=targetScore → 선수 팀 관점으로 정렬
    const actorScore = mr?.myScore ?? null;
    const targetScore = mr?.oppScore ?? null;
    const myScore = iAmActor ? actorScore : targetScore;
    const oppScore = iAmActor ? targetScore : actorScore;

    return {
      id: toStr(mr?.id),
      myTeam,
      oppTeam,
      status: normalizeRoomStatus(mr?.status),
      scheduledAt: mr?.scheduledAt || null,
      myScore,
      oppScore,
      iAmActor,
    };
  });

  return { rooms };
}

/* ========================= detail adapter ========================= */

function normalizeTeamSnapshot(snap) {
  const s = snap || {};
  return {
    clubId: toStr(s.clubId || s.id),
    id: toStr(s.clubId || s.id),
    name: toStr(s.name),
    region: toStr(s.region),
    regionSido: toStr(s.regionSido),
    regionGu: toStr(s.regionGu),
    logoUrl: toStr(s.logoUrl),
    stats: s.stats || null,
  };
}

function normalizeLineupSnapshot(snap) {
  const s = snap || {};
  const mapPreview = (arr) =>
    (Array.isArray(arr) ? arr : []).map((m, idx) => {
      const userId = toStr(m?.userId || m?.uid || m?.id) || `unknown-${idx}`;
      const nickname = toStr(m?.nickname || m?.name) || "선수";
      const mainPosition = toStr(m?.mainPosition || m?.position || m?.pos) || "";
      const heightCm = m?.heightCm != null ? safeNum(m.heightCm, null) : null;
      const weightKg = m?.weightKg != null ? safeNum(m.weightKg, null) : null;
      const photoUrl = toStr(m?.photoUrl || m?.avatarUrl || m?.profileUrl);
      const skillLevel = toStr(m?.skillLevel);
      return { userId, nickname, mainPosition, heightCm, weightKg, photoUrl, skillLevel };
    });

  const players = mapPreview(s.previewMembers);
  const subPlayers = mapPreview(s.subPreviewMembers);

  return {
    id: toStr(s.id),
    matchSizeKey: toStr(s.matchSizeKey),
    memberCount: safeNum(s.memberCount, players.length),
    memberIds: Array.isArray(s.memberIds) ? s.memberIds.map((x) => toStr(x)).filter(Boolean) : [],
    players,
    // ✅ 룸에서 확정된 라인업 여부 + 후보(벤치)
    confirmed: s.confirmed === true,
    subMemberIds: Array.isArray(s.subMemberIds) ? s.subMemberIds.map((x) => toStr(x)).filter(Boolean) : [],
    subPlayers,
  };
}

export function adaptMatchRequestToRoom(docId, data) {
  const d = data || {};
  const rawStatus = toStr(d.status);

  const field = d.field && typeof d.field === "object" ? d.field : null;
  const result = d.result && typeof d.result === "object" ? d.result : null;

  return {
    id: docId,
    status: rawStatus || "accepted",
    rawStatus,

    actorClubId: toStr(d.actorClubId),
    targetClubId: toStr(d.targetClubId),

    matchSizeKey:
      toStr(d.matchSizeKey) ||
      toStr(d?.fromLineupSnapshot?.matchSizeKey) ||
      toStr(d?.toLineupSnapshot?.matchSizeKey),

    scheduledAt: d.scheduledAt || null,
    durationMin: Number.isFinite(Number(d.durationMin)) ? Number(d.durationMin) : null,

    proposedByClubId: toStr(d.proposedByClubId),
    confirmedByClubId: toStr(d.confirmedByClubId),
    cancelledByClubId: toStr(d.cancelledByClubId),

    // 취소 사유/환불 — 취소된 경기 카드(사유·정산) 표시용
    cancelReason: toStr(d.cancelReason),
    cancelReasonKey: toStr(d.cancelReasonKey),
    cancelReasonText: toStr(d.cancelReasonText),
    cancelledAt: d.cancelledAt || null,
    refund: d.refund && typeof d.refund === "object" ? d.refund : null,

    field,
    fieldAddress: toStr(field?.address || d.fieldAddress || ""),
    fieldLat: field?.lat != null ? Number(field.lat) : null,
    fieldLng: field?.lng != null ? Number(field.lng) : null,

    myTeam: normalizeTeamSnapshot(d.fromTeamSnapshot), // ✅ actor team
    oppTeam: normalizeTeamSnapshot(d.toTeamSnapshot), // ✅ target team
    myLineup: normalizeLineupSnapshot(d.fromLineupSnapshot),
    oppLineup: normalizeLineupSnapshot(d.toLineupSnapshot),

    // ✅ score SSOT: myScore=actorScore, oppScore=targetScore
    myScore: d.myScore ?? null,
    oppScore: d.oppScore ?? null,
    resultState: d.resultState || null,

    result: result || null,
    statsAppliedAt: d.statsAppliedAt || null,
  };
}

/**
 * ✅ 선수 명단 보강
 * 라인업 스냅샷에 previewMembers가 없어 players가 비어있는 경우(과거/현재 데이터 공통),
 * 보존된 memberIds로 users 프로필을 조회해 players를 채운다.
 * - players가 이미 있으면 스냅샷(역사 보존) 값을 그대로 사용
 * - memberIds가 없으면 손대지 않음
 */
async function hydrateLineupPlayers(lineup) {
  if (!lineup) return lineup;
  const hasPlayers = Array.isArray(lineup.players) && lineup.players.length > 0;
  const ids = Array.isArray(lineup.memberIds) ? lineup.memberIds.filter(Boolean) : [];
  if (hasPlayers || ids.length === 0) return lineup;

  const profiles = await Promise.all(
    ids.map((uid) => getUserProfileByUid(uid).catch(() => null))
  );

  const players = profiles.map((u, idx) => {
    const id = toStr(ids[idx]);
    if (!u) {
      return { userId: id, nickname: "선수", mainPosition: "", heightCm: null, weightKg: null, photoUrl: "" };
    }
    return {
      userId: toStr(u.id || id),
      nickname: toStr(u.nickname || u.name) || "선수",
      mainPosition: toStr(u.mainPosition || u.position || ""),
      heightCm: u.heightCm != null ? safeNum(u.heightCm, null) : null,
      weightKg: u.weightKg != null ? safeNum(u.weightKg, null) : null,
      photoUrl: toStr(u.avatarUrl || u.photoUrl || u.profileUrl || ""),
    };
  });

  return { ...lineup, players, memberCount: lineup.memberCount || players.length };
}

/**
 * ✅ 매칭룸 실시간 구독
 * - match_requests/{id} 문서를 onSnapshot 으로 구독.
 * - 라인업 확정(from/toLineupSnapshot.confirmed)·상태·일정 등 핵심 필드가 바뀌면
 *   onChange(signature) 호출 → 페이지에서 loadMatchRoomDetail 재조회.
 * - 반환값: unsubscribe 함수
 */
export function subscribeMatchRoom(matchRequestId, onChange) {
  const id = toStr(matchRequestId);
  if (!id || typeof onChange !== "function") return () => {};

  const ref = doc(db, "match_requests", id);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const d = snap.data() || {};
      onChange({
        status: toStr(d.status),
        resultState: toStr(d.resultState),
        proposedByClubId: toStr(d.proposedByClubId),
        confirmedByClubId: toStr(d.confirmedByClubId),
        scheduledAtMs: tsMs(d.scheduledAt) || 0,
        updatedAtMs: tsMs(d.updatedAt) || 0,
        fromLineupConfirmed: !!d?.fromLineupSnapshot?.confirmed,
        toLineupConfirmed: !!d?.toLineupSnapshot?.confirmed,
      });
    },
    (err) => {
      console.warn("[matchRoomService] subscribeMatchRoom error:", err?.message || err);
    }
  );
}

export async function loadMatchRoomDetail(matchRequestId) {
  const id = toStr(matchRequestId);
  if (!id) return { room: null };

  const ref = doc(db, "match_requests", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.warn("[matchRoomService] match_requests not found:", id);
    return { room: null };
  }

  const data = snap.data();
  const room = adaptMatchRequestToRoom(snap.id, data);

  // 선수 명단이 비어있으면 memberIds로 보강 (기존/신규 매칭룸 모두 대응)
  const [myLineup, oppLineup] = await Promise.all([
    hydrateLineupPlayers(room.myLineup),
    hydrateLineupPlayers(room.oppLineup),
  ]);
  room.myLineup = myLineup;
  room.oppLineup = oppLineup;

  // ✅ 선수 실력(skillLevel) 보강: 라인업 선수들의 users 프로필에서 실력 주입
  // - 라인업 스냅샷(previewMembers)에는 실력이 없을 수 있어 항상 최신 프로필로 채운다
  try {
    const collectIds = (lineup) =>
      [
        ...((lineup?.players || []).map((p) => toStr(p?.userId))),
        ...((lineup?.subPlayers || []).map((p) => toStr(p?.userId))),
        ...((lineup?.memberIds) || []).map((x) => toStr(x)),
      ].filter(Boolean);

    const allIds = uniqStr([...collectIds(room.myLineup), ...collectIds(room.oppLineup)]);
    if (allIds.length) {
      const profs = await fetchLineupRosterProfiles(allIds);
      const skillById = {};
      profs.forEach((pr) => {
        if (pr?.userId) skillById[pr.userId] = toStr(pr.skillLevel);
      });
      const inject = (lineup) => {
        if (!lineup) return lineup;
        const mapSkill = (p) => ({ ...p, skillLevel: toStr(p?.skillLevel) || skillById[toStr(p?.userId)] || "" });
        return {
          ...lineup,
          players: (lineup.players || []).map(mapSkill),
          subPlayers: (lineup.subPlayers || []).map(mapSkill),
        };
      };
      room.myLineup = inject(room.myLineup);
      room.oppLineup = inject(room.oppLineup);
    }
  } catch (e) {
    console.warn("[matchRoomService] skill enrich failed:", e?.message || e);
  }

  // 선수 평점(상대 팀에 남긴 별점) 동봉
  try {
    room.reviews = await listMatchReviews({ matchRequestId: id });
  } catch (e) {
    console.warn("[matchRoomService] listMatchReviews failed:", e?.message || e);
    room.reviews = [];
  }

  return { room };
}

/* ========================= propose / confirm / cancel ========================= */

/* ───── 매칭룸 이벤트 푸시 알림 (상대 팀장에게) ─────
   sendPushTick은 targetIds(uid)로 발송하므로 수신 팀의 ownerUid를 명시한다. */
async function notifyMatchRoomEvent({ matchId, recipientClubId, subType, type, title, body, deepLink, actorTeamLogoUrl = "" }) {
  try {
    const rid = toStr(recipientClubId);
    if (!rid || !toStr(matchId)) return;
    const clubSnap = await getDoc(doc(db, "clubs", rid));
    const ownerUid = toStr(clubSnap.exists() ? clubSnap.data()?.ownerUid : "");
    if (!ownerUid) return;

    await addDoc(collection(db, "notifications"), {
      kind: "match",
      subType,
      type,
      title,
      body,
      targetType: "USER",
      targetIds: [ownerUid],
      linkType: "match",
      linkTargetId: toStr(matchId),
      // actorTeamLogoUrl: 상단 인앱 배너에서 요청 팀 프로필 사진으로 노출(useNotificationBanner)
      meta: { matchId: toStr(matchId), deepLink: toStr(deepLink) || `/match-roomdetail/${toStr(matchId)}`, actorTeamLogoUrl: toStr(actorTeamLogoUrl) },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "match",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[matchRoom] notifyMatchRoomEvent failed:", e?.message || e);
  }
}

// matchId로 mr 읽어 actor/target 중 actorClubId가 아닌 쪽(상대) clubId 반환
async function getOpponentClubId(matchId, actingClubId) {
  try {
    const snap = await getDoc(doc(db, "match_requests", toStr(matchId)));
    if (!snap.exists()) return "";
    const mr = snap.data() || {};
    const a = toStr(mr.actorClubId);
    const t = toStr(mr.targetClubId);
    const acting = toStr(actingClubId);
    if (acting && acting === a) return t;
    if (acting && acting === t) return a;
    return "";
  } catch (e) {
    return "";
  }
}

// ✅ 라인업 확정 요청 알림: 아직 라인업을 확정하지 않은 상대 팀(팀장)에게 발송
// - notifications 문서 생성(푸시 큐) + 매칭룸 채팅에 시스템 메시지
export async function sendLineupReminder({ matchRequestId, fromClubId } = {}) {
  const id = toStr(matchRequestId);
  const from = toStr(fromClubId);
  if (!id) throw new Error("sendLineupReminder: matchRequestId is required");

  const oppClubId = await getOpponentClubId(id, from);
  if (!oppClubId) throw new Error("상대 팀을 찾을 수 없습니다.");

  await notifyMatchRoomEvent({
    matchId: id,
    recipientClubId: oppClubId,
    subType: "matchLineupReminder",
    type: "match_lineup_reminder",
    title: "라인업 확정 요청",
    body: "상대팀이 라인업을 기다리고 있어요. 라인업을 확정해 주세요.",
  });

  // 채팅에도 시스템 메시지로 남겨 양 팀이 확인 가능
  try {
    await sendSystemMessage({
      chatId: `match_${id}`,
      text: "상대팀에 라인업 확정을 요청했어요.",
      meta: { type: "lineup_reminder", clubId: from },
    });
  } catch (e) {
    console.warn("[sendLineupReminder] system message failed:", e?.message || e);
  }

  return { ok: true };
}

// ── 매칭룸 미확인 배지: 상세 열람 시 "본 시각" 기록(배지 해제) ──
export async function markMatchRoomSeen({ matchRequestId, uid } = {}) {
  const id = toStr(matchRequestId);
  const u = toStr(uid || auth.currentUser?.uid);
  if (!id || !u) return;
  try {
    await updateDoc(doc(db, "match_requests", id), {
      [`lastSeenBy.${u}`]: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[match] markMatchRoomSeen failed:", e?.message || e);
  }
}

// 내 행동(제안/확정/취소/메시지)에 붙일 활동패치 — 상대에겐 새 알림, 나는 본 것으로 처리
function activityPatch() {
  const u = toStr(auth.currentUser?.uid);
  const patch = { lastActivityAt: serverTimestamp() };
  if (u) patch[`lastSeenBy.${u}`] = serverTimestamp();
  return patch;
}

export async function proposeMatchSchedule({
  matchRequestId,
  scheduledAtISO,
  fieldAddress,
  fieldLatLng,
  durationMin,
  proposedByClubId,
} = {}) {
  const id = toStr(matchRequestId);
  const iso = toStr(scheduledAtISO);
  const proposer = toStr(proposedByClubId);

  if (!id) throw new Error("proposeMatchSchedule: matchRequestId is required");
  if (!iso) throw new Error("proposeMatchSchedule: scheduledAtISO is required");
  if (!proposer) throw new Error("proposeMatchSchedule: proposedByClubId is required");

  const addr = toStr(fieldAddress);
  const lat = fieldLatLng && Number.isFinite(Number(fieldLatLng.lat)) ? Number(fieldLatLng.lat) : null;
  const lng = fieldLatLng && Number.isFinite(Number(fieldLatLng.lng)) ? Number(fieldLatLng.lng) : null;

  if (!addr) throw new Error("proposeMatchSchedule: fieldAddress is required");
  if (lat == null || lng == null) throw new Error("proposeMatchSchedule: fieldLatLng is required");

  const ref = doc(db, "match_requests", id);

  const durMin = Number.isFinite(Number(durationMin)) ? Number(durationMin) : 120;

  await updateDoc(ref, {
    status: "proposed",
    scheduledAt: iso,

    field: { address: addr, lat, lng },
    durationMin: durMin,
    proposedByClubId: proposer,
    proposedAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
    ...activityPatch(),
  });

  // 제안 시점을 채팅에 남긴다 → 채팅에서 이 메시지 자리에 제안 카드가 렌더된다.
  try {
    await sendSystemMessage({
      chatId: `match_${id}`,
      text: "구장·일정을 제안했어요 📍",
      meta: { type: "schedule_proposed", clubId: proposer },
    });
  } catch (e) {
    console.warn("[match] propose system message failed:", e?.message || e);
  }

  // (1-13) 제의 알림 → 상대 팀장
  const oppForPropose = await getOpponentClubId(id, proposer);
  if (oppForPropose) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: oppForPropose,
      subType: "matchProposed",
      type: "match_proposed",
      title: "구장·일정 제안 도착",
      body: "상대팀이 구장·일정을 제안했어요. 확인하고 수락해 주세요.",
    });
  }

  return true;
}

/**
 * 보낸 구장·일정 제안만 취소 (매칭 자체는 유지).
 * - status: proposed → accepted(조율중)로 복귀, 제안 데이터(일정/구장) 비움.
 * - 라인업 확정 등 다른 상태는 그대로 → 바로 다시 제안 가능.
 */
export async function cancelProposedSchedule({ matchRequestId, cancelledByClubId } = {}) {
  const id = toStr(matchRequestId);
  const canceller = toStr(cancelledByClubId);
  if (!id) throw new Error("cancelProposedSchedule: matchRequestId is required");

  const ref = doc(db, "match_requests", id);
  await updateDoc(ref, {
    status: "accepted",
    scheduledAt: null,
    field: null,
    proposedByClubId: "",
    proposedAt: null,
    partnerBooking: null, // 제휴구장 제안도 함께 정리 → 취소 후 유령 제휴구장 카드 잔존 방지
    updatedAt: serverTimestamp(),
    ...activityPatch(),
  });

  // 제안 카드는 status가 proposed일 때만 뜬다 → 취소 사실도 채팅에 남겨 흐름이 끊기지 않게
  try {
    await sendSystemMessage({
      chatId: `match_${id}`,
      text: "구장·일정 제안을 취소했어요",
      meta: { type: "schedule_proposal_cancelled", clubId: canceller },
    });
  } catch (e) {
    console.warn("[match] cancel-proposal system message failed:", e?.message || e);
  }

  // 상대 팀에 제안 철회 알림
  const opp = canceller ? await getOpponentClubId(id, canceller) : "";
  if (opp) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: opp,
      subType: "matchProposalCancelled",
      type: "match_proposal_cancelled",
      title: "구장·일정 제안 취소",
      body: "상대팀이 보냈던 구장·일정 제안을 취소했어요.",
    });
  }
  return true;
}

export async function confirmProposedSchedule({ matchRequestId, confirmedByClubId } = {}) {
  const id = toStr(matchRequestId);
  const confirmer = toStr(confirmedByClubId);

  if (!id) throw new Error("confirmProposedSchedule: matchRequestId is required");
  if (!confirmer) throw new Error("confirmProposedSchedule: confirmedByClubId is required");

  const ref = doc(db, "match_requests", id);

  await updateDoc(ref, {
    status: "confirmed",
    confirmedByClubId: confirmer,
    confirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...activityPatch(),
  });

  // (1-13) 경기 확정 알림 → 제안했던 상대 팀장
  const oppForConfirm = await getOpponentClubId(id, confirmer);
  if (oppForConfirm) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: oppForConfirm,
      subType: "matchConfirmed",
      type: "match_confirmed",
      title: "경기 확정 🎉",
      body: "상대팀이 수락해 경기가 확정됐어요! 일정을 확인하세요.",
      // 보낸 사람(제안자)이 푸시를 눌러 진입하면 경기 확정 축하창을 띄운다.
      deepLink: `/match-roomdetail/${id}?celebrate=confirmed`,
    });
  }

  // 양 팀 팀원에게도 "경기 확정" 알림 (팀장 제외 — 팀장은 위에서 받음)
  try {
    const confirmBody = "경기 일정·구장이 확정됐어요! 이용료는 현장에서 정산해요. 자세한 내용을 확인하세요.";
    await Promise.all([
      notifyClubMembersEvent({
        matchId: id,
        clubId: confirmer,
        subType: "matchConfirmed",
        type: "match_confirmed",
        title: "경기 확정 🎉",
        body: confirmBody,
      }),
      oppForConfirm
        ? notifyClubMembersEvent({
            matchId: id,
            clubId: oppForConfirm,
            subType: "matchConfirmed",
            type: "match_confirmed",
            title: "경기 확정 🎉",
            body: confirmBody,
          })
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.warn("[confirmProposedSchedule] member notify failed:", e?.message || e);
  }

  return true;
}

export async function cancelMatchRequest({
  matchRequestId,
  cancelledByClubId,
  reasonKey = "",
  reasonText = "",
  cancelledByName = "",
} = {}) {
  const id = toStr(matchRequestId);
  if (!id) throw new Error("cancelMatchRequest: matchRequestId is required");

  const ref = doc(db, "match_requests", id);
  const by = toStr(cancelledByClubId);

  // 사유 문자열(상대팀 표시용)
  const label = MATCH_CANCEL_REASON_LABELS[toStr(reasonKey)] || "";
  const reasonStr =
    [label, toStr(reasonText)].filter(Boolean).join(" · ") || "사유 미입력";

  // 제휴구장 결제 예약이면 환불(구조) 처리 — 직접입력은 null
  let refund = null;
  try {
    refund = await refundPartnerReservationIfPaid(id, reasonStr);
  } catch (e) {
    console.warn("[cancelMatchRequest] refund failed:", e?.message || e);
  }

  const patch = {
    status: "cancelled",
    cancelReason: reasonStr,
    cancelReasonKey: toStr(reasonKey),
    cancelReasonText: toStr(reasonText),
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...activityPatch(),
  };
  if (by) patch.cancelledByClubId = by;
  if (refund) patch.refund = refund;

  await updateDoc(ref, patch);

  // 상대팀 알림(푸시) — 취소 사유 포함
  try {
    const oppClubId = await getOpponentClubId(id, by);
    if (oppClubId) {
      const refundNote =
        refund && refund.amount > 0
          ? refund.status === "refunded"
            ? ` · 결제하신 ${refund.amount.toLocaleString()}원은 환불됐어요.`
            : ` · 결제하신 ${refund.amount.toLocaleString()}원은 환불 처리될 예정이에요.`
          : "";
      await notifyMatchRoomEvent({
        matchId: id,
        recipientClubId: oppClubId,
        subType: "matchCancelled",
        type: "match_cancelled",
        title: "경기가 취소됐어요",
        body: `${toStr(cancelledByName) || "상대팀"}이(가) 경기를 취소했어요. 사유: ${reasonStr}${refundNote}`,
      });
    }
  } catch (e) {
    console.warn("[cancelMatchRequest] notify failed:", e?.message || e);
  }

  // 채팅 시스템 메시지
  try {
    await sendSystemMessage({
      chatId: `match_${id}`,
      text: `경기가 취소됐어요. 사유: ${reasonStr}`,
      meta: { type: "match_cancelled", clubId: by, reasonKey: toStr(reasonKey) },
    });
  } catch (e) {}

  return { ok: true, refund };
}

/* ========================= result (submit) ========================= */

// ✅ 결과 제출 + 사진/코멘트 저장
// - files: File[] (이미지)
// - 저장: status는 confirmed 유지, resultState는 waiting_accept
export async function submitMatchResultWithMedia({
  matchRequestId,
  actorScore,
  targetScore,
  comment = "",
  files = [],
  opponentRating = 0, // ✅ 상대 팀 별점(1~5, 선택)
  submittedByClubId,

  // ✅ 추가: 작성자 메타(선택)
  authorUid = "",
  authorName = "",
  authorRole = "", // "owner" | "member" 등 (선택)
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);

  const auid = toStr(authorUid);
  const aname = toStr(authorName);
  const arole = toStr(authorRole);

  if (!id) throw new Error("submitMatchResultWithMedia: matchRequestId is required");
  if (!by) throw new Error("submitMatchResultWithMedia: submittedByClubId is required");

  const as = safeNum(actorScore, NaN);
  const ts = safeNum(targetScore, NaN);
  if (!Number.isFinite(as) || !Number.isFinite(ts))
    throw new Error("submitMatchResultWithMedia: scores are required");

  const cleanComment = String(comment || "").trim();

  // ✅ 이미지 업로드(서비스에서 처리)
  const fileList = Array.isArray(files) ? files.filter(Boolean) : [];
  const uploadedUrls = [];

  if (fileList.length > 0) {
    const uploaded = await Promise.all(
      fileList.slice(0, 6).map(async (file) => {
        const res = await uploadCompressedImageMedia({
          scope: "match_requests",
          ownerId: id,
          file,
          kind: "result",
        });
        return res?.url || "";
      })
    );

    uploaded.forEach((u) => {
      const url = toStr(u);
      if (url) uploadedUrls.push(url);
    });
  }

  const ref = doc(db, "match_requests", id);

  // 팀원 리뷰 알림 1회만 발송하도록 기존 발송 여부 확인
  let reviewAlreadyNotified = false;
  try {
    const cur = await getDoc(ref);
    reviewAlreadyNotified = !!cur.data()?.reviewRequestSent;
  } catch (e) {}

  // ✅ 동시 입력 방지: 상대팀이 이미 결과를 제출/확정했으면 덮어쓰기 금지 (트랜잭션)
  await runTransaction(db, async (tx) => {
    const cur = await tx.get(ref);
    const d = cur.exists() ? cur.data() || {} : {};
    const rs = toStr(d.resultState);
    const submitter = toStr(d?.result?.submittedByClubId);
    if ((rs === "waiting_accept" || rs === "confirmed") && submitter && submitter !== by) {
      throw new Error("상대팀이 먼저 결과를 입력했어요. 새로고침 후 확인해 주세요.");
    }
    tx.update(ref, {
      // score SSOT
      myScore: as, // actorScore
      oppScore: ts, // targetScore

      // ✅ confirmed 상태 유지(확정된 게임에서 결과 입력)
      status: "confirmed",
      resultState: "waiting_accept",
      reviewRequestSent: true,

      result: {
        submittedByClubId: by,

        // ✅ 작성자 메타 (있으면 저장, 없으면 빈값)
        authorUid: auid,
        authorName: aname,
        authorRole: arole,

        comment: cleanComment,
        photoUrls: uploadedUrls,
        opponentRating: safeNum(opponentRating, 0),
        submittedAt: serverTimestamp(),
      },

      updatedAt: serverTimestamp(),
    });
  });

  // (1-13) 결과 입력 알림 → 상대 팀장 (확인/인정 요청)
  const oppForResult = await getOpponentClubId(id, by);
  if (oppForResult) {
    await notifyMatchRoomEvent({
      matchId: id,
      recipientClubId: oppForResult,
      subType: "matchResultSubmitted",
      type: "match_result_submitted",
      title: "경기 결과 입력됨",
      body: `상대팀이 경기 결과(${as} : ${ts})를 입력했어요. 확인하고 인정해 주세요.`,
    });

    // 상대팀 팀원들에게도 "상대팀이 결과/후기 입력함" 알림 (팀장 제외)
    await notifyClubMembersEvent({
      matchId: id,
      clubId: oppForResult,
      subType: "matchResultSubmitted",
      type: "match_result_submitted",
      title: "상대팀이 경기 결과를 남겼어요",
      body: `상대팀이 경기 결과(${as} : ${ts})와 후기를 남겼어요.`,
    });
  }

  // 팀장이 결과를 입력하면, 양 팀 팀원들에게 "상대 팀 리뷰 작성" 알림 (1회만, 팀장 제외)
  if (!reviewAlreadyNotified) {
    try {
      await Promise.all([
        notifyClubMembersToReview(id, by),
        oppForResult ? notifyClubMembersToReview(id, oppForResult) : Promise.resolve(),
      ]);
    } catch (e) {
      console.warn("[submitMatchResult] member review notify failed:", e?.message || e);
    }
  }

  return { ok: true, photoUrls: uploadedUrls };
}

/* ========================= result + stats (client transaction) ========================= */

function normalizeRecentArray(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((x) => {
      const v = toStr(x).toUpperCase();
      if (v === "W" || v === "L" || v === "D") return v;
      return "";
    })
    .filter(Boolean)
    .slice(0, 5);
}

function computeNextStats(prevStats, nextResult) {
  const prev = prevStats && typeof prevStats === "object" ? prevStats : {};
  const wins = safeNum(prev.wins, 0) + (nextResult === "W" ? 1 : 0);
  const losses = safeNum(prev.losses, 0) + (nextResult === "L" ? 1 : 0);
  const draws = safeNum(prev.draws, 0) + (nextResult === "D" ? 1 : 0);
  const prevTotal = safeNum(prev.totalMatches, safeNum(prev.wins, 0) + safeNum(prev.losses, 0) + safeNum(prev.draws, 0));
  const totalMatches = prevTotal + 1;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;

  const recent = normalizeRecentArray(prev.recentResults);
  const recentResults = [nextResult, ...recent].slice(0, 5);

  return { wins, losses, draws, totalMatches, winRate, recentResults };
}

function extractMemberIdsStrict(lineupSnap, labelForLog) {
  const snap = lineupSnap && typeof lineupSnap === "object" ? lineupSnap : {};
  const ids = Array.isArray(snap.memberIds) ? snap.memberIds.map((x) => toStr(x)).filter(Boolean) : [];
  if (ids.length > 0) return uniqStr(ids);

  const preview = Array.isArray(snap.previewMembers) ? snap.previewMembers : [];
  const legacy = preview.map((m) => toStr(m?.userId || m?.uid || m?.id)).filter(Boolean);
  if (legacy.length > 0) {
    console.warn(
      `[matchRoomService][acceptMatchResult] lineup.memberIds missing -> using previewMembers as legacy source (${labelForLog}). ` +
        `PLEASE FIX lineup writer to always set memberIds.`
    );
    return uniqStr(legacy);
  }

  return [];
}

// ✅ 결과 인정 + clubs.stats + users.stats 트랜잭션 반영(중복 방지 statsAppliedAt)
// - 승인되면 status=finished 로 내려감 (지난 게임 탭)
export async function acceptMatchResult({ matchRequestId, confirmedByClubId } = {}) {
  const id = toStr(matchRequestId);
  const confirmer = toStr(confirmedByClubId);

  if (!id) throw new Error("acceptMatchResult: matchRequestId is required");
  if (!confirmer) throw new Error("acceptMatchResult: confirmedByClubId is required");

  const mrRef = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    // =========================
    // 0) READS (무조건 먼저 전부)
    // =========================
    const mrSnap = await tx.get(mrRef);
    if (!mrSnap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = mrSnap.data() || {};

    // 이미 적용된 케이스면 mr만 마무리(추가 READ 없음)
    if (mr.statsAppliedAt) {
      tx.update(mrRef, {
        resultState: "confirmed",
        status: "finished",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const actorClubId = toStr(mr.actorClubId);
    const targetClubId = toStr(mr.targetClubId);
    if (!actorClubId || !targetClubId) throw new Error("팀 정보를 확인할 수 없습니다.");

    const actorScore = mr.myScore;
    const targetScore = mr.oppScore;

    if (!Number.isFinite(Number(actorScore)) || !Number.isFinite(Number(targetScore))) {
      throw new Error("점수 정보를 확인할 수 없습니다.");
    }

    const aScore = Number(actorScore);
    const tScore = Number(targetScore);

    let actorResult = "D";
    let targetResult = "D";

    if (aScore > tScore) {
      actorResult = "W";
      targetResult = "L";
    } else if (aScore < tScore) {
      actorResult = "L";
      targetResult = "W";
    }

    const actorRef = doc(db, "clubs", actorClubId);
    const targetRef = doc(db, "clubs", targetClubId);

    const [aClubSnap, tClubSnap] = await Promise.all([tx.get(actorRef), tx.get(targetRef)]);
    const aClub = aClubSnap.exists() ? aClubSnap.data() || {} : {};
    const tClub = tClubSnap.exists() ? tClubSnap.data() || {} : {};

    // users.stats 업데이트 대상 uid 수집 (READ만)
    const fromLineup = mr.fromLineupSnapshot || null;
    const toLineup = mr.toLineupSnapshot || null;

    const actorMemberIds = extractMemberIdsStrict(fromLineup, "fromLineupSnapshot(actor)");
    const targetMemberIds = extractMemberIdsStrict(toLineup, "toLineupSnapshot(target)");

    if (!actorMemberIds.length || !targetMemberIds.length) {
      console.warn(
        "[matchRoomService][acceptMatchResult] memberIds missing/empty. " +
          "users.stats will be partially applied. " +
          "actorMemberIds=",
        actorMemberIds,
        "targetMemberIds=",
        targetMemberIds
      );
    }

    const allUserIds = uniqStr([...(actorMemberIds || []), ...(targetMemberIds || [])]);
    const userRefs = allUserIds.map((uid) => ({ uid, ref: doc(db, "users", uid) }));
    const userSnaps = await Promise.all(userRefs.map((x) => tx.get(x.ref)));

    const userDataById = {};
    for (let i = 0; i < userRefs.length; i += 1) {
      const uid = userRefs[i].uid;
      const snap = userSnaps[i];
      userDataById[uid] = snap && snap.exists() ? snap.data() || {} : null;
    }

    // =========================
    // 1) COMPUTE (메모리에서만)
    // =========================
    const aStats = aClub.stats || {};
    const tStats = tClub.stats || {};

    const aWins = safeNum(aStats.wins, 0) + (actorResult === "W" ? 1 : 0);
    const aLosses = safeNum(aStats.losses, 0) + (actorResult === "L" ? 1 : 0);
    const aDraws = safeNum(aStats.draws, 0) + (actorResult === "D" ? 1 : 0);
    const aTotal =
      safeNum(aStats.totalMatches, safeNum(aStats.wins, 0) + safeNum(aStats.losses, 0) + safeNum(aStats.draws, 0)) + 1;

    const tWins = safeNum(tStats.wins, 0) + (targetResult === "W" ? 1 : 0);
    const tLosses = safeNum(tStats.losses, 0) + (targetResult === "L" ? 1 : 0);
    const tDraws = safeNum(tStats.draws, 0) + (targetResult === "D" ? 1 : 0);
    const tTotal =
      safeNum(tStats.totalMatches, safeNum(tStats.wins, 0) + safeNum(tStats.losses, 0) + safeNum(tStats.draws, 0)) + 1;

    const aWinRate = aTotal > 0 ? aWins / aTotal : 0;
    const tWinRate = tTotal > 0 ? tWins / tTotal : 0;

    const aRecent = normalizeRecentArray(aStats.recentResults);
    const tRecent = normalizeRecentArray(tStats.recentResults);

    const nextARecent = [actorResult, ...aRecent].slice(0, 5);
    const nextTRecent = [targetResult, ...tRecent].slice(0, 5);

    // users별 next stats 계산도 메모리에서 미리
    const nextUserStatsById = {};
    actorMemberIds.forEach((uid) => {
      const u = userDataById[uid];
      const prevStats = u && typeof u === "object" ? u.stats : null;
      nextUserStatsById[uid] = {
        prevStats: prevStats && typeof prevStats === "object" ? prevStats : {},
        next: computeNextStats(prevStats, actorResult),
      };
    });
    targetMemberIds.forEach((uid) => {
      const u = userDataById[uid];
      const prevStats = u && typeof u === "object" ? u.stats : null;
      nextUserStatsById[uid] = {
        prevStats: prevStats && typeof prevStats === "object" ? prevStats : {},
        next: computeNextStats(prevStats, targetResult),
      };
    });

    // ✅ 상대 팀 평판(별점) 집계: 결과 제출 팀이 매긴 별점을 그 상대 팀 평판에 누적
    const ratingVal = safeNum(mr?.result?.opponentRating, 0);
    const ratedByClubId = toStr(mr?.result?.submittedByClubId);
    const ratedClubId =
      ratingVal >= 1 && ratedByClubId
        ? ratedByClubId === actorClubId
          ? targetClubId
          : actorClubId
        : "";

    const buildRep = (club) => {
      const rep = club.reputation || {};
      const sum = safeNum(rep.sum, 0) + ratingVal;
      const count = safeNum(rep.count, 0) + 1;
      return { sum, count, avg: count > 0 ? sum / count : 0, updatedAt: serverTimestamp() };
    };
    const aRep = ratedClubId && ratedClubId === actorClubId ? buildRep(aClub) : null;
    const tRep = ratedClubId && ratedClubId === targetClubId ? buildRep(tClub) : null;

    // ✅ AI 예측 검증: 경기 전(pre-match) 전적(aStats/tStats)으로 예측 → 실제 결과와 비교.
    //    aStats/tStats는 이 경기 반영 전 값이라 "경기 전에 알 수 있던 데이터" = 공정한 예측 근거.
    const pred = predictFromStats(aStats, tStats);
    const favoredClubId =
      pred.favored === "actor" ? actorClubId : pred.favored === "target" ? targetClubId : "";
    const actualWinnerClubId = aScore > tScore ? actorClubId : aScore < tScore ? targetClubId : "";
    let predResult;
    if (!pred.confident || !actualWinnerClubId) predResult = "push"; // 못 찍은 경기/무승부 → 집계 제외
    else predResult = favoredClubId === actualWinnerClubId ? "hit" : "miss";

    // =========================
    // 2) WRITES (여기부터는 tx.get 절대 금지)
    // =========================

    // clubs.stats 업데이트
    tx.set(
      actorRef,
      {
        stats: {
          ...aStats,
          wins: aWins,
          losses: aLosses,
          draws: aDraws,
          totalMatches: aTotal,
          winRate: aWinRate,
          recentResults: nextARecent,
          updatedAt: serverTimestamp(),
        },
        ...(aRep ? { reputation: aRep } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      targetRef,
      {
        stats: {
          ...tStats,
          wins: tWins,
          losses: tLosses,
          draws: tDraws,
          totalMatches: tTotal,
          winRate: tWinRate,
          recentResults: nextTRecent,
          updatedAt: serverTimestamp(),
        },
        ...(tRep ? { reputation: tRep } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // users.stats 업데이트
    allUserIds.forEach((uid) => {
      const pack = nextUserStatsById[uid];
      if (!pack) return;

      const uRef = doc(db, "users", uid);
      tx.set(
        uRef,
        {
          stats: {
            ...(pack.prevStats || {}),
            ...(pack.next || {}),
            updatedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    // match_requests 마무리
    tx.update(mrRef, {
      resultState: "confirmed",
      status: "finished",
      resultAcceptedByClubId: confirmer,
      resultAcceptedAt: serverTimestamp(),
      statsAppliedAt: serverTimestamp(),
      // ✅ AI 예측 스냅샷 + 검증 결과 (적중률 집계용)
      prediction: {
        favoredClubId,
        prob: pred.prob, // actor 관점 0~100
        confident: pred.confident,
        basis: "stats",
        predictedAt: serverTimestamp(),
      },
      predictionOutcome: {
        result: predResult, // "hit" | "miss" | "push"
        actualWinnerClubId,
        evaluatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
  });

  // ✅ 결과 확정 알림 (양 팀 전원 — 팀장 포함)
  //    ⚠️ 발송은 targetIds(uid)로만 된다. 예전엔 clubId를 넣어 아무에게도 안 갔음 → 실제 멤버 uid로 수정.
  try {
    const mrSnap = await getDoc(mrRef);
    const mr = mrSnap.exists() ? mrSnap.data() || {} : {};
    const clubIds = [toStr(mr.actorClubId), toStr(mr.targetClubId)].filter(Boolean);

    const uidSet = new Set();
    for (const cid of clubIds) {
      try {
        const members = await listClubMemberUidsExceptOwner(cid);
        members.forEach((u) => u && uidSet.add(toStr(u)));
      } catch {}
      try {
        const cSnap = await getDoc(doc(db, "clubs", cid));
        const owner = toStr(cSnap.exists() ? cSnap.data()?.ownerUid : "");
        if (owner) uidSet.add(owner);
      } catch {}
    }
    const targetIds = [...uidSet].filter(Boolean);

    if (targetIds.length) {
      await addDoc(collection(db, "notifications"), {
        kind: "match",
        subType: "matchResultConfirmed",
        type: "match_result_confirmed",
        title: "경기 결과가 확정되었어요",
        body: "경기 결과가 양 팀 모두 확정되었습니다.",
        targetType: "USER",
        targetIds,
        actorClubId: confirmer,
        linkType: "match",
        linkTargetId: id,
        meta: { matchId: id, deepLink: `/match-roomdetail/${id}` },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: {},
      });
    }
  } catch (e) {
    console.warn("[match] result-confirmed notification failed:", e?.message || e);
  }

  return true;
}


// 이의 제기 = 상대가 입력한 결과를 되돌려 "재입력 재오픈".
// (예전엔 resultState:"disputed"로만 세팅되어 이를 푸는 로직이 없어 경기가 영구히 멈췄음 → 데드엔드 제거)
export async function disputeMatchResult({ matchRequestId }) {
  const id = toStr(matchRequestId);
  if (!id) throw new Error("disputeMatchResult: matchRequestId is required");

  const ref = doc(db, "match_requests", id);

  // 되돌리기 전, 원 제출팀/상대팀을 알림 대상으로 확보
  let submitter = "";
  // ✅ 트랜잭션 + 가드: 이미 전적이 반영(statsAppliedAt)됐거나 종결(finished)된 경기는 되돌릴 수 없음.
  //    (자동확정이 백그라운드로 돈 직후 stale 화면의 "이의 제기"를 누르면 이미 반영된 clubs/users 전적이
  //     남아 유령 승/패로 랭킹이 영구 오염되던 문제 차단)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("경기를 찾을 수 없어요.");
    const d = snap.data() || {};
    if (d.statsAppliedAt || toStr(d.status) === "finished") {
      throw new Error("이미 확정된 경기라 이의를 제기할 수 없어요.");
    }
    submitter = toStr(d?.result?.submittedByClubId);
    tx.update(ref, {
      // 결과 초기화 → 팀장이 다시 입력할 수 있게 재오픈
      resultState: "",
      myScore: null,
      oppScore: null,
      result: null,
      reviewRequestSent: false,
      disputedAt: serverTimestamp(),
      disputeCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });

  // 양 팀에 재입력 안내
  try {
    const disputer = submitter ? await getOpponentClubId(id, submitter) : "";
    if (submitter) {
      await notifyMatchRoomEvent({
        matchId: id,
        recipientClubId: submitter,
        subType: "matchResultDisputed",
        type: "match_result_disputed",
        title: "경기 결과 이의 제기",
        body: "상대팀이 입력한 결과에 이의를 제기했어요. 협의 후 결과를 다시 입력해 주세요.",
      });
    }
    if (disputer) {
      await notifyMatchRoomEvent({
        matchId: id,
        recipientClubId: disputer,
        subType: "matchResultDisputed",
        type: "match_result_disputed",
        title: "이의 제기 완료",
        body: "결과 재입력이 필요해요. 상대팀과 협의 후 다시 입력해 주세요.",
      });
    }
  } catch (e) {
    console.warn("[disputeMatchResult] notify failed:", e?.message || e);
  }

  return true;
}

// ✅ 결과에 코멘트 추가(append)
// - 기존 result.comment 뒤에 구분선 + 새 코멘트가 붙음
export async function appendMatchResultComment({
  matchRequestId,
  comment = "",
  submittedByClubId,
  authorUid = "",
  authorName = "",
  authorRole = "",
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);
  const clean = String(comment || "").trim();

  if (!id) throw new Error("appendMatchResultComment: matchRequestId is required");
  if (!by) throw new Error("appendMatchResultComment: submittedByClubId is required");
  if (!clean) throw new Error("appendMatchResultComment: comment is required");

  const auid = toStr(authorUid);
  const aname = toStr(authorName);
  const arole = toStr(authorRole);

  const ref = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = snap.data() || {};
    const prevResult = mr.result && typeof mr.result === "object" ? mr.result : {};
    const prevComment = String(prevResult.comment || "").trim();

    const metaLine = `[추가 기록] ${aname ? aname : "참가자"} · ${by}`;
    const nextChunk = `${metaLine}\n${clean}`;

    const nextComment = prevComment ? `${prevComment}\n\n${nextChunk}` : nextChunk;

    tx.update(ref, {
      result: {
        ...prevResult,
        submittedByClubId: prevResult.submittedByClubId || by,
        authorUid: auid || prevResult.authorUid || "",
        authorName: aname || prevResult.authorName || "",
        authorRole: arole || prevResult.authorRole || "",
        comment: nextComment,
      },
      updatedAt: serverTimestamp(),
    });
  });

  return true;
}

// ✅ 결과에 사진 추가(append)
// - 기존 result.photoUrls 뒤에 업로드된 사진 URL을 덧붙임
export async function appendMatchResultPhotos({
  matchRequestId,
  files = [],
  submittedByClubId,
  authorUid = "",
  authorName = "",
  authorRole = "",
} = {}) {
  const id = toStr(matchRequestId);
  const by = toStr(submittedByClubId);

  if (!id) throw new Error("appendMatchResultPhotos: matchRequestId is required");
  if (!by) throw new Error("appendMatchResultPhotos: submittedByClubId is required");

  const fileList = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!fileList.length) throw new Error("appendMatchResultPhotos: files are required");

  const auid = toStr(authorUid);
  const aname = toStr(authorName);
  const arole = toStr(authorRole);

  const uploadedUrls = [];
  const uploaded = await Promise.all(
    fileList.slice(0, 6).map(async (file) => {
      const res = await uploadCompressedImageMedia({
        scope: "match_requests",
        ownerId: id,
        file,
        kind: "result",
      });
      return res?.url || "";
    })
  );

  uploaded.forEach((u) => {
    const url = toStr(u);
    if (url) uploadedUrls.push(url);
  });

  const ref = doc(db, "match_requests", id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("매칭 정보를 찾을 수 없습니다.");

    const mr = snap.data() || {};
    const prevResult = mr.result && typeof mr.result === "object" ? mr.result : {};
    const prevUrls = Array.isArray(prevResult.photoUrls) ? prevResult.photoUrls : [];

    const nextUrls = [...prevUrls, ...uploadedUrls].slice(0, 30);

    tx.update(ref, {
      result: {
        ...prevResult,
        submittedByClubId: prevResult.submittedByClubId || by,
        authorUid: auid || prevResult.authorUid || "",
        authorName: aname || prevResult.authorName || "",
        authorRole: arole || prevResult.authorRole || "",
        photoUrls: nextUrls,
      },
      updatedAt: serverTimestamp(),
    });
  });

  return { ok: true, photoUrls: uploadedUrls };
}

/* ========================= player reviews (선수 평점) ========================= */
// ✅ 선수별 상대 팀 평점
// - 저장: match_requests/{id}/reviews/{raterUid} (1인 1리뷰, upsert)
// - raterClubId(평가한 사람의 팀) → targetClubId(평가 대상 = 상대 팀)
// - 상대 팀 상세 화면에서 targetClubId == 내 팀인 리뷰를 모아 "우리 팀에 남긴 평점"으로 노출

// 한 경기에 대해 한 선수가 상대 팀에 남기는 평점 등록/수정
export async function submitMatchReview({
  matchRequestId,
  raterUid,
  raterName = "",
  raterClubId,
  targetClubId,
  stars,
  comment = "",
} = {}) {
  const id = toStr(matchRequestId);
  const uid = toStr(raterUid);
  const rClub = toStr(raterClubId);
  const tClub = toStr(targetClubId);
  const s = Math.max(0, Math.min(5, Math.round(safeNum(stars, 0))));

  if (!id) throw new Error("submitMatchReview: matchRequestId is required");
  if (!uid) throw new Error("submitMatchReview: raterUid is required");
  if (!rClub || !tClub) throw new Error("submitMatchReview: club ids are required");
  if (s < 1) throw new Error("별점을 선택해 주세요.");

  const ref = doc(db, "match_requests", id, "reviews", uid);
  const prev = await getDoc(ref);

  await setDoc(
    ref,
    {
      raterUid: uid,
      raterName: toStr(raterName),
      raterClubId: rClub,
      targetClubId: tClub,
      stars: s,
      comment: String(comment || "").trim(),
      ...(prev.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
}

// ✅ 내가(raterUid) 이미 리뷰를 남긴 경기 id 집합 — 전적 탭 "리뷰 남길/끝난 경기" 구분용
// - reviews/{raterUid} 문서를 직접 조회(타깃 read 1건/경기)해 rules 안전 + 가벼움
export async function listMyReviewedMatchIds({ matchIds = [], raterUid } = {}) {
  const uid = toStr(raterUid);
  const ids = (Array.isArray(matchIds) ? matchIds : []).map(toStr).filter(Boolean);
  if (!uid || ids.length === 0) return new Set();

  const results = await Promise.all(
    ids.map(async (mid) => {
      try {
        const snap = await getDoc(doc(db, "match_requests", mid, "reviews", uid));
        return snap.exists() ? mid : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(results.filter(Boolean));
}

// 한 경기의 모든 선수 평점 조회 (최신순)
export async function listMatchReviews({ matchRequestId } = {}) {
  const id = toStr(matchRequestId);
  if (!id) return [];

  const col = collection(db, "match_requests", id, "reviews");
  const snap = await getDocs(col);

  const out = snap.docs.map((d) => {
    const x = d.data() || {};
    return {
      id: d.id,
      raterUid: toStr(x.raterUid || d.id),
      raterName: toStr(x.raterName),
      raterClubId: toStr(x.raterClubId),
      targetClubId: toStr(x.targetClubId),
      stars: safeNum(x.stars, 0),
      comment: toStr(x.comment),
      createdAt: x.createdAt || null,
      updatedAt: x.updatedAt || null,
    };
  });

  out.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  return out;
}

// ✅ 한 팀이 상대 팀들로부터 받은 모든 평점/후기 수집 — 팀 프로필 "팀 리뷰"용
// - 이 팀(clubId)이 참가한 경기들의 reviews 서브컬렉션에서 targetClubId == clubId 인 것만 모음
// - 평균 별점 + 최신순 목록 반환 (각 항목에 평가자 이름/상대 팀 이름 포함)
export async function listTeamReviews({ clubId, max = 50 } = {}) {
  const cid = toStr(clubId);
  if (!cid) return { reviews: [], avg: 0, count: 0 };

  const col = collection(db, "match_requests");
  const qActor = query(col, where("actorClubId", "==", cid), limit(200));
  const qTarget = query(col, where("targetClubId", "==", cid), limit(200));
  const [snapA, snapB] = await Promise.all([getDocs(qActor), getDocs(qTarget)]);

  const matchDocs = uniqById([
    ...snapA.docs.map((d) => ({ id: d.id, ...d.data() })),
    ...snapB.docs.map((d) => ({ id: d.id, ...d.data() })),
  ]);

  const reviewLists = await runBatches(matchDocs, 8, async (mr) => {
    const mid = toStr(mr.id);
    if (!mid) return [];
    const iAmActor = toStr(mr.actorClubId) === cid;
    const oppTeamName = toStr(iAmActor ? mr?.toTeamSnapshot?.name : mr?.fromTeamSnapshot?.name);
    try {
      const rsnap = await getDocs(collection(db, "match_requests", mid, "reviews"));
      return rsnap.docs
        .map((d) => ({ docId: d.id, ...(d.data() || {}) }))
        .filter((r) => toStr(r.targetClubId) === cid)
        .map((r) => ({
          id: `${mid}_${r.docId}`,
          raterName: toStr(r.raterName) || "상대 선수",
          oppTeamName,
          stars: Math.max(1, Math.min(5, safeNum(r.stars, 0))),
          comment: toStr(r.comment),
          createdAt: r.createdAt || null,
        }));
    } catch (e) {
      return [];
    }
  });

  const reviews = reviewLists.flat();
  reviews.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));

  const count = reviews.length;
  const avg = count
    ? Math.round((reviews.reduce((s, r) => s + r.stars, 0) / count) * 10) / 10
    : 0;

  return { reviews: reviews.slice(0, max), avg, count };
}

/* ========================= finished feed helpers ========================= */
function mapFinishedDoc(d) {
  const data = d.data() || {};
  const fromTeam = data?.fromTeamSnapshot || {};
  const toTeam = data?.toTeamSnapshot || {};

  return {
    id: d.id,
    status: toStr(data?.status),
    resultState: toStr(data?.resultState), // "void"면 무효 처리된 경기

    actorClubId: toStr(data?.actorClubId),
    targetClubId: toStr(data?.targetClubId),

    scheduledAt: data?.scheduledAt || null,
    updatedAt: data?.updatedAt || null,

    fieldAddress: toStr(data?.field?.address || data?.fieldAddress || ""),

    // 제휴구장 예약(분할결제) 정보 — 경기기록 카드에서 직접입력/구장예약 구분용
    partnerBooking: data?.partnerBooking
      ? {
          venueName: toStr(data.partnerBooking.venueName),
          courtName: toStr(data.partnerBooking.courtName),
        }
      : null,

    actorScore: data?.myScore ?? null,
    targetScore: data?.oppScore ?? null,

    actorTeam: {
      clubId: toStr(fromTeam?.clubId || fromTeam?.id),
      name: toStr(fromTeam?.name) || "팀",
      logoUrl: toStr(fromTeam?.logoUrl || ""),
      region: toStr(fromTeam?.region),
      regionSido: toStr(fromTeam?.regionSido),
      regionGu: toStr(fromTeam?.regionGu),
    },
    targetTeam: {
      clubId: toStr(toTeam?.clubId || toTeam?.id),
      name: toStr(toTeam?.name) || "팀",
      logoUrl: toStr(toTeam?.logoUrl || ""),
      region: toStr(toTeam?.region),
      regionSido: toStr(toTeam?.regionSido),
      regionGu: toStr(toTeam?.regionGu),
    },

    result: data?.result && typeof data.result === "object" ? data.result : null,
  };
}

/* ========================= finished feed ========================= */
// ✅ finished 경기 피드
// - status == "finished"
// - clubId 지정 시: 해당 팀이 actor 또는 target 인 경기만 (두 쿼리 병합)
// - 미지정 시: 전체 (기존 동작)
export async function listFinishedMatchesPage({ pageSize = 20, cursor = null, clubId = "", debugLog = false } = {}) {
  const size = Number(pageSize);
  const take = Number.isFinite(size) && size > 0 ? Math.min(size, 50) : 20;
  const myClubId = toStr(clubId);

  // ✅ 팀이 없으면(탈퇴 후 재가입/미가입) 전체 경기가 "내 팀 기록"으로 노출되지 않도록 빈 결과 반환
  if (!myClubId) return { rows: [], nextCursor: null };

  const col = collection(db, "match_requests");

  // 내 팀 필터: actor/target 두 쿼리 병합 후 클라이언트 정렬
  if (myClubId) {
    const buildQ = (field) => {
      const base = [
        where("status", "==", "finished"),
        where(field, "==", myClubId),
        orderBy("updatedAt", "desc"),
        orderBy(documentId(), "desc"),
      ];
      const c = cursor?.[field];
      return c?.updatedAt && c?.id
        ? query(col, ...base, startAfter(c.updatedAt, c.id), limit(take))
        : query(col, ...base, limit(take));
    };

    try {
      const [snapA, snapT] = await Promise.all([getDocs(buildQ("actorClubId")), getDocs(buildQ("targetClubId"))]);
      const docsA = snapA?.docs || [];
      const docsT = snapT?.docs || [];

      const seen = new Set();
      const merged = [];
      [...docsA, ...docsT].forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        merged.push(d);
      });

      // updatedAt desc 정렬
      merged.sort((a, b) => {
        const ua = a.data()?.updatedAt || "";
        const ub = b.data()?.updatedAt || "";
        if (ua === ub) return a.id < b.id ? 1 : -1;
        return ua < ub ? 1 : -1;
      });

      const sliced = merged.slice(0, take);
      const rows = sliced.map(mapFinishedDoc);

      const lastA = docsA[docsA.length - 1];
      const lastT = docsT[docsT.length - 1];
      const nextCursor =
        docsA.length < take && docsT.length < take
          ? null
          : {
              actorClubId: lastA ? { updatedAt: lastA.data()?.updatedAt || null, id: lastA.id } : null,
              targetClubId: lastT ? { updatedAt: lastT.data()?.updatedAt || null, id: lastT.id } : null,
            };

      return { rows, nextCursor };
    } catch (e) {
      const err = new Error(e?.message || "Firestore query failed");
      err.code = e?.code || "";
      throw err;
    }
  }

  const base = [
    where("status", "==", "finished"),
    orderBy("updatedAt", "desc"),
    orderBy(documentId(), "desc"),
  ];

  const qFinal =
    cursor && cursor.updatedAt && cursor.id
      ? query(col, ...base, startAfter(cursor.updatedAt, cursor.id), limit(take))
      : query(col, ...base, limit(take));

  const cursorLog = cursor ? { updatedAt: cursor.updatedAt || null, id: cursor.id || null } : null;

  console.groupCollapsed("[listFinishedMatchesPage] START");
  console.log("take:", take);
  console.log("cursor:", cursorLog);
  console.log("debugLog:", !!debugLog);
  console.groupEnd();

  const withTimeout = async (p, ms = 5000) => {
    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`getDocs timeout after ${ms}ms`)), ms);
    });
    try {
      const res = await Promise.race([p, timeout]);
      return res;
    } finally {
      try {
        clearTimeout(t);
      } catch (e) {}
    }
  };

  try {
    console.log("[listFinishedMatchesPage] before getDocs");
    const snap = await withTimeout(getDocs(qFinal), 8000);
    console.log("[listFinishedMatchesPage] after getDocs");

    const docs = snap?.docs || [];
    console.log("[listFinishedMatchesPage] docs.length =", docs.length);

    if (docs[0]) {
      const d0 = docs[0];
      const data0 = d0.data() || {};
      console.log("[listFinishedMatchesPage] first.id:", d0.id);
      console.log("[listFinishedMatchesPage] first.status:", data0?.status);
      console.log("[listFinishedMatchesPage] first.updatedAt:", data0?.updatedAt);
    }

    if (debugLog) {
      console.groupCollapsed("[listFinishedMatchesPage] OK(detail)");
      console.log("take:", take);
      console.log("cursor:", cursorLog);
      console.log("docs.length:", docs.length);
      console.groupEnd();
    }

    const rows = docs.map(mapFinishedDoc);

    const last = docs[docs.length - 1] || null;
    const nextCursor = last ? { updatedAt: last.data()?.updatedAt || null, id: last.id } : null;

    console.log("[listFinishedMatchesPage] DONE -> rows:", rows.length, "nextCursor:", nextCursor);
    return { rows, nextCursor };
  } catch (e) {
    const code = e?.code || "";
    const msg = e?.message || String(e || "");

    console.groupCollapsed("[listFinishedMatchesPage] FAILED");
    console.log("code:", code);
    console.log("message:", msg);
    console.log("take:", take);
    console.log("cursor:", cursorLog);
    console.log("rawError:", e);
    console.groupEnd();

    const err = new Error(msg || "Firestore query failed");
    err.code = code;
    throw err;
  }
}
