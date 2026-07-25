/* eslint-disable */
// functions/jobs/matchAlimtalk.js
// 경기 확정/취소 시 양 팀장에게 카카오 알림톡 발송 (직접입력 매칭 ③④).
//
// 트리거: match_requests/{id} 문서의 status 전이 (onDocumentUpdated).
//   - (accepted/proposed) → confirmed : 경기 확정 안내 (matchConfirmedDirect)
//   - confirmed → cancelled           : 경기 취소 안내 (matchCanceledDirect)
//
// 서버측에서 잡는 이유: api_key를 클라이언트에 노출하지 않고, 확정/취소가 어느 경로로
//   일어나든(구장주/회원/자동) 한 곳에서 커버하기 위함.
//
// 제휴구장(partnerBooking 있음) 매칭은 결제·환불 템플릿(①②)이 준비되면 별도 처리 → 여기선 스킵.
// 멱등성: status 전이(before!=after)로만 발송 → 확정/취소 후 다른 필드 수정엔 재발송 안 됨.
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getDb } = require("../firebaseAdmin");
const { sendAlimtalk, LUNA_API_KEY } = require("../alimtalk");

const REGION = "asia-northeast3";
const toStr = (v) => String(v ?? "").trim();
const WD = ["일", "월", "화", "수", "목", "금", "토"];

// "5v5" → "5" (인원 폴백용)
function sizeFromKey(k) {
  const m = /^(\d+)\s*v/i.exec(toStr(k));
  return m ? m[1] : "";
}

// ISO 시작시각 + 소요(분) → "7/25(금) 19:00~21:00" (KST)
function formatSlot(scheduledAtISO, durationMin) {
  const start = new Date(scheduledAtISO);
  if (isNaN(start.getTime())) return "";
  const dur = Number(durationMin) > 0 ? Number(durationMin) : 120;
  const end = new Date(start.getTime() + dur * 60000);
  const kst = (d) => new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const s = kst(start);
  const e = kst(end);
  const hm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${s.getMonth() + 1}/${s.getDate()}(${WD[s.getDay()]}) ${hm(s)}~${hm(e)}`;
}

// clubs/{id}.ownerUid → users/{uid}.phoneE164 (팀장 전화번호)
async function leaderPhone(db, clubId) {
  const cid = toStr(clubId);
  if (!cid) return "";
  const cs = await db.collection("clubs").doc(cid).get();
  const uid = cs.exists ? toStr(cs.data()?.ownerUid) : "";
  if (!uid) return "";
  const us = await db.collection("users").doc(uid).get();
  if (!us.exists) return "";
  return toStr(us.data()?.phoneE164 || us.data()?.phone);
}

exports.matchAlimtalkOnStatusChange = onDocumentUpdated(
  { document: "match_requests/{id}", region: REGION, secrets: [LUNA_API_KEY] },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const beforeStatus = toStr(before.status);
    const afterStatus = toStr(after.status);
    if (beforeStatus === afterStatus) return; // 상태 전이 없음

    // 제휴구장(결제) 매칭은 ①②(PG 연동 후)에서 처리 → 직접입력만.
    if (after.partnerBooking && typeof after.partnerBooking === "object") return;

    let tplKey = "";
    if (afterStatus === "confirmed" && beforeStatus !== "confirmed") {
      tplKey = "matchConfirmedDirect";
    } else if (afterStatus === "cancelled" && beforeStatus === "confirmed") {
      tplKey = "matchCanceledDirect";
    } else {
      return; // 대상 전이 아님
    }

    const matchId = event.params.id;
    const db = getDb();

    const actorClubId = toStr(after.actorClubId);
    const targetClubId = toStr(after.targetClubId);
    const actorName = toStr(after?.fromTeamSnapshot?.name) || "상대팀";
    const targetName = toStr(after?.toTeamSnapshot?.name) || "상대팀";

    const sizeN =
      sizeFromKey(after.matchSizeKey) ||
      sizeFromKey(after?.fromLineupSnapshot?.matchSizeKey) ||
      sizeFromKey(after?.toLineupSnapshot?.matchSizeKey);
    const fromCount = Number(after?.fromLineupSnapshot?.memberCount) || "";
    const toCount = Number(after?.toLineupSnapshot?.memberCount) || "";

    const 구장명 = toStr(after?.field?.address) || "직접 입력 구장";
    const 일시 = formatSlot(after.scheduledAt, after.durationMin) || "앱에서 확인";
    const 사유 = toStr(after.cancelReason) || "상대팀 사정";

    // 수신자: 양 팀장. 각자에게 "상대팀"은 반대 팀.
    const recipients = [
      { clubId: actorClubId, oppName: targetName, oppCount: toCount },
      { clubId: targetClubId, oppName: actorName, oppCount: fromCount },
    ];

    for (const r of recipients) {
      try {
        const phone = await leaderPhone(db, r.clubId);
        if (!phone) {
          console.warn(`[matchAlimtalk] no phone for club ${r.clubId} (match ${matchId})`);
          continue;
        }
        const vars =
          tplKey === "matchConfirmedDirect"
            ? { 구장명, 일시, 상대팀: r.oppName, 인원: r.oppCount || sizeN || "-" }
            : { 구장명, 일시, 상대팀: r.oppName, 사유 };
        await sendAlimtalk(tplKey, phone, vars, { matchId });
        console.log(`[matchAlimtalk] sent ${tplKey} to club ${r.clubId} (match ${matchId})`);
      } catch (e) {
        console.error(`[matchAlimtalk] send failed (club ${r.clubId}, match ${matchId}):`, e?.message || e);
      }
    }
  }
);
