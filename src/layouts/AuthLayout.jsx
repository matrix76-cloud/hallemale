// src/layouts/AuthLayout.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { Outlet } from "react-router-dom";

const Wrap = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.colors.card};
  /* 피그마처럼 전체 화면 카드 느낌 */
  border-radius: 0;
  padding: 0;
  min-height: 100vh;

  display: flex;
  flex-direction: column;
`;

export default function AuthLayout() {
  return (
    <Wrap>
      <Card>
        <Outlet />
      </Card>
    </Wrap>
  );
}
