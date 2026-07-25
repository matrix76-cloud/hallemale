// src/pages/auth/WelcomePage.jsx
/* eslint-disable */
// 미로그인 사용자가 앱을 처음 열 때(스플래시 → /welcome) 보는 진입 랜딩.
// 브랜드·핵심 가치 소개 후 "시작하기"로 로그인(/login)으로 유도한다.
// 이미 로그인된 사용자는 /(스플래시)로 돌려보내 홈으로 흐르게 한다.
import React from "react";
import styled, { keyframes } from "styled-components";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import AppLoadingPage from "../system/AppLoadingPage";
import { images } from "../../utils/imageAssets";

const FEATURES = [
  {
    icon: images.emoji3dBasketball,
    title: "팀 매칭",
    desc: "우리 동네 팀과 경기 한판, 상대는 앱이 찾아줘요.",
  },
  {
    icon: images.emoji3dCalendar,
    title: "구장 예약",
    desc: "가까운 체육관·코트를 찾고 예약까지 한 번에.",
  },
  {
    icon: images.emoji3dBarchart,
    title: "랭킹 · 기록",
    desc: "경기 결과로 전적과 랭킹이 자동으로 쌓여요.",
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <AppLoadingPage />;
  // 이미 로그인 → 스플래시(/)가 프리로드 후 /home 으로 보냄
  if (isLoggedIn) return <Navigate to="/" replace />;

  return (
    <Wrap>
      <Hero>
        <Logo
          src={images.logo}
          alt="할래말래 로고"
          loading="eager"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <Brand>할래말래</Brand>
        <Tagline>이번주, 경기 한판 할래말래</Tagline>
      </Hero>

      <Features>
        {FEATURES.map((f) => (
          <Feature key={f.title}>
            <FeatureIcon src={f.icon} alt="" aria-hidden="true" />
            <FeatureText>
              <FeatureTitle>{f.title}</FeatureTitle>
              <FeatureDesc>{f.desc}</FeatureDesc>
            </FeatureText>
          </Feature>
        ))}
      </Features>

      <Spacer />

      <BottomArea>
        <StartBtn type="button" onClick={() => navigate("/login")}>
          시작하기
        </StartBtn>
      </BottomArea>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Wrap = styled.div`
  height: 100%;
  max-height: 100%;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
`;

const Hero = styled.div`
  width: 100%;
  padding: 64px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  animation: ${fadeUp} 0.5s ease-out both;
`;

const Logo = styled.img`
  width: 96px;
  height: 96px;
  object-fit: contain;
`;

const Brand = styled.h1`
  margin: 6px 0 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Tagline = styled.p`
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Features = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 8px 20px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeUp} 0.5s ease-out 0.1s both;
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border || "rgba(0,0,0,0.06)"};
`;

const FeatureIcon = styled.img`
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
`;

const FeatureText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FeatureTitle = styled.div`
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const FeatureDesc = styled.div`
  font-size: 13px;
  line-height: 1.4;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-height: 24px;
`;

const BottomArea = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 12px 20px calc(32px + env(safe-area-inset-bottom));
  box-sizing: border-box;
`;

const StartBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  cursor: pointer;
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
  transition: transform 0.1s, filter 0.15s;

  &:hover { filter: brightness(0.97); }
  &:active { transform: translateY(1px); }
`;
