/* eslint-disable */
// src/components/admin/AdminLoading.jsx
// jogun 스타일 로딩: BigSpinner + 텍스트 (페이지 진입/데이터 로딩용)
import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px 20px;
`;

const BigSpinner = styled.div`
  width: 44px;
  height: 44px;
  border: 4px solid #e5e7eb;
  border-top-color: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const LoadingText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
`;

export default function AdminLoading({ text = "불러오는 중..." }) {
  return (
    <Wrap>
      <BigSpinner />
      <LoadingText>{text}</LoadingText>
    </Wrap>
  );
}
