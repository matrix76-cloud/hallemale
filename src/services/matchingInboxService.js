/* eslint-disable */
// src/services/matchingInboxService.js
// ✅ 매칭 인박스(팀 단위) 조회 서비스 (matchId 단위)
// ✅ SSOT = match_requests/{matchId}
// - notifications 기반은 최신 알림/clubId 조건 때문에 direction/opponent가 뒤집힐 수 있어 폐기
// - 이 파일은 match_requests에서 "내 팀 기준" sent/received/closed를 안정적으로 만들어 반환
// - 디버깅 로그 상세 출력

import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

function toMsSafe(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  try {
    const d = new Date(v);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

function debugPickReq(id, d) {
  const actorClubId = toStr(d?.actorClubId);
  const targetClubId = toStr(d?.targetClubId);
  const status = toStr(d?.status);
  const createdAtMs = toMsSafe(d?.createdAt);
  const updatedAtMs = toMsSafe(d?.updatedAt);

  const actorName = toStr(d?.actorTeamSnapshot?.name || d?.fromTeamSnapshot?.name);
  const targetName = toStr(d?.targetTeamSnapshot?.name || d?.toTeamSnapshot?.name);

  return {
    id,
    status,
    actorClubId,
    targetClubId,
    actorName,
    targetName,
    createdAt: d?.createdAt ? "has" : "none",
    updatedAt: d?.updatedAt ? "has" : "none",
    createdAtMs: createdAtMs || null,
    updatedAtMs: updatedAtMs || null,
  };
}

function normalizeInboxRow(matchId, req, myClubId) {
  const d = req || {};
  const actorClubId = toStr(d.actorClubId);
  const targetClubId = toStr(d.targetClubId);

  const direction =
    actorClubId && actorClubId === myClubId ? "sent" : "received";

  const statusRaw = toStr(d.status).toLowerCase();

  const phase =
    statusRaw === "pending" || statusRaw === "requesting"
      ? "pending"
      : statusRaw === "accepted"
      ? "accepted"
      : statusRaw === "rejected"
      ? "rejected"
      : statusRaw === "cancelled"
      ? "cancelled"
      : statusRaw === "confirmed"
      ? "confirmed"
      : statusRaw === "finished"
      ? "finished"
      : "pending";

  const latest = {
    matchId,
    status: statusRaw || phase,

    actorClubId,
    targetClubId,

    fromTeamSnapshot: d.actorTeamSnapshot || d.fromTeamSnapshot || null,
    toTeamSnapshot: d.targetTeamSnapshot || d.toTeamSnapshot || null,

    fromLineupSnapshot: d.actorLineupSnapshot || d.fromLineupSnapshot || null,
    toLineupSnapshot: d.targetLineupSnapshot || d.toLineupSnapshot || null,

    scheduledAt: d.scheduledAt || null,
    myScore: d.myScore ?? null,
    oppScore: d.oppScore ?? null,

    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };

  const opponentClubId = direction === "sent" ? targetClubId : actorClubId;
  const opponentSnapshot =
    direction === "sent" ? latest.toTeamSnapshot : latest.fromTeamSnapshot;

  const timestamp = toMsSafe(d.updatedAt || d.createdAt);

  return {
    matchId,
    latest,
    direction,
    phase,
    timestamp,
    opponentClubId,
    opponentSnapshot: opponentSnapshot || {},
  };
}

async function safeQueryMatchRequests({ myClubId, limitCount, field }) {
  const col = collection(db, "match_requests");
  const lim = Math.min(Math.max(Number(limitCount) || 50, 1), 300);

  const tryRun = async (orderField) => {
    const qy = query(
      col,
      where(field, "==", myClubId),
      orderBy(orderField, "desc"),
      limit(lim)
    );
    const snap = await getDocs(qy);
    return { snap, orderField };
  };

  // ✅ 1) updatedAt desc 우선 (SSOT)
  try {
    return await tryRun("updatedAt");
  } catch (e1) {
    // ✅ 2) 인덱스/필드 이슈면 createdAt로 폴백
    try {
      return await tryRun("createdAt");
    } catch (e2) {
      throw e1;
    }
  }
}

/**
 * ✅ 매칭관리 리스트 로더 (SSOT: match_requests)
 * - myClubId 기준으로 actor/target 양쪽 쿼리해서 합침(OR 대체)
 */
export async function listMatchInboxForClub({ clubId, limitCount = 300 } = {}) {
  const myClubId = toStr(clubId);
  if (!myClubId) {
    console.warn("[matchInbox] listMatchInboxForClub: clubId is empty");
    return [];
  }

  console.groupCollapsed("[matchInbox] listMatchInboxForClub (SSOT=match_requests)");
  console.log("myClubId =", myClubId);
  console.log("limitCount =", limitCount);

  let sent = null;
  let recv = null;

  try {
    [sent, recv] = await Promise.all([
      safeQueryMatchRequests({ myClubId, limitCount, field: "actorClubId" }),
      safeQueryMatchRequests({ myClubId, limitCount, field: "targetClubId" }),
    ]);
  } catch (e) {
    console.log("[matchInbox] getDocs failed:", e?.code, e?.message || e);
    console.groupEnd();
    throw e;
  }

  const s1 = sent?.snap;
  const s2 = recv?.snap;

  console.log("query(sent) = where(actorClubId==) + orderBy(" + sent?.orderField + " desc) + limit");
  console.log("query(recv) = where(targetClubId==) + orderBy(" + recv?.orderField + " desc) + limit");

  console.log("sent docs =", s1?.size || 0);
  console.log("recv docs =", s2?.size || 0);

  const map = new Map();
  (s1?.docs || []).forEach((d) => map.set(d.id, d));
  (s2?.docs || []).forEach((d) => map.set(d.id, d));

  const docs = Array.from(map.values());
  console.log("unique match_requests =", docs.length);

  if (docs[0]) {
    console.log("sample[0] =", debugPickReq(docs[0].id, docs[0].data()));
  }

  const out = docs
    .map((d) => normalizeInboxRow(d.id, d.data(), myClubId))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const cntReceived = out.filter((x) => x.direction === "received").length;
  const cntSent = out.filter((x) => x.direction === "sent").length;

  console.log("out =", out.length, "received =", cntReceived, "sent =", cntSent);
  console.log(
    "out sample[0] =",
    out[0]
      ? {
          matchId: out[0].matchId,
          phase: out[0].phase,
          direction: out[0].direction,
          oppName: toStr(out[0]?.opponentSnapshot?.name),
          actor: toStr(out[0]?.latest?.fromTeamSnapshot?.name),
          target: toStr(out[0]?.latest?.toTeamSnapshot?.name),
        }
      : null
  );

  console.groupEnd();
  return out;
}
