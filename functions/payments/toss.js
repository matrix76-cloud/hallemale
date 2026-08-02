/* eslint-disable */
// functions/payments/toss.js
// 토스페이먼츠 결제위젯 — 주문 생성 / 결제 승인 / 결제 취소.
//
// 왜 서버인가: 승인(confirm)은 시크릿 키가 필요하고, 무엇보다 "얼마를 결제해야 하는지"를
//   클라이언트가 정하면 금액을 위조할 수 있다. 그래서 금액은 항상 예약 문서에서 서버가 계산하고,
//   승인 시 클라가 보낸 금액과 대조해 다르면 거부한다. (토스 공식 권장 흐름)
//
// 키:
//   - 클라이언트 키(test_gck_…) = 프론트에 노출되는 공개 키 → src/services/tossPayments.js
//   - 시크릿 키(test_gsk_…)     = 서버 전용 → Secret Manager:
//                                 firebase functions:secrets:set TOSS_SECRET_KEY
//   ⚠️ 클라이언트 키와 짝이 맞는 시크릿 키여야 한다(위젯키 gck ↔ gsk).
//
// 결제 단위(분담결제):
//   - 매칭 제휴구장(source="match") → 팀당 1건. side "A"=제안팀, "B"=상대팀. 금액=shareA/shareB.
//     한 팀만 결제하면 예약은 pending + 2시간 마감, 양 팀 완료 시 confirmed.
//   - 단독예약 → side "SINGLE", 금액=price 전액, 결제 즉시 confirmed.
//   side 는 클라가 아니라 호출자 uid ↔ 예약의 팀장 uid 대조로 서버가 판정한다.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getAdmin, getDb } = require("../firebaseAdmin");

const TOSS_SECRET_KEY = defineSecret("TOSS_SECRET_KEY");
const REGION = "asia-northeast3";
const API_BASE = "https://api.tosspayments.com/v1/payments";

// 한 팀이 먼저 결제한 뒤 상대 팀이 결제해야 하는 제한시간.
// src/services/ownerVenueService.js 의 PARTNER_PAY_WINDOW_MS 와 같은 값을 유지할 것.
const PARTNER_PAY_WINDOW_MS = 2 * 60 * 60 * 1000;

// 플랫폼 이용료율 — 총액 표시(구장 부담) 모델. 구장 등록가가 곧 결제액이고,
// 그 결제액에서 요율만큼 떼고 나머지를 구장주에게 정산한다.
// ⚠️ src/constants/payments.js 의 PLATFORM_FEE_RATE 와 같은 값을 유지할 것.
// PG 수수료는 이 안에서 회사가 흡수한다(별도 항목으로 전가 금지 — 여전법 제19조).
const PLATFORM_FEE_RATE = 0.05;

