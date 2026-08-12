/* eslint-disable */
// src/pages/matching/components/QuickMatchHero.jsx
// 매칭하기 상단 빠른 매칭 히어로 카드
// - 한때 내 팀 현황과 정렬 기준(matchmaking.WEIGHTS)을 카드 안에 펼쳐 놨었다.
//   기준을 투명하게 보여주려던 것인데, 시작 버튼 하나를 누르러 온 화면에 읽을거리가 너무 많았다.
// - 지금은 제목 · 버튼 · 상대 수 한 줄만 남긴다. 무엇으로 정렬하는지는 결과 화면에서 보면 된다.

import React from "react";
import styled from "styled-components";

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Card = styled.div`
  border-radius: 20px;
  padding: 22px 20px 18px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Title = styled.h2`
  margin: 0 0 20px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 22px;
  font-weight: 800;
  line-height: 1.32;
  letter-spacing: -0.4px;
`;

const StartBtn = styled.button`
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
  box-shadow: 0 8px 18px rgba(124, 92, 201, 0.3);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 3px 10px rgba(124, 92, 201, 0.28);
  }
`;

const Caption = styled.p`
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function BoltIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5 9-12H12.5L13 2Z" fill={color} />
    </svg>
  );
}

export default function QuickMatchHero({ onStart, opponentCount = 0 }) {
  return (
    <Section>
      <Card>
        <Title>
          우리 팀에 맞는 상대를
          <br />
          계산해서 찾아드려요
        </Title>

        <StartBtn type="button" onClick={onStart}>
          <BoltIcon size={20} color="#ffffff" />
          매칭 찾기
        </StartBtn>

        {opponentCount > 0 ? (
          <Caption>지금 등록된 상대 팀 {opponentCount}팀에서 찾아요</Caption>
        ) : null}
      </Card>
    </Section>
  );
}
