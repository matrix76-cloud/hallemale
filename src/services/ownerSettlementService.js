/* eslint-disable */
// src/services/ownerSettlementService.js
// 구장주 매출·정산 — 결제 원장(payments)을 단일 진실로 집계한다.
//
// 왜 payments 인가:
//   venueReservations.price 는 "정가"라서 환불·부분취소가 반영되지 않는다. 예약 기준으로 매출을
//   집계하면 취소된 건이 계속 매출로 남고, 분담결제에서 한 팀만 낸 건도 전액으로 잡힌다.
//   payments 는 실제로 승인된 돈만 남고 환불 시 netVenueAmount 가 깎이므로 장부가 맞는다.
//
// 금액 구분 (functions/payments/toss.js 가 기록):
//   amount         = 사용자가 실제로 낸 돈 (구장몫 + 플랫폼 이용료)
//   venueAmount    = 구장 몫 (수수료 0% — 전액 지급 대상)
//   netVenueAmount = 환불하고 남은 구장 몫 ← 정산은 항상 이 값을 더한다
//   platformFee    = 플랫폼 이용료 (회사 몫, 구장주와 무관)
//
// 정산 시점: 지급은 "이용일이 지난 뒤"가 원칙이다. 이용 전에 지급하면 그 뒤 환불이 났을 때
//   구장주에게서 돈을 회수해야 하는데 그게 어렵다. 그래서 이용일 기준으로 단계를 나눈다.

// ownerDb: 구장주 세션(ownerApp)에 묶인 Firestore. payments 읽기 규칙이
// resource.data.ownerUid == request.auth.uid 라, 기본 db 로 읽으면 항상 거부된다.
import { ownerDb as db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const s = (v) => String(v ?? "").trim();

const pad = (x) => String(x).padStart(2, "0");
/** 오늘(KST) "YYYY-MM-DD" */
export function todayKst() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function row(d) {
  const x = d.data() || {};
  const venueAmount = n(x.venueAmount);
  return {
    id: d.id,
    paymentKey: s(x.paymentKey) || d.id,
    reservationId: s(x.reservationId),
    venueId: s(x.venueId),
    venueName: s(x.venueName),
    matchId: s(x.matchId),
    side: s(x.side),
    date: s(x.reservationDate),
    amount: n(x.amount),
    venueAmount,
    platformFee: n(x.platformFee),
    // 구버전 결제 문서엔 netVenueAmount 가 없다 → 취소 여부로 보수적으로 판단.
    netVenueAmount: x.netVenueAmount != null ? n(x.netVenueAmount) : (x.cancelled === true ? 0 : venueAmount),
    cancelled: x.cancelled === true,
    refundedVenueAmount: n(x.refundedVenueAmount),
    approvedAt: s(x.approvedAt),
    payoutId: s(x.payoutId),
  };
}

/**
 * 이 구장주의 결제 내역. 구장주 권한으로 읽으려면 ownerUid 로 좁혀야 한다
 * (firestore.rules: payments 는 resource.data.ownerUid == request.auth.uid 만 읽기 허용).
 *
 * 기간으로 자르지 않고 전부 읽는다: "받을 정산금"은 미지급분 전체를 더해야 나오는 값이라
 * 월로 끊으면 실제 입금액과 안 맞는다. 지급이 끝난 건은 payoutId 가 생기므로 미지급 집합은
 * 계속 쌓이지 않는다. 건수가 부담될 만큼 커지면 where("reservationDate",">=",…) 를 추가하되
 * 그때 (ownerUid ASC, reservationDate ASC) 복합 인덱스를 같이 만들어야 한다.
 *
 * @param {string} ownerUid
 * @param {{venueId?:string}} opt
 */
export async function listOwnerPayments(ownerUid, { venueId = "" } = {}) {
  const uid = s(ownerUid);
  if (!uid) return [];

  const snap = await getDocs(query(collection(db, "payments"), where("ownerUid", "==", uid)));
  let rows = [];
  snap.forEach((d) => rows.push(row(d)));

  // 다구장 구장주는 화면에서 고른 구장만 본다. 인덱스를 늘리지 않으려고 클라에서 거른다.
  if (venueId) rows = rows.filter((r) => r.venueId === venueId);

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 최신 이용일 순
  return rows;
}

/**
 * 결제 내역 → 정산 요약.
 *   upcoming : 이용일이 아직 안 지남 → 정산 대상 아님(경기 끝나야 지급)
 *   payable  : 이용 완료 + 미지급 → 이번에 받을 돈
 *   paid     : 이미 지급됨
 * 취소·환불분은 netVenueAmount 가 0(또는 감액)이라 자동으로 빠진다.
 */
export function summarize(rows = [], today = todayKst()) {
  const out = { gross: 0, upcoming: 0, payable: 0, paid: 0, refunded: 0, count: 0 };
  for (const r of rows) {
    out.refunded += r.refundedVenueAmount;
    if (r.netVenueAmount <= 0) continue; // 전액 환불 — 정산에서 제외
    out.gross += r.netVenueAmount;
    out.count += 1;
    if (r.payoutId) out.paid += r.netVenueAmount;
    else if (r.date && r.date >= today) out.upcoming += r.netVenueAmount;
    else out.payable += r.netVenueAmount;
  }
  return out;
}

/** 이용일(YYYY-MM-DD)이 해당 월인 것만 */
export function filterMonth(rows = [], monthKey = "") {
  if (!monthKey) return rows;
  return rows.filter((r) => (r.date || "").startsWith(monthKey));
}
