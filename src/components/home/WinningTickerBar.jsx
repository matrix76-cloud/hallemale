// src/components/home/WinningTickerBar.jsx
/* eslint-disable */
import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { TEAMS } from "../../mock/teamsMock";

// 왼쪽 → 오른쪽으로 계속 흐르는 애니메이션
const scroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

const Bar = styled.div`
  width: 100%;
  height: 32px;
  background: linear-gradient(90deg, #0b0f1a, #111827, #0b0f1a);
  color: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  overflow: hidden;
  font-size: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const Inner = styled.div`
  display: inline-flex;
  white-space: nowrap;
  animation: ${scroll} 18s linear infinite;
`;

const Segment = styled.span`
  padding: 0 24px;
`;

export default function WinningTickerBar() {
  const textLine = useMemo(() => {
    const items = TEAMS.filter(
      (t) => t.streak && t.streak.type === "WIN" && t.streak.count > 0
    ).map((t) => `${t.name} ${t.streak.count}연승 중`);

    if (!items.length) return "지금 바로 매칭을 시작해보세요!";
    return items.join("  ·  ");
  }, []);

  return (
    <Bar>
      <Inner>
        <Segment>{textLine}</Segment>
        <Segment>{textLine}</Segment>
      </Inner>
    </Bar>
  );
}
