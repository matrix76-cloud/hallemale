// src/components/auth/BrandHeader.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { images } from "../../utils/imageAssets";

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Logo = styled.img`
  width: 34px;
  height: 34px;
  display: block;
`;

const Title = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.title}px;
  font-weight: 600;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textStrong};
`;

export default function BrandHeader() {
  return (
    <Wrap>
      <Logo src={images.logo} alt="할래말래 로고" />
      <Title>할래말래</Title>
    </Wrap>
  );
}
