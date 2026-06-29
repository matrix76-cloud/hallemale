/* eslint-disable */
// src/pages/matching/components/QuickMatchHero.jsx
// 매칭하기 상단 "게임식 빠른 매칭" 히어로 카드
// - 흰색 카드 + 보라색 매칭 찾기 버튼
// - 버튼 → 지역 선택 화면으로 진입

import React from "react";
import styled from "styled-components";

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Card = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 24px 20px 20px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

/* 우상단 장식 원 (은은한 보라) */
const Blob = styled.div`
  position: absolute;
  top: -40px;
  right: -30px;
  width: 150px;
  height: 150px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.12)" : "rgba(79,70,229,0.07)"};
  pointer-events: none;
`;

const Title = styled.h2`
  position: relative;
  margin: 0 0 8px;
  color: ${({ theme }) => theme.colors.textStrong};
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
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 3px 10px rgba(79, 70, 229, 0.28);
  }
`;

const Caption = styled.p`
  position: relative;
  margin: 0 0 12px;
  text-align: center;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function BoltIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5 9-12H12.5L13 2Z" fill={color} />
    </svg>
  );
}

export default function QuickMatchHero({ onStart }) {
  return (
    <Section>
      <Card>
        <Blob />

        <Title>
          버튼 한 번이면
          <br />딱 맞는 상대를 찾아드려요
        </Title>

        <Caption>지역·전력·활동량을 종합해 추천해요</Caption>

        <StartBtn type="button" onClick={onStart}>
          <BoltIcon size={20} color="#ffffff" />
          매칭 찾기
        </StartBtn>
      </Card>
    </Section>
  );
}
