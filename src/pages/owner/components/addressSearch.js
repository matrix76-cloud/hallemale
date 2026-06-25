/* eslint-disable */
// src/pages/owner/components/addressSearch.js
// 다음(카카오) 주소검색 팝업 + 좌표 지오코딩.
// index.html 에 postcode.v2.js / kakao maps sdk(services) 가 이미 로드돼 있음.

export function openDaumPostcode(onComplete) {
  const daum = window.daum;
  if (!daum || !daum.Postcode) {
    window.alert("주소 검색 스크립트가 아직 로드되지 않았어요. 잠시 후 다시 시도해주세요.");
    return;
  }
  new daum.Postcode({
    oncomplete: (data) => {
      const address = data.roadAddress || data.jibunAddress || "";
      const region = [data.sido, data.sigungu].filter(Boolean).join(" ");

      // 좌표 지오코딩 (실패해도 주소는 채움)
      const kakao = window.kakao;
      const finish = (lat, lng) => onComplete && onComplete({ address, region, lat, lng });

      if (address && kakao && kakao.maps && kakao.maps.services) {
        try {
          const geocoder = new kakao.maps.services.Geocoder();
          geocoder.addressSearch(address, (result, status) => {
            if (status === kakao.maps.services.Status.OK && result && result[0]) {
              finish(Number(result[0].y), Number(result[0].x));
            } else {
              finish(null, null);
            }
          });
        } catch (e) {
          finish(null, null);
        }
      } else {
        finish(null, null);
      }
    },
  }).open();
}
