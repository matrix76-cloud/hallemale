/* eslint-disable */
// src/services/tossPay.js
// 토스페이먼츠 결제창 연동 (테스트 모드).
// ⚠️ 현재는 프론트 전용 테스트: 결제창 성공 redirect 후 서버 승인(confirm) 검증 없이 예약을 확정함.
//    실서비스 전환 시 Cloud Function(confirmTossPayment)로 paymentKey/amount 승인 검증 필요.
import { loadTossPayments } from "@tosspayments/payment-sdk";

// 토스페이먼츠 공개 "테스트" 클라이언트 키 (문서용). 실서비스 시 .env의 REACT_APP_TOSS_CLIENT_KEY로 교체.
const TEST_CLIENT_KEY = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";
const CLIENT_KEY = process.env.REACT_APP_TOSS_CLIENT_KEY || TEST_CLIENT_KEY;

// 결제수단 UI 키 → 토스 SDK method 매핑.
// (테스트 단계에선 간편결제도 '카드' 결제창으로 처리 — 결제창 안에서 수단 선택 가능)
const METHOD_MAP = {
  card: "카드",
  kakao: "카드",
  naver: "카드",
  toss: "카드",
};

/**
 * 토스 결제창을 띄운다. 호출 시 페이지가 토스로 리다이렉트되고,
 * 성공 시 successUrl, 실패/취소 시 failUrl로 돌아온다.
 */
export async function requestTossPayment({ method, amount, orderId, orderName, customerName, successUrl, failUrl }) {
  const toss = await loadTossPayments(CLIENT_KEY);
  const tossMethod = METHOD_MAP[method] || "카드";
  await toss.requestPayment(tossMethod, {
    amount: Number(amount) || 0,
    orderId,
    orderName,
    customerName: customerName || "사용자",
    successUrl,
    failUrl,
  });
}
