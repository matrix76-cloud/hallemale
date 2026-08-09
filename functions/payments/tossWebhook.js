/* eslint-disable */
// functions/payments/tossWebhook.js
// 토스페이먼츠 결제 웹훅 수신 — 결제 상태가 바뀌었을 때 서버가 뒤늦게라도 따라잡는 경로.
//
// 왜 필요한가:
//   1) 가상계좌는 승인 시점에 돈이 안 들어온다(WAITING_FOR_DEPOSIT). 입금은 나중에 일어나고
//      그 사실은 DEPOSIT_CALLBACK 웹훅으로만 온다 → 예약 확정을 여기서 마무리한다.
//   2) 승인 직후 예약 반영이 실패한 건(payments.reservationSyncFailed)을 다시 시도한다.
//   3) 토스 관리자에서 직접 취소한 건처럼 우리 코드를 안 거친 변경을 원장에 반영한다.
//
// ⚠️ 일반 결제 웹훅에는 서명 헤더가 없다. 그래서 본문을 절대 그대로 믿지 않고,
//    paymentKey 로 조회 API 를 다시 호출해 "진짜 상태"를 확인한 뒤에만 반영한다.
//    (서명 검증이 있는 건 지급대행/셀러 웹훅이고, 우리는 아직 안 쓴다.)
//
// 등록: 토스 개발자센터 > 웹훅에 아래 URL 을 등록해야 발송이 시작된다.
//   https://asia-northeast3-halle-bf789.cloudfunctions.net/tossWebhook
const { onRequest } = require("firebase-functions/v2/https");
const { getDb } = require("../firebaseAdmin");
const { TOSS_SECRET_KEY, tossGetPayment, applyPaidToReservation } = require("./toss");

const REGION = "asia-northeast3";
const s = (v) => String(v ?? "").trim();

exports.tossWebhook = onRequest(
  { region: REGION, cors: false, secrets: [TOSS_SECRET_KEY] },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).send("method_not_allowed");

    const body = req.body || {};
    const data = body.data || body; // DEPOSIT_CALLBACK 은 data 로 감싸지 않고 평평하게 온다
    const eventType = s(body.eventType);
    const orderId = s(data.orderId);
    let paymentKey = s(data.paymentKey);

    const db = getDb();

    // DEPOSIT_CALLBACK 에는 paymentKey 가 없다 → 우리 주문에서 되찾는다.
    if (!paymentKey && orderId) {
      const o = await db.collection("paymentOrders").doc(orderId).get();
      paymentKey = s(o.data()?.paymentKey);
    }
    if (!paymentKey) {
      // 우리가 만든 주문이 아니거나 아직 승인 전 — 재시도해도 소용없으니 그냥 받는다.
      console.warn("[tossWebhook] paymentKey 없음:", eventType, orderId);
      return void res.status(200).send("ignored");
    }

    // 🔒 본문 대신 조회 API 가 단일 진실. 실패하면 200 을 주지 않아 토스가 재전송하게 둔다.
    let payment;
    try {
      payment = await tossGetPayment(paymentKey);
    } catch (e) {
      console.error("[tossWebhook] 조회 실패:", paymentKey, e?.message || e);
      return void res.status(503).send("verify_failed");
    }

    const status = s(payment.status);
    const ledgerRef = db.collection("payments").doc(paymentKey);
    const ledger = (await ledgerRef.get()).data();

    // 원장보다 웹훅이 먼저 도착한 경우 — 승인 처리가 끝나면 반영되므로 재전송을 유도한다.
    if (!ledger) {
      console.warn("[tossWebhook] 원장 없음(승인 처리 전):", paymentKey, status);
      return void res.status(503).send("ledger_not_ready");
    }

    await ledgerRef.set({ status, webhookAt: new Date().toISOString() }, { merge: true });

    // 입금 완료(가상계좌) 또는 승인 직후 예약 반영에 실패했던 건 → 지금 예약을 확정한다.
    const needsApply = status === "DONE" && (s(ledger.status) !== "DONE" || ledger.reservationSyncFailed === true);
    if (needsApply) {
      try {
        const r = await applyPaidToReservation(db, {
          reservationId: s(ledger.reservationId),
          side: s(ledger.side),
          uid: s(ledger.uid),
          paymentKey,
        });
        await ledgerRef.set(
          { reservationSyncFailed: false, reservationSyncError: "", reservationStatus: s(r.reservationStatus) },
          { merge: true }
        );
      } catch (e) {
        // 실패를 삼키면 영영 안 맞는다. 200 을 주지 않아 토스가 다시 보내게 한다.
        console.error("[tossWebhook] 예약 반영 실패:", paymentKey, e?.message || e);
        await ledgerRef.set({ reservationSyncFailed: true, reservationSyncError: s(e?.message) }, { merge: true });
        return void res.status(503).send("apply_failed");
      }
    }

    res.status(200).send("ok");
  }
);
