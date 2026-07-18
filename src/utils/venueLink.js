// src/utils/venueLink.js
// 구장 위치 관련 공통 액션 — 길찾기 / 지도보기 / 주소복사 / 전화.
// 예약 카드(MyReservationsPage) · 매치 티켓(MatchRoomDetailPage) · 구장 상세(VenueBookingPage)가
// 각자 인라인으로 갖고 있던 카카오맵 링크·클립보드 코드를 한곳으로 모은 것.
// 지도는 앱 전역이 카카오(VenueMiniMap = kakao.maps.StaticMap)라 카카오맵 링크로 통일한다.

const toStr = (v) => String(v || "").trim();

const hasLatLng = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  !(Number(lat) === 0 && Number(lng) === 0);

/** 표시용 전체 주소 — "주소 상세주소" */
export function fullAddress(address, addressDetail) {
  return `${toStr(address)}${toStr(addressDetail) ? ` ${toStr(addressDetail)}` : ""}`.trim();
}

/** 전화 링크 href — 번호 없으면 null (호출부에서 버튼 자체를 숨기라는 뜻) */
export function telHref(phone) {
  const p = toStr(phone);
  return p ? `tel:${p}` : null;
}

/**
 * 카카오맵 길찾기(도착지 = 구장).
 * 좌표가 있으면 정확한 지점으로, 없으면 이름/주소 검색으로 폴백.
 */
export function openDirections({ name, address, lat, lng } = {}) {
  const label = encodeURIComponent(toStr(name) || toStr(address) || "구장");
  const url = hasLatLng(lat, lng)
    ? `https://map.kakao.com/link/to/${label},${Number(lat)},${Number(lng)}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(toStr(address) || toStr(name) || "구장")}`;
  window.open(url, "_blank", "noopener");
}

/** 카카오맵에서 위치 보기 (길찾기 아님 — 주변 파악용) */
export function openMapView({ name, address, lat, lng } = {}) {
  const label = encodeURIComponent(toStr(name) || toStr(address) || "구장");
  const url = hasLatLng(lat, lng)
    ? `https://map.kakao.com/link/map/${label},${Number(lat)},${Number(lng)}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(toStr(address) || toStr(name) || "구장")}`;
  window.open(url, "_blank", "noopener");
}

/**
 * 클립보드 복사. 성공 여부를 boolean 으로 돌려주고 예외를 던지지 않는다.
 * (호출부는 결과로 토스트 문구만 고르면 됨)
 */
export async function copyText(text) {
  const s = toStr(text);
  if (!s) return false;
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    return false;
  }
}
