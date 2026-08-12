/* eslint-disable */
// functions/payments/payouts.js
// 지급대행 오케스트레이션 — 셀러 등록/동기화, 구장별 지급 요청/취소, 웹훅 수신.
// 저수준 API 래퍼는 payoutsApi.js 에 있다(JWE 암호화·인증).
//
// 돈이 **나가는** 기능이라 방어 순서를 고정한다. 하나라도 건너뛰면 회수 불가능한 사고가 된다:
//   ① 게이트(PAYOUTS_ENABLED) → ② 어드민 인증 → ③ 셀러 상태 → ④ 잔액 →
//   ⑤ payments 선점(트랜잭션) → ⑥ 토스 요청 → ⑦ 결과 반영
// ⑤를 ⑥보다 **먼저** 하는 이유: 요청이 성공했는데 반영이 실패하면 같은 결제건에 두 번 지급된다.
// 먼저 잠가두면 최악의 경우 "지급했는데 장부가 REQUESTED 로 남는" 쪽으로 기운다(웹훅이 정정한다).
//
// 컬렉션
//   payoutSellers/{venueId} — 구장 = 셀러. 토스 sellerId 와 승인 상태를 들고 있다.
//   payouts/{refPayoutId}   — 지급 요청 1건(구장 1곳 × 1회차). 묶인 payments id 목록 포함.
//   payments/*              — 지급되면 payoutId 가 채워진다(정산 화면이 "지급 완료"로 읽는 값).

const { onRequest } = require("firebase-functions/v2/https");
const { getAdmin } = require("../firebaseAdmin");
const {
  PAYOUT_SECRETS, payoutsEnabled,
  registerSeller, updateSeller, getSeller, getBalance, requestPayouts, cancelPayout,
  MAX_PAYOUT_ITEMS,
} = require("./payoutsApi");

const REGION = "asia-northeast3";
const s = (v) => String(v ?? "").trim();
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const db = () => getAdmin().firestore();

/** 지급 가능한 셀러 상태 — 그 외(본인인증 전·KYC 대기)는 요청해도 토스가 막는다. */
const PAYABLE_SELLER_STATUS = ["PARTIALLY_APPROVED", "APPROVED"];

/* ── 인증 ────────────────────────────────────────────────── */
async function callerToken(req) {
  const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return null;
  try { return await getAdmin().auth().verifyIdToken(m[1]); } catch { return null; }
}
/** 지급 실행은 어드민만. 구장주가 자기 돈을 스스로 내보내게 두지 않는다. */
async function requireAdmin(req, res) {
  const t = await callerToken(req);
  if (!t?.uid) { res.status(401).json({ error: "unauthorized" }); return null; }
  if (t.admin !== true) { res.status(403).json({ error: "forbidden" }); return null; }
  return t;
}

/**
 * refSellerId 는 7~20자 제약이 있다(토스). venueId 가 그보다 길거나 짧을 수 있으므로
 * 접두사를 붙이고 잘라 쓴다. 등록 후에는 수정 불가라 규칙을 바꾸면 안 된다.
 */
function refSellerIdOf(venueId) {
  return `hm-${s(venueId)}`.slice(0, 20).padEnd(7, "0");
}

/** 이 지급 요청을 가리키는 고유 id. 같은 값을 다시 쓸 수 없어 회차·시각을 섞는다. */
function refPayoutIdOf(venueId, now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  const p = (x) => String(x).padStart(2, "0");
  const stamp = `${k.getUTCFullYear()}${p(k.getUTCMonth() + 1)}${p(k.getUTCDate())}${p(k.getUTCHours())}${p(k.getUTCMinutes())}${p(k.getUTCSeconds())}`;
  return `hm-${s(venueId)}-${stamp}`.slice(0, 50);
}

/* ============================================================
 * 1) 셀러 등록 — 구장 사업자를 토스에 셀러로 올린다.
 *    개인사업자는 등록 직후 APPROVAL_REQUIRED 이고, 등록한 전화번호로 본인인증 문자가 간다.
 *    본인인증을 마쳐야 PARTIALLY_APPROVED 가 되어 지급이 가능하다 →
 *    "등록했다 = 지급된다"가 아니므로 상태를 화면에 그대로 보여줘야 한다.
 * ========================================================== */
