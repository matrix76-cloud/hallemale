/* eslint-disable */
// src/pages/matching/components/FlowSteps.jsx
// 빠른 매칭 흐름의 현재 단계 표시 — 지역(1) → 탐색(2) → 상대 확인(3)
// 세 화면이 같은 모양을 써야 "흐름"으로 읽히므로 한 곳에서 만든다.

import React from "react";
import styled from "styled-components";

const LABELS = ["지역", "탐색", "상대 확인"];

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Text = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Seg = styled.span`
  flex: 1;
  height: 3px;
  border-radius: 999px;
  background: ${({ $on, theme }) =>
    $on
      ? theme.colors.primary
      : theme.mode === "dark"
      ? "rgba(255,255,255,0.10)"
      : "#e5e7eb"};
`;

/** @param {number} current 1~3 */
export default function FlowSteps({ current = 1, className }) {
  return (
    <Row className={className}>
      <Text>
        {current} / {LABELS.length} {LABELS[current - 1]}
      </Text>
      {LABELS.map((label, i) => (
        <Seg key={label} $on={i < current} />
      ))}
    </Row>
  );
}
