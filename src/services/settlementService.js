/* eslint-disable */
// src/services/settlementService.js
// 결제 정산 관리 — venueReservations(피지 결제 완료분)을 구장별로 집계하고 정산 처리.
//
// 데이터: venueReservations (price/status/venueId/venueName/ownerUid/date/settled)
// - 정산 대상: status in [confirmed, done] (결제 완료된 예약)
// - 플랫폼 수수료: PLATFORM_FEE_RATE
// - 정산 처리: 예약 문서에 settled(true)/settledAt 기록

import { db } from "./firebase";
import {
  collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";

// 플랫폼 수수료율 (구장주에게 지급 = 매출 × (1 - 수수료율))
export const PLATFORM_FEE_RATE = 0.1; // 10%

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function s(v) { return String(v ?? "").trim(); }
function toDate(v) {
  try { if (v?.toDate) return v.toDate(); if (v) return new Date(v); } catch {}
  return null;
}

const PAID_STATUSES = ["confirmed", "done"];

function row(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    venueId: s(data.venueId),
    venueName: s(data.venueName) || "(이름 없음)",
    ownerUid: s(data.ownerUid),
    courtName: s(data.courtName),
    date: s(data.date),               // YYYY-MM-DD
    startTime: s(data.startTime),
    endTime: s(data.endTime),
    userName: s(data.userName),
    teamName: s(data.teamName),
    price: n(data.price),
    status: s(data.status),
    paymentMethod: s(data.paymentMethod),
    settled: data.settled === true,
    settledAt: toDate(data.settledAt),
    createdAt: toDate(data.createdAt),
  };
}

/** 결제 완료된 예약 목록 (정산 대상). from/to: "YYYY-MM-DD" 문자열(포함). */
export async function listPaidReservations({ from = "", to = "" } = {}) {
  const snap = await getDocs(collection(db, "venueReservations"));
  let rows = [];
  snap.forEach((d) => rows.push(row(d)));
  rows = rows.filter((r) => PAID_STATUSES.includes(r.status) && r.price > 0);
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 최신순
  return rows;
}

/** 매출 → 수수료/정산액 계산 */
export function calcSettlement(grossAmount) {
  const gross = n(grossAmount);
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  const net = gross - fee;
  return { gross, fee, net };
}

/** 예약 목록을 구장별로 집계 */
export function groupByVenue(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.venueId || r.venueName;
    if (!map.has(key)) {
      map.set(key, {
        venueId: r.venueId, venueName: r.venueName, ownerUid: r.ownerUid,
        count: 0, gross: 0, settledCount: 0, settledGross: 0, items: [],
      });
    }
    const g = map.get(key);
    g.count += 1;
    g.gross += r.price;
    if (r.settled) { g.settledCount += 1; g.settledGross += r.price; }
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

/** 단건 정산 처리/해제 */
export async function markReservationSettled(reservationId, settled = true) {
  const rid = s(reservationId);
  if (!rid) throw new Error("reservationId가 비어있습니다.");
  await updateDoc(doc(db, "venueReservations", rid), {
    settled: !!settled,
    settledAt: settled ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

/** 여러 건 일괄 정산 처리/해제 (배치) */
export async function markManySettled(reservationIds = [], settled = true) {
  const ids = (reservationIds || []).map(s).filter(Boolean);
  if (!ids.length) return 0;
  // Firestore 배치는 500개 제한 → 분할
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    ids.slice(i, i + 450).forEach((id) => {
      batch.update(doc(db, "venueReservations", id), {
        settled: !!settled,
        settledAt: settled ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
  return ids.length;
}
