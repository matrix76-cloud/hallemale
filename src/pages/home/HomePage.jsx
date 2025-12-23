// src/pages/home/HomePage.jsx
// (Context 기반: HomePage에서 loadHomePageData 직접 호출 금지)
/* eslint-disable */
import React, { useMemo, useEffect } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import HomeHeroBanner from "../../components/home/HomeHeroBanner";
import TeamProfileSection from "../../components/home/TeamProfileSection";
import WinningTeamsSection from "../../components/home/WinningTeamsSection";
import TeamRankingSection from "../../components/home/TeamRankingSection";
import PlayerRankingSection from "../../components/home/PlayerRankingSection";
import FavoriteTeamsSection from "../../components/home/FavoriteTeamsSection";
import FavoritePlayersSection from "../../components/home/FavoritePlayersSection";
import AppFooter from "../../components/common/AppFooter";

import { useAuth } from "../../hooks/useAuth";
import ImpactTickerBar from "../../components/home/ImpactDonationBar";
import Spinner from "../../components/common/Spinner";
import { useHomeData } from "../../hooks/useHomeData";
import { useClub } from "../../hooks/useClub";
import useMatchRoomCounts from "../../hooks/useMatchRoomCounts";

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

const TickerRow = styled.div`
  margin: -16px -16px 0;
`;

const HeroRow = styled.div`
  margin: 0 -16px 0;
`;

const Inner = styled.div`
  padding: 16px 0 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FooterBleed = styled.div`
  margin-left: -16px;
  margin-right: -16px;
`;

const LoadingCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
`;

export default function HomePage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const { club } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();

  const { homeData, loading: homeLoading, refreshFavorites } = useHomeData();

  // ✅ 즐겨찾기만 페이지 진입마다 갱신
  useEffect(() => {
    if (!uid) return;
    refreshFavorites && refreshFavorites(uid);
  }, [uid, refreshFavorites]);

  // ✅ 매칭룸 카운트 실시간
  const { counts: matchRoomCounts } = useMatchRoomCounts({ clubId: myClubId });

  const footerLinks = useMemo(
    () => [
      { label: "고객센터", onClick: () => navigate("/support") },
      { label: "이용약관", onClick: () => navigate("/terms") },
      { label: "개인정보처리방침", onClick: () => navigate("/privacy") },
    ],
    [navigate]
  );

  if (authLoading) {
    return (
      <Wrap>
        <Content>
          <LoadingCenter>
            <Spinner />
          </LoadingCenter>
        </Content>
      </Wrap>
    );
  }

  if (!isLoggedIn) return null;

  if (homeLoading || !homeData) {
    return (
      <Wrap>
        <Content>
          <TickerRow onClick={() => navigate("/impact")}>
            <ImpactTickerBar totalPoints={1020} wonPerPoint={10} />
          </TickerRow>

          <HeroRow>
            <HomeHeroBanner />
          </HeroRow>

          <LoadingCenter>
            <Spinner />
          </LoadingCenter>

          <FooterBleed>
            <AppFooter brand="할래말래" links={footerLinks} />
          </FooterBleed>
        </Content>
      </Wrap>
    );
  }

  const {
    myTeam,
    myTeamRank,
    winningTeamsHighlight,
    teamRankingTop5,
    playerRankingTop5,
    favoriteTeams,
    favoritePlayers,
  } = homeData;

  return (
    <Wrap>
      <Content>
        <TickerRow onClick={() => navigate("/impact")}>
          <ImpactTickerBar totalPoints={1020} wonPerPoint={10} />
        </TickerRow>

        <HeroRow>
          <HomeHeroBanner />
        </HeroRow>

        <Inner>
          <TeamProfileSection team={myTeam} rank={myTeamRank || 1} matchRoomCounts={matchRoomCounts} />
          <WinningTeamsSection items={winningTeamsHighlight} />
          <TeamRankingSection rows={teamRankingTop5} />
          <PlayerRankingSection rows={playerRankingTop5} />
          <FavoriteTeamsSection items={favoriteTeams} />
          <FavoritePlayersSection items={favoritePlayers} />
        </Inner>

        <FooterBleed>
          <AppFooter brand="할래말래" links={footerLinks} />
        </FooterBleed>
      </Content>
    </Wrap>
  );
}
