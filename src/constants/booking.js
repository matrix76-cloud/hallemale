// src/constants/booking.js
// 구장 예약 가능 기간 — 오늘 포함 21일(3주).
// 날짜 스트립(VenueBookingPage/CourtBookingPage) · 예약 생성 가드(ownerVenueService) ·
// firestore.rules(venueReservations) 가 모두 이 값을 기준으로 한다. 바꿀 땐 rules 의
// BOOKING_WINDOW_DAYS 주석도 함께 맞출 것.
// 예외: 구장주 수동·정기대관(createOwnerReservation)은 이 창구를 적용하지 않는다.
export const BOOKING_WINDOW_DAYS = 21;

// "YYYY-MM-DD" — 오늘(로컬) 기준 n일 뒤
function ymdAfter(days) {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** date("YYYY-MM-DD") 가 예약 가능 기간(오늘 ~ 오늘+20일) 안인지 */
export function isBookableDate(date) {
  const d = String(date || "");
  return d >= ymdAfter(0) && d <= ymdAfter(BOOKING_WINDOW_DAYS - 1);
}
