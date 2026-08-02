/* eslint-disable */
// functions/payments/refundPolicy.js
// 취소 시점·귀책 → 환불율 + 고객 안내 문구를 한 곳에서 판정한다.
//
// 왜 분리했나: 환불을 "실행"하는 곳(venuePaymentJobs)과 그 결과를 "통지"하는 곳(venueAlimtalk)이
//   각자 계산하면, 실제 환불액과 알림톡에 찍힌 금액이 어긋나는 사고가 난다. 판정은 여기 하나뿐이다.
//
// ⚠️ src/constants/cancelPolicy.js 의 CANCEL_POLICY_TIERS 와 같은 값을 유지할 것.
//    [0]=2일 전까지 100% / [1]=1일 전 50% / [2]=당일 0% / [3]=시작 후 0%

const s = (v) => String(v ?? "").trim();

const REFUND_TIERS = [1, 0.5, 0, 0];

// 알림톡 #{환불기준} 에 그대로 들어가는 문구. 금액만 통보하면 분담결제에서 두 팀 환불액이
// 갈리는 이유를 설명할 수 없어 분쟁이 난다.
const STAGE_BASIS = [
  "이용 2일 전 취소 · 전액 환불",
  "이용 1일 전 취소 · 50% 공제",
  "이용 당일 취소 · 환불 불가",
  "이용 시작 후 취소 · 환불 불가",
];

const kstDay = (ms) => Math.floor((ms + 9 * 3600 * 1000) / 86400000);

/** 지금이 어느 취소 단계인지 (KST 기준). cancelPolicy.cancelStageIndex 와 동일 규칙. */
function cancelStageIndex(date, startTime, nowMs) {
  const startMs = Date.parse(`${s(date)}T${s(startTime) || "00:00"}:00+09:00`);
  if (!Number.isFinite(startMs)) return 0;
  if (nowMs >= startMs) return 3;
  const days = kstDay(startMs) - kstDay(nowMs);
  if (days <= 0) return 2;
  if (days === 1) return 1;
  return 0;
}

/**
 * 이 결제건의 환불율 + 그 근거 문구.
 * 구장 사정 취소·반려·미결제 자동취소는 이용자 잘못이 아니므로 전액 환불한다.
 * 매칭에서 한 팀이 취소하면 그 팀만 위약금을 물고, 상대 팀은 귀책이 없어 전액 환불.
 * @returns {{rate: number, basis: string}}
 */
function refundDecision(data, payment, nowMs) {
  if (s(data.cancelReason) === "payment_timeout") {
    return { rate: 1, basis: "상대 팀 미결제 · 전액 환불" };
  }

  const by = s(data.canceledBy);
  if (by !== "user" && by !== "team") {
    return {
      rate: 1,
      basis: s(data.status) === "rejected" ? "구장 예약 반려 · 전액 환불" : "구장 사정 취소 · 전액 환불",
    };
  }

  if (by === "team") {
    const cancelClub = s(data.cancelledByClubId);
    const sideClub = s(payment.side) === "A" ? s(data.teamAClubId) : s(data.teamBClubId);
    if (cancelClub && sideClub && cancelClub !== sideClub) {
      return { rate: 1, basis: "상대 팀 취소 · 전액 환불" }; // 이 팀은 무귀책
    }
  }

  const stage = cancelStageIndex(data.date, data.startTime, nowMs);
  return { rate: REFUND_TIERS[stage], basis: STAGE_BASIS[stage] };
}

module.exports = { REFUND_TIERS, cancelStageIndex, refundDecision };
