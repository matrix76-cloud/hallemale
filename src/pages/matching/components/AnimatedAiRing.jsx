/* eslint-disable */
// ✅ 1) AnimatedAiRing.jsx: 숫자 안 잘리게 링/텍스트 조정 (기본 size 조금 키우고 글자 줄임)
// src/pages/matching/components/AnimatedAiRing.jsx

import React, { useMemo } from "react";
import styled, { keyframes, css } from "styled-components";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const dashMove = keyframes`
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -40; }
`;

const Wrap = styled.div`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
`;

const Svg = styled.svg`
  width: 100%;
  height: 100%;
  display: block;
`;

const SpinLayer = styled.div`
  position: absolute;
  inset: 0;
  ${({ $speed }) => css`
    animation: ${spin} ${$speed}s linear infinite;
  `}
  transform-origin: 50% 50%;
`;

const Center = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  line-height: 1.1;
`;

const PercentText = styled.div`
  font-size: 16px; /* ✅ 18 → 16 */
  font-weight: 800;
  color: #111827;
`;

const LabelText = styled.div`
  margin-top: 2px;
  font-size: 10px; /* ✅ 11 → 10 */
  color: #6b7280;
`;

const DottedCircle = styled.circle`
  ${({ $duration }) => css`
    animation: ${dashMove} ${$duration}s linear infinite;
  `}
`;

export default function AnimatedAiRing({
  percent = 60,
  size = 72, // ✅ 64 → 72 (기본 링 조금 키움)
  label = "확률",
}) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));

  const strokeW = 6;
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = useMemo(() => (c * p) / 100, [c, p]);

  return (
    <Wrap $size={size}>
      <Svg viewBox="0 0 80 80" aria-label={`${p}% ${label}`}>
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(17,24,39,0.08)"
          strokeWidth={strokeW}
        />

        <DottedCircle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(17,24,39,0.18)"
          strokeWidth="2"
          strokeDasharray="2 5"
          $duration={2.4}
        />

        <g transform="rotate(-90 40 40)">
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="rgba(79,70,229,0.95)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </g>
      </Svg>

      <SpinLayer $speed={1.6}>
        <Svg viewBox="0 0 80 80">
          <g transform="rotate(-90 40 40)">
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="rgba(99,102,241,0.85)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="14 240"
              style={{ filter: "blur(0.4px)" }}
            />
          </g>
        </Svg>
      </SpinLayer>

      <Center>
        <div>
          <PercentText>{p}%</PercentText>
          <LabelText>{label}</LabelText>
        </div>
      </Center>
    </Wrap>
  );
}
