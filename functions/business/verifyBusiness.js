/* eslint-disable */
// functions/business/verifyBusiness.js
// 국세청 사업자등록정보 진위확인 → 구장 사업자 인증 자동 처리
//
// 흐름:
// 1) 클라이언트가 { venueId, bizNo, ownerName, openDate, bizName } 를 POST
// 2) 국세청 진위확인 API(odcloud)로 대조
//    - valid "01"(일치)  → venues/{venueId}.business.status = "verified"
//    - valid "02"(불일치) → status = "rejected" + 사유
// 3) (부가) 상태조회 API로 과세유형(간이/일반)·휴폐업 확인 → taxType 자동 보정
//
// 🔑 서비스키: data.go.kr "국세청_사업자등록정보 진위확인 및 상태조회" 신청 후
//    Functions 환경변수 NTS_SERVICE_KEY 에 "Decoding" 키를 넣는다. (functions/.env)
//    키 미설정이면 { configured:false } 반환 → 클라는 기존 수동 승인 대기 흐름 유지.

const { onRequest } = require("firebase-functions/v2/https");
const { getAdmin } = require("../firebaseAdmin");

const VALIDATE_URL = "https://api.odcloud.kr/api/nts-businessman/v1/validate";
const STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status";

function digits(v) { return String(v || "").replace(/[^0-9]/g, ""); }
function ymd(v) { return String(v || "").replace(/[^0-9]/g, "").slice(0, 8); }

exports.verifyBusiness = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const serviceKey = process.env.NTS_SERVICE_KEY || "";
    const { venueId, bizNo, ownerName, openDate, bizName } = req.body || {};

    const b_no = digits(bizNo);
    if (!venueId || b_no.length !== 10 || !String(ownerName || "").trim() || ymd(openDate).length !== 8) {
      res.status(400).json({ error: "invalid_params" });
      return;
    }

    // 🔒 인증: 유효한 Firebase ID 토큰 + 해당 구장의 소유자만 허용
    //    (무인증 onRequest 라 누구나 임의 구장의 business.status 를 변조할 수 있던 구멍 차단)
    const admin = getAdmin();
    const db = admin.firestore();
    const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "unauthenticated" }); return; }
    let callerUid = "";
    try {
      callerUid = (await admin.auth().verifyIdToken(m[1])).uid;
    } catch (e) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    try {
      const vsnap = await db.collection("venues").doc(String(venueId)).get();
      if (!vsnap.exists || String(vsnap.data()?.ownerUid || "") !== callerUid) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
    } catch (e) {
      res.status(500).json({ error: "venue_read_failed" });
      return;
    }

    // 키 미설정 → 자동 진위확인 비활성(수동 승인 폴백)
    if (!serviceKey) {
      res.status(200).json({ configured: false });
      return;
    }

    try {
      // 1) 진위확인 (사업자번호 + 개업일자 + 대표자명 대조)
      const vRes = await fetch(`${VALIDATE_URL}?serviceKey=${encodeURIComponent(serviceKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businesses: [{
            b_no,
            start_dt: ymd(openDate),
            p_nm: String(ownerName).trim(),
            b_nm: String(bizName || "").trim(),
            p_nm2: "", b_sector: "", b_type: "", corp_no: "",
          }],
        }),
      });
      const vJson = await vRes.json().catch(() => ({}));
      if (!vRes.ok) {
        console.error("[verifyBusiness] validate http error", vRes.status, JSON.stringify(vJson));
        res.status(200).json({ configured: true, valid: false, reason: "국세청 조회에 실패했어요. 잠시 후 다시 시도해주세요." });
        return;
      }

      const item = (vJson.data && vJson.data[0]) || {};
      const isValid = item.valid === "01";

      // 2) 상태조회(과세유형/휴폐업) — 부가정보, 실패해도 무시
      let taxType = "", bStt = "";
      try {
        const sRes = await fetch(`${STATUS_URL}?serviceKey=${encodeURIComponent(serviceKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ b_no: [b_no] }),
        });
        const sJson = await sRes.json().catch(() => ({}));
        const s = (sJson.data && sJson.data[0]) || {};
        bStt = s.b_stt || "";
        const tt = String(s.tax_type || "");
        if (tt.includes("간이")) taxType = "simple";
        else if (tt.includes("일반")) taxType = "general";
      } catch (e) { /* 부가정보 실패 무시 */ }

      const ref = db.collection("venues").doc(String(venueId));
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (isValid) {
        // 휴업·폐업자면 인증 반려
        if (bStt && !String(bStt).includes("계속")) {
          const reason = `국세청 조회 결과 '${bStt}' 상태예요. 정상 영업 중인 사업자만 인증할 수 있어요.`;
          await ref.update({
            "business.status": "rejected", "business.rejectReason": reason,
            "business.ntsChecked": true, "business.ntsCheckedAt": now, updatedAt: now,
          });
          res.status(200).json({ configured: true, valid: false, reason });
          return;
        }
        const patch = {
          "business.status": "verified", "business.rejectReason": "",
          "business.ntsChecked": true, "business.ntsCheckedAt": now, updatedAt: now,
        };
        if (taxType) patch["business.taxType"] = taxType;
        await ref.update(patch);
        res.status(200).json({ configured: true, valid: true, taxType, bStt });
      } else {
        const reason = item.valid_msg || "국세청에 등록된 사업자 정보와 일치하지 않아요. 사업자번호·대표자명·개업일자를 확인해주세요.";
        await ref.update({
          "business.status": "rejected", "business.rejectReason": reason,
          "business.ntsChecked": true, "business.ntsCheckedAt": now, updatedAt: now,
        });
        res.status(200).json({ configured: true, valid: false, reason });
      }
    } catch (err) {
      console.error("[verifyBusiness] error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  }
);
