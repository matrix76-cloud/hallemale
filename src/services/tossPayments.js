/* eslint-disable */
// src/services/tossPayments.js
// 토스페이먼츠 결제위젯(v2) 클라이언트 래퍼.
// 서버: functions/payments/toss.js (createTossOrder / confirmTossPayment)
//
// 금액은 클라가 정하지 않는다. 서버가 예약 문서(shareA/shareB/price)에서 계산해 주문을 만들고,
// 위젯에는 그 금액만 그려준다. 승인 때 서버가 한 번 더 대조하므로 조작해도 통과 못 한다.
//
// 키: 결제위젯 클라이언트 키(gck)는 프론트에 노출되는 공개 값이라 코드에 둬도 된다.
//     실서비스 전환 시 REACT_APP_TOSS_CLIENT_KEY 만 live_gck_… 로 바꾸면 된다.

import { auth } from "./firebase";

const CF_BASE = "https://asia-northeast3-halle-bf789.cloudfunctions.net";
const SDK_URL = "https://js.tosspayments.com/v2/standard";

export const TOSS_CLIENT_KEY =
  process.env.REACT_APP_TOSS_CLIENT_KEY || "test_gck_oEjb0gm23PjwBOwXlXBnrpGwBJn5";

/** 테스트 키로 동작 중인지 — 화면에 "테스트 결제" 배지를 띄우는 용도 */
export const IS_TEST_PAYMENT = TOSS_CLIENT_KEY.startsWith("test_");

let sdkPromise = null;

/** 토스 SDK 로드 (script 태그, 1회만) */
function loadTossSdk() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SDK_URL;
    el.onload = () =>
      window.TossPayments
        ? resolve(window.TossPayments)
        : reject(new Error("결제 모듈을 불러오지 못했어요."));
    el.onerror = () => {
      sdkPromise = null; // 네트워크 실패 시 재시도 가능하게
      reject(new Error("결제 모듈을 불러오지 못했어요."));
    };
    document.head.appendChild(el);
  });
  return sdkPromise;
}

async function authedPost(path, body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const res = await fetch(`${CF_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || ERROR_TEXT[data?.error] || "결제 처리에 실패했어요.");
    err.code = data?.error;
    err.data = data;
    throw err;
  }
  return data;
}

// 서버 에러코드 → 사용자에게 보여줄 문구
const ERROR_TEXT = {
  reservation_not_found: "예약을 찾을 수 없어요.",
  reservation_closed: "이미 종료된 예약이에요.",
  not_a_payer: "이 예약의 결제 대상이 아니에요.",
  already_paid: "이미 결제가 완료됐어요.",
  payment_expired: "결제 시간이 지났어요. 다시 예약해 주세요.",
  amount_mismatch: "결제 금액이 맞지 않아요. 처음부터 다시 시도해 주세요.",
  order_not_payable: "이미 처리된 결제예요.",
};

/**
 * 결제 주문 생성 — 서버가 낼 금액을 확정한다.
 * @returns {{orderId:string, amount:number, orderName:string, side:"A"|"B"|"SINGLE"}}
 */
export function createOrder(reservationId) {
  return authedPost("createTossOrder", { reservationId });
}

/** 결제 승인 — 결제창 성공 리다이렉트 후 호출. 여기서 실제로 돈이 빠진다. */
export function confirmPayment({ paymentKey, orderId, amount }) {
  return authedPost("confirmTossPayment", { paymentKey, orderId, amount });
}

/**
 * 결제위젯을 그린다.
 * @param {object} p
 * @param {string} p.selector   - 결제수단 위젯을 붙일 요소 선택자
 * @param {string} p.agreementSelector - 약관 위젯을 붙일 요소 선택자
 * @param {number} p.amount
 * @returns {Promise<object>} widgets 인스턴스 (requestPayment 호출용)
 */
export async function renderWidget({ selector, agreementSelector, amount }) {
  const TossPayments = await loadTossSdk();
  const toss = TossPayments(TOSS_CLIENT_KEY);
  // customerKey: 회원 식별자. 비회원 결제가 아니므로 uid 사용.
  const widgets = toss.widgets({ customerKey: auth.currentUser?.uid || "ANONYMOUS" });

  // ⚠️ setAmount 가 renderPaymentMethods 보다 먼저여야 한다(토스 요구사항).
  await widgets.setAmount({ value: amount, currency: "KRW" });
  await Promise.all([
    widgets.renderPaymentMethods({ selector }),
    widgets.renderAgreement({ selector: agreementSelector }),
  ]);
  return widgets;
}
