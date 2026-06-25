/* eslint-disable */
// src/services/fizzService.js
// 피지(가짜 결제 포인트) 지갑 — 실제 피지/결제 시스템 전 임시 시뮬레이션.
// users/{uid}.fizzBalance (number)
//
// - getFizzBalance: 잔액 조회
// - chargeFizz: 가짜 충전 (즉시 반영)
// - payFizz: 결제 차감 (트랜잭션, 잔액 부족 시 에러)

import { db } from "./firebase";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** 잔액 조회 */
export async function getFizzBalance(uid) {
  const u = String(uid || "").trim();
  if (!u) return 0;
  const snap = await getDoc(doc(db, "users", u));
  if (!snap.exists()) return 0;
  return n(snap.data()?.fizzBalance);
}

/** 가짜 충전 — 즉시 잔액 증가 */
export async function chargeFizz(uid, amount) {
  const u = String(uid || "").trim();
  const amt = n(amount);
  if (!u) throw new Error("로그인이 필요합니다.");
  if (amt <= 0) throw new Error("충전 금액이 올바르지 않습니다.");

  const ref = doc(db, "users", u);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = n(snap.exists() ? snap.data()?.fizzBalance : 0);
    const after = cur + amt;
    tx.set(ref, { fizzBalance: after, fizzUpdatedAt: serverTimestamp() }, { merge: true });
    return after;
  });
  return next;
}

/** 결제 차감 — 잔액 부족 시 에러 */
export async function payFizz(uid, amount) {
  const u = String(uid || "").trim();
  const amt = n(amount);
  if (!u) throw new Error("로그인이 필요합니다.");
  if (amt < 0) throw new Error("결제 금액이 올바르지 않습니다.");

  const ref = doc(db, "users", u);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = n(snap.exists() ? snap.data()?.fizzBalance : 0);
    if (cur < amt) {
      const err = new Error("잔액이 부족합니다.");
      err.code = "insufficient_fizz";
      err.balance = cur;
      throw err;
    }
    const after = cur - amt;
    tx.set(ref, { fizzBalance: after, fizzUpdatedAt: serverTimestamp() }, { merge: true });
    return after;
  });
  return next;
}
