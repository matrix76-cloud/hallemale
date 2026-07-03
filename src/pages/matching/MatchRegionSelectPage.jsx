/* eslint-disable */
// src/pages/matching/MatchRegionSelectPage.jsx
// 빠른 매칭 ① 지역 선택
// - "내 위치로 설정": 단말 GPS → 카카오 역지오코딩으로 활동 지역(시/도·시군구) 자동 입력
// - 직접 선택: 팀 생성과 동일한 RegionPickerSheet(시/도 · 구/군)
// → "○○ 에서 상대 찾기" → 로딩 화면

import React, { useState } from "react";
import styled from "styled-components";
import { showAlert } from "../../utils/appDialog";
import { useNavigate } from "react-router-dom";
import { FiChevronRight, FiMapPin } from "react-icons/fi";

import RegionPickerSheet from "../../components/common/RegionPickerSheet";
import InfoDialog from "../../components/common/InfoDialog";
import { useWebviewBridgeContext } from "../../context/WebviewBridgeContext";
import { KR_AREAS } from "../../utils/constants";

const Page = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
`;

const Body = styled.div`
  flex: 1;
  padding: 20px 16px 120px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Heading = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.34;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.p`
  margin: -8px 0 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 내 위치로 설정 */
const MyLocBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px;
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  border: 1.5px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) =>
    $active
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "#eef2ff"
      : theme.colors.card};
  transition: transform 0.1s ease;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
  &:active:not(:disabled) {
    transform: scale(0.99);
  }
`;

/* 아이콘만 — 뒤 배경 박스 없음 */
const LocIcon = styled.span`
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.primary};
`;

const LocTexts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const LocTitle = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LocValue = styled.span`
  font-size: 13px;
  color: ${({ $has, theme }) =>
    $has ? theme.colors.primary : theme.colors.textWeak};
  font-weight: ${({ $has }) => ($has ? 600 : 400)};
`;

/* 구분 문구 */
const DividerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.divider};
  }
`;

/* 직접 선택 (팀 생성과 동일 패턴) */
const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const Label = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LabelSub = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SelectBtn = styled.button`
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: ${({ $muted, theme }) =>
    $muted ? theme.colors.textWeak : theme.colors.textStrong};
`;

const Footer = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors.bg};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;

const Cta = styled.button`
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(79, 70, 229, 0.3);
  transition: transform 0.12s ease;

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

function BoltIcon({ size = 18, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5 9-12H12.5L13 2Z" fill={color} />
    </svg>
  );
}

// 카카오 행정구역명(시/도) → 앱 내부 표기(KR_AREAS)로 정규화
const SIDO_FROM_KAKAO = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
  제주도: "제주",
};

// 카카오 좌표→행정구역(region_1depth/region_2depth)을 앱의 { sido, gu }로 변환·검증
function normalizeRegionFromKakao(region1, region2) {
  const rawSido = String(region1 || "").trim();
  const rawGu = String(region2 || "").trim();
  const sido = SIDO_FROM_KAKAO[rawSido] || "";
  const area = (KR_AREAS || []).find((a) => a.sido === sido);
  if (!area) return { sido: "", gu: "" };

  // 카카오 region_2depth 표기는 앱 guList와 동일(예: "남양주시", "수원시 영통구")
  if (area.guList.includes(rawGu)) return { sido, gu: rawGu };

  // "성남시 분당구"처럼 시/구가 합쳐진 경우 첫 단어(시)로 폴백
  const firstWord = rawGu.split(/\s+/)[0];
  const byFirst = area.guList.find((g) => g === firstWord || g.startsWith(firstWord));
  if (byFirst) return { sido, gu: byFirst };

  return { sido, gu: "" };
}

