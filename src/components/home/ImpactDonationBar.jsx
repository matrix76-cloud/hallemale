/* eslint-disable */
// src/components/home/ImpactTickerBar.jsx
import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";

/**
 * ImpactTickerBar
 * - 한 줄로 흘러가는 임팩트/기부 티커
 *
 * props
 * - totalPoints: number (누적 득점)
 * - wonPerPoint: number (1점당 기부금)
 * - label?: string (왼쪽 라벨 느낌)
 * - speedSec?: number (속도)
 */

const scroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

const Bar = styled.div`
  width: 100%;
  height: 32px;
  background: #0b0f1a;
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
  animation: ${scroll} ${({ $speedSec }) => $speedSec}s linear infinite;
`;

const Segment = styled.span`
  padding: 0 24px;
`;

const Strong = styled.span`
  color: rgba(255, 255, 255, 0.98);
`;

const Accent = styled.span`
  color: #93c5fd;
`;

function fmtInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("ko-KR");
}

export default function ImpactTickerBar({
  totalPoints = 0,
  wonPerPoint = 100,
  label = "할래말래",
  speedSec = 18,
}) {
  const line = useMemo(() => {
    const p = Number(totalPoints);
    const w = Number(wonPerPoint);
    const totalWon =
      Number.isFinite(p) && Number.isFinite(w) ? Math.max(0, Math.floor(p * w)) : 0;

    return (
      <>
        <Strong>{label}</Strong>
        <span style={{ opacity: 0.45 }}> · </span>
        누적 득점 <Strong>{fmtInt(p)}점</Strong>
        <span style={{ opacity: 0.45 }}> · </span>
        1점당 <Strong>{fmtInt(w)}원</Strong> 기부
        <span style={{ opacity: 0.45 }}> · </span>
        누적 <Accent>{fmtInt(totalWon)}원</Accent>
        <span style={{ opacity: 0.45 }}> · </span>
        같이 뛰고 같이 기부해요 
      </>
    );
  }, [label, totalPoints, wonPerPoint]);

  return (
    <Bar aria-label="임팩트 티커">
      <Inner $speedSec={speedSec}>
        <Segment>{line}</Segment>
        <Segment>{line}</Segment>
      </Inner>
    </Bar>
  );
}