exports.registerPayoutSeller = onRequest(
  { region: REGION, cors: true, secrets: PAYOUT_SECRETS },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });
    if (!payoutsEnabled()) return void res.status(503).json({ error: "payouts_disabled" });
    const t = await requireAdmin(req, res);
    if (!t) return;

    const venueId = s(req.body?.venueId);
    if (!venueId) return void res.status(400).json({ error: "venueId_required" });

    try {
      const vSnap = await db().collection("venues").doc(venueId).get();
      if (!vSnap.exists) return void res.status(404).json({ error: "venue_not_found" });
      const v = vSnap.data() || {};

      // 셀러 등록에 필요한 값이 하나라도 비면 토스가 거절한다 → 무엇이 없는지 먼저 알려준다.
      const biz = v.business || {};
      const settle = v.settlement || {};
      const missing = [];
      if (!s(biz.bizName)) missing.push("상호");
      if (!s(biz.ownerName)) missing.push("대표자명");
      if (!s(biz.bizNo)) missing.push("사업자등록번호");
      if (!s(settle.bank) || !s(settle.account)) missing.push("정산 계좌");
      if (!s(settle.holder)) missing.push("예금주");
      if (!s(settle.taxEmail)) missing.push("세금계산서 수신 이메일");
      if (!s(v.phone)) missing.push("구장 연락처");
      if (missing.length) {
        return void res.status(400).json({ error: "seller_info_incomplete", missing });
      }

      const seller = await registerSeller({
        refSellerId: refSellerIdOf(venueId),
        // 우리는 비사업자 개인을 받지 않는다 — 법인 여부만 갈린다.
        businessType: s(biz.entityType) === "corporate" ? "CORPORATE" : "INDIVIDUAL_BUSINESS",
        company: {
          name: s(biz.bizName),
          representativeName: s(biz.ownerName),
          businessRegistrationNumber: s(biz.bizNo),
          email: s(settle.taxEmail),
          phone: s(v.phone),
        },
        account: {
          bankCode: s(settle.bankCode) || s(settle.bank), // 코드가 저장돼 있으면 그걸, 아니면 은행명(호출부에서 매핑)
          accountNumber: s(settle.account),
          holderName: s(settle.holder),
        },
        metadata: { venueId, ownerUid: s(v.ownerUid) },
      });

      await db().collection("payoutSellers").doc(venueId).set({
        venueId,
        ownerUid: s(v.ownerUid),
        sellerId: s(seller?.id),
        refSellerId: s(seller?.refSellerId),
        businessType: s(seller?.businessType),
        status: s(seller?.status),
        bizNo: s(biz.bizNo),
        holderName: s(settle.holder),
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastError: "",
      }, { merge: true });

      res.json({ ok: true, sellerId: s(seller?.id), status: s(seller?.status) });
    } catch (e) {
      console.error("[payouts] registerSeller failed", e?.message || e);
      res.status(400).json({ error: s(e?.message) || "seller_register_failed", code: s(e?.tossCode) });
    }
  }
);

/* ============================================================
 * 2) 셀러 상태 동기화 — 본인인증·KYC 로 상태가 바뀌었는지 확인.
 *    웹훅(seller.changed)이 정본이지만, 웹훅 유실·초기 연동 확인용으로 수동 조회를 둔다.
 * ========================================================== */
exports.syncPayoutSeller = onRequest(
  { region: REGION, cors: true, secrets: PAYOUT_SECRETS },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });
    if (!payoutsEnabled()) return void res.status(503).json({ error: "payouts_disabled" });
    const t = await requireAdmin(req, res);
    if (!t) return;

    const venueId = s(req.body?.venueId);
    try {
      const ref = db().collection("payoutSellers").doc(venueId);
      const snap = await ref.get();
      const sellerId = s(snap.data()?.sellerId);
      if (!sellerId) return void res.status(404).json({ error: "seller_not_registered" });

      const seller = await getSeller(sellerId);
      await ref.set({ status: s(seller?.status), updatedAt: new Date().toISOString() }, { merge: true });
      res.json({ ok: true, status: s(seller?.status) });
    } catch (e) {
      res.status(400).json({ error: s(e?.message) || "seller_sync_failed" });
    }
  }
);

/* ============================================================
 * 3) 잔액 조회 — 지급 요청 전에 어드민이 확인한다.
 *    available 을 넘겨 요청하면 그대로 실패하므로 화면에 먼저 보여준다.
 * ========================================================== */
exports.getPayoutBalance = onRequest(
  { region: REGION, cors: true, secrets: PAYOUT_SECRETS },
  async (req, res) => {
    if (!payoutsEnabled()) return void res.status(503).json({ error: "payouts_disabled" });
    const t = await requireAdmin(req, res);
    if (!t) return;
    try {
      res.json({ ok: true, ...(await getBalance()) });
    } catch (e) {
      res.status(400).json({ error: s(e?.message) || "balance_failed" });
    }
  }
);

/* ============================================================
 * 4) 구장 지급 요청 — 이 구장의 미지급 payments 를 묶어 한 건으로 보낸다.
 *
 * 지급액은 클라이언트가 보낸 숫자를 절대 믿지 않는다. 원장(payments.netVenueAmount)에서
 * 서버가 다시 더한다 — 어드민 화면의 값이 낡았거나 조작돼도 실제 나가는 돈은 장부와 같다.
 * ========================================================== */
