/* eslint-disable */
// src/services/taxInvoiceService.js
// 플랫폼 이용료 **수수료 세금계산서** — 발행 대상 산출 · 상태 관리 · 국세청 업로드용 내보내기.
//
// 무엇에 대한 계산서인가:
//   구장 이용료(손님 결제액)의 부가세는 공급자인 구장 사업자 몫이라 우리와 무관하다.
//   우리가 구장에게 파는 건 "중개 용역"이고 그 대가가 플랫폼 이용료(5%)다.
//   → 공급자 = 할래말래, 공급받는자 = 구장 사업자. 우리가 발행하고 구장이 매입세액 공제를 받는다.
//
// 금액 기준은 **환불 반영 후(netPlatformFee)** 다. platformFee 는 환불 전 스냅샷이라
// 그걸로 끊으면 취소된 예약의 이용료까지 청구하게 된다.
//
// ⚠️ 실제 "전자세금계산서 발행"은 여기서 하지 않는다. 전자세금계산서는 국세청에 전송해야
//    효력이 생기고, 그러려면 ASP(팝빌·바로빌 등) 계약이나 홈택스 직접 발행이 필요하다.
//    아직 발행 대행사가 정해지지 않았으므로 이 파일은 "무엇을 얼마에 끊어야 하는지"를 확정하고
//    그 결과를 기록·내보내기까지만 한다. 발행처가 정해지면 issue() 안의 어댑터만 갈아끼우면 된다.
//    (없는 발행을 했다고 표시하면 세무 사고가 된다 — 상태를 정직하게 나눠 둔 이유다)

import { db } from "./firebase";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp,
} from "firebase/firestore";
import { hasMock, mockData } from "../dev/mockBus";
import { splitVat } from "../constants/payments";
import { exportCsv } from "./ownerSettlementService";

const s = (v) => String(v ?? "").trim();
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/* 상태
 *  draft   — 대상·금액만 확정. 아직 국세청에 아무것도 안 갔다.
 *  issued  — 실제로 발행됨(홈택스/ASP). 발행번호(issueNo)를 같이 남긴다.
 *  cancelled — 발행 취소(수정세금계산서 포함). 사유를 남긴다.
 */
export const TAX_INVOICE_STATUS = ["draft", "issued", "cancelled"];
export const TAX_INVOICE_STATUS_LABEL = {
  draft: "발행 대기",
  issued: "발행 완료",
  cancelled: "발행 취소",
};

/** 문서 id — 구장 × 기간에 1건. 같은 달을 두 번 끊는 사고를 id 로 막는다. */
export const invoiceId = (venueId, period) => `${s(venueId)}_${s(period)}`;

/**
 * 기간(YYYY-MM)의 발행 대상 산출.
 * payments 원장에서 구장별로 netPlatformFee 를 더한다 — 정산 화면과 같은 단일 진실이다.
 *
 * @param {Array} rows settlementService.listPayments() 결과 (이미 기간 필터된 것)
 * @returns [{ venueId, venueName, ownerUid, supply, vat, total, count, paymentIds }]
 */
export function buildInvoiceTargets(rows = []) {
  const map = new Map();
  for (const r of rows) {
    if (n(r.netPlatformFee) <= 0) continue; // 전액 환불 건은 청구할 이용료가 없다
    const key = s(r.venueId) || s(r.venueName);
    if (!map.has(key)) {
      map.set(key, {
        venueId: s(r.venueId), venueName: s(r.venueName), ownerUid: s(r.ownerUid),
        total: 0, count: 0, paymentIds: [],
      });
    }
    const g = map.get(key);
    g.total += n(r.netPlatformFee);
    g.count += 1;
    g.paymentIds.push(s(r.id));
  }
  // 공급가액·부가세는 건별 합이 아니라 **합계에서 한 번** 나눈다 —
  // 세금계산서는 한 장에 한 쌍의 (공급가액, 세액)만 적히므로 그 장의 총액을 기준으로 해야
  // supply + vat = total 이 계산서 위에서 성립한다.
  return [...map.values()]
    .map((g) => ({ ...g, ...splitVat(g.total) }))
    .map((g) => ({ ...g, supply: g.supply, vat: g.vat }))
    .sort((a, b) => b.total - a.total);
}

const row = (id, x = {}) => ({
  id,
  venueId: s(x.venueId),
  venueName: s(x.venueName),
  ownerUid: s(x.ownerUid),
  period: s(x.period),
  supply: n(x.supply),
  vat: n(x.vat),
  total: n(x.total),
  count: n(x.count),
  // 공급받는자 정보 — 발행 시점 스냅샷이다. 구장이 나중에 상호를 바꿔도 이미 끊은 계산서는 그대로여야 한다.
  bizNo: s(x.bizNo),
  bizName: s(x.bizName),
  ownerName: s(x.ownerName),
  taxEmail: s(x.taxEmail),
  taxType: s(x.taxType),
  status: TAX_INVOICE_STATUS.includes(s(x.status)) ? s(x.status) : "draft",
  issueNo: s(x.issueNo),
  issuedAt: s(x.issuedAt),
  cancelReason: s(x.cancelReason),
  memo: s(x.memo),
});

