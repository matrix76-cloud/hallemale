/* eslint-disable */
// src/pages/owner/components/VenueMapPicker.jsx
// 지도 중심에 핀을 고정하고 지도를 움직여 위치를 지정 → 중심 좌표를 역지오코딩해 주소 자동 반영.
// onChange({ lat, lng, address, region }) 로 상위에 전달.
import React, { useEffect, useRef } from "react";
import styled from "styled-components";

const SEOUL = { lat: 37.5665, lng: 126.9780 };
const isValid = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  !(Number(lat) === 0 && Number(lng) === 0);

export default function VenueMapPicker({ value, onChange, height = 230 }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const suppressRef = useRef(false); // 프로그램적 setCenter가 부른 idle의 역지오코딩 억제
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const reverseGeocode = (lat, lng) => {
    const kakao = window.kakao;
    const g = geocoderRef.current;
    if (!g) { onChangeRef.current && onChangeRef.current({ lat, lng, address: "", region: "" }); return; }
    g.coord2Address(lng, lat, (result, status) => {
      let address = "", region = "";
      if (status === kakao.maps.services.Status.OK && result && result[0]) {
        const r = result[0];
        address = (r.road_address && r.road_address.address_name) || (r.address && r.address.address_name) || "";
        const a = r.address || {};
        region = [a.region_1depth_name, a.region_2depth_name].filter(Boolean).join(" ");
      }
      onChangeRef.current && onChangeRef.current({ lat, lng, address, region });
    });
  };

  // 초기화 (1회). ⚠️ SDK는 defer/autoload=false로 로드돼 콜드스타트 시 이 컴포넌트 마운트가
  //   스크립트 실행보다 앞설 수 있음 → window.kakao 준비될 때까지 폴링(최대 ~10초)해 지도가
  //   영영 안 뜨는(=위치 단계 영구정지) 문제 방지.
  useEffect(() => {
    let cancelled = false;
    let rafId = null;

    const run = () => {
      const kakao = window.kakao;
      if (cancelled || !hostRef.current || !kakao || !kakao.maps) return;
      if (hostRef.current.offsetWidth === 0) { rafId = requestAnimationFrame(run); return; }
      if (mapRef.current) return;

      const start = isValid(value?.lat, value?.lng)
        ? { lat: Number(value.lat), lng: Number(value.lng) }
        : SEOUL;
      const center = new kakao.maps.LatLng(start.lat, start.lng);
      const map = new kakao.maps.Map(hostRef.current, { center, level: 3 });
      geocoderRef.current = new kakao.maps.services.Geocoder();
      mapRef.current = map;

      let first = true;
      kakao.maps.event.addListener(map, "idle", () => {
        if (suppressRef.current) { suppressRef.current = false; return; }
        // 편집 진입(이미 주소 있음) 첫 idle은 덮어쓰지 않음
        if (first) { first = false; if (value?.address) return; }
        const c = map.getCenter();
        reverseGeocode(c.getLat(), c.getLng());
      });

      setTimeout(() => { try { map.relayout(); map.setCenter(center); } catch (e) {} }, 0);
    };

    let tries = 0;
    const boot = () => {
      if (cancelled) return;
      const kakao = window.kakao;
      if (kakao && kakao.maps) {
        if (typeof kakao.maps.load === "function") kakao.maps.load(() => { if (!cancelled) run(); });
        else run();
        return;
      }
      if (tries++ < 100) setTimeout(boot, 100); // SDK 로드 대기 (최대 10초)
    };
    boot();
    return () => { cancelled = true; if (rafId) cancelAnimationFrame(rafId); };
  }, []); // eslint-disable-line

  // 외부에서 좌표가 주어지면(편집 프리필 등) 지도 이동 — idle 역지오코딩은 억제
  useEffect(() => {
    const kakao = window.kakao;
    if (!kakao || !kakao.maps || !mapRef.current) return;
    if (!isValid(value?.lat, value?.lng)) return;
    const cur = mapRef.current.getCenter();
    if (Math.abs(cur.getLat() - Number(value.lat)) < 1e-6 && Math.abs(cur.getLng() - Number(value.lng)) < 1e-6) return;
    suppressRef.current = true;
    mapRef.current.setCenter(new kakao.maps.LatLng(Number(value.lat), Number(value.lng)));
  }, [value?.lat, value?.lng]);

  return (
    <Wrap style={{ height }}>
      <Host ref={hostRef} />
      <CenterPin aria-hidden>📍</CenterPin>
      <Hint>지도를 움직여 구장 위치에 핀을 맞춰주세요</Hint>
    </Wrap>
  );
}

const Wrap = styled.div`
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #e5e7eb;
`;
const Host = styled.div`width: 100%; height: 100%;`;
const CenterPin = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -100%);
  font-size: 30px;
  line-height: 1;
  pointer-events: none;
  z-index: 5;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));
`;
const Hint = styled.div`
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.82);
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
`;
