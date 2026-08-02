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
import { hasMock, mockData } from "../dev/mockBus";

const CF_BASE = "https://asia-northeast3-halle-bf789.cloudfunctions.net";
const SDK_URL = "https://js.tosspayments.com/v2/standard";

export const TOSS_CLIENT_KEY =
  process.env.REACT_APP_TOSS_CLIENT_KEY || "test_gck_oEjb0gm23PjwBOwXlXBnrpGwBJn5";

/** 테스트 키로 동작 중인지 — 화면에 "테스트 결제" 배지를 띄우는 용도 */
export const IS_TEST_PAYMENT = TOSS_CLIENT_KEY.startsWith("test_");

let sdkPromise = null;

/**
 * uid → 토스 customerKey.
 * 토스 규칙: 영문 대소문자·숫자·`- _ = . @` 만, 2~50자. 어기면 widgets() 가 예외를 던져
 * 결제 화면이 아예 안 뜬다.
 * ⚠️ 카카오 로그인 uid 는 "kakao:4941828861" 처럼 콜론이 들어간다 — 그대로 넘기면
 *    카카오로 가입한 사용자 전원이 결제를 못 한다. 허용 문자만 남기고 나머지는 "_" 로 바꾼다
 *    (uid 와 1:1 이라 사용자별로 계속 같은 값이 나온다 — 토스가 이 키로 결제수단을 기억한다).
 */
export function toCustomerKey(uid) {
  const k = String(uid || "").replace(/[^A-Za-z0-9\-_=.@]/g, "_").slice(0, 50);
  return k.length >= 2 ? k : "ANONYMOUS";
}

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
  test_skip_not_allowed: "결제 건너뛰기는 테스트 환경에서만 쓸 수 있어요.",
};

/**
 * 결제 주문 생성 — 서버가 낼 금액을 확정한다.
 * @returns {{orderId:string, amount:number, orderName:string, side:"A"|"B"|"SINGLE"}}
 */
export function createOrder(reservationId) {
  // 리뷰 보드 목업 — 서버 호출(로그인 필요)을 건너뛰고 고정 주문을 돌려준다.
  // 위젯 자체는 실제 토스 SDK 로 그려지므로 결제수단 UI 를 그대로 확인할 수 있다.
  if (hasMock("tossOrder")) return Promise.resolve(mockData("tossOrder"));
  return authedPost("createTossOrder", { reservationId });
}

/**
 * 결제 승인 — 결제창 성공 리다이렉트 후 호출. 여기서 실제로 돈이 빠진다.
 * @param {boolean} [p.testSkip] 결제창을 건너뛴 테스트 승인. 서버가 토스 승인만 생략하고
 *   예약 확정·원장 기록은 그대로 한다. 시크릿 키가 test_ 일 때만 서버가 받아준다.
 */
export function confirmPayment({ paymentKey, orderId, amount, testSkip }) {
  // 리뷰 보드 목업 — 실제 승인(돈이 빠지는 호출)을 하지 않고 성공 응답만 흉내낸다.
  // 응답 형태는 서버(confirmTossPayment) 와 같게 유지할 것 — 완료 화면이 reservationStatus 로
  // "확정" 과 "상대 팀 결제 대기" 를 가른다.
  if (hasMock("tossOrder")) {
    const o = mockData("tossOrder");
    return Promise.resolve({
      ok: true,
      orderId: orderId || o.orderId,
      amount: amount || o.amount,
      reservationId: "mock_reservation",
      reservationStatus: o.reservationStatus || "confirmed",
      matchId: o.matchId || "",
      approvedAt: "2026-07-28T19:00:00+09:00",
    });
  }
  return authedPost("confirmTossPayment", { paymentKey, orderId, amount, testSkip: !!testSkip });
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
  // customerKey: 회원 식별자. 비회원 결제가 아니므로 uid 기반.
  const widgets = toss.widgets({ customerKey: toCustomerKey(auth.currentUser?.uid) });

  // ⚠️ setAmount 가 renderPaymentMethods 보다 먼저여야 한다(토스 요구사항).
  await widgets.setAmount({ value: amount, currency: "KRW" });
  await Promise.all([
    widgets.renderPaymentMethods({ selector }),
    widgets.renderAgreement({ selector: agreementSelector }),
  ]);
  return widgets;
}
