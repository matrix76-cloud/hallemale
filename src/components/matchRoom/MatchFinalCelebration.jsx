/* eslint-disable */
// src/components/matchRoom/MatchFinalCelebration.jsx
// 최종 "경기 확정!" 축하 — 양 팀 결제 완료 시 웅장/화려하게 1회 표시.
// (제안 수락/라인업 확정 축하보다 강한 연출: 회전 광선 + 트로피 글로우 + 대량 컨페티)
// open=true 시 표시, 약 4.6초 뒤 자동 닫힘 / 탭하면 즉시 닫힘.
import React, { useEffect } from "react";
import styled, { keyframes } from "styled-components";

export default function MatchFinalCelebration({
  open,
  onClose,
  title = "경기 확정!",
  subtitle = "양 팀 결제 완료 · 경기장에서 만나요!",
  teams = "", // "우리팀 vs 상대팀"
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose && onClose(), 4600);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const confetti = Array.from({ length: 40 });
  const colors = ["#fbbf24", "#f59e0b", "#6c5ce7", "#22c55e", "#ef4444", "#3b82f6", "#ec4899", "#ffffff"];
  const sparkles = Array.from({ length: 14 });

  return (
    <Overlay onClick={() => onClose && onClose()}>
      <Rays />
      <Glow />

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

      <Card onClick={(e) => e.stopPropagation()}>
        <TrophyWrap>
          {sparkles.map((_, i) => (
            <Sparkle
              key={i}
              style={{
                transform: `rotate(${i * (360 / 14)}deg) translateY(-62px)`,
                animationDelay: `${(i % 7) * 0.1}s`,
              }}
            />
          ))}
          <TrophyRing>
            <Trophy>🏆</Trophy>
          </TrophyRing>
        </TrophyWrap>

        <Badge>MATCH CONFIRMED</Badge>
        <Title>{title}</Title>
        {teams ? <Teams>{teams}</Teams> : null}
        {subtitle ? <Sub>{subtitle}</Sub> : null}
        <Hint>화면을 탭하면 닫혀요</Hint>
      </Card>
    </Overlay>
  );
}

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const pulse = keyframes`
  0%,100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.08); }
`;
const fall = keyframes`
  0% { transform: translateY(-15vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(115vh) rotate(720deg); opacity: 0.95; }
`;
const pop = keyframes`
  0% { transform: scale(0) rotate(-25deg); }
  55% { transform: scale(1.25) rotate(8deg); }
  75% { transform: scale(0.92) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
`;
const floaty = keyframes`
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;
const rise = keyframes`from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}`;
const shine = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;
const twinkle = keyframes`
  0%,100% { opacity: 0; transform-origin: center; }
  50% { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 42%, rgba(45, 32, 90, 0.78), rgba(10, 12, 24, 0.92));
  backdrop-filter: blur(4px);
  animation: ${fadeIn} 0.25s ease;
`;

const Rays = styled.div`
  position: absolute;
  top: 50%; left: 50%;
  width: 170vmax; height: 170vmax;
  transform: translate(-50%, -50%);
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 215, 130, 0.16) 0deg 9deg,
    transparent 9deg 18deg
  );
  animation: ${spin} 14s linear infinite;
  pointer-events: none;
`;
const Glow = styled.div`
  position: absolute;
  top: 42%; left: 50%;
  width: 60vmax; height: 60vmax;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(124, 92, 231, 0.5), transparent 60%);
  filter: blur(8px);
  animation: ${pulse} 2.4s ease-in-out infinite;
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

const Card = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 30px 24px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,243,255,0.98));
  box-shadow: 0 24px 70px -16px rgba(108, 92, 231, 0.65), 0 0 0 1px rgba(255,255,255,0.4) inset;
  animation: ${rise} 0.4s ease both;
`;

const TrophyWrap = styled.div`
  position: relative;
  width: 124px;
  height: 124px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;
const TrophyRing = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffd86b, #f59e0b);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14px 34px -8px rgba(245, 158, 11, 0.75), 0 0 0 6px rgba(255, 216, 107, 0.28);
  animation: ${pop} 0.7s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
`;
const Trophy = styled.div`
  font-size: 52px;
  line-height: 1;
  animation: ${floaty} 2.2s ease-in-out infinite;
`;
const Sparkle = styled.span`
  position: absolute;
  top: 50%; left: 50%;
  width: 8px; height: 8px;
  margin: -4px 0 0 -4px;
  background: #fff7d6;
  clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%);
  animation: ${twinkle} 1.4s ease-in-out infinite;
`;

const Badge = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #b45309;
  background: #fef3c7;
  padding: 4px 12px;
  border-radius: 999px;
`;
const Title = styled.div`
  margin-top: 4px;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.01em;
  background: linear-gradient(90deg, #6c5ce7, #ec4899, #f59e0b, #6c5ce7);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shine} 3s linear infinite;
`;
const Teams = styled.div`
  font-size: 14px;
  font-weight: 800;
  color: #111827;
`;
const Sub = styled.div`
  font-size: 13px;
  color: #4b5563;
  text-align: center;
  white-space: pre-line;
`;
const Hint = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
`;
