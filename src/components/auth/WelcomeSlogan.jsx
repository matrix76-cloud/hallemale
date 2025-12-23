// src/components/auth/WelcomeSlogan.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";

const Wrap = styled.section`
  margin-left: 4px;
`;

const Line1 = styled.div`
  /* 더 크게: theme에 titleXl이 있으면 그거 쓰고, 없으면 28px */
  font-size: ${({ theme }) => theme.fontSizes.titleXl || 28}px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: ${({ theme }) => theme.lineHeights.tight};

  font-family:"GmarketSans";
`;

const Line2 = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.titleXl || 28}px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.primary};
  margin-top: 6px;
  font-family:"GmarketSans";
`;

export default function WelcomeSlogan() {
  return (
    <Wrap>
      <Line1>
        이번주,
        <br />
        경기 한판
      </Line1>
      <Line2>할래말래</Line2>
    </Wrap>
  );
}
