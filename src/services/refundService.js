/* eslint-disable */
// src/services/refundService.js
// 환불 관리 — 결제 완료된 예약(venueReservations)을 취소하고 피지를 유저에게 환불.
//
// 환불 처리: chargeFizz(userId, 환불액)로 잔액 복구 + 예약 status=cancelled +
//            refunded(true)/refundAmount/refundedAt/refundReason 기록.

import { db } from "./firebase";
import {
  collection, getDocs, getDoc, doc, updateDoc, serverTimestamp,
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
    createdAt: toDate(data.createdAt),
  };
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
  const snap = await getDocs(collection(db, "venueReservations"));
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
  const snap = await getDocs(collection(db, "venueReservations"));
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
 * 환불 처리.
 * @param reservation  대상 예약 row (id/userId/price 필요)
 * @param amount       환불액(기본=전액). 0 < amount <= price
 * @param reason       환불 사유(선택)
 */
export async function processRefund(reservation, amount, reason = "") {
  const r = reservation || {};
  const rid = s(r.id);
  if (!rid) throw new Error("예약 정보가 올바르지 않습니다.");
  if (r.refunded) throw new Error("이미 환불된 예약입니다.");
  const amt = n(amount);
  if (amt <= 0) throw new Error("환불액이 올바르지 않습니다.");
  if (amt > n(r.price)) throw new Error("환불액이 결제액보다 클 수 없습니다.");

  // 1) 유저 피지 잔액 복구 (userId 있을 때만)
  if (s(r.userId) && s(r.userId) !== "seed_user") {
    await chargeFizz(r.userId, amt);
  }

  // 2) 예약 문서: 취소 + 환불 기록
  await updateDoc(doc(db, "venueReservations", rid), {
    status: "cancelled",
    refunded: true,
    refundAmount: amt,
    refundReason: s(reason),
    refundedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { reservationId: rid, refundAmount: amt };
}
