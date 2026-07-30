/* eslint-disable */
// functions/jobs/venuePaymentJobs.js
// 앱내 결제(토스) 예약의 뒤처리 — 결제 완료 확정 동기화 + 결제 마감 만료 취소.
//
// 왜 서버인가: 결제 승인은 서버에서 일어나므로, 그 결과로 매칭이 확정되고 알림이 나가는 것도
//   서버에서 끝나야 한다. (클라가 확정을 찍으면 결제 없이 확정하는 우회로가 생긴다)
//
// 1) venuePaidConfirmTrigger — venueReservations status → confirmed (결제건만)
//      · 매칭 예약: match_requests 확정 + 양 팀장 알림
//      · 앱 예약  : 예약자에게 결제/확정 알림
//    현장정산(paymentMethod!="toss") 건은 기존 클라 로직이 처리하므로 건드리지 않는다.
//
// 2) venuePaymentExpireTick — pending 예약의 paymentDeadline 초과분 정리(10분마다)
//      · 먼저 낸 팀 결제를 토스에서 취소(환불) → 예약 cancelled → 매칭은 재제안 가능 상태로
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");
const { cancelTossPayment, TOSS_SECRET_KEY } = require("../payments/toss");

const REGION = "asia-northeast3";
const s = (v) => String(v ?? "").trim();

/**
 * 슬롯 락 반납 — venueSlotLocks/{venueId}__{courtId}__{date}.ranges 에서 이 예약 자리를 뺀다.
 *
 * 클라이언트도 자기가 취소할 때 직접 반납하지만, 서버가 끝내는 취소(미결제 자동취소·어드민 조작)는
 * 클라를 거치지 않는다. 여기서 한 번 더 잡아야 그 시간대가 영구히 예약 불가로 남지 않는다.
 * 필드 단위 삭제라 중복 실행돼도 안전하다.
 */
