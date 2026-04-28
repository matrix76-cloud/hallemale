// src/layouts/AuthLayout.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { Outlet } from "react-router-dom";

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 0;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  min-height: 100vh;
  min-height: 100dvh;

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
