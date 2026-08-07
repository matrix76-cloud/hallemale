// src/constants/payments.js
// 결제 정책 상수. 현장정산은 폐지됐고 앱내 결제(토스페이먼츠)가 유일한 경로다.
//
// 흐름: 예약 요청 → 구장주 승인 → status="pending"(결제대기, 2시간) → 결제 완료 → confirmed.
//       매칭 제휴구장은 양 팀장이 각자 몫(shareA/shareB)을 결제해야 확정된다.
//       2시간 안에 결제가 없으면 서버 잡이 자동취소하고 슬롯을 반납한다.
//
// ⚠️ 실서비스 배포 전 반드시 확인: 토스 클라이언트 키가 test_gck_ 이면 카드가 실제로
//    청구되지 않는데도 예약은 확정된다(= 무료 예약). 라이브 키(live_gck_)를
//    REACT_APP_TOSS_CLIENT_KEY 로 넣고 시크릿(TOSS_SECRET_KEY)도 라이브로 올린 뒤 배포할 것.
//    현재 키가 테스트인지는 services/tossPayments.js 의 IS_TEST_PAYMENT 로 알 수 있고,
//    결제 화면에 "테스트 결제" 배지가 뜬다.

/* ── 결제 진입 차단 (토스 PG 가맹 심사 대기) ──────────────────
 * 심사가 끝나기 전까지 라이브 키가 없다. 테스트 키로 결제 화면을 열어두면 위 경고 그대로
 * 카드가 청구되지 않는데도 예약이 confirmed 로 넘어간다(= 무료 예약). 결제창을 아예 건너뛰는
 * "결제 건너뛰기(테스트)" 버튼까지 노출되므로, 심사가 끝날 때까지 결제 진입 자체를 닫고
 * 개발 서버(npm start)에서만 연다.
 *
 * NODE_ENV 로 가르는 이유: 프로덕션 빌드에서 이 값이 false 로 고정돼 진입 분기가 죽는다.
 * 런타임 호스트명 검사와 달리 배포본에서 조건을 뒤집을 방법이 없다.
 *
 * 심사 통과 후 여는 법:
 *   1) REACT_APP_TOSS_CLIENT_KEY=live_gck_… / TOSS_SECRET_KEY=live_gsk_… 로 교체
 *   2) 이 상수를 true 로 고정(또는 이 블록 제거)
 *   3) functions/payments/toss.js 의 LOCAL_ONLY 게이트도 함께 해제
 */
export const PAYMENTS_ENABLED = process.env.NODE_ENV !== "production";

/** 결제 진입이 막혀 있을 때 결제 버튼 자리에 대신 넣는 안내. */
export const PAYMENTS_DISABLED_NOTICE =
  "결제 기능을 준비하고 있어요. 준비되면 다시 안내드릴게요.";

// 승인 후 결제 마감까지 주는 시간.
// ⚠️ functions/payments/toss.js 의 PARTNER_PAY_WINDOW_MS 와 같은 값을 유지할 것.
export const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000;

