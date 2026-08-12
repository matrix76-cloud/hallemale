/* eslint-disable */
// src/services/payoutService.js
// 토스 지급대행 — 어드민 화면에서 쓰는 클라이언트 래퍼.
// 서버: functions/payments/payouts.js
//
// 금액은 여기서 정하지 않는다. 서버가 payments 원장(netVenueAmount)에서 다시 더해 보낸다 —
// 화면 값이 낡았거나 조작돼도 실제로 나가는 돈은 장부와 같아야 한다.
//
// 지급대행은 PG 계약이 선행조건이라 아직 닫혀 있을 수 있다(503 payouts_disabled).
// 화면은 그 상태를 "오류"가 아니라 "아직 안 열림"으로 구분해 보여줘야 한다.

import { auth, db } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";

const CF_BASE = "https://asia-northeast3-halle-bf789.cloudfunctions.net";
const s = (v) => String(v ?? "").trim();

/** 지급대행이 아직 안 열렸을 때 던지는 에러 — 화면이 문구를 갈라 쓸 수 있게 코드로 구분한다. */
export const PAYOUTS_DISABLED = "payouts_disabled";

async function call(fn, body) {
  const u = auth.currentUser;
  if (!u) {
    // 로그인이 없으면 지급대행을 쓸 수 없다 — "오류"가 아니라 "안 열림"으로 취급한다.
    // (목업으로 띄운 리뷰 보드 화면이 빨간 연결 실패로 보이면 안 된다)
    const e = new Error("지급대행을 사용할 수 없습니다.");
    e.code = PAYOUTS_DISABLED;
    throw e;
  }
  const token = await u.getIdToken();
  const res = await fetch(`${CF_BASE}/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(s(json.error) || `요청 실패(HTTP ${res.status})`);
    e.code = s(json.code) || (res.status === 503 ? PAYOUTS_DISABLED : "");
    e.detail = json;
    throw e;
  }
  return json;
}

/** 구장을 토스 셀러로 등록. 개인사업자는 등록 직후 본인인증 문자가 가고, 그전엔 지급이 안 된다. */
export function registerSeller(venueId) {
  return call("registerPayoutSeller", { venueId });
}

/** 셀러 상태 재조회(웹훅 유실 대비 수동 동기화) */
export function syncSeller(venueId) {
  return call("syncPayoutSeller", { venueId });
}

/** 지급 가능 잔액 — 요청 전에 확인한다. 넘겨서 요청하면 그대로 실패한다. */
export function fetchBalance() {
  return call("getPayoutBalance", {});
}

/**
 * 구장 지급 요청. payoutDate 를 주면 예약지급(SCHEDULED), 없으면 당일지급(EXPRESS).
 * ⚠️ EXPRESS 는 영업일 08:00~15:00 에만 된다(휴일·공휴일 오류).
 */
export function requestPayout(venueId, payoutDate = "") {
  return call("requestVenuePayout", { venueId, payoutDate });
}

/** 예약지급(REQUESTED) 취소 */
export function cancelPayoutRequest(refPayoutId) {
  return call("cancelVenuePayout", { refPayoutId });
}

/* ── 조회 (Firestore 직접) ───────────────────────────────── */

const sellerRow = (id, x = {}) => ({
  venueId: id,
  sellerId: s(x.sellerId),
  status: s(x.status),
  businessType: s(x.businessType),
  holderName: s(x.holderName),
  bizNo: s(x.bizNo),
  updatedAt: s(x.updatedAt),
  lastError: s(x.lastError),
});

/** 구장의 셀러 등록 상태. 없으면 null(=아직 등록 안 함). */
export async function getSellerStatus(venueId) {
  const id = s(venueId);
  if (!id) return null;
  if (hasMock("payoutSellers")) {
    const m = (mockData("payoutSellers") || {})[id];
    return m ? sellerRow(id, m) : null;
  }
  const snap = await getDoc(doc(db, "payoutSellers", id));
  return snap.exists() ? sellerRow(snap.id, snap.data()) : null;
}

const payoutRow = (id, x = {}) => ({
  refPayoutId: id,
  payoutId: s(x.payoutId),
  venueId: s(x.venueId),
  amount: Number(x.amount) || 0,
  status: s(x.status),
  scheduleType: s(x.scheduleType),
  payoutDate: s(x.payoutDate),
  requestedAt: s(x.requestedAt),
  completedAt: s(x.completedAt),
  count: Array.isArray(x.paymentIds) ? x.paymentIds.length : 0,
  error: s(x.error),
});

/** 최근 지급 요청 이력 (구장 지정 시 그 구장만) */
export async function listPayouts({ venueId = "", max = 50 } = {}) {
  if (hasMock("payoutDocs")) {
    const all = Object.entries(mockData("payoutDocs") || {}).map(([k, v]) => payoutRow(k, v));
    return all
      .filter((r) => !venueId || r.venueId === venueId)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))
      .slice(0, max);
  }
  const base = collection(db, "payouts");
  const q = venueId
    ? query(base, where("venueId", "==", s(venueId)), limit(max))
    : query(base, orderBy("requestedAt", "desc"), limit(max));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach((d) => rows.push(payoutRow(d.id, d.data())));
  // venueId 로 거를 때는 정렬 인덱스를 추가하지 않으려고 클라에서 정렬한다.
  return rows.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

/** 셀러 상태 → 화면 문구. 상태를 그대로 노출하면 무슨 뜻인지 알 수 없다. */
export const SELLER_STATUS_LABEL = {
  "": "미등록",
  APPROVAL_REQUIRED: "본인인증 대기",
  PARTIALLY_APPROVED: "지급 가능 (주 1천만원 미만)",
  KYC_REQUIRED: "KYC 심사 필요",
  APPROVED: "지급 가능 (한도 없음)",
};
/** 지금 지급을 걸 수 있는 상태인가 */
export const canPayout = (status) => ["PARTIALLY_APPROVED", "APPROVED"].includes(s(status));

export const PAYOUT_STATUS_LABEL = {
  PENDING_REQUEST: "요청 중",
  REQUESTED: "지급 예약됨",
  IN_PROGRESS: "지급 처리 중",
  COMPLETED: "지급 완료",
  FAILED: "지급 실패",
  CANCELED: "취소됨",
};