async function releaseSlotLock(db, data, reservationId) {
  const venueId = s(data?.venueId), courtId = s(data?.courtId), date = s(data?.date);
  const rid = s(reservationId);
  if (!venueId || !courtId || !date || !rid) return;
  const FieldValue = getAdmin().firestore.FieldValue;
  try {
    await db.collection("venueSlotLocks").doc(`${venueId}__${courtId}__${date}`).update({
      [`ranges.${rid}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // 락 문서가 없으면(레거시 예약) 비울 것도 없다.
  }
}

// 이용자 귀책 취소 시 환불율.
// ⚠️ src/constants/cancelPolicy.js 의 CANCEL_POLICY_TIERS 와 같은 값을 유지할 것.
//    [0]=2일 전까지 100% / [1]=1일 전 50% / [2]=당일 0% / [3]=시작 후 0%
const REFUND_TIERS = [1, 0.5, 0, 0];

const kstDay = (ms) => Math.floor((ms + 9 * 3600 * 1000) / 86400000);

/** 지금이 어느 취소 단계인지 (KST 기준). cancelPolicy.cancelStageIndex 와 동일 규칙. */
function cancelStageIndex(date, startTime, nowMs) {
  const startMs = Date.parse(`${s(date)}T${s(startTime) || "00:00"}:00+09:00`);
  if (!Number.isFinite(startMs)) return 0;
  if (nowMs >= startMs) return 3;
  const days = kstDay(startMs) - kstDay(nowMs);
  if (days <= 0) return 2;
  if (days === 1) return 1;
  return 0;
}

/**
 * 이 결제건의 환불율.
 * 구장 사정 취소·반려·미결제 자동취소는 이용자 잘못이 아니므로 전액 환불한다.
 * 매칭에서 한 팀이 취소하면 그 팀만 위약금을 물고, 상대 팀은 귀책이 없어 전액 환불.
 */
function refundRateFor(data, payment, nowMs) {
  const by = s(data.canceledBy);
  if (by !== "user" && by !== "team") return 1;

  if (by === "team") {
    const cancelClub = s(data.cancelledByClubId);
    const sideClub = s(payment.side) === "A" ? s(data.teamAClubId) : s(data.teamBClubId);
    if (cancelClub && sideClub && cancelClub !== sideClub) return 1; // 상대 팀(무귀책)
  }
  return REFUND_TIERS[cancelStageIndex(data.date, data.startTime, nowMs)];
}

/** notifications 문서 1건 생성 (클라 addDoc 형식과 동일하게 맞춤) */
async function notify(db, { targetIds, subType, title, body, deepLink, linkTargetId, audience = "user", linkType = "venue", type = "venue_reservation", kind = "venue", prefsCategory = "venue" }) {
  const ids = (targetIds || []).map(s).filter(Boolean);
  if (!ids.length) return;
  const FieldValue = getAdmin().firestore.FieldValue;
  await db.collection("notifications").add({
    kind,
    subType,
    type,
    title,
    body,
    targetType: "USER",
    targetIds: ids,
    linkType,
    linkTargetId: s(linkTargetId),
    meta: { deepLink: s(deepLink) },
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    audience,
    prefsCategory,
    readBy: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/* ============================================================
 * 1) 결제 완료 → 확정 동기화
 * ========================================================== */
exports.venuePaidConfirmTrigger = onDocumentUpdated(
  { document: "venueReservations/{id}", region: REGION, secrets: [TOSS_SECRET_KEY] },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};

    // 취소·반려로 끝난 예약 → 결제분 환불. 취소가 어느 경로(구장주·예약자·어드민)로
    // 일어나든 여기 한 곳에서 잡는다. 환불율은 취소 시점·귀책에 따라 refundRateFor 가 정한다.
    // 종료 상태로 넘어갔으면 슬롯을 비운다 — 경로(구장주·예약자·서버·어드민)와 무관하게 여기서 보장.
    const TERMINAL = ["cancelled", "rejected", "noshow"];
    if (!TERMINAL.includes(s(before.status)) && TERMINAL.includes(s(after.status))) {
      await releaseSlotLock(getDb(), after, event.params.id);
    }

    const ENDED = ["cancelled", "rejected"];
    if (!ENDED.includes(s(before.status)) && ENDED.includes(s(after.status))) {
      const db = getDb();
      const nowMs = Date.now();
      const payments = await db
        .collection("payments")
        .where("reservationId", "==", event.params.id)
        .where("cancelled", "==", false)
        .get();

      for (const p of payments.docs) {
        const pay = p.data() || {};
        const rate = refundRateFor(after, pay, nowMs);
        // 원 단위 내림 — 부분환불에서 1원도 더 나가지 않게.
        const amount = Math.floor((Number(pay.amount) || 0) * rate);
        if (amount <= 0) {
          // 이용 시작 후 취소 등 환불액 0 — 취소 API를 부를 수 없으므로 사유만 남긴다.
          await p.ref.set({ refundSkipped: "no_refundable_amount", refundRate: rate }, { merge: true });
          continue;
        }
        try {
          // 전액이면 cancelAmount 를 넘기지 않는다(토스 전액취소).
          await cancelTossPayment(p.id, s(after.cancelReason) || "예약 취소", rate < 1 ? amount : 0);
          await p.ref.set({ refundRate: rate }, { merge: true });
        } catch (e) {
          console.error(`[venuePaidConfirm] refund failed (payment ${p.id}):`, e?.message || e);
        }
      }
      return;
    }

    if (s(before.status) === "confirmed" || s(after.status) !== "confirmed") return;
    // 현장정산 건은 기존(클라) 흐름이 알림·매칭 동기화를 이미 하므로 중복 방지를 위해 제외.
    if (s(after.paymentMethod) !== "toss") return;

    const db = getDb();
    const FieldValue = getAdmin().firestore.FieldValue;
    const reservationId = event.params.id;
    const when = `${s(after.date)} ${s(after.startTime)}~${s(after.endTime)}`;
    const where = `${s(after.venueName)}${s(after.courtName) ? ` · ${s(after.courtName)}` : ""}`;
    const matchId = s(after.matchId);

    if (matchId) {
      await db.collection("match_requests").doc(matchId).update({
        status: "confirmed",
        "partnerBooking.approvalState": "approved",
        "partnerBooking.finalized": true,
        "partnerBooking.payState": "paid",
        "partnerBooking.reservationCode": s(after.reservationCode),
        "partnerBooking.ownerNote": s(after.ownerNote),
        "partnerBooking.venuePhone": s(after.venuePhone),
        confirmedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await notify(db, {
        targetIds: [after.teamALeaderUid, after.teamBLeaderUid],
        subType: "venueReservationPaid",
        title: "결제 완료 🎉 경기 확정!",
        body: `${when} · ${where} 결제가 끝나 경기가 확정됐어요!`,
        deepLink: `/match-roomdetail/${matchId}`,
        linkTargetId: matchId,
        linkType: "match",
        type: "venue_reservation_approved",
        kind: "match",
        prefsCategory: "match",
      });
      return;
    }

    await notify(db, {
      targetIds: [after.userId],
      subType: "venueReservationPaid",
      title: "결제가 완료돼 예약이 확정됐어요 🎉",
      body: `${when} · ${where} 예약이 확정됐어요.${s(after.ownerNote) ? `\n구장 안내: ${s(after.ownerNote)}` : ""}`,
      deepLink: "/my/reservations",
      linkTargetId: s(after.venueId),
    });
  }
);

/* ============================================================
 * 2) 결제 마감 만료 → 환불 + 취소
 * ========================================================== */
exports.venuePaymentExpireTick = onSchedule(
  { schedule: "*/10 * * * *", region: REGION, secrets: [TOSS_SECRET_KEY] },
  async () => {
    const db = getDb();
    const FieldValue = getAdmin().firestore.FieldValue;
    const nowISO = new Date().toISOString();

    const snap = await db
      .collection("venueReservations")
      .where("status", "==", "pending")
      .where("paymentDeadline", "<", nowISO)
      .limit(100)
      .get();
    if (snap.empty) return;

    for (const d of snap.docs) {
      const data = d.data() || {};
      try {
        // 먼저 낸 쪽 결제를 환불. (양쪽 다 냈으면 confirmed 라 여기 오지 않는다)
        const payments = await db
          .collection("payments")
          .where("reservationId", "==", d.id)
          .where("cancelled", "==", false)
          .get();
        for (const p of payments.docs) {
          try {
            await cancelTossPayment(p.id, "상대 팀 미결제로 예약 자동 취소");
          } catch (e) {
            console.error(`[venuePaymentExpire] refund failed (payment ${p.id}):`, e?.message || e);
          }
        }

        await d.ref.update({
          status: "cancelled",
          cancelReason: "payment_timeout",
          updatedAt: FieldValue.serverTimestamp(),
        });

        const matchId = s(data.matchId);
        if (matchId) {
          // 매칭은 조율중으로 되돌려 다른 구장·시간을 다시 제안할 수 있게 한다.
          await db.collection("match_requests").doc(matchId).update({
            status: "accepted",
            "partnerBooking.payState": "expired",
            updatedAt: FieldValue.serverTimestamp(),
          });
          await notify(db, {
            targetIds: [data.teamALeaderUid, data.teamBLeaderUid],
            subType: "venueReservationPaymentExpired",
            title: "결제 시간이 지나 예약이 취소됐어요",
            body: `${s(data.date)} ${s(data.startTime)}~${s(data.endTime)} 예약이 미결제로 취소됐어요. 결제하신 금액은 환불됩니다.`,
            deepLink: `/match-roomdetail/${matchId}`,
            linkTargetId: matchId,
            linkType: "match",
            type: "venue_reservation_cancelled",
            kind: "match",
            prefsCategory: "match",
          });
        } else {
          await notify(db, {
            targetIds: [data.userId],
            subType: "venueReservationPaymentExpired",
            title: "결제 시간이 지나 예약이 취소됐어요",
            body: `${s(data.date)} ${s(data.startTime)}~${s(data.endTime)} 예약이 미결제로 취소됐어요.`,
            deepLink: "/my/reservations",
            linkTargetId: s(data.venueId),
          });
        }
      } catch (e) {
        console.error(`[venuePaymentExpire] failed (reservation ${d.id}):`, e?.message || e);
      }
    }
  }
);
