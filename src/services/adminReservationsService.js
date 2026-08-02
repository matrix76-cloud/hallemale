/* eslint-disable */
// src/services/adminReservationsService.js
// 어드민 예약 현황 — 전 구장의 venueReservations 를 기간/상태/구장으로 조회한다(읽기 전용).
//
// 구장주는 자기 구장 예약만 보지만(ownerVenueService.listReservations), 어드민은
// 전 구장을 한 화면에서 봐야 하므로 컬렉션 전체를 읽고 클라에서 필터한다.

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function s(v) { return String(v ?? "").trim(); }
function toDate(v) {
  try { if (v?.toDate) return v.toDate(); if (v) return new Date(v); } catch {}
  return null;
}

// 예약 상태 — ownerVenueService.reservationRow 과 동일한 집합
export const STATUS_LABEL = {
  requested: "승인대기",
  pending: "결제대기",
  confirmed: "확정",
  rejected: "반려",
  cancelled: "취소",
  done: "이용완료",
  noshow: "노쇼",
};
const STATUSES = Object.keys(STATUS_LABEL);

function row(d) {
  const data = d.data() || {};
  const matchId = s(data.matchId);
  return {
    id: d.id,
    reservationCode: s(data.reservationCode), // HM-YYMMDD-XXXX (구버전 예약엔 없을 수 있다)
    venueId: s(data.venueId),
    venueName: s(data.venueName),
    courtName: s(data.courtName),
    date: s(data.date), // YYYY-MM-DD
    startTime: s(data.startTime), // HH:mm
    endTime: s(data.endTime),
    // 매칭 예약은 예약자 대신 양 팀이 주체다 — 화면에서 "A vs B" 로 보여야 실제와 맞는다.
    matchId,
    teamAName: s(data.teamAName),
    teamBName: s(data.teamBName),
    userName: s(data.userName),
    teamName: s(data.teamName),
    phone: s(data.phone),
    price: n(data.price),
    status: STATUSES.includes(data.status) ? data.status : "requested",
    source: s(data.source) || (s(data.userId) ? "app" : "owner"),
    paymentMethod: s(data.paymentMethod),
    refunded: data.refunded === true,
    createdAt: toDate(data.createdAt),
  };
}

// 예약에 venueName 없으면 venues 에서 보강
async function backfillVenueNames(rows) {
  const need = [...new Set(rows.filter((r) => !r.venueName).map((r) => r.venueId).filter(Boolean))];
  if (!need.length) return rows;
  const vmap = {};
  await Promise.all(need.map(async (vid) => {
    try { const vs = await getDoc(doc(db, "venues", vid)); if (vs.exists()) vmap[vid] = vs.data(); } catch {}
  }));
  return rows.map((r) => (r.venueName ? r : { ...r, venueName: s(vmap[r.venueId]?.name) }));
}

/**
 * 전 구장 예약 목록. 상태·구장 필터는 화면에서 (건수 집계와 같은 원본을 써야 하므로).
 * @param from "YYYY-MM-DD" 이상 (빈 값이면 제한 없음)
 * @param to   "YYYY-MM-DD" 이하 (빈 값이면 제한 없음)
 */
export async function listAllReservations({ from = "", to = "" } = {}) {
  const snap = hasMock("venueReservationDocs")
    ? mockQuerySnap(mockData("venueReservationDocs"))
    : await getDocs(collection(db, "venueReservations"));

  let rows = [];
  snap.forEach((d) => rows.push(row(d)));

  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);

  rows = await backfillVenueNames(rows);
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1; // 최근 날짜 먼저
    return a.startTime < b.startTime ? 1 : a.startTime > b.startTime ? -1 : 0;
  });
  return rows;
}
