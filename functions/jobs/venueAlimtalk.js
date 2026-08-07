/* eslint-disable */
// functions/jobs/venueAlimtalk.js
// 제휴구장 매칭 예약의 확정/취소·환불 알림톡 발송 모듈 (①②).
//
// ⚠️ 이 파일은 트리거가 아니라 "발송 함수"다. venuePaymentJobs 가 예약을 확정하거나
//    실제 환불을 실행한 직후에 호출한다.
//    예전엔 여기서 직접 venueReservations 를 구독했는데, 그러면 환불을 실행하는 트리거와
//    동시에 돌아서 payments 문서를 읽어도 아직 환불 전 값이거나(레이스), 정책을 다시 계산하다
//    실제 환불액과 어긋났다. 지금은 "환불한 쪽이 환불한 금액을 그대로 넘겨준다".
//
// 켜기 전 조건:
//   1) 카카오 템플릿 ①② 승인 → alimtalk.js TEMPLATES.matchConfirmed / matchCanceled 에 template_id 입력
//      (미입력이면 아래에서 조용히 스킵한다 — 승인 전에 예약·환불 흐름이 에러로 깨지면 안 된다)
//   2) 약관 제3조 "현재=현장정산" 문장 갱신 (알림톡 "환불" 문구와 정합)
//
// 매칭 예약(matchId + teamAClubId/teamBClubId)만 대상. 개인 예약은 상대팀 변수가 없어 별도 템플릿이 필요하다.
const { getDb } = require("../firebaseAdmin");
const { sendAlimtalk, TEMPLATES, LUNA_API_KEY } = require("../alimtalk");

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

