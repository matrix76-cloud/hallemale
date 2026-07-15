// src/pages/home/HomePage.jsx
// (Context 기반: HomePage에서 loadHomePageData 직접 호출 금지)
/* eslint-disable */
import React, { useMemo, useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";

import HomeHeroBanner from "../../components/home/HomeHeroBanner";
import HomeUpcomingMatch from "../../components/home/HomeUpcomingMatch";
import TeamProfileSection from "../../components/home/TeamProfileSection";
import WinningTeamsSection from "../../components/home/WinningTeamsSection";
import TeamRankingSection from "../../components/home/TeamRankingSection";
import PlayerRankingSection from "../../components/home/PlayerRankingSection";
import FavoriteTeamsSection from "../../components/home/FavoriteTeamsSection";
import FavoritePlayersSection from "../../components/home/FavoritePlayersSection";
import AppFooter from "../../components/common/AppFooter";
import { track } from "../../utils/analytics";

import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";
import { useHomeData } from "../../hooks/useHomeData";
import { useClub } from "../../hooks/useClub";
import useMatchRoomCounts from "../../hooks/useMatchRoomCounts";
import useMatchRoomUnread from "../../hooks/useMatchRoomUnread";

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
  /* 홈은 하단 고정 탭바가 떠 있는 탭 페이지 — 최하단 푸터(법무 링크)가
     탭바 뒤로 가리지 않도록 탭바 높이만큼 여백 확보 */
  padding-bottom: calc(${({ theme }) => theme.layout.bottomTabHeight}px + 16px);
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const HeroRow = styled.div`
  margin: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(17, 24, 39, 0.08);
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

/* ───── 홈 로딩 스켈레톤 ───── */
const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;
const SkelBlock = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${({ $r }) => $r || 12}px;
  height: ${({ $h }) => $h || 120}px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#e9ecef"};

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      ${({ theme }) =>
        theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)"},
      transparent
    );
    animation: ${shimmer} 1.4s ease-in-out infinite;
  }
`;
const SkelInner = styled.div`
  padding: 16px 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export default function HomePage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const { club } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();

  const { homeData, loading: homeLoading, loadedUid, refreshFavorites, preloadHomeData, refreshHomeData } = useHomeData();

  // ✅ 현재 로그인 uid와 캐시된 homeData의 주인이 다르면 stale (계정 전환 후 이전 계정 데이터)
  const staleForUser = !!loadedUid && loadedUid !== uid;

  // 홈 진입 기록 — 리텐션/활성 퍼널
  useEffect(() => { track("home_view"); }, []);

  // ✅ preload가 안 됐거나 다른 계정 데이터면 HomePage 진입 시 직접 로드 (fallback)
  useEffect(() => {
    if (!uid || authLoading || homeLoading) return;
    if (homeData && loadedUid === uid) return; // 이미 이 계정 데이터가 있으면 스킵
    preloadHomeData(uid).catch((e) =>
      console.error("[HomePage] fallback preload failed:", e)
    );
  }, [uid, authLoading, homeLoading, homeData, loadedUid, preloadHomeData]);

  // ✅ 즐겨찾기만 페이지 진입마다 갱신
  useEffect(() => {
    if (!uid) return;
    refreshFavorites && refreshFavorites(uid);
  }, [uid, refreshFavorites]);

  // ✅ 소속팀(실시간 useClub)이 홈 캐시(homeData.myTeam)와 다르면 강제 재로딩.
  //    팀 생성/탈퇴 직후 홈에 즉시 반영되도록. (myClubId 값당 1회만 실행해 루프 방지)
  const syncedClubRef = useRef(null);
  useEffect(() => {
    if (!uid || authLoading) return;
    if (!homeData || loadedUid !== uid) return; // 최초 로드는 기존 로직이 처리
    if (syncedClubRef.current === myClubId) return;

    const shownId = String(homeData?.myTeam?.clubId || homeData?.myTeam?.id || "").trim();
    if (shownId === myClubId) {
      syncedClubRef.current = myClubId;
      return;
    }
    syncedClubRef.current = myClubId;
    refreshHomeData && refreshHomeData(uid).catch(() => {});
  }, [uid, authLoading, myClubId, homeData, loadedUid, refreshHomeData]);

  // ✅ 매칭룸 카운트 실시간 + 미확인(반응 필요) 배지
  const { counts: matchRoomCounts, attention: matchRoomAttention } = useMatchRoomCounts({
    clubId: myClubId,
    uid,
  });

  // ✅ 매칭룸 카드 배지: 안 읽은 메시지 수(실시간, 목록 카드의 빨간 배지와 동일 기준)
  const { counts: matchRoomUnread } = useMatchRoomUnread({ clubId: myClubId, uid });

  const footerLinks = useMemo(
    () => [
      { label: "이용약관", onClick: () => navigate("/terms") },
      { label: "개인정보처리방침", onClick: () => navigate("/privacy") },
      { label: "운영정책", onClick: () => navigate("/operation") },
      { label: "취소·환불 정책", onClick: () => navigate("/refund") },
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

  if (homeLoading || !homeData || staleForUser) {
    return (
      <Wrap>
        <Content>
          <HeroRow>
            <HomeHeroBanner />
          </HeroRow>

          {/* 스피너 대신 스켈레톤으로 채워 휑한 느낌 제거 */}
          <SkelInner>
            <SkelBlock $h={96} />
            <SkelBlock $h={34} $r={10} />
            <SkelBlock $h={150} />
            <SkelBlock $h={150} />
          </SkelInner>
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
        <HeroRow>
          <HomeHeroBanner />
        </HeroRow>

        <Inner>
          <HomeUpcomingMatch clubId={myClubId} />
          <TeamProfileSection
            team={myTeam}
            rank={myTeamRank || 1}
            matchRoomCounts={matchRoomCounts}
            matchRoomAttention={matchRoomAttention}
            matchRoomUnread={matchRoomUnread}
          />
          <TeamRankingSection rows={teamRankingTop5} />
          <PlayerRankingSection rows={playerRankingTop5} />
          <WinningTeamsSection items={winningTeamsHighlight} />
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
