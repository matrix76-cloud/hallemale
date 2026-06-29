/* eslint-disable */
// src/pages/matching/components/QuickMatchHero.jsx
// 매칭하기 상단 "게임식 빠른 매칭" 히어로 카드 (5안 중 A · 빠른 매칭 버튼)
// - 버튼 → 지역 선택 화면으로 진입

import React from "react";
import styled, { keyframes, css } from "styled-components";

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Card = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 22px 20px 20px;
  background: linear-gradient(135deg, #6d5efc 0%, #5b4ef0 55%, #4f46e5 100%);
  box-shadow: 0 14px 30px rgba(79, 70, 229, 0.32);
`;

/* 우상단 장식 원 */
const Blob = styled.div`
  position: absolute;
  top: -40px;
  right: -30px;
  width: 150px;
  height: 150px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  pointer-events: none;
`;

const Chip = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  backdrop-filter: blur(2px);
`;

const Title = styled.h2`
  position: relative;
  margin: 14px 0 18px;
  color: #ffffff;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.32;
  letter-spacing: -0.4px;
`;

const StartBtn = styled.button`
  position: relative;
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 16px;
  background: #ffffff;
  color: #4f46e5;
  font-size: 17px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.14);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.14);
  }
`;

const Caption = styled.p`
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

const Bolt = styled.span`
  display: inline-flex;
  ${({ $animate }) =>
    $animate
      ? css`
          animation: ${pulse} 1.6s ease-in-out infinite;
        `
      : ""}
`;

function BoltIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2 4.5 13.5H11l-1 8.5 9-12H12.5L13 2Z"
        fill={color}
      />
    </svg>
  );
}

export default function QuickMatchHero({ onStart }) {
  return (
    <Section>
      <Card>
        <Blob />
        <Chip>
          <Bolt $animate>
            <BoltIcon size={14} color="#ffffff" />
          </Bolt>
          AI 자동 매칭
        </Chip>

        <Title>
          버튼 한 번이면
          <br />딱 맞는 상대를 찾아드려요
        </Title>

        <StartBtn type="button" onClick={onStart}>
          <BoltIcon size={20} color="#4f46e5" />
          매칭 찾기
        </StartBtn>
      </Card>

      <Caption>지역·전력·활동량을 종합해 추천해요</Caption>
    </Section>
  );
}