// 전화번호: 우선 payerUid(실제 결제자), 없으면 팀장 uid → users/{uid}.phoneE164
async function resolvePhone(db, payerUid, leaderUid) {
  const uid = toStr(payerUid) || toStr(leaderUid);
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

// 취소 사유 — 내부 코드값이 그대로 고객에게 나가면 안 된다("payment_timeout").
// 개인 예약에는 "상대 팀"이 없다 — 같은 코드값이라도 문구를 갈라야 한다.
function cancelReasonText(data, isSolo) {
  const raw = toStr(data.cancelReason);
  if (raw === "payment_timeout") {
    return isSolo ? "결제 시간 초과로 자동 취소" : "상대 팀 미결제로 자동 취소";
  }
  if (toStr(data.status) === "rejected") return "구장 사정으로 예약 반려";
  return toStr(data.refundReason) || raw || (isSolo ? "예약자 취소" : "팀 사정");
}

// 구장 주소 — 예약 문서에 없어서 venues 문서에서 조회한다.
async function venueAddress(db, venueId) {
  try {
    const vs = await db.collection("venues").doc(toStr(venueId)).get();
    if (vs.exists) return toStr(vs.data()?.address) || "앱에서 확인";
  } catch (e) {}
  return "앱에서 확인";
}

/** 템플릿 승인 전이면 발송하지 않는다(에러 대신 스킵 — 예약·환불 흐름을 깨지 않게). */
function templateReady(tplKey, reservationId) {
  if (toStr(TEMPLATES[tplKey]?.id)) return true;
  console.info(`[venueAlimtalk] ${tplKey} 템플릿 미승인 — 발송 스킵 (resv ${reservationId})`);
  return false;
}

/** 매칭 예약인지 + 공통 변수 조립. 대상이 아니면 null. */
async function baseVars(db, reservationId, data) {
  const matchId = toStr(data.matchId);
  const teamAClubId = toStr(data.teamAClubId);
  const teamBClubId = toStr(data.teamBClubId);
  if (!matchId || !teamAClubId || !teamBClubId) return null;

  const [nameA, nameB] = await Promise.all([clubName(db, teamAClubId), clubName(db, teamBClubId)]);
  return {
    matchId,
    nameA,
    nameB,
    예약번호: toStr(data.reservationCode) || reservationId,
    구장명: toStr(data.venueName) || "구장",
    // 변수가 비면 루나가 발송을 거부한다 — 코트가 없는 구장(단일 필드)도 있으므로 폴백 필수.
    코트: toStr(data.courtName) || "-",
    일시: formatSlotFromParts(data.date, data.startTime, data.endTime),
  };
}

/** 개인 예약(매칭 아님) 공통 변수. 매칭 예약이면 null. */
function soloVars(reservationId, data) {
  if (toStr(data.matchId)) return null;
  return {
    예약번호: toStr(data.reservationCode) || reservationId,
    구장명: toStr(data.venueName) || "구장",
    코트: toStr(data.courtName) || "-",
    일시: formatSlotFromParts(data.date, data.startTime, data.endTime),
  };
}

/** 개인 예약자 전화 — users 문서 우선, 없으면 예약 시점에 박힌 phone. */
async function soloPhone(db, data) {
  const uid = toStr(data.userId);
  if (uid) {
    const p = await resolvePhone(db, "", uid);
    if (p) return p;
  }
  return toStr(data.phone);
}

/**
 * 경기 확정 안내 — 양 팀이 모두 결제해 예약이 confirmed 된 직후.
 * 수신자는 각 팀 결제자(없으면 팀장), 금액은 그 팀이 실제로 낸 몫(share).
 */
async function sendMatchConfirmed(db, reservationId, data) {
  if (!templateReady("matchConfirmed", reservationId)) return;
  const base = await baseVars(db, reservationId, data);
  if (!base) return;

  const 주소 = await venueAddress(db, data.venueId);

  // 인원: 라인업 스냅샷 → 없으면 매치 사이즈(5v5 → 5)
  let mr = {};
  try {
    const snap = await db.collection("match_requests").doc(base.matchId).get();
    mr = snap.exists ? snap.data() || {} : {};
  } catch (e) {}
  const sizeN =
    sizeFromKey(mr.matchSizeKey) ||
    sizeFromKey(mr?.fromLineupSnapshot?.matchSizeKey) ||
    sizeFromKey(mr?.toLineupSnapshot?.matchSizeKey);
  const countA = Number(mr?.fromLineupSnapshot?.memberCount) || sizeN || "-";
  const countB = Number(mr?.toLineupSnapshot?.memberCount) || sizeN || "-";

  const recipients = [
    { side: "A", payerUid: data.teamAPayerUid, leaderUid: data.teamALeaderUid, share: toNum(data.shareA), oppName: base.nameB, oppCount: countB },
    { side: "B", payerUid: data.teamBPayerUid, leaderUid: data.teamBLeaderUid, share: toNum(data.shareB), oppName: base.nameA, oppCount: countA },
  ];

  for (const r of recipients) {
    try {
      const phone = await resolvePhone(db, r.payerUid, r.leaderUid);
      if (!phone) {
        console.warn(`[venueAlimtalk] no phone for side ${r.side} (resv ${reservationId})`);
        continue;
      }
      await sendAlimtalk(
        "matchConfirmed",
        phone,
        {
          예약번호: base.예약번호, 구장명: base.구장명, 코트: base.코트, 주소,
          일시: base.일시, 상대팀: r.oppName, 인원: r.oppCount, 금액: won(r.share),
        },
        { matchId: base.matchId }
      );
      console.log(`[venueAlimtalk] sent matchConfirmed side ${r.side} (resv ${reservationId})`);
    } catch (e) {
      console.error(`[venueAlimtalk] confirm send failed (side ${r.side}, resv ${reservationId}):`, e?.message || e);
    }
  }
}

/**
 * 경기 취소·환불 안내 — 실제 환불을 실행한 직후.
 * @param {Array<{side: string, paid: number, refund: number, basis: string}>} refunds
 *        환불을 시도한 결제건들. refund=0(당일 취소 등)도 넣는다 —
 *        "왜 0원인지"를 알리는 게 이 알림톡의 핵심이다.
 */
async function sendMatchCanceled(db, reservationId, data, refunds) {
  if (!Array.isArray(refunds) || !refunds.length) return;
  if (!templateReady("matchCanceled", reservationId)) return;
  const base = await baseVars(db, reservationId, data);
  if (!base) return;

  const 사유 = cancelReasonText(data, false);

  for (const r of refunds) {
    const isA = toStr(r.side) === "A";
    try {
      const phone = await resolvePhone(
        db,
        isA ? data.teamAPayerUid : data.teamBPayerUid,
        isA ? data.teamALeaderUid : data.teamBLeaderUid
      );
      if (!phone) {
        console.warn(`[venueAlimtalk] no phone for side ${r.side} (resv ${reservationId})`);
        continue;
      }
      await sendAlimtalk(
        "matchCanceled",
        phone,
        {
          예약번호: base.예약번호, 구장명: base.구장명, 코트: base.코트, 일시: base.일시, 사유,
          금액: won(r.paid), 환불금액: won(r.refund), 환불기준: toStr(r.basis) || "앱에서 확인",
        },
        { matchId: base.matchId }
      );
      console.log(`[venueAlimtalk] sent matchCanceled side ${r.side} (resv ${reservationId})`);
    } catch (e) {
      console.error(`[venueAlimtalk] cancel send failed (side ${r.side}, resv ${reservationId}):`, e?.message || e);
    }
  }
}

/* ============================================================
 * 개인 예약(매칭 아님) — 상대팀 변수가 없어 별도 템플릿(50007/50008)을 쓴다.
 * ========================================================== */

/** 예약 확정 안내 — 결제 완료로 confirmed 된 직후. */
async function sendSoloConfirmed(db, reservationId, data) {
  if (!templateReady("soloConfirmed", reservationId)) return;
  const base = soloVars(reservationId, data);
  if (!base) return;

  try {
    const phone = await soloPhone(db, data);
    if (!phone) {
      console.warn(`[venueAlimtalk] no phone for solo resv ${reservationId}`);
      return;
    }
    await sendAlimtalk("soloConfirmed", phone, {
      ...base,
      주소: await venueAddress(db, data.venueId),
      금액: won(data.price),
      // 구장안내는 선택 입력이라 비는 게 정상 — 비면 발송이 거부되므로 폴백을 넣는다.
      구장안내: toStr(data.ownerNote) || "-",
    });
    console.log(`[venueAlimtalk] sent soloConfirmed (resv ${reservationId})`);
  } catch (e) {
    console.error(`[venueAlimtalk] solo confirm send failed (resv ${reservationId}):`, e?.message || e);
  }
}

/**
 * 예약 취소·환불 안내 — 실제 환불을 실행한 직후.
 * @param {Array<{paid: number, refund: number, basis: string}>} refunds 실제 환불한 결제건들.
 */
async function sendSoloCanceled(db, reservationId, data, refunds) {
  if (!Array.isArray(refunds) || !refunds.length) return;
  if (!templateReady("soloCanceled", reservationId)) return;
  const base = soloVars(reservationId, data);
  if (!base) return;

  const 사유 = cancelReasonText(data, true);
  const phone = await soloPhone(db, data);
  if (!phone) {
    console.warn(`[venueAlimtalk] no phone for solo resv ${reservationId}`);
    return;
  }

  for (const r of refunds) {
    try {
      await sendAlimtalk("soloCanceled", phone, {
        ...base, 사유,
        금액: won(r.paid), 환불금액: won(r.refund), 환불기준: toStr(r.basis) || "앱에서 확인",
      });
      console.log(`[venueAlimtalk] sent soloCanceled (resv ${reservationId})`);
    } catch (e) {
      console.error(`[venueAlimtalk] solo cancel send failed (resv ${reservationId}):`, e?.message || e);
    }
  }
}

/* ============================================================
 * 결제 마감 임박 (50006) — 매칭·개인 예약 공용
 * ========================================================== */

/**
 * 마감 30분 전 리마인더. 아직 결제하지 않은 수신자에게만.
 *
 * 승인 직후의 "결제 요청"(50005)은 카카오 반려라 알림톡이 없다 —
 * 결제창이 열렸다는 걸 알림톡으로 알릴 수 있는 지점은 지금 이 한 번뿐이다.
 *
 * @param {Array<{uid: string, amount: number}>} recipients 미결제자와 각자 부담분
 * @param {string} deadlineText 결제 마감 시각(KST 표기) — 호출측이 이미 만든 값을 그대로 쓴다
 */
async function sendPaymentReminder(db, reservationId, data, recipients, deadlineText) {
  if (!Array.isArray(recipients) || !recipients.length) return;
  if (!templateReady("paymentReminder", reservationId)) return;

  const vars = {
    예약번호: toStr(data.reservationCode) || reservationId,
    구장명: toStr(data.venueName) || "구장",
    코트: toStr(data.courtName) || "-",
    일시: formatSlotFromParts(data.date, data.startTime, data.endTime),
    마감시각: toStr(deadlineText) || "앱에서 확인",
  };

  for (const r of recipients) {
    try {
      const phone = await resolvePhone(db, "", r.uid);
      if (!phone) {
        console.warn(`[venueAlimtalk] no phone for reminder ${r.uid} (resv ${reservationId})`);
        continue;
      }
      await sendAlimtalk("paymentReminder", phone, { ...vars, 금액: won(r.amount) });
      console.log(`[venueAlimtalk] sent paymentReminder to ${r.uid} (resv ${reservationId})`);
    } catch (e) {
      console.error(`[venueAlimtalk] reminder send failed (${r.uid}, resv ${reservationId}):`, e?.message || e);
    }
  }
}

/* ============================================================
 * 진입점 — 호출측이 매칭/개인을 분기하지 않도록 여기서 가른다.
 * 분기를 호출측에 두면 새 취소 경로가 생길 때마다 한쪽을 빠뜨린다.
 * ========================================================== */
const sendReservationConfirmed = (db, id, data) =>
  toStr(data?.matchId) ? sendMatchConfirmed(db, id, data) : sendSoloConfirmed(db, id, data);

const sendReservationCanceled = (db, id, data, refunds) =>
  toStr(data?.matchId) ? sendMatchCanceled(db, id, data, refunds) : sendSoloCanceled(db, id, data, refunds);

module.exports = {
  sendMatchConfirmed,
  sendMatchCanceled,
  sendReservationConfirmed,
  sendReservationCanceled,
  sendPaymentReminder,
  LUNA_API_KEY,
};
