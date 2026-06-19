import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const SIZES = {
  sm: { box: 38, font: 9, border: 2 },
  md: { box: 54, font: 10, border: 3 },
  lg: { box: 74, font: 12, border: 4 },
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
  border: ${({ $border }) => $border}px solid
    ${({ theme }) =>
      theme.mode === "dark" ? "rgba(255,255,255,0.10)" : "#e5e7eb"};
  border-top-color: ${({ theme }) => theme.colors.textWeak};
  animation: ${spin} 0.9s linear infinite;
`;

const Label = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ $font }) => $font}px;
  color: ${({ theme }) => theme.colors.textWeak};
  letter-spacing: -0.02em;
`;

const FullScreen = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  pointer-events: none;
`;

export default function Spinner({ size = "md", label = "로딩중", fullscreen = true }) {
  const dim = SIZES[size] || SIZES.md;
  const inner = (
    <Wrap $box={dim.box}>
      <Ring $border={dim.border} />
      {label ? <Label $font={dim.font}>{label}</Label> : null}
    </Wrap>
  );

  if (fullscreen) {
    return <FullScreen>{inner}</FullScreen>;
  }
  return inner;
}
