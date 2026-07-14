// src/constants/payments.js
// 결제(PG) 개시 여부 스위치.
//
// 현재 할래말래는 "현장 정산(무결제 예약중개)" 모델로 운영한다. 회사가 대금을
// 수납하지 않으므로 정산·환불 기능이 성립하지 않는다. PG(카드결제)를 실제로 붙이는
// 시점에 이 값을 true 로 바꾸면 관리자 결제 정산/환불 메뉴·화면이 활성화된다.
//
// 연동 지점:
//  - src/utils/menus.js            : 관리자 사이드바에서 정산/환불 메뉴 노출 제어
//  - src/pages/admin/AdminSettlementsPage.jsx : PG 개시 전 안내 화면
//  - src/pages/admin/AdminRefundsPage.jsx      : PG 개시 전 안내 화면
export const PG_ENABLED = false;