const s = (v) => String(v ?? "").trim();
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** 토스 API 인증 헤더 — 시크릿키 뒤에 콜론(:)을 붙여 base64. */
function authHeader() {
  const key = TOSS_SECRET_KEY.value();
  if (!key) throw new Error("TOSS_SECRET_KEY 미설정");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function tossFetch(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(s(json.message) || `토스 API 실패(HTTP ${res.status})`);
    err.tossCode = s(json.code);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Authorization: Bearer <idToken> → uid. 실패 시 "" */
async function callerUid(req) {
  const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return "";
  try {
    return (await getAdmin().auth().verifyIdToken(m[1])).uid;
  } catch {
    return "";
  }
}

/**
 * 예약 문서 + 호출자 → 이 사람이 결제해야 할 몫.
 *
 * amount      = 실제 결제액 = 예약 문서에 적힌 금액 그대로(구장 등록가 = 표시가 = 결제액)
 * platformFee = 플랫폼 이용료 = 결제액 × 요율 (결제액에서 뗀다)
 * venueAmount = 구장 몫(정산 대상) = amount - platformFee
 *
 * ⚠️ 2026-08-02 전환 전에는 amount = venueAmount + fee 였다(사용자에게 가산).
 *    지금은 반대로 amount 가 기준이고 fee 를 빼서 venueAmount 를 만든다.
 *    반올림도 fee 쪽에서만 하고 venueAmount 는 뺄셈으로 구한다 — 그래야
 *    venueAmount + platformFee 가 결제액과 1원도 안 어긋난다(정산 검증이 이 항등식을 쓴다).
 *
 * 요율은 예약 문서에 고정된 값(feeRate)을 우선 쓴다 — 예약 시점에 본 금액과
 * 결제 시점 금액이 달라지지 않게 하기 위함. 없으면(구버전 예약) 현재 요율.
 *
 * @returns {{side:"A"|"B"|"SINGLE", venueAmount:number, platformFee:number, amount:number, feeRate:number}}
 *          결제 자격이 없으면 null
 */
function resolveShare(data, uid) {
  const rate = Number.isFinite(Number(data.feeRate)) ? Number(data.feeRate) : PLATFORM_FEE_RATE;

  const withFee = (side, payAmount) => {
    const total = n(payAmount);
    const fee = total > 0 ? Math.round(total * rate) : 0;
    return { side, venueAmount: total - fee, platformFee: fee, amount: total, feeRate: rate };
  };

  if (s(data.source) === "match") {
    if (s(data.teamALeaderUid) === uid) return withFee("A", data.shareA);
    if (s(data.teamBLeaderUid) === uid) return withFee("B", data.shareB);
    return null;
  }
  if (s(data.userId) === uid) return withFee("SINGLE", data.price);
  return null;
}

/** 해당 몫이 이미 결제됐는지 */
function alreadyPaid(data, side) {
  if (side === "A") return data.paidByA === true;
  if (side === "B") return data.paidByB === true;
  return data.paid === true;
}

// 결제를 받을 수 없는 예약 상태 (종료·반려된 건)
const DEAD_STATUSES = ["cancelled", "rejected", "noshow", "done"];

/* ============================================================
 * 1) 주문 생성 — 결제창을 띄우기 전에 서버가 금액을 확정해 둔다.
 *    POST { reservationId } → { orderId, amount, orderName, side }
 * ========================================================== */
exports.createTossOrder = onRequest(
  { region: REGION, cors: true, secrets: [TOSS_SECRET_KEY] },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });

    const uid = await callerUid(req);
    if (!uid) return void res.status(401).json({ error: "unauthenticated" });

    const reservationId = s(req.body?.reservationId);
    if (!reservationId) return void res.status(400).json({ error: "invalid_params" });

    const db = getDb();
    const resRef = db.collection("venueReservations").doc(reservationId);
    const snap = await resRef.get();
    if (!snap.exists) return void res.status(404).json({ error: "reservation_not_found" });

    const data = snap.data() || {};
    if (DEAD_STATUSES.includes(s(data.status))) {
      return void res.status(409).json({ error: "reservation_closed", status: s(data.status) });
    }

    const share = resolveShare(data, uid);
    if (!share) return void res.status(403).json({ error: "not_a_payer" });
    if (share.amount <= 0) return void res.status(400).json({ error: "invalid_amount" });
    if (alreadyPaid(data, share.side)) {
      return void res.status(409).json({ error: "already_paid", side: share.side });
    }

    // 상대 팀이 먼저 결제해 마감이 걸린 뒤라면 결제를 받지 않는다(만료 예약에 돈이 들어오는 것 방지).
    const deadline = s(data.paymentDeadline);
    if (deadline && Date.now() > new Date(deadline).getTime()) {
      return void res.status(409).json({ error: "payment_expired", deadline });
    }

    const orderId = `hm-${reservationId}-${share.side}-${Date.now().toString(36)}`;
    const orderName = `${s(data.venueName) || "구장"} ${s(data.date)} ${s(data.startTime)}`.slice(0, 100);

    await db.collection("paymentOrders").doc(orderId).set({
      orderId,
      reservationId,
      side: share.side,
      uid,
      amount: share.amount,           // 실제 결제액(= 구장몫 + 이용료)
      venueAmount: share.venueAmount, // 구장 정산 대상 — 수수료 0%, 전액 지급
      platformFee: share.platformFee, // 플랫폼 이용료(사용자 부담)
      feeRate: share.feeRate,
      orderName,
      status: "created",
      matchId: s(data.matchId),
      venueId: s(data.venueId),
      venueName: s(data.venueName),
      ownerUid: s(data.ownerUid),
      // 정산 지급은 "경기 종료 후"가 원칙이라(지급 후 환불이 나면 회수가 어렵다)
      // 결제 시각이 아니라 이용일 기준으로 정산 주기를 끊는다.
      reservationDate: s(data.date),
      createdAt: new Date().toISOString(),
    });

    res.json({
      orderId,
      amount: share.amount,
      venueAmount: share.venueAmount,
      platformFee: share.platformFee,
      feeRate: share.feeRate,
      orderName,
      side: share.side,
    });
  }
);

/* ============================================================
 * 2) 결제 승인 — 결제창 성공 리다이렉트 후 호출.
 *    POST { paymentKey, orderId, amount } → { ok, reservationStatus }
 *    승인이 나야 실제로 돈이 빠진다. 승인 전까지는 임시 상태.
 * ========================================================== */
