import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Wrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Circle = styled.div`
  width: ${({ size }) => (size === "lg" ? 32 : size === "sm" ? 16 : 24)}px;
  height: ${({ size }) => (size === "lg" ? 32 : size === "sm" ? 16 : 24)}px;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.colors.primaryWeak};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`;

export default function Spinner({ size = "md" }) {
  return (
    <Wrap>
      <Circle size={size} />
    </Wrap>
  );
}
