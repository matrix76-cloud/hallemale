/* eslint-disable */
// functions/utils/matchAudience.js
// 매치 알림 수신자 결정 — "그 경기에 실제로 뛰는 사람만 받는다".
//
// 예전엔 팀 전체(users.activeTeamId == clubId)에게 뿌려서, 라인업에 안 들어간 팀원도
// 경기 시작·종료·자동확정·무효 알림을 전부 받았다. 이제 라인업이 확정된 뒤에는
// 확정 라인업(주전 + 후보)만 대상으로 한다.
//
// ⚠️ 라인업 확정 "전"에는 팀 전체가 대상이다. 이 시점에 라인업으로 좁히면 알림이 통째로 사라진다.
// ⚠️ 빈 배열을 targetIds 로 쓰면 안 된다 — sendPushNotifications.js 가 빈 배열을 "전체 발송"으로 취급한다.
//
// 클라이언트에도 같은 규칙이 src/services/matchAudience.js 에 있다. 바꾸면 두 곳을 같이 고쳐야 한다.

const toStr = (v) => String(v || "").trim();
const uniqStr = (arr) =>
  Array.from(new Set((Array.isArray(arr) ? arr : []).map(toStr).filter(Boolean)));

// match_requests 문서에서 한 팀의 확정 라인업 uid(주전 + 후보). 미확정이면 [].
function confirmedLineupUids(mr, clubId) {
  const cid = toStr(clubId);
  if (!mr || !cid) return [];

  const isActor = toStr(mr.actorClubId) === cid;
  const isTarget = toStr(mr.targetClubId) === cid;
  if (!isActor && !isTarget) return [];

  const snap = isActor ? mr.fromLineupSnapshot : mr.toLineupSnapshot;
  if (!snap || snap.confirmed !== true) return [];

  return uniqStr([...(snap.memberIds || []), ...(snap.subMemberIds || [])]);
}

// 한 팀의 팀원 uid 목록 (users.activeTeamId == clubId). 팀장 포함 — 호출부에서 Set으로 중복 제거.
async function clubMemberUids(db, clubId) {
  const cid = toStr(clubId);
  if (!cid) return [];
  try {
    const snap = await db
      .collection("users")
      .where("activeTeamId", "==", cid)
      .limit(100)
      .get();
    return snap.docs.map((d) => d.id);
  } catch (e) {
    return [];
  }
}

// 이 경기 알림을 받을 한 팀의 uid — 라인업 확정 후엔 라인업 인원, 확정 전엔 팀 전체.
async function matchNotifyUids(db, mr, clubId) {
  const lineup = confirmedLineupUids(mr, clubId);
  if (lineup.length) return lineup;
  return clubMemberUids(db, clubId);
}

module.exports = { confirmedLineupUids, clubMemberUids, matchNotifyUids };