exports.confirmTossPayment = onRequest(
  { region: REGION, cors: true, secrets: [TOSS_SECRET_KEY] },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });

    const uid = await callerUid(req);
    if (!uid) return void res.status(401).json({ error: "unauthenticated" });

    // 🧪 테스트 결제 건너뛰기 — 결제창을 거치지 않고 "승인 이후" 흐름(예약 확정·원장·정산)을
    //    확인하기 위한 경로. 토스 승인 호출만 건너뛰고 그 뒤 처리는 실결제와 같은 코드를 탄다.
    //    게이트: 시크릿 키가 test_ 로 시작할 때만 — 라이브 키로 바꾸는 순간 자동으로 막힌다.
    const testSkip = req.body?.testSkip === true;
    if (testSkip && !s(TOSS_SECRET_KEY.value()).startsWith("test_")) {
      return void res.status(403).json({ error: "test_skip_not_allowed" });
    }

    const orderId = s(req.body?.orderId);
    const amount = n(req.body?.amount);
    // 건너뛰기는 결제창을 안 거쳐 paymentKey 가 없다 → 주문에 1:1 로 묶이는 키를 서버가 만든다.
    // TESTSKIP_ 접두사는 환불(cancelTossPayment)이 토스 호출을 건너뛸 대상임을 알아보는 표시이기도 하다.
    const paymentKey = testSkip ? `TESTSKIP_${orderId}` : s(req.body?.paymentKey);
    if (!paymentKey || !orderId || amount <= 0) {
      return void res.status(400).json({ error: "invalid_params" });
    }

    const db = getDb();
    const orderRef = db.collection("paymentOrders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return void res.status(404).json({ error: "order_not_found" });

    const order = orderSnap.data() || {};
    if (s(order.uid) !== uid) return void res.status(403).json({ error: "not_order_owner" });
    // 이미 승인된 주문 — 새로고침/중복 호출이므로 성공으로 되돌린다(중복 승인 방지).
    if (s(order.status) === "paid") return void res.json({ ok: true, duplicated: true });
    if (s(order.status) !== "created") {
      return void res.status(409).json({ error: "order_not_payable", status: s(order.status) });
    }
    // 💰 금액 위변조 차단 — 서버가 저장해 둔 금액과 다르면 승인하지 않는다.
    if (n(order.amount) !== amount) {
      return void res.status(400).json({ error: "amount_mismatch", expected: n(order.amount) });
    }

    let payment;
    if (testSkip) {
      // 승인 응답 자리만 채운다. method 로 원장에서 실결제와 구분된다.
      payment = { method: "테스트건너뛰기", approvedAt: new Date().toISOString() };
    } else {
      try {
        payment = await tossFetch(`${API_BASE}/confirm`, { paymentKey, orderId, amount });
      } catch (e) {
        await orderRef.update({
          status: "failed",
          failReason: s(e.message),
          failCode: s(e.tossCode),
          failedAt: new Date().toISOString(),
        });
        return void res.status(400).json({ error: "confirm_failed", code: s(e.tossCode), message: s(e.message) });
      }
    }

    const reservationId = s(order.reservationId);
    const side = s(order.side);
    const resRef = db.collection("venueReservations").doc(reservationId);

    // 예약 반영은 트랜잭션 — 양 팀이 동시에 승인해도 상태가 엇갈리지 않게.
    const result = await db.runTransaction(async (tx) => {
      const cur = await tx.get(resRef);
      if (!cur.exists) throw new Error("reservation_not_found");
      const d = cur.data() || {};

      const patch = { updatedAt: new Date().toISOString() };
      if (side === "SINGLE") {
        patch.paid = true;
        patch.paymentMethod = "toss";
        patch.status = "confirmed";
        patch.paymentKey = paymentKey;
      } else {
        const paidA = side === "A" ? true : d.paidByA === true;
        const paidB = side === "B" ? true : d.paidByB === true;
        patch.paidByA = paidA;
        patch.paidByB = paidB;
        patch.paymentMethod = "toss";
        patch[side === "A" ? "teamAPayerUid" : "teamBPayerUid"] = uid;
        patch[side === "A" ? "paymentKeyA" : "paymentKeyB"] = paymentKey;

        if (paidA && paidB) {
          patch.status = "confirmed";
          patch.paid = true;
          patch.paymentDeadline = "";
        } else {
          patch.status = "pending";
          // 먼저 낸 팀 기준으로 상대 팀 결제 마감을 건다.
          patch.paymentDeadline = new Date(Date.now() + PARTNER_PAY_WINDOW_MS).toISOString();
        }
      }
      tx.update(resRef, patch);
      return { reservationStatus: patch.status, paidByA: patch.paidByA, paidByB: patch.paidByB };
    });

    await orderRef.update({
      status: "paid",
      paymentKey,
      method: s(payment.method),
      approvedAt: s(payment.approvedAt),
      receiptUrl: s(payment.receipt?.url),
    });

    // 정산·환불이 결제건을 역추적할 수 있게 결제 원장을 따로 남긴다.
    // ⚠️ 구장주 매출·정산 화면(ownerSettlementService)이 이 컬렉션을 단일 진실로 쓴다.
    //    amount(사용자가 낸 돈) 와 venueAmount(구장에 줄 돈)를 반드시 분리해 둘 것 —
    //    합쳐두면 정산액에 플랫폼 이용료가 섞여 과지급된다.
    await db.collection("payments").doc(paymentKey).set({
      paymentKey,
      orderId,
      reservationId,
      side,
      uid,
      amount,
      venueAmount: n(order.venueAmount),
      platformFee: n(order.platformFee),
      feeRate: n(order.feeRate),
      // 정산 대상 금액. 환불이 나면 cancelTossPayment 가 깎아서 다시 쓴다.
      // 정산 집계는 venueAmount 가 아니라 항상 이 필드를 더한다.
      netVenueAmount: n(order.venueAmount),
      status: "DONE",
      method: s(payment.method),
      approvedAt: s(payment.approvedAt),
      receiptUrl: s(payment.receipt?.url),
      venueId: s(order.venueId),
      venueName: s(order.venueName),
      ownerUid: s(order.ownerUid),
      matchId: s(order.matchId),
      reservationDate: s(order.reservationDate),
      cancelled: false,
      // 정산 지급 상태 — payouts 문서가 생기면 payoutId 가 채워진다.
      payoutId: "",
    });

    // reservationId/matchId 는 결제 완료 화면이 돌아갈 곳을 정하는 데 쓴다.
    res.json({ ok: true, reservationId, matchId: s(order.matchId), amount, ...result });
  }
);

