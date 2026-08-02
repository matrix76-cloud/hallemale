/* eslint-disable */
// src/services/settlementService.js
// 어드민 결제 정산 — 결제 원장(payments)을 단일 진실로 집계한다.
//
// ⚠️ 예전에는 venueReservations.price 를 더했다. 그건 "정가"라서 환불·부분취소가 반영되지 않는다.
//    구장주 화면(ownerSettlementService)은 payments.netVenueAmount 로 집계하고 있어서,
//    같은 구장인데 어드민과 구장주가 서로 다른 금액을 봤다. 환불된 만큼을 더 지급하게 되는 값이라
//    지급대행(자동이체)을 붙이면 그대로 돈이 나간다. 두 화면을 이 파일 기준으로 맞춘다.
//
// 금액 구분 (functions/payments/toss.js 가 기록):
//   amount         = 사용자가 실제로 낸 돈 (구장몫 + 플랫폼 이용료)
//   venueAmount    = 구장 몫 (정가)
//   netVenueAmount = 환불하고 남은 구장 몫 ← 지급액은 항상 이 값이다
//   platformFee    = 플랫폼 이용료 (회사 몫, 구장주와 무관)
//
// 지급 완료 표시: payments.settled. 지급대행이 붙으면 서버가 payoutId 를 채우므로
//   그때는 payoutId 가 있는 건도 지급 완료로 본다(둘 다 인정).

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import {
  collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";

// 정산 "시점"에 한 번 더 떼는 수수료율 — 0 이어야 한다.
// 플랫폼 이용료는 결제 시점에 이미 원장에서 차감돼 있다(payments.netVenueAmount = 결제액 - 이용료).
// 여기서 또 떼면 이중 공제가 되어 구장주에게 덜 지급된다.
// 요율 자체는 src/constants/payments.js 의 PLATFORM_FEE_RATE 하나가 단일 출처다.
export const PLATFORM_FEE_RATE = 0;

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function s(v) { return String(v ?? "").trim(); }
function toDate(v) {
  try { if (v?.toDate) return v.toDate(); if (v) return new Date(v); } catch {}
  return null;
}

function row(d) {
  const x = d.data() || {};
  const venueAmount = n(x.venueAmount);
  return {
    id: d.id,
    reservationId: s(x.reservationId),
    venueId: s(x.venueId),
    venueName: s(x.venueName) || "(이름 없음)",
    ownerUid: s(x.ownerUid),
    matchId: s(x.matchId),
    side: s(x.side),                  // 분담결제면 A/B, 단독이면 SINGLE
    date: s(x.reservationDate),       // 이용일 YYYY-MM-DD
    amount: n(x.amount),              // 사용자 결제액
    venueAmount,                      // 구장 몫(정가)
    platformFee: n(x.platformFee),    // 회사 몫
    // 구버전 결제 문서엔 netVenueAmount 가 없다 → 취소 여부로 보수적으로 판단.
    netVenueAmount: x.netVenueAmount != null ? n(x.netVenueAmount) : (x.cancelled === true ? 0 : venueAmount),
    refundedVenueAmount: n(x.refundedVenueAmount),
    cancelled: x.cancelled === true,
    method: s(x.method),
    payoutId: s(x.payoutId),
    settled: x.settled === true || !!s(x.payoutId), // 지급대행이 채운 payoutId 도 지급 완료
    settledAt: toDate(x.settledAt),
  };
}

/**
 * 지급 대상 결제 목록. from/to: 이용일 "YYYY-MM-DD"(포함).
 * 전액 환불된 건(netVenueAmount<=0)은 지급할 돈이 없으므로 제외한다.
 */
export async function listPayments({ from = "", to = "" } = {}) {
  const snap = hasMock("paymentDocs")
    ? mockQuerySnap(mockData("paymentDocs"))
    : await getDocs(collection(db, "payments"));
  let rows = [];
  snap.forEach((d) => rows.push(row(d)));
  rows = rows.filter((r) => r.netVenueAmount > 0);
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 최신 이용일순
  return rows;
}

/** 매출 → 수수료/정산액 계산 (구장주에게 떼는 수수료는 0%라 gross === net) */
export function calcSettlement(grossAmount) {
  const gross = n(grossAmount);
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  const net = gross - fee;
  return { gross, fee, net };
}

/** 결제 목록을 구장별로 집계 */
export function groupByVenue(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.venueId || r.venueName;
    if (!map.has(key)) {
      map.set(key, {
        venueId: r.venueId, venueName: r.venueName, ownerUid: r.ownerUid,
        count: 0, gross: 0, platformFee: 0, refunded: 0,
        settledCount: 0, settledGross: 0, items: [],
      });
    }
    const g = map.get(key);
    g.count += 1;
    g.gross += r.netVenueAmount;
    g.platformFee += r.platformFee;
    g.refunded += r.refundedVenueAmount;
    if (r.settled) { g.settledCount += 1; g.settledGross += r.netVenueAmount; }
    g.items.push(r);
  }
  const groups = [...map.values()].map((g) => ({
    ...g,
    ...calcSettlement(g.gross),
    settledNet: calcSettlement(g.settledGross).net,
    pendingCount: g.count - g.settledCount,
    fullySettled: g.count > 0 && g.settledCount === g.count,
  }));
  groups.sort((a, b) => b.gross - a.gross);
  return groups;
}

/** 단건 지급 완료 처리/해제 */
export async function markPaymentSettled(paymentId, settled = true) {
  const pid = s(paymentId);
  if (!pid) throw new Error("paymentId가 비어있습니다.");
  // 규칙이 settled/settledAt 외의 키 변경을 거부한다 — updatedAt 을 같이 쓰면 실패한다.
  await updateDoc(doc(db, "payments", pid), {
    settled: !!settled,
    settledAt: settled ? serverTimestamp() : null,
  });
}

/** 여러 건 일괄 지급 완료 처리/해제 (배치) */
export async function markManySettled(paymentIds = [], settled = true) {
  const ids = (paymentIds || []).map(s).filter(Boolean);
  if (!ids.length) return 0;
  // Firestore 배치는 500개 제한 → 분할
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    ids.slice(i, i + 450).forEach((id) => {
      batch.update(doc(db, "payments", id), {
        settled: !!settled,
        settledAt: settled ? serverTimestamp() : null,
      });
    });
    await batch.commit();
  }
  return ids.length;
}