/* ── 수수료 정책 ─────────────────────────────────────────────
 * 총액 표시(구장 부담) 모델. 2026-08-02 전환 — 그 전에는 "구장주 0% + 사용자에게 5% 가산"이었다.
 *
 * 구장주가 등록하는 금액 = 손님이 결제할 금액 = 앱에 그대로 뜨는 금액.
 * 플랫폼은 그 결제액에서 요율만큼 떼고 나머지를 구장주에게 정산한다.
 *   구장 등록가 30,000원 → 손님 결제 30,000원 → 이용료 1,500원 → 구장 정산 28,500원
 *
 * 왜 바꿨나 (사용자 가산 → 구장 부담):
 *  · 회사 몫은 사실상 같다(가산 모델 586원 vs 이 모델 630원, PG 2.9% 차감 후).
 *    바뀌는 건 "소비자가 보는 숫자"뿐인데, 가산 모델은 30,000원 구장을 31,500원으로
 *    표시하게 만들어 목록·지도의 가격표가 전부 깨졌다.
 *  · 조례로 요금이 묶인 학교·공공 구장은 정산액이 깎이면 안 되는데, 이 모델에서는
 *    그들이 등록가를 올려 잡으면 된다(31,600원 등록 → 30,020원 정산). 플랫폼이
 *    강제하지 않으므로 운영 주체별 예외 분기가 필요 없다.
 *  · 표시가 = 결제액이라 전자상거래법 "순차공개 가격책정"(다크패턴) 논점 자체가 사라진다.
 *
 * ⚠️ PG 수수료를 사용자에게 "별도 항목"으로 전가하면 여신전문금융업법 제19조
 *    (카드 수수료 소비자 전가 금지) 위반이다. 어느 모델이든 PG(약 2.9%)는 회사가
 *    이 이용료 안에서 흡수하고, 화면에 PG 라는 단어를 쓰지 않는다.
 *
 * 요율 변경은 이 상수 하나만 바꾸면 된다. 단, 이미 만들어진 예약은
 * 생성 시점 요율(venueReservations.feeRate)로 계속 계산된다 — 예약할 때 본
 * 금액과 결제할 때 금액이 달라지지 않게 하기 위함.
 * 초기 입점 구장은 venues.feeRate = 0 으로 고정(그랜드파더링)할 수 있고,
 * 예약 생성 시 그 값이 우선한다.
 * ⚠️ functions/payments/toss.js 의 PLATFORM_FEE_RATE 와 같은 값을 유지할 것.
 */
export const PLATFORM_FEE_RATE = 0.05;

/** 화면 문구에 쓰는 요율 표기 ("5%"). 요율을 바꿔도 안내문이 같이 따라오게 한다. */
export const PLATFORM_FEE_LABEL = `${Math.round(PLATFORM_FEE_RATE * 100)}%`;

/** 결제 총액 → 플랫폼 이용료(원 단위 반올림). 총액에서 떼는 몫이다. */
export function calcPlatformFee(payTotal, rate = PLATFORM_FEE_RATE) {
  const v = Number(payTotal);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v * rate);
}

/** 결제 총액 → 구장주에게 정산될 금액 (총액 - 이용료) */
export function calcVenuePayout(payTotal, rate = PLATFORM_FEE_RATE) {
  const v = Number(payTotal);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v - calcPlatformFee(v, rate);
}

/* ── 소비자 화면 표시가 ────────────────────────────────────
 * 총액 표시 모델에서는 구장 등록가가 곧 결제액이라 가공하지 않는다.
 * 함수는 남겨 둔다 — 호출부(목록·지도·찜·코트 선택)가 "여기가 소비자 표시가"라는
 * 표식 역할을 하고, 요율 모델이 또 바뀌면 이 한 곳만 고치면 된다.
 */
export function calcDisplayPrice(payTotal) {
  const v = Number(payTotal);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v;
}

/** 표시가 옆에 붙이는 안내 문구. 총액 표시라 덧붙일 말이 없다(빈 문자열이면 호출부가 생략). */
export const DISPLAY_PRICE_NOTE = "";

/**
 * 구장주 요금 입력 옆에 붙이는 안내 —
 * "손님 결제 40,000원 → 정산 38,000원 (이용료 5%)"
 * 구장주가 입력하는 값이 "받을 돈"이 아니라 "손님이 낼 돈"이라는 걸 입력 시점에 못 박는다.
 * 이 안내가 없으면 등록가를 정산액으로 착각해 정산 시점에 분쟁이 난다.
 */
export function payoutHint(payTotal, rate = PLATFORM_FEE_RATE) {
  const v = Number(payTotal);
  if (!Number.isFinite(v) || v <= 0) return "";
  return `손님 결제 ${v.toLocaleString()}원 → 정산 ${calcVenuePayout(v, rate).toLocaleString()}원 (이용료 ${Math.round(rate * 100)}%)`;
}
