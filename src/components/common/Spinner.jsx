import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const SIZES = {
  sm: { box: 56, font: 10, border: 3 },
  md: { box: 80, font: 12, border: 4 },
  lg: { box: 110, font: 14, border: 5 },
};

const Wrap = styled.div`
  position: relative;
  width: ${({ $box }) => $box}px;
  height: ${({ $box }) => $box}px;
`;

const Ring = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: ${({ $border }) => $border}px solid #e5e7eb;
  border-top-color: #6b7280;
  animation: ${spin} 0.9s linear infinite;
`;

const Label = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ $font }) => $font}px;
  color: #9ca3af;
  letter-spacing: -0.02em;
`;

export default function Spinner({ size = "md", label = "로딩중" }) {
  const dim = SIZES[size] || SIZES.md;
  return (
    <Wrap $box={dim.box}>
      <Ring $border={dim.border} />
      {label ? <Label $font={dim.font}>{label}</Label> : null}
    </Wrap>
  );
}
