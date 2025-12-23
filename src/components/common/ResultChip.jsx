/* eslint-disable */
// src/components/common/ResultChip.jsx
import React from "react";
import styled from "styled-components";

const CHIP_SIZES = {
  sm: {
    fontSize: 10,
    height: 20,
    minWidth: 22,
    padding: "1px 6px",
    radius: 4,
  },
  md: {
    fontSize: 12,
    height: 24,
    minWidth: 26,
    padding: "2px 8px",
    radius: 4,
  },
  lg: {
    fontSize: 14,
    height: 28,
    minWidth: 30,
    padding: "3px 10px",
    radius: 4,
  },
};

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;

  ${({ $size }) => {
    const s = CHIP_SIZES[$size] || CHIP_SIZES.md;
    return `
      font-size: ${s.fontSize}px;
      height: ${s.height}px;
      min-width: ${s.minWidth}px;
      padding: ${s.padding};
      border-radius: ${s.radius}px;
    `;
  }}

  ${({ $variant }) => {
    if ($variant === "win") {
      return `
        background: #16a34a;
      `;
    }
    if ($variant === "draw") {
      return `
        background: #9ca3af;
      `;
    }
    if ($variant === "lose") {
      return `
        background: #dc2626;
      `;
    }
    return `
      background: #6b7280;
    `;
  }}
`;

// type: "WIN" | "LOSE" | "DRAW" | "W" | "L" | "D"
// size: "sm" | "md" | "lg"
export function ResultChip({ type = "WIN", size = "md", children }) {
  const t = String(type || "").toUpperCase();

  let variant = "draw";
  let defaultLabel = "무";

  if (t === "WIN" || t === "W" || t === "승") {
    variant = "win";
    defaultLabel = "승";
  } else if (t === "LOSE" || t === "L" || t === "패") {
    variant = "lose";
    defaultLabel = "패";
  }

  const label = children || defaultLabel;

  return (
    <Chip $size={size} $variant={variant}>
      {label}
    </Chip>
  );
}

// 편의용 래퍼들(각각 컴포넌트로도 사용 가능)
export function WinChip({ size = "md", children }) {
  return (
    <ResultChip type="WIN" size={size}>
      {children || "승"}
    </ResultChip>
  );
}

export function DrawChip({ size = "md", children }) {
  return (
    <ResultChip type="DRAW" size={size}>
      {children || "무"}
    </ResultChip>
  );
}

export function LoseChip({ size = "md", children }) {
  return (
    <ResultChip type="LOSE" size={size}>
      {children || "패"}
    </ResultChip>
  );
}
