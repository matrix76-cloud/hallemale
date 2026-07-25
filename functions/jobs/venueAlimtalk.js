/* eslint-disable */
// functions/jobs/venueAlimtalk.js
// 제휴구장 매칭 예약의 확정/취소 시 결제/환불 알림톡 발송 (①②).
//
// ⚠️ 아직 배포 대상 아님(pre-write). 켜기 전 조건:
//   1) 인앱결제(PG) 실연동 + matchRoomService REFUND_CREDIT_ENABLED=true (현재 false → 실제 환불 미작동)
//   2) 카카오 템플릿 ①② 승인 → alimtalk.js TEMPLATES.matchConfirmed / matchCanceled 에 template_id 입력
//   3) index.js 에서 export 활성화 (지금은 주석)
//   4) 약관 제3조 "현재=현장정산" 문장 갱신 (알림톡 "환불" 문구와 정합)
//
// 트리거: venueReservations/{id} status 전이 (onDocumentUpdated).
//   - (requested/pending) → confirmed : 경기 확정 안내 (matchConfirmed)
//   - confirmed → cancelled           : 경기 취소 안내 (matchCanceled)
// 매칭 예약(matchId + teamAClubId/teamBClubId)만 대상. 일반 사용자앱 개인예약(상대팀 없음)은 스킵.
// 결제 미완료 취소(payment_timeout 등)는 환불 없음 → 스킵.
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getDb } = require("../firebaseAdmin");
const { sendAlimtalk, LUNA_API_KEY } = require("../alimtalk");

const REGION = "asia-northeast3";
const toStr = (v) => String(v ?? "").trim();
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const won = (v) => toNum(v).toLocaleString("en-US");
const WD = ["일", "월", "화", "수", "목", "금", "토"];

// "5v5" → "5"
function sizeFromKey(k) {
  const m = /^(\d+)\s*v/i.exec(toStr(k));
  return m ? m[1] : "";
}

