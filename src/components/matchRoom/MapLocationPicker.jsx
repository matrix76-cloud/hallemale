/* eslint-disable */
// src/components/matchRoom/MapLocationPicker.jsx
// 카카오T식 "구장 위치 선택" 풀스크린 픽커.
// 시안(할래말래_직접입력.html · 직접1)을 그대로 옮긴 화면.
// 지도를 움직여 중앙 고정 핀으로 위치를 잡고, idle 시 좌표→주소 역지오코딩.

import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { mrp } from "./matchRoomPalette";

const SEOUL = { lat: 37.5665, lng: 126.978 };

// {lat:0,lng:0}(바다)·NaN·null 등 무효 좌표 거르기
const isValidLatLng = (p) =>
  !!p &&
  Number.isFinite(Number(p.lat)) &&
  Number.isFinite(Number(p.lng)) &&
  !(Number(p.lat) === 0 && Number(p.lng) === 0);

export default function MapLocationPicker({
  open,
  subtitle = "",
  initialLatLng = null,
  initialAddress = "",
  onClose,
  onConfirm,
}) {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const geocoderRef = useRef(null);
  const idleListenerRef = useRef(null);
  const resizeObsRef = useRef(null);

  const [pickName, setPickName] = useState("");
  const [pickAddr, setPickAddr] = useState("");
  const centerRef = useRef(isValidLatLng(initialLatLng) ? initialLatLng : SEOUL);

  // 좌표 → 주소 역지오코딩
  const reverseGeocode = (lat, lng) => {
    const kakao = window.kakao;
    if (!kakao || !kakao.maps || !kakao.maps.services) return;
    if (!geocoderRef.current) geocoderRef.current = new kakao.maps.services.Geocoder();
    geocoderRef.current.coord2Address(lng, lat, (result, status) => {
      if (status !== kakao.maps.services.Status.OK) return;
      const first = result && result[0] ? result[0] : null;
      if (!first) return;
      const road = first.road_address;
      const jibun = first.address;
      const building = road && road.building_name ? road.building_name : "";
      const roadName = road ? road.address_name : "";
      const jibunName = jibun ? jibun.address_name : "";
      setPickName(building || "지도에서 선택한 위치");
      setPickAddr(roadName || jibunName || "");
    });
  };

  // 지도 초기화 — maptest처럼 최소 구성. (relayout 루프·ResizeObserver 제거)
  useEffect(() => {
    if (!open) return;
    const kakao = window.kakao;
    if (!kakao || !kakao.maps) return;

    let cancelled = false;

    const create = () => {
      if (cancelled || !mapRef.current) return;

      // 컨테이너 크기가 0이면(오버레이가 펼쳐지는 중) 잡힐 때까지 대기.
      if (mapRef.current.offsetWidth === 0 || mapRef.current.offsetHeight === 0) {
        requestAnimationFrame(create);
        return;
      }

      // 유효한 좌표만 사용. {lat:0,lng:0}(바다)·NaN·null 은 무효 → 서울 폴백.
      const valid = isValidLatLng(initialLatLng);
      const start = valid ? initialLatLng : SEOUL;
      centerRef.current = start;
      mapRef.current.innerHTML = "";

      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(start.lat, start.lng),
        level: 4,
      });
      mapObjRef.current = map;

      // 지도가 멈출 때마다 중앙 좌표 → 주소
      const onIdle = () => {
        const c = map.getCenter();
        const lat = c.getLat();
        const lng = c.getLng();
        centerRef.current = { lat, lng };
        reverseGeocode(lat, lng);
      };
      idleListenerRef.current = onIdle;
      kakao.maps.event.addListener(map, "idle", onIdle);

      if (initialAddress) {
        setPickName("지도에서 선택한 위치");
        setPickAddr(initialAddress);
      }
      reverseGeocode(start.lat, start.lng);
      // (현재 위치 자동 이동 제거 — 위치 권한 알림창 안 뜨게)
    };

    if (typeof kakao.maps.load === "function") {
      kakao.maps.load(() => {
        if (!cancelled) create();
      });
    } else {
      create();
    }

    return () => {
      cancelled = true;
      try {
        const kakao = window.kakao;
        if (kakao && mapObjRef.current && idleListenerRef.current) {
          kakao.maps.event.removeListener(mapObjRef.current, "idle", idleListenerRef.current);
        }
      } catch (e) {}
      try {
        if (mapRef.current) mapRef.current.innerHTML = "";
      } catch (e) {}
      mapObjRef.current = null;
      idleListenerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 주소 검색 (건물명·도로명) → 지도 이동
  const openAddressSearch = () => {
    const daum = window.daum;
    const kakao = window.kakao;
    if (!daum || !daum.Postcode) {
      window.alert("주소 검색 스크립트가 아직 로드되지 않았습니다.");
      return;
    }
    new daum.Postcode({
      oncomplete: (data) => {
        const address = data.roadAddress || data.jibunAddress || "";
        if (!address) return;
        if (!kakao || !kakao.maps || !kakao.maps.services) return;
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(address, (result, status) => {
          if (status !== kakao.maps.services.Status.OK) return;
          const first = result && result[0] ? result[0] : null;
          if (!first) return;
          const lat = Number(first.y);
          const lng = Number(first.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          if (mapObjRef.current) {
            mapObjRef.current.setCenter(new kakao.maps.LatLng(lat, lng));
          }
          centerRef.current = { lat, lng };
        });
      },
    }).open();
  };

  // 내 위치로 이동
  const goMyLocation = () => {
    if (!navigator.geolocation) {
      window.alert("이 기기에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const kakao = window.kakao;
        if (mapObjRef.current && kakao) {
          mapObjRef.current.setCenter(new kakao.maps.LatLng(lat, lng));
        }
        centerRef.current = { lat, lng };
      },
      () => window.alert("위치 정보를 가져오지 못했습니다."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirm = () => {
    const c = centerRef.current || SEOUL;
    const address = pickAddr || initialAddress || "";
    onConfirm &&
      onConfirm({
        address,
        name: pickName,
        lat: c.lat,
        lng: c.lng,
      });
  };

  if (!open) return null;

  return (
    <Overlay>
      <AppBar>
        <Back type="button" onClick={onClose}>
          ‹
        </Back>
        <TitleWrap>
          <Title>구장 위치 선택</Title>
          {subtitle ? <Sub>{subtitle}</Sub> : null}
        </TitleWrap>
        <RightSpace />
      </AppBar>

      <Body>
        <SearchBar type="button" onClick={openAddressSearch}>
          <span>🔍</span>
          <Mq>건물명 · 도로명으로 검색</Mq>
        </SearchBar>

        <MapArea>
          <MapCanvas ref={mapRef} />
          <MapHint>지도를 움직여 구장 위치를 맞춰요</MapHint>
          <CenterPin>
            <Mk>📍</Mk>
            <PinShadow />
          </CenterPin>
        </MapArea>

        <PickCard>
          <Pk>📍</Pk>
          <PInfo>
            <Pa>{pickName || "위치를 선택해 주세요"}</Pa>
            <Pd>{pickAddr || "지도를 움직여 위치를 맞춰주세요"}</Pd>
          </PInfo>
        </PickCard>

        <Notice>
          <Em>💡</Em>
          <div>
            지도에서 잡은 위치는 다음 단계에서 <b>주소로 자동 입력</b>돼요. 핀이
            정확한지 한 번 더 확인하세요.
          </div>
        </Notice>
      </Body>

      <ActionBar>
        <PrimaryBtn type="button" onClick={handleConfirm}>
          이 위치로 설정
        </PrimaryBtn>
        <BtnNote>선택한 위치가 상대팀에게 지도로 공유돼요</BtnNote>
      </ActionBar>
    </Overlay>
  );
}

/* ───────────── styled (시안 그대로) ───────────── */

const pinFloat = keyframes`
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;
const shadowPulse = keyframes`
  0%,100% { transform: scaleX(1); opacity: .3; }
  50% { transform: scaleX(.7); opacity: .18; }
`;

const P = (theme) => mrp(theme.mode);

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => P(theme).bg2};
  color: ${({ theme }) => P(theme).t1};
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
`;

const AppBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 12px;
  border-bottom: 0.5px solid ${({ theme }) => P(theme).line};
`;

const Back = styled.button`
  border: none;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  color: ${({ theme }) => P(theme).t2};
  cursor: pointer;
  padding: 0 4px;
`;

const TitleWrap = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => P(theme).t1};
`;

const Sub = styled.small`
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: ${({ theme }) => P(theme).t3};
  margin-top: 1px;
`;

const RightSpace = styled.div`
  width: 24px;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SearchBar = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: ${({ theme }) => P(theme).surface};
  border: 0.5px solid ${({ theme }) => P(theme).line2};
  border-radius: 11px;
  padding: 11px 13px;
  font-size: 12px;
  color: ${({ theme }) => P(theme).t3};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  text-align: left;
`;

const Mq = styled.span`
  flex: 1;
`;

const MapArea = styled.div`
  position: relative;
  flex: 1;
  min-height: 260px;
  border-radius: 14px;
  overflow: hidden;
  border: 0.5px solid ${({ theme }) => P(theme).line2};
  background: ${({ theme }) => (theme.mode === "dark" ? P(theme).surface : "#e5e7eb")};
`;

const MapCanvas = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

const MapHint = styled.div`
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  font-size: 9.5px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.64);
  color: #fff;
  padding: 5px 11px;
  border-radius: 20px;
  white-space: nowrap;
  backdrop-filter: blur(4px);
`;

const CenterPin = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
`;

const Mk = styled.div`
  font-size: 34px;
  line-height: 1;
  filter: drop-shadow(0 7px 5px rgba(0, 0, 0, 0.4));
  animation: ${pinFloat} 1.8s ease-in-out infinite;
`;

const PinShadow = styled.div`
  width: 13px;
  height: 5px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  animation: ${shadowPulse} 1.8s ease-in-out infinite;
`;

const MyLoc = styled.button`
  position: absolute;
  right: 9px;
  bottom: 9px;
  z-index: 6;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: ${({ theme }) => P(theme).surface};
  border: 0.5px solid ${({ theme }) => P(theme).line2};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  cursor: pointer;
`;

const PickCard = styled.div`
  background: ${({ theme }) =>
    `linear-gradient(135deg, ${P(theme).puBg}, ${P(theme).surface})`};
  border: 0.5px solid ${({ theme }) => P(theme).puD};
  border-radius: 13px;
  padding: 12px 13px;
  display: flex;
  gap: 10px;
  align-items: center;
`;

const Pk = styled.div`
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
`;

const PInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const Pa = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: ${({ theme }) => P(theme).t1};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Pd = styled.div`
  font-size: 10px;
  color: ${({ theme }) => P(theme).t3};
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Notice = styled.div`
  display: flex;
  gap: 8px;
  font-size: 10px;
  line-height: 1.5;
  padding: 10px 12px;
  border-radius: 11px;
  background: ${({ theme }) => P(theme).blBg};
  color: ${({ theme }) => P(theme).blL};
  border: 0.5px solid ${({ theme }) => P(theme).blBorder};
  b {
    font-weight: 700;
  }
`;

const Em = styled.span`
  font-size: 13px;
  flex-shrink: 0;
`;

const ActionBar = styled.div`
  padding: 11px 14px 14px;
  border-top: 0.5px solid ${({ theme }) => P(theme).line};
  background: ${({ theme }) => P(theme).bg2};
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const PrimaryBtn = styled.button`
  width: 100%;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  padding: 13px;
  border-radius: 13px;
  border: none;
  cursor: pointer;
  color: #fff;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? `linear-gradient(135deg, ${P(theme).pu}, ${P(theme).puD})`
      : P(theme).pu};
  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? `0 8px 20px -6px ${P(theme).puD}`
      : "0 6px 16px -8px rgba(108,92,231,.55)"};
`;

const BtnNote = styled.div`
  text-align: center;
  font-size: 9.5px;
  color: ${({ theme }) => P(theme).t3};
`;
