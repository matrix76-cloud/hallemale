// src/constants/cancelPolicy.js
// 구장 예약 취소·환불 정책 — 플랫폼 공통 기준(구장별로 다르게 두지 않는다).
//
// 구장마다 다른 환불율을 쓰면 ① 분담결제에서 두 팀 환불액이 갈려 분쟁이 나고
// ② 자동 환불 계산이 구장별로 갈라져 돈 계산 사고가 난다. 그래서 플랫폼이 하나로 정한다.
//
// 결제 여부에 따라 같은 표가 두 가지로 읽힌다 (constants/payments.js PG_ENABLED):
//   OFF(현장정산) → 환불할 결제금이 없으므로 "취소 가능 여부"만 의미가 있다.
//   ON(앱내 결제) → 아래 환불율로 부분 환불된다. 계산은 refundRate() 하나로 통일.
//
// ⚠️ 토스페이먼츠 심사 요건: 무형재화(용역)는 "제공이 개시되지 않은 부분"에 대해 환불이
//    가능해야 하고, 환불정책을 구매페이지·이용약관에 기재해야 한다. 그래서
//    ① 이용 시작 전에는 항상 취소가 가능하고(임박 취소는 위약금 공제),
//    ② 결제 화면(PaymentPage)과 약관에 이 표를 그대로 노출한다.

/** 취소 규정 테이블 (구장 상세 · 예약 시트 · 결제 화면에서 그대로 렌더) */
export const CANCEL_POLICY_TIERS = [
  { when: "이용 2일 전까지", what: "전액 환불", refundRate: 1, tone: "ok" },
  { when: "이용 1일 전", what: "50% 환불 (50% 위약금)", refundRate: 0.5, tone: "warn" },
  { when: "이용 당일", what: "환불 불가", refundRate: 0, tone: "danger" },
  { when: "이용 시작 후", what: "환불 불가 · 앱 취소 불가", refundRate: 0, tone: "danger" },
];

export const CANCEL_POLICY_NOTE =
  "구장 사정으로 예약이 반려·취소되거나, 상대 팀 미결제로 경기가 성사되지 않은 경우에는 위약금 없이 전액 환불돼요.";

/** 결제 없이 운영할 때(현장정산) 쓰는 안내 — 환불할 결제금이 없다는 사실을 그대로 말한다. */
export const CANCEL_POLICY_NOTE_ONSITE =
  "이용료는 현장에서 정산하므로 앱에서 환불받을 금액은 없어요. 다만 당일 취소·노쇼가 반복되면 예약이 제한될 수 있어요.";

const toStr = (v) => String(v || "").trim();
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 예약의 이용 시작 시각 (date "YYYY-MM-DD" + startTime "HH:mm") → Date | null */
export function reservationStartAt(date, startTime) {
  const d = toStr(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T${toStr(startTime) || "00:00"}:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/**
 * 지금이 어느 단계인지 — CANCEL_POLICY_TIERS 의 인덱스와 1:1 대응.
 * 0=2일 전까지 / 1=1일 전 / 2=당일 / 3=시작 후(취소 불가)
 */
export function cancelStageIndex(date, startTime, now = new Date()) {
  const start = reservationStartAt(date, startTime);
  if (!start) return 0;
  if (now.getTime() >= start.getTime()) return 3;
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayS = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const days = Math.round((dayS.getTime() - day0.getTime()) / 86400000);
  if (days <= 0) return 2;
  if (days === 1) return 1;
  return 0;
}

/**
 * 이용자 귀책 취소 시 환불율 (0~1). CANCEL_POLICY_TIERS 와 1:1로 붙어 있다.
 * 구장 사정 취소·미결제 자동취소·상대팀 귀책은 이 함수를 쓰지 않고 무조건 전액 환불이다.
 */
export function refundRate(date, startTime, now = new Date()) {
  const tier = CANCEL_POLICY_TIERS[cancelStageIndex(date, startTime, now)];
  return tier ? tier.refundRate : 0;
}

/** 환불 예정액 (원 단위 내림 — 부분환불에서 1원이라도 더 나가지 않게) */
export function refundAmount(paidAmount, date, startTime, now = new Date()) {
  const paid = Number(paidAmount) || 0;
  return Math.floor(paid * refundRate(date, startTime, now));
}

/** "7월 20일 (월) 19:00" */
export function formatStartAt(date, startTime) {
  const s = reservationStartAt(date, startTime);
  if (!s) return "";
  const hh = String(s.getHours()).padStart(2, "0");
  const mm = String(s.getMinutes()).padStart(2, "0");
  return `${s.getMonth() + 1}월 ${s.getDate()}일 (${WEEK[s.getDay()]}) ${hh}:${mm}`;
}

/** 확정 예약 상단 안내 — "7월 20일 (월) 19:00부터 이용할 수 있어요." */
export function usableFromText(date, startTime) {
  const label = formatStartAt(date, startTime);
  return label ? `${label}부터 이용할 수 있어요.` : "";
}

/**
 * 취소 기한 안내 문구.
 * 취소 가능하면 언제까지인지, 불가하면 왜 불가하고 어디로 문의할지.
 */
export function cancelDeadlineText(date, startTime, now = new Date()) {
  const stage = cancelStageIndex(date, startTime, now);
  if (stage === 3) {
    return "이용 시작 시각이 지나 앱에서는 취소할 수 없어요. 구장에 직접 연락해 주세요.";
  }
  const label = formatStartAt(date, startTime);
  if (!label) return "이용 시작 전까지 취소할 수 있어요.";
  if (stage === 2) {
    return `${label} 이전까지 취소할 수 있어요. 오늘 경기라 취소하면 노쇼로 기록될 수 있어요.`;
  }
  return `${label} 이전까지 취소할 수 있어요.`;
}