export default function MatchRegionSelectPage() {
  const navigate = useNavigate();
  const bridge = useWebviewBridgeContext();
  const isWebView = !!bridge?.isWebView;

  const [sido, setSido] = useState("");
  const [gu, setGu] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [detectedLabel, setDetectedLabel] = useState("");
  // 위치 권한이 꺼져 있을 때 안내(설정 유도) 다이얼로그
  const [permOpen, setPermOpen] = useState(false);

  const goToLocationSettings = () => {
    try {
      if (isWebView && bridge?.sendToApp) {
        // 네이티브(RN)의 기존 규약: OPEN_SETTINGS → handleOpenSettings 가 OS 앱 설정을 염
        bridge.sendToApp("OPEN_SETTINGS", { reason: "location" });
      }
    } catch (e) {}
    setPermOpen(false);
  };

  const region = sido && gu ? `${sido} ${gu}` : "";
  const usingMyLocation = !!detectedLabel && region === detectedLabel;

  // "내 위치로 설정": 단말 GPS → 카카오 역지오코딩 → 활동 지역 자동 입력
  const useMyLocation = () => {
    if (locating) return;
    if (!navigator.geolocation) {
      showAlert("이 기기에서는 위치 정보를 사용할 수 없습니다. 직접 선택해 주세요.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const kakao = window.kakao;

        const run = () => {
          try {
            const geocoder = new kakao.maps.services.Geocoder();
            geocoder.coord2RegionCode(lng, lat, (result, status) => {
              setLocating(false);
              if (status !== kakao.maps.services.Status.OK || !Array.isArray(result)) {
                showAlert("현재 위치의 지역 정보를 가져오지 못했어요. 직접 선택해 주세요.");
                return;
              }
              const r = result.find((x) => x.region_type === "H") || result[0];
              const { sido: s, gu: g } = normalizeRegionFromKakao(
                r?.region_1depth_name,
                r?.region_2depth_name
              );
              if (!s || !g) {
                showAlert("현재 위치를 지원 지역으로 변환하지 못했어요. 직접 선택해 주세요.");
                return;
              }
              setSido(s);
              setGu(g);
              setDetectedLabel(`${s} ${g}`);
            });
          } catch (e) {
            setLocating(false);
            showAlert("위치 정보를 불러오지 못했어요. 직접 선택해 주세요.");
          }
        };

        if (kakao && kakao.maps && typeof kakao.maps.load === "function") {
          kakao.maps.load(run);
        } else if (kakao && kakao.maps && kakao.maps.services) {
          run();
        } else {
          setLocating(false);
          showAlert("지도 서비스를 불러오지 못했어요. 직접 선택해 주세요.");
        }
      },
      (err) => {
        setLocating(false);
        // code 1 = PERMISSION_DENIED → 설정에서 위치 권한을 켜도록 유도
        if (err && err.code === 1) {
          setPermOpen(true);
          return;
        }
        showAlert("위치를 가져오지 못했어요. 직접 선택해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleFind = () => {
    if (!region) return;
    navigate("/matching/searching", {
      state: { region, regionSido: sido, regionGu: gu },
    });
  };

  return (
    <Page>
      <Body>
        <Heading>
          어느 지역에서
          <br />
          경기하고 싶나요?
        </Heading>
        <Sub>선택한 지역 주변에서 딱 맞는 상대를 찾아드려요.</Sub>

        <MyLocBtn
          type="button"
          $active={usingMyLocation}
          disabled={locating}
          onClick={useMyLocation}
        >
          <LocIcon>
            <FiMapPin size={22} />
          </LocIcon>
          <LocTexts>
            <LocTitle>내 위치로 설정</LocTitle>
            <LocValue $has={!!detectedLabel}>
              {locating
                ? "현재 위치 확인 중…"
                : detectedLabel || "탭하면 현재 위치로 지역을 설정해요"}
            </LocValue>
          </LocTexts>
        </MyLocBtn>

        <DividerRow>여기로 설정하지 않을 거라면 직접 선택해 주세요</DividerRow>

        <div>
          <LabelRow>
            <Label>활동 지역</Label>
            <LabelSub>구 단위까지 선택하면 좋아요.</LabelSub>
          </LabelRow>

          <SelectBtn
            type="button"
            $muted={!region}
            onClick={() => setSheetOpen(true)}
          >
            <span>{region || "지역 선택"}</span>
            <FiChevronRight size={18} />
          </SelectBtn>
        </div>
      </Body>

      <Footer>
        <Cta type="button" onClick={handleFind} disabled={!region}>
          <BoltIcon />
          {region ? `${region} 에서 상대 찾기` : "지역을 선택해 주세요"}
        </Cta>
      </Footer>

      <RegionPickerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={{ sido, gu }}
        onPick={({ sido: s, gu: g }) => {
          setSido(s);
          setGu(g);
        }}
        title="활동 지역 선택"
      />

      {/* 위치 권한 꺼짐 → 설정 유도 */}
      <InfoDialog
        open={permOpen}
        tone="warning"
        title="위치 권한이 꺼져 있어요"
        message={
          isWebView
            ? "현재 위치로 지역을 설정하려면\n위치 권한이 필요해요.\n\n설정에서 위치 접근을 허용한 뒤\n다시 시도해 주세요.\n허용하지 않아도 아래에서 지역을\n직접 선택할 수 있어요."
            : "현재 위치로 지역을 설정하려면\n브라우저의 위치 권한이 필요해요.\n\n주소창의 자물쇠(사이트 설정)에서\n위치를 '허용'으로 바꾼 뒤 다시 시도해 주세요.\n허용하지 않아도 아래에서 지역을\n직접 선택할 수 있어요."
        }
        primaryText={isWebView ? "설정으로 가기" : "확인"}
        onPrimary={isWebView ? goToLocationSettings : () => setPermOpen(false)}
        secondaryText="직접 선택할게요"
        onClose={() => setPermOpen(false)}
        closeOnOverlay={true}
        showClose={true}
      />
    </Page>
  );
}
