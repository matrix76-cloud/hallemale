// src/constants/cancelPolicy.js
// 구장 예약 취소 정책 — 플랫폼 공통 기본값.
//
// 할래말래는 무결제 예약중개(현장 정산, constants/payments.js PG_ENABLED=false)라
// "결제금액 N% 차감" 같은 환불 단계가 존재하지 않는다. 그래서 단계는 "환불률"이 아니라
// "취소가 구장에 주는 부담 / 이용자에게 남는 기록"으로 구성한다.
//
// 실제 강제 규칙은 ownerVenueService.cancelMyReservation 하나뿐이다:
//   requested·confirmed 이고 시작 시각 이전이면 취소 가능, 그 외 불가.
// 아래 문구는 그 동작을 그대로 설명한다 — UI가 서비스보다 엄격한 척하지 않게 할 것.

/** 취소 규정 테이블 (구장 상세 · 예약 시트에서 그대로 렌더) */
export const CANCEL_POLICY_TIERS = [
  { when: "이용 2일 전까지", what: "자유롭게 취소 · 불이익 없음", tone: "ok" },
  { when: "이용 1일 전", what: "취소 가능 · 구장에 즉시 통보돼요", tone: "warn" },
  { when: "이용 당일", what: "취소 가능하나 노쇼로 기록될 수 있어요", tone: "warn" },
  { when: "이용 시작 후", what: "앱 취소 불가 · 구장에 직접 문의", tone: "danger" },
];

export const CANCEL_POLICY_NOTE =
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