exports.requestVenuePayout = onRequest(
  { region: REGION, cors: true, secrets: PAYOUT_SECRETS },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });
    if (!payoutsEnabled()) return void res.status(503).json({ error: "payouts_disabled" });
    const t = await requireAdmin(req, res);
    if (!t) return;

    const venueId = s(req.body?.venueId);
    const payoutDate = s(req.body?.payoutDate); // 없으면 EXPRESS(당일). 영업일 08~15시만 가능.
    if (!venueId) return void res.status(400).json({ error: "venueId_required" });

    try {
      // ── 셀러 상태
      const sellerSnap = await db().collection("payoutSellers").doc(venueId).get();
      const seller = sellerSnap.data() || {};
      if (!s(seller.sellerId)) return void res.status(400).json({ error: "seller_not_registered" });
      if (!PAYABLE_SELLER_STATUS.includes(s(seller.status))) {
        return void res.status(400).json({ error: "seller_not_payable", status: s(seller.status) });
      }

      // ── 지급 대상 결제 — 이용이 끝났고, 아직 지급 안 됐고, 남은 구장 몫이 있는 것.
      //    이용 전 예약은 제외한다(지급 후 환불이 나면 회수가 어렵다 — 정책상 경기 종료 후 지급).
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const paySnap = await db().collection("payments").where("venueId", "==", venueId).get();
      const targets = [];
      paySnap.forEach((d) => {
        const x = d.data() || {};
        if (s(x.payoutId)) return;                    // 이미 지급대행에 물린 건
        if (x.settled === true) return;               // 수동 이체로 처리된 건
        if (n(x.netVenueAmount) <= 0) return;         // 전액 환불
        if (s(x.reservationDate) > today) return;     // 아직 이용 전
        targets.push({ id: d.id, amount: n(x.netVenueAmount) });
      });
      if (!targets.length) return void res.status(400).json({ error: "nothing_to_pay" });

      const amount = targets.reduce((a, b) => a + b.amount, 0);
      if (amount <= 0) return void res.status(400).json({ error: "nothing_to_pay" });

      // ── 잔액
      const bal = await getBalance();
      if (bal.available < amount) {
        return void res.status(400).json({ error: "insufficient_balance", available: bal.available, required: amount });
      }

      const refPayoutId = refPayoutIdOf(venueId);
      const payoutRef = db().collection("payouts").doc(refPayoutId);

      // ── 선점: 대상 payments 에 payoutId 를 먼저 박는다.
      //    여기서 경합(다른 어드민이 동시에 누름)이 나면 트랜잭션이 실패해 둘 중 하나만 나간다.
      await db().runTransaction(async (tx) => {
        const fresh = await Promise.all(targets.map((x) => tx.get(db().collection("payments").doc(x.id))));
        fresh.forEach((d) => {
          const x = d.data() || {};
          if (s(x.payoutId)) {
            const e = new Error("이미 지급 처리 중인 결제가 있습니다. 새로고침 후 다시 시도해 주세요.");
            e.code = "payout_conflict";
            throw e;
          }
        });
        tx.set(payoutRef, {
          refPayoutId, venueId, ownerUid: s(seller.ownerUid), sellerId: s(seller.sellerId),
          amount, scheduleType: payoutDate ? "SCHEDULED" : "EXPRESS", payoutDate,
          status: "PENDING_REQUEST", // 토스에 보내기 직전. 응답을 받으면 REQUESTED 로 바뀐다.
          paymentIds: targets.map((x) => x.id),
          requestedBy: t.uid,
          requestedAt: new Date().toISOString(),
          error: "",
        });
        fresh.forEach((d) => tx.update(d.ref, { payoutId: refPayoutId, payoutStatus: "PENDING_REQUEST" }));
      });

      // ── 토스 요청. 멱등키로 재시도 시 중복 지급을 막는다.
      try {
        const items = await requestPayouts([{
          refPayoutId,
          sellerId: s(seller.sellerId),
          amount,
          payoutDate,
          description: "정산금",
          metadata: { venueId, count: String(targets.length) },
        }], `hm-payout-${refPayoutId}`);
        const out = items[0] || {};
        await payoutRef.set({
          payoutId: s(out.id),
          status: s(out.status) || "REQUESTED",
          tossRequestedAt: s(out.requestedAt),
        }, { merge: true });
        res.json({ ok: true, refPayoutId, payoutId: s(out.id), status: s(out.status), amount, count: targets.length });
      } catch (e) {
        // 요청이 실패했으면 선점을 풀어준다 — 안 풀면 그 결제건들이 영영 지급 대상에서 빠진다.
        const batch = db().batch();
        targets.forEach((x) => batch.update(db().collection("payments").doc(x.id), { payoutId: "", payoutStatus: "" }));
        batch.set(payoutRef, { status: "FAILED", error: s(e?.message), failedAt: new Date().toISOString() }, { merge: true });
        await batch.commit();
        throw e;
      }
    } catch (e) {
      console.error("[payouts] requestVenuePayout failed", e?.message || e);
      const code = s(e?.code);
      res.status(code === "payout_conflict" ? 409 : 400).json({ error: s(e?.message) || "payout_failed", code });
    }
  }
);

