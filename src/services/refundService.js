/* eslint-disable */
// src/services/refundService.js
// 환불 관리 — 결제 완료된 예약(venueReservations)을 취소하고 환불한다.
//
// ⚠️ 환불 경로가 둘이고, 섞으면 이중 환불이 난다.
//   · 카드(토스) 결제건 — 예약을 cancelled 로 바꾸면 서버 트리거 venuePaidConfirm
//     (functions/jobs/venuePaymentJobs.js)이 취소 시점 정책(refundPolicy.refundDecision)에 따라
//     토스로 실제 환불하고 payments 원장을 깎는다. 여기서 할 일은 "취소"뿐이다.
//     예전엔 이 상태에서 chargeFizz 로 앱 잔액까지 얹어줘서 카드 환불 + 잔액 지급이 동시에 나갔다.
//   · 앱 잔액(피지) 결제건 — 결제 원장이 없으므로 여기서 잔액을 복구해야 한다.
//
// 어느 쪽인지는 payments 원장의 존재로 판정한다(예약 문서의 paymentMethod 는 구버전에 없을 수 있다).
// 카드 결제건의 실제 환불액은 서버가 정하므로 이 화면에서 금액을 받지 않는다 — 받아봐야
// 카드로 나가는 금액과 달라 화면과 원장이 다른 말을 하게 된다.

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import {
  collection, getDocs, getDoc, doc, updateDoc, query, where, serverTimestamp,
} from "firebase/firestore";
import { chargeFizz } from "./fizzService";

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function s(v) { return String(v ?? "").trim(); }
function toDate(v) {
  try { if (v?.toDate) return v.toDate(); if (v) return new Date(v); } catch {}
  return null;
}

// 환불 대상이 되는(결제 완료) 상태
const PAID_STATUSES = ["confirmed", "done"];

function row(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    venueId: s(data.venueId),
    venueName: s(data.venueName) || "(이름 없음)",
    ownerUid: s(data.ownerUid),
    courtName: s(data.courtName),
    date: s(data.date),
    startTime: s(data.startTime),
    endTime: s(data.endTime),
    userId: s(data.userId),
    userName: s(data.userName),
    teamName: s(data.teamName),
    phone: s(data.phone),
    price: n(data.price),
    status: s(data.status),
    paymentMethod: s(data.paymentMethod),
    refunded: data.refunded === true,
    refundAmount: n(data.refundAmount),
    refundReason: s(data.refundReason),
    refundedAt: toDate(data.refundedAt),
    // "pg" = 카드 환불(금액은 서버 정책이 정한다) · "fizz" = 앱 잔액 복구(금액이 곧 환불액)
    refundVia: s(data.refundVia),
    createdAt: toDate(data.createdAt),
  };
}

/** 이 예약에 살아있는 결제 원장이 있는지 — 있으면 카드 결제건이다. */
async function hasLivePayments(reservationId) {
  const rid = s(reservationId);
  if (!rid) return false;
  if (hasMock("paymentDocs")) {
    return Object.values(mockData("paymentDocs") || {}).some(
      (p) => s(p?.reservationId) === rid && p?.cancelled !== true,
    );
  }
  const snap = await getDocs(
    query(collection(db, "payments"), where("reservationId", "==", rid), where("cancelled", "==", false)),
  );
  return !snap.empty;
}

// 예약에 venueName 없으면 venues 에서 보강
async function backfillVenueNames(rows) {
  const need = [...new Set(
    rows.filter((r) => !r.venueName || r.venueName === "(이름 없음)").map((r) => r.venueId).filter(Boolean)
  )];
  if (!need.length) return rows;
  const vmap = {};
  await Promise.all(need.map(async (vid) => {
    try { const vs = await getDoc(doc(db, "venues", vid)); if (vs.exists()) vmap[vid] = vs.data(); } catch {}
  }));
  return rows.map((r) => {
    const v = vmap[r.venueId];
    if (!v) return r;
    return { ...r, venueName: s(v.name) || r.venueName };
  });
}

