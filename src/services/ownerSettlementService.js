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
    // 지급 완료 판단 — 지급대행이 채우는 payoutId 와, 그 전 수동 이체를 어드민이 체크한 settled.
    // 둘 다 인정해야 어드민 정산 화면과 이 화면의 "받은 돈"이 어긋나지 않는다.
    settled: x.settled === true || !!s(x.payoutId),
    // 지급 이력(회차별 입금 내역)을 만들려면 "언제 지급됐는지"가 필요하다.
    settledAt: ymdOf(x.settledAt),
  };
}

/** Firestore Timestamp | Date | ISO → KST "YYYY-MM-DD" (없으면 "") */
function ymdOf(v) {
  if (!v) return "";
  let d = null;
  try {
    if (typeof v?.toDate === "function") d = v.toDate();
    else d = new Date(v);
  } catch (e) {
    return "";
  }
  if (!d || Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`;
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
 *   paid     : 이미 지급됨 (지급대행 payoutId 또는 어드민 수동 지급 체크 settled)
 * 취소·환불분은 netVenueAmount 가 0(또는 감액)이라 자동으로 빠진다.
 */
export function summarize(rows = [], today = todayKst()) {
  const out = {
    // 정산 명세 원장 — 결제총액 − 이용료 = 정산기준액, − 환불 = 정산액.
    // 전액 환불 건도 원장에는 남아야 숫자가 맞물린다(그래서 아래 continue 위에서 더한다).
    amount: 0,        // 손님이 낸 돈 합계
    platformFee: 0,   // 플랫폼 이용료 합계
    venueAmount: 0,   // 환불 전 구장 몫 합계
    refunded: 0,      // 환불로 빠진 구장 몫
    net: 0,           // 환불 반영 후 구장 몫 (= gross + 전액환불건 0원)
    refundCount: 0,

    // 지급 단계별 — 전액 환불 건은 여기서 제외된다
    gross: 0, upcoming: 0, payable: 0, paid: 0, count: 0,
  };
  for (const r of rows) {
    out.amount += r.amount;
    out.platformFee += r.platformFee;
    out.venueAmount += r.venueAmount;
    out.refunded += r.refundedVenueAmount;
    out.net += r.netVenueAmount;
    if (r.refundedVenueAmount > 0) out.refundCount += 1;

    if (r.netVenueAmount <= 0) continue; // 전액 환불 — 정산에서 제외
    out.gross += r.netVenueAmount;
    out.count += 1;
    if (r.settled) out.paid += r.netVenueAmount;
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

/* ============================================================
 * 기간 — 부가세 신고 단위(반기)까지 볼 수 있어야 세무에 쓸 수 있다.
 * ========================================================== */

/** period: {type:"month"|"quarter"|"half"|"year", y, m?, q?, h?} → 표시 라벨 */
export function periodLabel(p = {}) {
  const y = p.y;
  if (p.type === "year") return `${y}년`;
  if (p.type === "half") return `${y}년 ${p.h === 2 ? "하반기" : "상반기"}`;
  if (p.type === "quarter") return `${y}년 ${p.q}분기`;
  return `${y}년 ${p.m}월`;
}

/** 이용일이 그 기간에 드는 결제만 */
export function filterPeriod(rows = [], p = {}) {
  const y = Number(p.y);
  if (!y) return rows;
  return rows.filter((r) => {
    const d = String(r.date || "");
    if (d.length < 7) return false;
    const ry = Number(d.slice(0, 4));
    const rm = Number(d.slice(5, 7));
    if (ry !== y) return false;
    if (p.type === "year") return true;
    if (p.type === "half") return p.h === 2 ? rm >= 7 : rm <= 6;
    if (p.type === "quarter") return Math.ceil(rm / 3) === Number(p.q);
    return rm === Number(p.m);
  });
}

/** 기간을 앞/뒤로 한 칸 이동 */
export function shiftPeriod(p = {}, dir = 1) {
  const d = dir >= 0 ? 1 : -1;
  if (p.type === "year") return { ...p, y: p.y + d };
  if (p.type === "half") {
    const v = (p.h || 1) + d;
    if (v > 2) return { ...p, y: p.y + 1, h: 1 };
    if (v < 1) return { ...p, y: p.y - 1, h: 2 };
    return { ...p, h: v };
  }
  if (p.type === "quarter") {
    const v = (p.q || 1) + d;
    if (v > 4) return { ...p, y: p.y + 1, q: 1 };
    if (v < 1) return { ...p, y: p.y - 1, q: 4 };
    return { ...p, q: v };
  }
  const v = (p.m || 1) + d;
  if (v > 12) return { ...p, y: p.y + 1, m: 1 };
  if (v < 1) return { ...p, y: p.y - 1, m: 12 };
  return { ...p, m: v };
}

/* ============================================================
 * 부가세 — 과세유형에 따라 계산이 다르다. 틀린 숫자를 보여주느니 안 보여준다.
 * ========================================================== */

/**
 * "general"  일반과세자 → 공급가액/부가세 분해 가능(10% 포함가)
 * "simple"   간이과세자 → 업종별 부가율이 달라 단순 1/11 분해가 틀린다 → 총액만
 * "other"    학교·기관  → 과세 구조가 별개 → 총액만
 */
export function vatMode({ ownerType = "", taxType = "" } = {}) {
  if (ownerType !== "business") return "other";
  return taxType === "general" ? "general" : "simple";
}

/** 부가세 포함 금액 → { supply 공급가액, vat 부가세 } (10% 포함가 기준) */
export function splitVat(amount) {
  const total = n(amount);
  if (total <= 0) return { supply: 0, vat: 0 };
  const supply = Math.round(total / 1.1);
  return { supply, vat: total - supply };
}

/* ============================================================
 * 지급 이력 — "언제 얼마 입금됐는지". 누적 총액만으로는 대사(對査)가 안 된다.
 * ========================================================== */

/** 지급 완료 건을 지급일(settledAt)로 묶어 최신순 회차 목록으로 */
export function groupPayouts(rows = []) {
  const map = new Map();
  for (const r of rows) {
    if (!r.settled || r.netVenueAmount <= 0) continue;
    const key = r.settledAt || "날짜 미기록";
    if (!map.has(key)) map.set(key, { date: key, amount: 0, count: 0 });
    const g = map.get(key);
    g.amount += r.netVenueAmount;
    g.count += 1;
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ============================================================
 * CSV — 세무사에게 넘길 수 있어야 정산 화면이 장부 구실을 한다.
 * ========================================================== */

const csvCell = (v) => {
  const t = String(v ?? "");
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** 결제 내역 → CSV 문자열 (Excel 한글 깨짐 방지용 BOM 포함) */
export function buildSettlementCsv(rows = [], { venueName = "" } = {}) {
  const head = [
    "이용일", "구장", "구분", "결제번호",
    "결제액", "플랫폼이용료", "정산기준액", "환불액", "정산액",
    "상태", "지급일",
  ];
  const body = rows.map((r) => [
    r.date,
    r.venueName || venueName,
    r.matchId ? `매칭${r.side === "A" || r.side === "B" ? `(${r.side}팀)` : ""}` : "단독",
    r.paymentKey,
    r.amount,
    r.platformFee,
    r.venueAmount,
    r.refundedVenueAmount,
    r.netVenueAmount,
    r.netVenueAmount <= 0 ? "환불" : r.settled ? "지급완료" : "정산대기",
    r.settledAt || "",
  ]);
  return `﻿${[head, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

/**
 * CSV 내려받기. 앱 웹뷰는 다운로드가 막혀 있는 경우가 있어 실패하면 클립보드로 폴백한다.
 * @returns {Promise<"download"|"clipboard"|"failed">}
 */
export async function exportCsv(csv, filename = "settlement.csv") {
  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "download";
  } catch (e) {
    try {
      await navigator.clipboard.writeText(csv);
      return "clipboard";
    } catch (e2) {
      return "failed";
    }
  }
}
