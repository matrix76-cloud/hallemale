/* eslint-disable */
// src/pages/owner/components/VenueLocationPicker.jsx
// 구장 위치를 카카오 지도에 핀으로 표시하고, 드래그/탭으로 정확한 위치를 조정하는 픽커.
// 주소 지오코딩 좌표(lat/lng)가 부정확할 수 있어 오너가 직접 미세조정 → onChange로 반영.
import React, { useEffect, useRef } from "react";
import styled from "styled-components";

const isValid = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  !(Number(lat) === 0 && Number(lng) === 0);

export default function VenueLocationPicker({ lat, lng, onChange, height = 200 }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const kakao = window.kakao;
    if (!kakao || !kakao.maps || !isValid(lat, lng)) return;
    let cancelled = false;

    const run = () => {
      if (cancelled || !hostRef.current) return;
      if (hostRef.current.offsetWidth === 0) {
        requestAnimationFrame(run);
        return;
      }
      const pos = new kakao.maps.LatLng(Number(lat), Number(lng));
      if (!mapRef.current) {
        const map = new kakao.maps.Map(hostRef.current, { center: pos, level: 3 });
        const marker = new kakao.maps.Marker({ position: pos, draggable: true });
        marker.setMap(map);
        const emit = (p) => onChangeRef.current && onChangeRef.current({ lat: p.getLat(), lng: p.getLng() });
        kakao.maps.event.addListener(marker, "dragend", () => emit(marker.getPosition()));
        kakao.maps.event.addListener(map, "click", (e) => {
          marker.setPosition(e.latLng);
          emit(e.latLng);
        });
        mapRef.current = map;
        markerRef.current = marker;
        // 레이아웃 확정 후 재정렬(탭 전환·시트 등에서 타일 깨짐 방지)
        setTimeout(() => { try { map.relayout(); map.setCenter(pos); } catch (e) {} }, 0);
      } else {
        // 외부에서 좌표 변경(주소 재검색 등) → 마커 이동 + 지도 이동
        markerRef.current.setPosition(pos);
        mapRef.current.setCenter(pos);
      }
    };

    if (typeof kakao.maps.load === "function") kakao.maps.load(() => { if (!cancelled) run(); });
    else run();

    return () => { cancelled = true; };
  }, [lat, lng]);

  if (!isValid(lat, lng)) return null;
  return <Host ref={hostRef} style={{ height }} />;
}

const Host = styled.div`
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #e5e7eb;
`;