/** 환불 가능 예약 (결제완료 + 미환불). from/to: "YYYY-MM-DD" */
export async function listRefundableReservations({ from = "", to = "" } = {}) {
  const snap = hasMock("venueReservationDocs")
    ? mockQuerySnap(mockData("venueReservationDocs"))
    : await getDocs(collection(db, "venueReservations"));
  let rows = [];
  snap.forEach((d) => rows.push(row(d)));
  rows = rows.filter((r) => PAID_STATUSES.includes(r.status) && !r.refunded && r.price > 0);
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows = await backfillVenueNames(rows);
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

/** 환불 완료 내역 */
export async function listRefundedReservations({ from = "", to = "" } = {}) {
  const snap = hasMock("venueReservationDocs")
    ? mockQuerySnap(mockData("venueReservationDocs"))
    : await getDocs(collection(db, "venueReservations"));
  let rows = [];
  snap.forEach((d) => rows.push(row(d)));
  rows = rows.filter((r) => r.refunded);
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows = await backfillVenueNames(rows);
  rows.sort((a, b) => {
    const ta = a.refundedAt ? a.refundedAt.getTime() : 0;
    const tb = b.refundedAt ? b.refundedAt.getTime() : 0;
    return tb - ta;
  });
  return rows;
}

/**
 * 이 예약이 어느 경로로 환불되는지.
 * 화면은 이걸 먼저 물어봐야 한다 — 카드 결제건은 금액을 입력받으면 안 되기 때문이다.
 * @returns {"pg"|"fizz"}
 */
export async function getRefundRoute(reservation) {
  return (await hasLivePayments(s(reservation?.id))) ? "pg" : "fizz";
}

/**
 * 환불 처리.
 * @param reservation  대상 예약 row (id/userId/price 필요)
 * @param amount       앱 잔액 결제건의 환불액(기본=전액). 카드 결제건에서는 무시된다.
 * @param reason       환불 사유(선택)
 * @param basis        카드 결제건의 환불 기준 — "full"(전액) | "policy"(취소 시점 위약금 공제)
 * @returns {{ via: "pg"|"fizz", refundAmount: number|null }}
 *          via==="pg" 면 실제 환불액은 서버가 정하므로 여기서 알 수 없다(null).
 */
export async function processRefund(reservation, amount, reason = "", basis = "full") {
  const r = reservation || {};
  const rid = s(r.id);
  if (!rid) throw new Error("예약 정보가 올바르지 않습니다.");
  if (r.refunded) throw new Error("이미 환불된 예약입니다.");

  const isPg = await hasLivePayments(rid);

  if (isPg) {
    // 카드 결제건 — 취소만 한다. 환불은 서버 트리거가 정책률로 실행하고 payments 를 깎는다.
    // 여기서 잔액을 얹으면 카드 환불과 겹쳐 이중 환불이 된다.
    //
    // ⚠️ canceledBy 를 반드시 세운다. 예전엔 안 세워서 서버 판정(refundPolicy.refundDecision)이
    //    캐치올에 걸려 **어떤 건이든 무조건 전액 환불**이 나갔고, 고객 알림톡에도
    //    "구장 사정 취소"라고 찍혔다. 위약금을 물려야 하는 임박 취소도 100% 환불됐다.
    //      · full   → "admin" : 관리자 확인 · 전액 환불
    //      · policy → "user"  : 이용자 귀책 = 취소 시점 위약금 공제(2일 전 100/1일 전 50/당일 0)
    await updateDoc(doc(db, "venueReservations", rid), {
      status: "cancelled",
      canceledBy: basis === "policy" ? "user" : "admin",
      cancelReason: s(reason) || "관리자 환불 처리",
      refunded: true,
      refundVia: "pg",
      refundBasis: basis === "policy" ? "policy" : "full",
      refundReason: s(reason),
      refundedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { reservationId: rid, via: "pg", refundAmount: null };
  }

  // 앱 잔액(피지) 결제건 — 결제 원장이 없으므로 여기서 복구한다.
  const amt = n(amount);
  if (amt <= 0) throw new Error("환불액이 올바르지 않습니다.");
  if (amt > n(r.price)) throw new Error("환불액이 결제액보다 클 수 없습니다.");

  if (s(r.userId) && s(r.userId) !== "seed_user") {
    await chargeFizz(r.userId, amt);
  }

  await updateDoc(doc(db, "venueReservations", rid), {
    status: "cancelled",
    cancelReason: s(reason) || "관리자 환불 처리",
    refunded: true,
    refundVia: "fizz",
    refundAmount: amt,
    refundReason: s(reason),
    refundedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { reservationId: rid, via: "fizz", refundAmount: amt };
}
