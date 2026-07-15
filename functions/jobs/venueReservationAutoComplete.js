/* eslint-disable */
// functions/jobs/venueReservationAutoComplete.js
// 구장 예약 자동 이용완료 (리뷰 엔진 스위치):
//  - status="confirmed" 예약 중 이용 종료(KST date+endTime)가 GRACE(2h) 넘게 지났으면
//    자동으로 status="done"(autoCompleted) 전환. 오너가 그 사이 노쇼 처리할 여유를 GRACE로 확보.
//  - 앱 예약(userId 有, matchId 無)만 예약자에게 "리뷰 남겨주세요" 알림 → /my/reservations.
//    (매칭 예약은 매칭 라인에서 별도 처리하므로 done 전환만, 알림 제외 — 기존 notify 가드와 동일)
//  - done 전환 즉시 confirmed 쿼리에서 빠지므로 멱등(중복 알림 없음).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getDb, getAdmin } = require("../firebaseAdmin");

const GRACE_MS = 2 * 60 * 60 * 1000; // 이용 종료 후 2시간 유예(오너 노쇼 처리 여지)

// KST 기준 "YYYY-MM-DD" + "HH:MM" → epoch ms. endTime<=startTime(자정 넘김)이면 +1일.
function endEpochMs(date, startTime, endTime) {
  const d = String(date || "").trim();
  const et = String(endTime || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(et)) return NaN;
  let ms = Date.parse(`${d}T${et}:00+09:00`);
  if (!Number.isFinite(ms)) return NaN;
  const st = String(startTime || "").trim();
  if (/^\d{2}:\d{2}$/.test(st) && et <= st) ms += 24 * 60 * 60 * 1000; // 자정 넘긴 슬롯
  return ms;
}

const venueReservationAutoCompleteTick = onSchedule("0 * * * *", async () => {
  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const nowMs = Date.now();

  const snap = await db
    .collection("venueReservations")
    .where("status", "==", "confirmed")
    .limit(300)
    .get();

  if (snap.empty) return;

  let done = 0;
  let notified = 0;

  for (const docSnap of snap.docs) {
    try {
      const r = docSnap.data() || {};
      const endMs = endEpochMs(r.date, r.startTime, r.endTime);
      if (!Number.isFinite(endMs)) continue;          // 날짜/시간 파싱 불가 → 건너뜀
      if (nowMs < endMs + GRACE_MS) continue;         // 아직 유예 안 지남

      await docSnap.ref.update({
        status: "done",
        autoCompleted: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      done += 1;

      // 앱 예약만 리뷰 유도 알림 (매칭예약·오너수동예약 제외)
      const userId = String(r.userId || "").trim();
      const matchId = String(r.matchId || "").trim();
      if (userId && !matchId) {
        const when = `${String(r.date || "")} ${String(r.startTime || "")}~${String(r.endTime || "")}`;
        const where =
          `${String(r.venueName || "구장")}` +
          (String(r.courtName || "") ? ` · ${String(r.courtName)}` : "");
        await db.collection("notifications").add({
          kind: "venue",
          subType: "venueReservationDone",
          type: "venue_reservation",
          title: "이용 잘 하셨나요? ⭐",
          body: `${when} · ${where} 이용이 끝났어요. 잠깐이면 되는 리뷰로 다음 팀에게 도움을 주세요!`,
          targetType: "USER",
          targetIds: [userId],
          linkType: "venue",
          linkTargetId: String(r.venueId || ""),
          meta: { venueId: String(r.venueId || ""), reservationId: docSnap.id, deepLink: "/my/reservations" },
          push: { enabled: true, status: "queued", sentAt: null, failReason: null },
          prefsCategory: "venue",
          readBy: {},
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        notified += 1;
      }
    } catch (e) {
      console.warn("[venueReservationAutoCompleteTick] item failed:", e?.message || e);
    }
  }

  if (done) {
    console.log(`[venueReservationAutoCompleteTick] done ${done}, review-nudge ${notified}`);
  }
});

module.exports = { venueReservationAutoCompleteTick };
