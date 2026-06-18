/* eslint-disable */
// src/components/matchRoom/VenueMiniMap.jsx
// 채팅 속 구장 카드에 들어갈 작은 정적 지도 미리보기.
// 상호작용이 필요 없으므로 kakao.maps.StaticMap(이미지 기반)을 사용 → 타일/relayout 이슈 없음.

import React, { useEffect, useRef } from "react";
import styled from "styled-components";

// {lat:0,lng:0}(바다)·NaN·null 등 무효 좌표 거르기
const isValidLatLng = (p) =>
  !!p &&
  Number.isFinite(Number(p.lat)) &&
  Number.isFinite(Number(p.lng)) &&
  !(Number(p.lat) === 0 && Number(p.lng) === 0);

export default function VenueMiniMap({ latLng, height = 120 }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const kakao = window.kakao;
    if (!kakao || !kakao.maps) return;
    if (!isValidLatLng(latLng)) return;

    let cancelled = false;

    const draw = () => {
      if (cancelled || !hostRef.current) return;
      if (hostRef.current.offsetWidth === 0) {
        requestAnimationFrame(draw);
        return;
      }
      hostRef.current.innerHTML = "";
      const center = new kakao.maps.LatLng(Number(latLng.lat), Number(latLng.lng));
      // StaticMap: 마커 1개 + 적당한 줌
      new kakao.maps.StaticMap(hostRef.current, {
        center,
        level: 4,
        marker: [{ position: center }],
      });
    };

    if (typeof kakao.maps.load === "function") {
      kakao.maps.load(() => {
        if (!cancelled) draw();
      });
    } else {
      draw();
    }

    return () => {
      cancelled = true;
      try {
        if (hostRef.current) hostRef.current.innerHTML = "";
      } catch (e) {}
    };
  }, [latLng && latLng.lat, latLng && latLng.lng]);

  if (!isValidLatLng(latLng)) return null;

  return <Host ref={hostRef} style={{ height }} />;
}

const Host = styled.div`
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: #e5e7eb;
`;