/* ============================================================
 * 5) 지급 취소 — 예약 지급(REQUESTED)만 가능. 선점도 함께 풀어야 다시 지급 대상이 된다.
 * ========================================================== */
exports.cancelVenuePayout = onRequest(
  { region: REGION, cors: true, secrets: PAYOUT_SECRETS },
  async (req, res) => {
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });
    if (!payoutsEnabled()) return void res.status(503).json({ error: "payouts_disabled" });
    const t = await requireAdmin(req, res);
    if (!t) return;

    const refPayoutId = s(req.body?.refPayoutId);
    try {
      const ref = db().collection("payouts").doc(refPayoutId);
      const snap = await ref.get();
      if (!snap.exists) return void res.status(404).json({ error: "payout_not_found" });
      const p = snap.data() || {};
      if (s(p.status) !== "REQUESTED") {
        return void res.status(400).json({ error: "not_cancellable", status: s(p.status) });
      }
      await cancelPayout(s(p.payoutId), `hm-payout-cancel-${refPayoutId}`);
      await applyPayoutStatus(refPayoutId, "CANCELED", "");
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: s(e?.message) || "cancel_failed" });
    }
  }
);

/**
 * 지급 상태를 원장에 반영한다. 웹훅과 수동 취소가 같은 함수를 쓰게 해서
 * "어디서 바꿨느냐에 따라 장부가 달라지는" 일을 막는다.
 *
 * COMPLETED → payments.settled=true (정산 화면의 "지급 완료"가 이 값을 본다)
 * FAILED/CANCELED → 선점 해제. 다시 지급 대상이 되어야 돈이 묶이지 않는다.
 */
async function applyPayoutStatus(refPayoutId, status, errorMessage) {
  const ref = db().collection("payouts").doc(s(refPayoutId));
  const snap = await ref.get();
  if (!snap.exists) return false;
  const p = snap.data() || {};
  const ids = Array.isArray(p.paymentIds) ? p.paymentIds : [];

  const batch = db().batch();
  batch.set(ref, {
    status: s(status),
    error: s(errorMessage),
    ...(status === "COMPLETED" ? { completedAt: new Date().toISOString() } : {}),
  }, { merge: true });

  ids.forEach((id) => {
    const pref = db().collection("payments").doc(s(id));
    if (status === "COMPLETED") {
      batch.update(pref, { payoutStatus: "COMPLETED", settled: true, settledAt: new Date().toISOString() });
    } else if (status === "FAILED" || status === "CANCELED") {
      batch.update(pref, { payoutId: "", payoutStatus: "" });
    } else {
      batch.update(pref, { payoutStatus: s(status) });
    }
  });
  await batch.commit();
  return true;
}

/* ============================================================
 * 6) 웹훅 — seller.changed / payout.changed
 *    지급의 **최종** 성공·실패는 요청 응답이 아니라 이 웹훅으로 온다.
 *    토스 개발자센터 > 웹훅에 이 함수 URL 을 등록해야 발송이 시작된다.
 * ========================================================== */
exports.payoutsWebhook = onRequest(
  { region: REGION, cors: false, secrets: PAYOUT_SECRETS },
  async (req, res) => {
    // 웹훅은 무조건 200 으로 받는다 — 4xx/5xx 를 주면 토스가 재시도를 반복한다.
    try {
      const body = req.body || {};
      const type = s(body.eventType || body.type);
      const data = body.data || body.entityBody || {};

      if (type.startsWith("seller")) {
        const sellerId = s(data.id);
        if (sellerId) {
          const q = await db().collection("payoutSellers").where("sellerId", "==", sellerId).limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.set({ status: s(data.status), updatedAt: new Date().toISOString() }, { merge: true });
          }
        }
      } else if (type.startsWith("payout")) {
        const refPayoutId = s(data.refPayoutId);
        if (refPayoutId) {
          await applyPayoutStatus(refPayoutId, s(data.status), s(data.error?.message));
        }
      }
    } catch (e) {
      console.error("[payouts] webhook failed", e?.message || e);
    }
    res.status(200).send("OK");
  }
);

module.exports.applyPayoutStatus = applyPayoutStatus;
module.exports.refSellerIdOf = refSellerIdOf;
module.exports.refPayoutIdOf = refPayoutIdOf;
