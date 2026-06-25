/* eslint-disable */
// src/pages/owner/components/OwnerSpinner.jsx
import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Wrap = styled.div`
  flex: 1;
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const Ring = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`;

const Text = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function OwnerSpinner({ label = "불러오는 중…" }) {
  return (
    <Wrap>
      <Ring />
      {label && <Text>{label}</Text>}
    </Wrap>
  );
}