// "2026-07-25" + "19:00"~"21:00" → "7/25(금) 19:00~21:00" (KST)
function formatSlotFromParts(date, startTime, endTime) {
  const d = new Date(`${toStr(date)}T${toStr(startTime) || "00:00"}:00+09:00`);
  if (isNaN(d.getTime())) return `${toStr(date)} ${toStr(startTime)}~${toStr(endTime)}`.trim();
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getMonth() + 1}/${kst.getDate()}(${WD[kst.getDay()]}) ${toStr(startTime)}~${toStr(endTime)}`;
}

// 전화번호: 우선 payerUid, 없으면 clubs/{clubId}.ownerUid → users/{uid}.phoneE164
async function resolvePhone(db, payerUid, clubId) {
  let uid = toStr(payerUid);
  if (!uid) {
    const cs = await db.collection("clubs").doc(toStr(clubId)).get();
    uid = cs.exists ? toStr(cs.data()?.ownerUid) : "";
  }
  if (!uid) return "";
  const us = await db.collection("users").doc(uid).get();
  return us.exists ? toStr(us.data()?.phoneE164 || us.data()?.phone) : "";
}

async function clubName(db, clubId) {
  const cid = toStr(clubId);
  if (!cid) return "상대팀";
  const cs = await db.collection("clubs").doc(cid).get();
  return (cs.exists ? toStr(cs.data()?.name) : "") || "상대팀";
}

exports.venueAlimtalkOnStatusChange = onDocumentUpdated(
  { document: "venueReservations/{id}", region: REGION, secrets: [LUNA_API_KEY] },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const beforeStatus = toStr(before.status);
    const afterStatus = toStr(after.status);
    if (beforeStatus === afterStatus) return;

    // 매칭 예약만 (상대팀이 있는 팀 vs 팀). 개인 사용자앱 예약은 제외.
    const matchId = toStr(after.matchId);
    const teamAClubId = toStr(after.teamAClubId);
    const teamBClubId = toStr(after.teamBClubId);
    if (!matchId || !teamAClubId || !teamBClubId) return;

    let tplKey = "";
    if (afterStatus === "confirmed" && beforeStatus !== "confirmed") {
      tplKey = "matchConfirmed";
    } else if (afterStatus === "cancelled" && beforeStatus === "confirmed") {
      // 결제 미완료 취소는 환불 없음 → 스킵
      if (toStr(after.cancelReason) === "payment_timeout") return;
      if (!(after.paidByA === true || after.paidByB === true)) return;
      tplKey = "matchCanceled";
    } else {
      return;
    }

    const db = getDb();

    // 공통 예약 정보
    const 예약번호 = toStr(after.reservationCode) || event.params.id;
    const 구장명 = toStr(after.venueName) || "구장";
    const 코트 = toStr(after.courtName);
    const 일시 = formatSlotFromParts(after.date, after.startTime, after.endTime);
    const 사유 = toStr(after.cancelReason) || "상대팀 사정";

    // 주소는 예약 문서에 없음 → 구장 문서에서 조회
    let 주소 = "앱에서 확인";
    try {
      const vs = await db.collection("venues").doc(toStr(after.venueId)).get();
      if (vs.exists) 주소 = toStr(vs.data()?.address) || 주소;
    } catch (e) {}

    // 팀 이름 + 인원(매칭 라인업)
    const [nameA, nameB, mrSnap] = await Promise.all([
      clubName(db, teamAClubId),
      clubName(db, teamBClubId),
      db.collection("match_requests").doc(matchId).get().catch(() => null),
    ]);
    const mr = mrSnap && mrSnap.exists ? mrSnap.data() || {} : {};
    const sizeN =
      sizeFromKey(mr.matchSizeKey) ||
      sizeFromKey(mr?.fromLineupSnapshot?.matchSizeKey) ||
      sizeFromKey(mr?.toLineupSnapshot?.matchSizeKey);
    // actor=A / target=B 가정(예약 생성 시 매핑) — 스냅샷 memberCount 폴백 sizeN
    const countB = Number(mr?.toLineupSnapshot?.memberCount) || sizeN || "-";
    const countA = Number(mr?.fromLineupSnapshot?.memberCount) || sizeN || "-";

    // 환불금액: 문서에 계산돼 있으면 사용, 없으면 각 팀 결제분(share)으로 폴백.
    const refundTotal = toNum(after.refundAmount);

    // 수신자: 각 팀 결제자(없으면 팀장), 각자 상대팀·본인 결제분(share) 기준.
    const recipients = [
      { clubId: teamAClubId, payerUid: after.teamAPayerUid, paid: after.paidByA === true, share: toNum(after.shareA), oppName: nameB, oppCount: countB },
      { clubId: teamBClubId, payerUid: after.teamBPayerUid, paid: after.paidByB === true, share: toNum(after.shareB), oppName: nameA, oppCount: countA },
    ];

    for (const r of recipients) {
      // 확정: 결제한 팀에게만(선결제 완료자). 취소: 결제분 있는 팀에게 환불 안내.
      if (!r.paid) continue;
      try {
        const phone = await resolvePhone(db, r.payerUid, r.clubId);
        if (!phone) {
          console.warn(`[venueAlimtalk] no phone for club ${r.clubId} (resv ${event.params.id})`);
          continue;
        }
        // 환불금액: 분할결제면 이 팀 몫만(refundTotal 전액을 share 비율로 볼 수 없어 보수적으로 share).
        const 환불금액 = refundTotal > 0 && recipients.filter((x) => x.paid).length === 1 ? refundTotal : r.share;
        const vars =
          tplKey === "matchConfirmed"
            ? { 예약번호, 구장명, 코트, 주소, 일시, 상대팀: r.oppName, 인원: r.oppCount, 금액: won(r.share) }
            : { 예약번호, 구장명, 코트, 일시, 사유, 금액: won(r.share), 환불금액: won(환불금액) };
        await sendAlimtalk(tplKey, phone, vars, { matchId });
        console.log(`[venueAlimtalk] sent ${tplKey} to club ${r.clubId} (resv ${event.params.id})`);
      } catch (e) {
        console.error(`[venueAlimtalk] send failed (club ${r.clubId}, resv ${event.params.id}):`, e?.message || e);
      }
    }
  }
);
