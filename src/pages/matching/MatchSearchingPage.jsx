/* eslint-disable */
// src/pages/matching/MatchSearchingPage.jsx
// 빠른 매칭 ①.5 로딩(광고) — 레이더 탐색 + 광고 배너 + 진행바
// - 약 3초 후 매칭 상대 공개 화면으로 자동 이동(replace: 뒤로가기 시 로딩 재진입 방지)

import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";

const SEARCH_MS = 3000;

const ripple = keyframes`
  0%   { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(1.8); opacity: 0; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const Page = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
  padding: env(safe-area-inset-top) 16px 0;
`;

const Top = styled.div`
  margin-top: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
`;

const Radar = styled.div`
  position: relative;
  width: 150px;
  height: 150px;
  display: grid;
  place-items: center;
`;

const Ring = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1.5px solid rgba(99, 102, 241, 0.35);
  animation: ${ripple} 2.4s ease-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`;

const Sweep = styled.span`
  position: absolute;
  width: 132px;
  height: 132px;
  border-radius: 999px;
  border: 3px solid transparent;
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-right-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 1.5s linear infinite;
`;

const Core = styled.div`
  width: 78px;
  height: 78px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.22)" : "#eef2ff"};
  display: grid;
  place-items: center;
`;

const Headline = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RegionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AdWrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AdCard = styled.div`
  position: relative;
  width: 100%;
  max-width: 360px;
  aspect-ratio: 4 / 3;
  border-radius: 18px;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const AdBadge = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.55);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
`;

const Footer = styled.div`
  padding: 14px 0 calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Track = styled.div`
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#e5e7eb"};
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  width: ${({ $pct }) => $pct}%;
  transition: width 0.2s linear;
`;

const FootRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function PinIcon({ size = 16, color = "#6b7280" }) {
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

export default function MatchSearchingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const region = navState.region || "내 주변";

  const [pct, setPct] = useState(6);
  const navStateRef = useRef(navState);
  navStateRef.current = navState;

  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const ratio = Math.min(1, (now - start) / SEARCH_MS);
      setPct(Math.round(6 + ratio * 94));
      if (ratio < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const timer = setTimeout(() => {
      navigate("/matching/opponent", { state: navStateRef.current, replace: true });
    }, SEARCH_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <Page>
      <Top>
        <Radar>
          <Ring $delay={0} />
          <Ring $delay={0.8} />
          <Ring $delay={1.6} />
          <Sweep />
          <Core>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="#4f46e5" strokeWidth="2.2" />
              <path d="m20 20-3.4-3.4" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </Core>
        </Radar>

        <Headline>딱 맞는 상대를 찾고 있어요</Headline>
        <RegionRow>
          <PinIcon />
          {region} 주변
        </RegionRow>
      </Top>

      <AdWrap>
        <AdCard>
          <AdBadge>AD · 광고</AdBadge>
        </AdCard>
      </AdWrap>

      <Footer>
        <Track>
          <Fill $pct={pct} />
        </Track>
        <FootRow>
          <span>지역·전력·활동량을 종합하고 있어요</span>
          <span>잠시만요…</span>
        </FootRow>
      </Footer>
    </Page>
  );
}
