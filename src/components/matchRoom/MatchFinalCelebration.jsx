/* eslint-disable */
// src/components/matchRoom/MatchFinalCelebration.jsx
// 최종 "경기 확정!" 축하 — 양 팀 vs 원형 프로필 + 컨페티 + 다크 글로우 (목업: matchconfirmed)
// - 직접입력/제휴구장 확정 공통. 1~3위 팀은 프로필 위 왕관.
// - open=true 시 표시, 약 4.6초 뒤 자동 닫힘 / 탭·X로 즉시 닫힘.
import React, { useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { images } from "../../utils/imageAssets";

export default function MatchFinalCelebration({
  open,
  onClose,
  myName = "우리팀",
  myLogoUrl = "",
  myRank = 0,
  oppName = "상대팀",
  oppLogoUrl = "",
  oppRank = 0,
  autoMs = 4600,
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose && onClose(), autoMs);
    return () => clearTimeout(t);
  }, [open, onClose, autoMs]);

  if (!open) return null;

  const confetti = Array.from({ length: 40 });
  const colors = ["#fbbf24", "#f59e0b", "#6c5ce7", "#22c55e", "#ef4444", "#3b82f6", "#ec4899", "#ffffff"];

  const renderTeam = (name, logoUrl, rank, side) => {
    const hasLogo = logoUrl && logoUrl !== images.logo;
    const crowned = rank >= 1 && rank <= 3;
    return (
      <TeamCol $side={side}>
        <CircleWrap $side={side} style={{ animationDelay: side === "right" ? "0.42s" : "0.3s" }}>
          {crowned ? <Crown src={images.logo} alt={`${rank}위`} /> : null}
          <Circle $side={side} $crowned={crowned}>
            {hasLogo ? <CircleImg src={logoUrl} alt={name} /> : <CircleInitial>{String(name || "").trim().slice(0, 1) || "팀"}</CircleInitial>}
          </Circle>
        </CircleWrap>
        <Name>{name}</Name>
        {rank ? <Rank $top={crowned}>랭킹 {rank}위</Rank> : <RankSpacer />}
      </TeamCol>
    );
  };

  return (
    <Overlay onClick={() => onClose && onClose()}>
      <Glow />
      <RingGlow />

      {confetti.map((_, i) => (
        <Confetti
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 10) * 0.18}s`,
            animationDuration: `${2.4 + ((i % 5) * 0.4)}s`,
            transform: `rotate(${(i * 53) % 360}deg)`,
          }}
        />
      ))}

      <CloseBtn type="button" aria-label="닫기" onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}>
        ×
      </CloseBtn>

      <Hero onClick={(e) => e.stopPropagation()}>
        {renderTeam(myName, myLogoUrl, myRank, "left")}
        <Vs>VS</Vs>
        {renderTeam(oppName, oppLogoUrl, oppRank, "right")}
      </Hero>
    </Overlay>
  );
}

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const pulse = keyframes`
  0%,100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.08); }
`;
const ringPulse = keyframes`
  0%,100% { opacity: 0.25; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.06); }
`;
const fall = keyframes`
  0% { transform: translateY(-15vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(115vh) rotate(720deg); opacity: 0.95; }
`;
const bounceInLeft = keyframes`
  0%   { transform: translateX(-70px) scale(0.4); opacity: 0; }
  55%  { transform: translateX(8px) scale(1.12); opacity: 1; }
  72%  { transform: translateX(-4px) scale(0.97); }
  100% { transform: translateX(0) scale(1); opacity: 1; }
`;
const bounceInRight = keyframes`
  0%   { transform: translateX(70px) scale(0.4); opacity: 0; }
  55%  { transform: translateX(-8px) scale(1.12); opacity: 1; }
  72%  { transform: translateX(4px) scale(0.97); }
  100% { transform: translateX(0) scale(1); opacity: 1; }
`;
const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-7px); }
`;
const popVs = keyframes`
  0% { transform: scale(0) rotate(-12deg); opacity: 0; }
  60% { transform: scale(1.25) rotate(6deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #2b2e3b 0%, #15161d 46%, #0a0b10 100%);
  animation: ${fadeIn} 0.25s ease;
`;

/* 중앙 소프트 화이트 글로우 */
const Glow = styled.div`
  position: absolute;
  top: 42%;
  left: 50%;
  width: 70vmin;
  height: 70vmin;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 62%);
  filter: blur(6px);
  animation: ${pulse} 2.6s ease-in-out infinite;
  pointer-events: none;
`;
/* VS 뒤 옅은 원형 링 */
const RingGlow = styled.div`
  position: absolute;
  top: 42%;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 60px rgba(255, 255, 255, 0.12) inset;
  animation: ${ringPulse} 2.6s ease-in-out infinite;
  pointer-events: none;
`;

const Confetti = styled.span`
  position: absolute;
  top: -8vh;
  width: 10px;
  height: 16px;
  border-radius: 2px;
  animation: ${fall} 2.8s linear infinite;
  pointer-events: none;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: calc(14px + env(safe-area-inset-top));
  right: 16px;
  z-index: 3;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
`;

const Hero = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 26px;
`;

const TeamCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 92px;
`;
const CircleWrap = styled.div`
  position: relative;
  animation: ${({ $side }) => ($side === "right" ? bounceInRight : bounceInLeft)}
      0.7s cubic-bezier(0.18, 0.89, 0.32, 1.28) both,
    ${bob} 1.15s ease-in-out infinite;
`;
const Circle = styled.div`
  width: 86px;
  height: 86px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $side }) => ($side === "left" ? "#e9e8ff" : "#ffeede")};
  border: ${({ $crowned }) => ($crowned ? "2px solid rgba(167,139,250,0.9)" : "2px solid rgba(255,255,255,0.5)")};
  box-shadow: ${({ $crowned }) =>
    $crowned
      ? "0 0 0 5px rgba(124,92,231,0.28), 0 10px 26px -8px rgba(0,0,0,0.55)"
      : "0 10px 26px -8px rgba(0,0,0,0.55)"};
`;
const CircleImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
const CircleInitial = styled.span`
  font-size: 30px;
  font-weight: 900;
  color: ${({ theme }) => "#4b3fae"};
`;
/* 1~3위: 원형 프로필 위 왕관 (앱 공통 비율 — 사진의 ~58%, 위로 ~37% 돌출) */
const Crown = styled.img`
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 50px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4));
`;
const Name = styled.div`
  font-size: 14px;
  font-weight: 800;
  color: #ffffff;
  max-width: 92px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const Rank = styled.div`
  font-size: 11.5px;
  font-weight: 700;
  color: ${({ $top }) => ($top ? "#b9a7ff" : "rgba(255,255,255,0.6)")};
`;
const RankSpacer = styled.div`
  height: 15px;
`;
const Vs = styled.div`
  margin-top: 22px;
  font-size: 34px;
  font-weight: 900;
  font-style: italic;
  color: #ffffff;
  letter-spacing: -0.02em;
  text-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  animation: ${popVs} 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
  animation-delay: 0.5s;
`;