/** 기간의 세금계산서 목록 */
export async function listTaxInvoices(period) {
  const p = s(period);
  if (hasMock("taxInvoiceDocs")) {
    return Object.entries(mockData("taxInvoiceDocs") || {})
      .map(([k, v]) => row(k, v))
      .filter((r) => !p || r.period === p);
  }
  const snap = await getDocs(query(collection(db, "taxInvoices"), where("period", "==", p)));
  const rows = [];
  snap.forEach((d) => rows.push(row(d.id, d.data())));
  return rows.sort((a, b) => b.total - a.total);
}

/**
 * 발행 대상을 draft 로 확정 저장.
 * 이미 issued 인 건은 건드리지 않는다 — 끊은 계산서의 금액이 뒤에서 바뀌면 안 된다.
 *
 * @param {object} target buildInvoiceTargets() 의 한 항목
 * @param {object} venue  venues 문서(공급받는자 정보 스냅샷용)
 */
export async function upsertDraft(target, venue, period) {
  const id = invoiceId(target.venueId, period);
  const ref = doc(db, "taxInvoices", id);
  const cur = await getDoc(ref);
  if (cur.exists() && s(cur.data()?.status) === "issued") return row(cur.id, cur.data());

  const biz = venue?.business || {};
  const payload = {
    venueId: s(target.venueId),
    venueName: s(target.venueName),
    ownerUid: s(target.ownerUid),
    period: s(period),
    supply: n(target.supply),
    vat: n(target.vat),
    total: n(target.total),
    count: n(target.count),
    paymentIds: Array.isArray(target.paymentIds) ? target.paymentIds : [],
    bizNo: s(biz.bizNo) || s(venue?.bizNo),
    bizName: s(biz.bizName) || s(venue?.bizName),
    ownerName: s(biz.ownerName) || s(venue?.ownerName),
    taxEmail: s(venue?.settlement?.taxEmail),
    taxType: s(biz.taxType),
    status: "draft",
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  return row(id, payload);
}

/**
 * 발행 처리. 지금은 "발행했다는 사실과 발행번호를 기록"하는 데까지다 —
 * 실제 국세청 전송은 홈택스나 ASP 에서 이뤄지고, 그 결과 번호를 여기에 적는다.
 * 발행 대행사를 붙이면 이 함수 안에서 API 를 부르고 issueNo 를 받아 채우면 된다.
 */
export async function markIssued(id, { issueNo = "", memo = "" } = {}) {
  await updateDoc(doc(db, "taxInvoices", s(id)), {
    status: "issued",
    issueNo: s(issueNo),
    memo: s(memo),
    issuedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function markCancelled(id, reason = "") {
  await updateDoc(doc(db, "taxInvoices", s(id)), {
    status: "cancelled",
    cancelReason: s(reason),
    updatedAt: serverTimestamp(),
  });
}

/** 발행 가능 여부 — 사업자번호·이메일이 없으면 계산서를 끊을 수 없다. */
export function issuableCheck(inv) {
  const missing = [];
  if (!s(inv?.bizNo)) missing.push("사업자등록번호");
  if (!s(inv?.taxEmail)) missing.push("수신 이메일");
  if (!s(inv?.bizName)) missing.push("상호");
  return { ok: missing.length === 0, missing };
}

const csvCell = (v) => {
  const t = String(v ?? "");
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * 국세청 홈택스 / 발행 대행사 일괄등록용 CSV.
 * 컬럼은 "전자세금계산서 일괄발행" 양식이 공통으로 요구하는 최소 항목에 맞췄다 —
 * 대행사를 정하면 그 양식에 맞춰 열 이름만 바꾸면 된다.
 */
export function buildTaxInvoiceCsv(rows = [], period = "") {
  const head = [
    "작성일자", "공급받는자 등록번호", "공급받는자 상호", "공급받는자 대표자",
    "공급받는자 이메일", "품목", "공급가액", "세액", "합계금액", "비고",
  ];
  const writeDate = `${s(period).replace("-", "")}31`.slice(0, 8); // 월말 기준(발행 시 조정)
  const body = rows.map((r) => [
    writeDate,
    s(r.bizNo).replace(/[^0-9]/g, ""),
    r.bizName,
    r.ownerName,
    r.taxEmail,
    `${s(period)} 플랫폼 중개 이용료`,
    r.supply,
    r.vat,
    r.total,
    `예약 ${r.count}건`,
  ]);
  return `﻿${[head, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}

export { exportCsv };