/**
 * 결제 취소(환불). 예약 취소·마감 만료 처리에서 호출한다.
 * @param {string} paymentKey
 * @param {string} reason  - 취소 사유(토스 관리자에 그대로 노출)
 * @param {number} [amount] - 부분취소 금액. 생략하면 전액취소.
 */
async function cancelTossPayment(paymentKey, reason, amount) {
  const key = s(paymentKey);
  if (!key) throw new Error("paymentKey 없음");

  const body = { cancelReason: s(reason) || "예약 취소" };
  if (n(amount) > 0) body.cancelAmount = n(amount);

  // 테스트 건너뛰기로 만든 결제는 토스에 실제 승인 건이 없다 → 취소 API 를 부르면 실패한다.
  // 원장 정리(환불액·정산액 차감)는 실결제와 똑같이 진행해야 취소 이후 흐름을 확인할 수 있다.
  const json = key.startsWith("TESTSKIP_")
    ? { status: "CANCELED" }
    : await tossFetch(`${API_BASE}/${encodeURIComponent(key)}/cancel`, body);

  const db = getDb();
  const ref = db.collection("payments").doc(key);

  // 환불은 총 결제금액 기준 비율로 나간다(환불정책 제5조). 그러면 구장 몫과 플랫폼 이용료가
  // 같은 비율로 줄어든다. 정산이 쓸 "환불 후 구장 몫"을 여기서 확정해 둔다 —
  // 화면에서 정책을 다시 계산하면 정책이 바뀔 때 과거 건까지 소급돼 장부가 어긋난다.
  const prev = (await ref.get()).data() || {};
  const paidTotal = n(prev.amount);
  const venueAmount = n(prev.venueAmount);
  const refunded = n(amount) > 0 ? n(amount) : paidTotal; // 부분취소 아니면 전액
  const refundedVenue =
    paidTotal > 0 ? Math.min(venueAmount, Math.round((venueAmount * refunded) / paidTotal)) : venueAmount;

  const log = {
    cancelled: true,
    cancelledAt: new Date().toISOString(),
    cancelReason: s(reason),
    status: s(json.status),
    refundedAmount: refunded,
    refundedVenueAmount: refundedVenue,
    // 정산 대상 금액 = 환불하고 남은 구장 몫. 전액취소면 0.
    netVenueAmount: Math.max(0, venueAmount - refundedVenue),
  };
  if (n(amount) > 0) log.cancelAmount = n(amount); // 부분취소일 때만 기록(undefined 저장 불가)
  await ref.set(log, { merge: true });
  return json;
}

module.exports.cancelTossPayment = cancelTossPayment;
module.exports.TOSS_SECRET_KEY = TOSS_SECRET_KEY;
module.exports.PARTNER_PAY_WINDOW_MS = PARTNER_PAY_WINDOW_MS;
