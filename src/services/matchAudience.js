/* eslint-disable */
// src/services/matchAudience.js
// 매치 알림 수신자 결정 — "그 경기에 실제로 뛰는 사람만 받는다".
//
// 예전엔 팀 전체(users.activeTeamId == clubId)에게 뿌려서, 라인업에 안 들어간 팀원도
// 경기 확정·취소·결과 알림을 전부 받았다. 이제 라인업이 확정된 뒤에는
// 확정 라인업(주전 + 후보)만 대상으로 한다.
//
// ⚠️ 라인업 확정 "전"에는 팀 전체가 대상이다. 이 시점에 라인업으로 좁히면
//    (아직 아무도 라인업에 없으므로) 알림이 통째로 사라진다.
//
// 서버(Cloud Functions)에도 같은 규칙이 필요해 functions/utils/matchAudience.js 에
// 동일한 로직이 있다. 규칙을 바꾸면 두 곳을 같이 고쳐야 한다.

import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { listClubMemberUidsExceptOwner } from "./clubManageService";

const toStr = (v) => String(v || "").trim();
const uniqStr = (arr) =>
  Array.from(new Set((Array.isArray(arr) ? arr : []).map(toStr).filter(Boolean)));

/**
 * match_requests 문서에서 한 팀의 확정 라인업 uid(주전 + 후보).
 * 라인업 미확정이거나 그 경기의 참가 팀이 아니면 [].
 */
export function confirmedLineupUids(matchData, clubId) {
  const cid = toStr(clubId);
  if (!matchData || !cid) return [];

  const isActor = toStr(matchData.actorClubId) === cid;
  const isTarget = toStr(matchData.targetClubId) === cid;
  if (!isActor && !isTarget) return [];

  const snap = isActor ? matchData.fromLineupSnapshot : matchData.toLineupSnapshot;
  if (!snap || snap.confirmed !== true) return [];

  return uniqStr([...(snap.memberIds || []), ...(snap.subMemberIds || [])]);
}

/**
 * 이 경기 알림을 받을 "팀원" uid (팀장 제외 — 팀장은 팀장 전용 알림으로 따로 받는다).
 * - 라인업 확정 후: 확정 라인업(주전+후보)에서 팀장만 뺀 인원
 * - 라인업 확정 전: 팀 전체(기존 동작)
 *
 * @param {object} args
 * @param {string} args.matchId
 * @param {string} args.clubId
 * @param {object} [args.matchData] 이미 읽어둔 match_requests 데이터(있으면 재조회 안 함)
 */
export async function listMatchNotifyUids({ matchId, clubId, matchData = null } = {}) {
  const mid = toStr(matchId);
  const cid = toStr(clubId);
  if (!cid) return [];

  let mr = matchData;
  if (!mr && mid) {
    try {
      const snap = await getDoc(doc(db, "match_requests", mid));
      mr = snap.exists() ? snap.data() || null : null;
    } catch (e) {
      mr = null;
    }
  }

  const lineup = confirmedLineupUids(mr, cid);
  if (!lineup.length) {
    try {
      return await listClubMemberUidsExceptOwner(cid);
    } catch (e) {
      return [];
    }
  }

  let ownerUid = "";
  try {
    const cSnap = await getDoc(doc(db, "clubs", cid));
    ownerUid = toStr(cSnap.exists() ? cSnap.data()?.ownerUid : "");
  } catch (e) {}

  return lineup.filter((u) => u !== ownerUid);
}
