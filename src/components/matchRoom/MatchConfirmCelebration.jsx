/* eslint-disable */
// src/components/matchRoom/MatchConfirmCelebration.jsx
// 경기 확정 시 잠깐 뜨는 축하 애니메이션 오버레이. (2-7)
// open=true 시 표시, 약 2.6초 뒤 자동 닫힘 / 탭하면 즉시 닫힘.

import React, { useEffect } from "react";
import styled, { keyframes } from "styled-components";

export default function MatchConfirmCelebration({
  open,
  onClose,
  title = "경기 확정!",
  subtitle = "",
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose && onClose(), 2600);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  // 간단한 컨페티 조각
  const pieces = Array.from({ length: 18 });
  const colors = ["#6c5ce7", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

  return (
    <Overlay onClick={() => onClose && onClose()}>
      {pieces.map((_, i) => (
        <Confetti
          key={i}
          style={{
            left: `${(i * 53) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 6) * 0.12}s`,
            transform: `rotate(${(i * 47) % 360}deg)`,
          }}
        />
      ))}
      <Card onClick={(e) => e.stopPropagation()}>
        <CheckCircle>
          <Check>✓</Check>
        </CheckCircle>
        <Title>{title}</Title>
        {subtitle ? <Sub>{subtitle}</Sub> : null}
        <Hint>화면을 탭하면 닫혀요</Hint>
      </Card>
    </Overlay>
  );
}

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const pop = keyframes`
  0% { transform: scale(0); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
`;
const fall = keyframes`
  0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
`;
const rise = keyframes`
  from { transform: translateY(14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 18, 30, 0.55);
  backdrop-filter: blur(3px);
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease;
`;

const Confetti = styled.span`
  position: absolute;
  top: -5vh;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  animation: ${fall} 2.4s linear infinite;
`;

const Card = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 26px 30px 22px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 18px 50px -12px rgba(0, 0, 0, 0.45);
  animation: ${rise} 0.35s ease both;
`;

const CheckCircle = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px -8px rgba(22, 163, 74, 0.6);
  animation: ${pop} 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
`;
const Check = styled.div`
  color: #fff;
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
`;
const Title = styled.div`
  margin-top: 6px;
  font-size: 20px;
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
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
`;
