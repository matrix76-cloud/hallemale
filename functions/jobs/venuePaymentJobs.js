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
const { refundDecision } = require("../payments/refundPolicy");
// 알림톡은 환불을 실행한 이 자리에서 보낸다 — 별도 트리거로 빼면 환불 완료 전에 읽어
// 금액이 어긋난다. LUNA_API_KEY 는 아래 두 함수의 secrets 에 함께 실려야 한다.
const {
  sendReservationConfirmed,
  sendReservationCanceled,
  sendPaymentReminder,
  LUNA_API_KEY,
} = require("./venueAlimtalk");

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

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/**
 * ISO 문자열 → "8/2(토) 21:30" (KST). 결제 마감 시각을 알림 문장에 그대로 넣는다.
 * 9시간 밀어 놓고 UTC 게터로 읽는다 — 함수 실행 환경의 타임존에 안 흔들리게.
 */
function kstStamp(iso) {
  const t = Date.parse(s(iso));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WD[d.getUTCDay()]}) ${hh}:${mm}`;
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
  { document: "venueReservations/{id}", region: REGION, secrets: [TOSS_SECRET_KEY, LUNA_API_KEY] },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};

    // 취소·반려로 끝난 예약 → 결제분 환불. 취소가 어느 경로(구장주·예약자·어드민)로
    // 일어나든 여기 한 곳에서 잡는다. 환불율은 취소 시점·귀책에 따라 refundPolicy.refundDecision 이 정한다.
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

      // 알림톡에 실을 "실제로 환불한 금액" — 환불을 돌린 이 자리에서 모은다.
      const refunds = [];
      for (const p of payments.docs) {
        const pay = p.data() || {};
        const { rate, basis } = refundDecision(after, pay, nowMs);
        // 원 단위 내림 — 부분환불에서 1원도 더 나가지 않게.
        const amount = Math.floor((Number(pay.amount) || 0) * rate);
        if (amount <= 0) {
          // 이용 시작 후 취소 등 환불액 0 — 취소 API를 부를 수 없으므로 사유만 남긴다.
          // 통지는 해야 한다: "왜 0원인지"를 안 알리면 그대로 CS·분쟁이 된다.
          await p.ref.set({ refundSkipped: "no_refundable_amount", refundRate: rate }, { merge: true });
          refunds.push({ side: s(pay.side), paid: Number(pay.amount) || 0, refund: 0, basis });
          continue;
        }
        try {
          // 전액이면 cancelAmount 를 넘기지 않는다(토스 전액취소).
          await cancelTossPayment(p.id, s(after.cancelReason) || "예약 취소", rate < 1 ? amount : 0);
          await p.ref.set({ refundRate: rate }, { merge: true });
          refunds.push({ side: s(pay.side), paid: Number(pay.amount) || 0, refund: amount, basis });
        } catch (e) {
          console.error(`[venuePaidConfirm] refund failed (payment ${p.id}):`, e?.message || e);
        }
      }
      // 알림톡 실패가 환불·취소를 되돌리면 안 된다.
      try {
        await sendReservationCanceled(db, event.params.id, after, refunds);
      } catch (e) {
        console.error(`[venuePaidConfirm] alimtalk failed (resv ${event.params.id}):`, e?.message || e);
      }
      return;
    }

    // ── 분담결제: 한 팀만 낸 상태 ────────────────────────────────
    // 우리 팀이 내도 상대 팀이 안 내면 경기는 확정되지 않고, 마감이 지나면 예약이 통째로
    // 취소되면서 먼저 낸 팀 돈이 환불된다. 그런데 안 낸 팀장에게는 아무 신호도 안 갔다 —
    // 앱을 열어보기 전에는 마감 시계가 돌고 있다는 걸 알 방법이 없었다.
    // 결제가 한 칸 진행됐는데 아직 pending 이면, 안 낸 쪽 팀장에게 바로 알린다.
    const paidAdvanced =
      (before.paidByA !== true && after.paidByA === true) ||
      (before.paidByB !== true && after.paidByB === true);
    if (paidAdvanced && s(after.status) === "pending") {
      const db = getDb();
      const matchId = s(after.matchId);

      // 누가 냈는지를 매칭 문서에도 미러링한다. 매칭 목록·채팅 안내는 예약 문서를 읽지 않고
      // partnerBooking 만 보므로, 여기서 안 옮기면 상대 팀은 "먼저 낸 팀이 있다"는 걸 알 수 없다.
      if (matchId) {
        try {
          await db.collection("match_requests").doc(matchId).update({
            "partnerBooking.paidByA": after.paidByA === true,
            "partnerBooking.paidByB": after.paidByB === true,
            "partnerBooking.payState": "partial", // 한 팀만 냄 (양 팀 완납은 확정 분기에서 "paid")
            updatedAt: getAdmin().firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error(`[venuePaidConfirm] partial-pay mirror failed (match ${matchId}):`, e?.message || e);
        }
      }

      const waitingUid =
        after.paidByA === true && after.paidByB !== true ? s(after.teamBLeaderUid)
        : after.paidByB === true && after.paidByA !== true ? s(after.teamALeaderUid)
        : "";
      if (waitingUid) {
        const until = kstStamp(after.paymentDeadline);
        await notify(db, {
          targetIds: [waitingUid],
          subType: "venueReservationPartnerPaid",
          title: "상대 팀이 결제했어요 · 우리 팀 몫만 남았어요",
          body:
            `${s(after.date)} ${s(after.startTime)}~${s(after.endTime)} · ${s(after.venueName)}\n` +
            `${until ? `${until}까지` : "마감 시각까지"} 결제하면 경기가 확정돼요. ` +
            `지나면 예약이 자동 취소되고 상대 팀 결제분은 환불됩니다.`,
          deepLink: matchId ? `/match-roomdetail/${matchId}` : "/my/reservations",
          linkTargetId: matchId || s(after.venueId),
          linkType: matchId ? "match" : "venue",
          kind: matchId ? "match" : "venue",
          prefsCategory: matchId ? "match" : "venue",
        });
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
        // 확정은 양 팀 완납일 때만 온다 — 부분결제 때 찍힌 한쪽 false 를 여기서 정리한다.
        "partnerBooking.paidByA": true,
        "partnerBooking.paidByB": true,
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
      try {
        await sendReservationConfirmed(db, reservationId, after);
      } catch (e) {
        console.error(`[venuePaidConfirm] alimtalk failed (resv ${reservationId}):`, e?.message || e);
      }
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
    try {
      await sendReservationConfirmed(db, reservationId, after);
    } catch (e) {
      console.error(`[venuePaidConfirm] alimtalk failed (resv ${reservationId}):`, e?.message || e);
    }
  }
);

// 마감 몇 분 전에 리마인더를 보낼지. 10분 틱이라 실제 발송은 마감 20~30분 전 사이에 한 번 걸린다.
const REMIND_BEFORE_MS = 30 * 60 * 1000;

/* ============================================================
 * 2) 결제 마감 만료 → 환불 + 취소  (+ 마감 임박 리마인더)
 * ========================================================== */
exports.venuePaymentExpireTick = onSchedule(
  { schedule: "*/10 * * * *", region: REGION, secrets: [TOSS_SECRET_KEY, LUNA_API_KEY] },
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

    for (const d of snap.docs) {
      const data = d.data() || {};
      try {
        // 먼저 낸 쪽 결제를 환불. (양쪽 다 냈으면 confirmed 라 여기 오지 않는다)
        const payments = await db
          .collection("payments")
          .where("reservationId", "==", d.id)
          .where("cancelled", "==", false)
          .get();
        // 먼저 낸 팀은 귀책이 없다 → 전액 환불. 그 사실을 알림톡으로도 알린다.
        const refunds = [];
        for (const p of payments.docs) {
          const pay = p.data() || {};
          try {
            await cancelTossPayment(p.id, "상대 팀 미결제로 예약 자동 취소");
            refunds.push({
              side: s(pay.side),
              paid: Number(pay.amount) || 0,
              refund: Number(pay.amount) || 0,
              basis: "상대 팀 미결제 · 전액 환불",
            });
          } catch (e) {
            console.error(`[venuePaymentExpire] refund failed (payment ${p.id}):`, e?.message || e);
          }
        }

        await d.ref.update({
          status: "cancelled",
          cancelReason: "payment_timeout",
          updatedAt: FieldValue.serverTimestamp(),
        });

        try {
          await sendReservationCanceled(db, d.id, { ...data, status: "cancelled", cancelReason: "payment_timeout" }, refunds);
        } catch (e) {
          console.error(`[venuePaymentExpire] alimtalk failed (resv ${d.id}):`, e?.message || e);
        }

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

    // ── 마감 임박 리마인더 ────────────────────────────────────
    // 예전엔 "결제해 주세요" 신호가 승인 직후 한 번뿐이었다. 그 알림을 놓친 팀은
    // 마감이 지나서야 "자동 취소됐어요" 로 알게 된다 — 되돌릴 수 없는 시점이다.
    // 마감 30분 전에 아직 안 낸 쪽에게만 한 번 더 보낸다(문서 플래그로 1회 보장).
    const soonISO = new Date(Date.now() + REMIND_BEFORE_MS).toISOString();
    const soon = await db
      .collection("venueReservations")
      .where("status", "==", "pending")
      .where("paymentDeadline", "<", soonISO)
      .limit(100)
      .get();

    for (const d of soon.docs) {
      const data = d.data() || {};
      if (s(data.paymentDeadline) <= nowISO) continue;   // 이미 만료 — 위에서 취소된다
      if (data.paymentReminderSent === true) continue;   // 이미 보냄

      // 안 낸 쪽만. 매칭이면 미결제 팀장(들), 단독 예약이면 예약자.
      // 알림톡은 각자 낼 금액을 본문에 실으므로 uid 와 부담분을 함께 들고 다닌다
      // (매칭은 분담결제라 팀마다 금액이 다르다).
      const matchId = s(data.matchId);
      const recipients = matchId
        ? [
            data.paidByA === true ? null : { uid: s(data.teamALeaderUid), amount: Number(data.shareA) || 0 },
            data.paidByB === true ? null : { uid: s(data.teamBLeaderUid), amount: Number(data.shareB) || 0 },
          ].filter((r) => r && r.uid)
        : [{ uid: s(data.userId), amount: Number(data.price) || 0 }].filter((r) => r.uid);
      const targets = recipients.map((r) => r.uid);
      if (!targets.length) continue;

      try {
        const until = kstStamp(data.paymentDeadline);
        await notify(db, {
          targetIds: targets,
          subType: "venueReservationPaymentReminder",
          title: "결제 마감이 얼마 안 남았어요",
          body:
            `${s(data.date)} ${s(data.startTime)}~${s(data.endTime)} · ${s(data.venueName)}\n` +
            `${until ? `${until}까지` : "마감 시각까지"} 결제하지 않으면 예약이 자동 취소돼요.`,
          deepLink: matchId ? `/match-roomdetail/${matchId}` : "/my/reservations",
          linkTargetId: matchId || s(data.venueId),
          linkType: matchId ? "match" : "venue",
          kind: matchId ? "match" : "venue",
          prefsCategory: matchId ? "match" : "venue",
        });
        await d.ref.update({ paymentReminderSent: true });
        // 알림톡 실패가 "이미 보냄" 플래그를 되돌리면 안 된다 — 되돌리면 10분 뒤 푸시가 또 나간다.
        try {
          await sendPaymentReminder(db, d.id, data, recipients, until);
        } catch (e) {
          console.error(`[venuePaymentExpire] reminder alimtalk failed (resv ${d.id}):`, e?.message || e);
        }
      } catch (e) {
        console.error(`[venuePaymentExpire] reminder failed (reservation ${d.id}):`, e?.message || e);
      }
    }
  }
);
