// src/pages/home/HomePage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import HomeHeroBanner from "../../components/home/HomeHeroBanner";
import TeamProfileSection from "../../components/home/TeamProfileSection";
import WinningTickerBar from "../../components/home/WinningTickerBar";
import WinningTeamsSection from "../../components/home/WinningTeamsSection";
import TeamRankingSection from "../../components/home/TeamRankingSection";
import PlayerRankingSection from "../../components/home/PlayerRankingSection";

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

// 티커: PageContainer의 위/좌우 padding 상쇄
const TickerRow = styled.div`
  margin: -16px -16px 0;
`;

// 배너: 좌우 padding 상쇄
const HeroRow = styled.div`
  margin: 0 -16px 0;
`;

// 섹션 영역: 가로 padding 제거 (PageContainer 것만 사용)
const Inner = styled.div`
  padding: 16px 0 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export default function HomePage() {
  return (
    <Wrap>
      <Content>
        <TickerRow>
          <WinningTickerBar />
        </TickerRow>

        <HeroRow>
          <HomeHeroBanner />
        </HeroRow>

        <Inner>
          <TeamProfileSection />
          <WinningTeamsSection />
          <TeamRankingSection />
          <PlayerRankingSection />
          {/* 여기 아래에 팀 랭킹, 개인 랭킹 섹션 붙이면 됨 */}
        </Inner>
      </Content>
    </Wrap>
  );
}
