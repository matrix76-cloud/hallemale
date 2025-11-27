// src/pages/auth/WelcomePage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import BrandHeader from "../../components/auth/BrandHeader";
import WelcomeHero from "../../components/auth/WelcomeHero";
import WelcomeSlogan from "../../components/auth/WelcomeSlogan";
import WelcomeButtonGroup from "../../components/auth/WelcomeButtonGroup";

/**
 * 구조
 * - 상단: 로고 + 히어로
 * - 중단: 슬로건 (왼쪽 정렬)
 * - 하단: 버튼 그룹 (바닥 쪽에 고정 느낌)
 */

const Wrap = styled.div`
  min-height: 100vh;
  padding: 40px 24px 32px;
  display: flex;
  flex-direction: column;
`;

const SectionTop = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`;

const SloganBlock = styled.div`
  /* 슬로건을 더 아래로 내리기 */
  margin-top: 100px;
`;

const SectionBottom = styled.div`
  margin-top: auto;
`;

export default function WelcomePage() {
  return (
    <Wrap>
      <SectionTop>
        <BrandHeader />
        <WelcomeHero />
      </SectionTop>

      <SloganBlock>
        <WelcomeSlogan />
      </SloganBlock>

      <SectionBottom>
        <WelcomeButtonGroup />
      </SectionBottom>
    </Wrap>
  );
}
