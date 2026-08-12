/* eslint-disable */
// src/components/auth/AuthPageHeader.jsx
// 로그인 화면에서 갈라져 나온 하위 페이지(이메일 로그인·가입·계정 찾기)의 공통 헤더.
// AuthLayout 은 헤더를 주지 않으므로 뒤로가기는 각 페이지가 직접 달아야 한다.
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

export default function AuthPageHeader({ title = "", onBack }) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) return onBack();
    navigate(-1);
  };

  return (
    <Bar>
      <BackBtn type="button" onClick={handleBack} aria-label="뒤로">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </BackBtn>
      <Title>{title}</Title>
      {/* 좌우 균형용 자리 — 제목이 가운데 오도록 */}
      <Slot />
    </Bar>
  );
}

const Bar = styled.div`
  height: 56px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 4px;
`;

const BackBtn = styled.button`
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const Title = styled.div`
  flex: 1 1 auto;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Slot = styled.div`
  width: 44px;
  flex: 0 0 auto;
`;
