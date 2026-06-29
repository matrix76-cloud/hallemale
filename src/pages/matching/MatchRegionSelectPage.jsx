/* eslint-disable */
// src/pages/matching/MatchRegionSelectPage.jsx
// 빠른 매칭 ① 지역 선택
// - 어느 지역에서 경기할지 칩으로 선택 → "○○구 에서 상대 찾기" → 로딩 화면

import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

const NEARBY_REGIONS = [
  "성북구",
  "강남구",
  "송파구",
  "용산구",
  "마포구",
  "노원구",
  "서대문구",
  "광진구",
  "동대문구",
];

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

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const NearbyLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ChipGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
`;

const Chip = styled.button`
  height: 56px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s ease;
  border: 1.5px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) =>
    $active
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "#eef2ff"
      : theme.colors.card};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textStrong};

  &:active {
    transform: scale(0.97);
  }
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

function PinIcon({ size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export default function MatchRegionSelectPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState("성북구");

  const list = useMemo(() => {
    const text = q.trim();
    if (!text) return NEARBY_REGIONS;
    return NEARBY_REGIONS.filter((r) => r.includes(text));
  }, [q]);

  const handleFind = () => {
    if (!selected) return;
    navigate("/matching/searching", { state: { region: selected } });
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

        <SearchBox>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="#9ca3af" strokeWidth="2" />
            <path d="m20 20-3.2-3.2" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지역 검색 (구·동)"
          />
        </SearchBox>

        <NearbyLabel>
          <PinIcon color="#4f46e5" />내 주변 지역
        </NearbyLabel>

        <ChipGrid>
          {list.map((region) => (
            <Chip
              key={region}
              type="button"
              $active={selected === region}
              onClick={() => setSelected(region)}
            >
              {region}
            </Chip>
          ))}
        </ChipGrid>
      </Body>

      <Footer>
        <Cta type="button" onClick={handleFind} disabled={!selected}>
          <BoltIcon />
          {selected} 에서 상대 찾기
        </Cta>
      </Footer>
    </Page>
  );
}
