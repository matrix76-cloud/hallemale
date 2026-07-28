// src/constants/payments.js
// 결제(PG) 개시 여부 스위치.
//
// 방향은 "현장정산 폐지, 전면 앱내 결제(토스페이먼츠)"다. 다만 라이브 키가 나오기 전에 켜면
// 결제가 불가능한 상태로 예약 흐름이 막히므로, 라이브 키 발급 + 실결제 검증이 끝나는 날 켠다.
//
// ON  → 구장주 승인 시 status="pending"(결제대기) → 결제 완료돼야 confirmed.
//       매칭 제휴구장은 양 팀장이 각자 몫(shareA/shareB)을 결제해야 확정.
// OFF → 기존 현장정산 흐름 (승인 즉시 confirmed). 관리자 정산/환불 메뉴도 숨김.
//
// 연동 지점:
//  - src/services/ownerVenueService.js : 승인 시 pending(결제대기) 전환 · 예약 생성 결제수단
//  - src/utils/menus.js                : 관리자 사이드바에서 정산/환불 메뉴 노출 제어
//  - src/pages/admin/AdminSettlementsPage.jsx : PG 개시 전 안내 화면
//  - src/pages/admin/AdminRefundsPage.jsx      : PG 개시 전 안내 화면
//  - 서버측 결제 로직은 functions/payments/toss.js (이 스위치와 무관하게 항상 동작 가능)
// 기본값 false(현장정산). 빌드할 때 REACT_APP_PG_ENABLED=1 을 주면 켜진다 —
// 실서비스는 그대로 두고 미리보기 채널에서만 결제를 켜서 검증하기 위함.
export const PG_ENABLED = process.env.REACT_APP_PG_ENABLED === "1";

// 승인 후 결제 마감까지 주는 시간.
// ⚠️ functions/payments/toss.js 의 PARTNER_PAY_WINDOW_MS 와 같은 값을 유지할 것.
export const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000;
