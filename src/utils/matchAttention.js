/* eslint-disable */
// src/utils/matchAttention.js
// 매칭룸 "반응 필요(미확인)" 판정 — 홈 4박스 배지 / 목록 카드 배지 공용
// 규칙(사용자 확정):
//  - 조율중/확정/취소: 읽음 기반. lastActivityAt > lastSeenBy[myUid] 이면 미확인
//      · lastActivityAt = 상대의 새 메시지/제안/확정/취소 등으로 갱신
//      · 내 행동은 lastSeenBy[myUid]도 같이 갱신 → 내 행동엔 배지 안 뜸
//      · 상세를 열면 lastSeenBy[myUid] 갱신 → 배지 사라짐
//  - 지난(past): 상태 기반. 내가 결과 입력/승인해야 하면 표시(열람으론 안 사라짐, 결과 확정 시 사라짐)
//  - 개수 = 경기(방) 수

const toStr = (v) => String(v || "").trim();

const tsMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

export function isEndedRoom(r) {
  const start = r?.scheduledAt ? tsMs(r.scheduledAt) : 0;
  if (!start) return false;
  const durMin = Number(r?.durationMin) > 0 ? Number(r.durationMin) : 120; // 기본 2시간
  return Date.now() >= start + durMin * 60 * 1000;
}

export function categorizeRoom(r) {
  const st = toStr(r?.status);
  if (st === "accepted" || st === "proposed") return "ongoing";
  if (st === "confirmed") return isEndedRoom(r) ? "past" : "confirmed";
  if (st === "finished") return "past";
  if (st === "cancelled") return "cancelled";
  return "";
}

// 결과 미입력으로 무효 처리된 경기 (status=finished + resultState="void")
export function isVoidedRoom(r) {
  return toStr(r?.resultState) === "void";
}

// 지난 경기: 내가 결과 입력/승인해야 하는가 (상태 기반)
function pastNeedsMyResult(r, myClubId) {
  const st = toStr(r?.status);
  const rs = toStr(r?.resultState);
  if (rs === "void") return false; // 무효 종결 — 입력/승인 불필요
  if (st === "finished" || rs === "confirmed") return false; // 이미 확정됨
  if (rs === "waiting_accept") {
    const submittedBy = toStr(r?.result?.submittedByClubId);
    return !!submittedBy && submittedBy !== toStr(myClubId); // 상대가 제출 → 내가 승인할 차례
  }
  return true; // 아직 결과 없음 → 내가 입력할 수 있음
}

// 읽음 기반(조율중/확정/취소): 마지막 활동이 내가 마지막으로 본 시점 이후인가
function unseenActivity(r, myUid) {
  const act = tsMs(r?.lastActivityAt);
  if (!act) return false; // 활동 타임스탬프 없는 레거시 문서는 배지 안 띄움
  const seen = tsMs(r?.lastSeenBy?.[toStr(myUid)]);
  return act > seen;
}

export function roomNeedsAttention(r, { myUid, myClubId } = {}) {
  const cat = categorizeRoom(r);
  if (!cat) return false;
  if (cat === "past") return pastNeedsMyResult(r, myClubId);
  return unseenActivity(r, myUid);
}

// 홈 4박스용: 카테고리별 "반응 필요" 경기 수
export function computeAttentionCounts(rows, { myUid, myClubId } = {}) {
  const out = { ongoing: 0, confirmed: 0, past: 0, cancelled: 0 };
  for (const r of rows || []) {
    if (!roomNeedsAttention(r, { myUid, myClubId })) continue;
    const cat = categorizeRoom(r);
    if (out[cat] != null) out[cat] += 1;
  }
  return out;
}
