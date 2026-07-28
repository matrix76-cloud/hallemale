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
 * @returns {{side:"A"|"B"|"SINGLE", amount:number}} 결제 자격이 없으면 null
 */
function resolveShare(data, uid) {
  if (s(data.source) === "match") {
    if (s(data.teamALeaderUid) === uid) return { side: "A", amount: n(data.shareA) };
    if (s(data.teamBLeaderUid) === uid) return { side: "B", amount: n(data.shareB) };
    return null;
  }
  if (s(data.userId) === uid) return { side: "SINGLE", amount: n(data.price) };
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
      amount: share.amount,
      orderName,
      status: "created",
      matchId: s(data.matchId),
      venueId: s(data.venueId),
      ownerUid: s(data.ownerUid),
      createdAt: new Date().toISOString(),
    });

    res.json({ orderId, amount: share.amount, orderName, side: share.side });
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

    const paymentKey = s(req.body?.paymentKey);
    const orderId = s(req.body?.orderId);
    const amount = n(req.body?.amount);
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
    await db.collection("payments").doc(paymentKey).set({
      paymentKey,
      orderId,
      reservationId,
      side,
      uid,
      amount,
      status: "DONE",
      method: s(payment.method),
      approvedAt: s(payment.approvedAt),
      receiptUrl: s(payment.receipt?.url),
      venueId: s(order.venueId),
      ownerUid: s(order.ownerUid),
      matchId: s(order.matchId),
      cancelled: false,
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

  const json = await tossFetch(`${API_BASE}/${encodeURIComponent(key)}/cancel`, body);

  const db = getDb();
  const log = {
    cancelled: true,
    cancelledAt: new Date().toISOString(),
    cancelReason: s(reason),
    status: s(json.status),
  };
  if (n(amount) > 0) log.cancelAmount = n(amount); // 부분취소일 때만 기록(undefined 저장 불가)
  await db.collection("payments").doc(key).set(log, { merge: true });
  return json;
}

module.exports.cancelTossPayment = cancelTossPayment;
module.exports.TOSS_SECRET_KEY = TOSS_SECRET_KEY;
module.exports.PARTNER_PAY_WINDOW_MS = PARTNER_PAY_WINDOW_MS;
