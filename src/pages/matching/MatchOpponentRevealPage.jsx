/* eslint-disable */
// src/pages/matching/MatchOpponentRevealPage.jsx
// 빠른 매칭 ② 상대 공개(C안) — 고정 매치업 헤더 + 상대 전체 선수단
// - 우리팀(요약) vs 상대팀(전체 선수단)
// - 사이클(재매칭) 버튼 → 새 상대 + 카드 등장 애니메이션 재생
// - "이 팀에 매칭 요청" → 기존 분석/요청 퍼널(/matching/analysis/:clubId)로 연결

import React, { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";

import { useClubContext } from "../../context/ClubContext";
import { useMatchingData } from "../../hooks/useMatchingData";
import { getTeamProfile } from "../../services/teamService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { getPlayerRankMap } from "../../services/rankingService";
import { getClubMemberCounts } from "../../services/matchingHomeService";
import { estimateWinProbability } from "../../utils/matchAnalysis";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";

const cardIn = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const Page = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
`;

/* ===== 매치업 헤더 ===== */
const MatchupBar = styled.div`
  background: ${({ theme }) => theme.colors.card};
  padding: 18px 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

const Matchup = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 10px;
  animation: ${cardIn} 0.45s ease both;
`;

const TeamCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;

  &:active {
    opacity: 0.75;
  }
`;

/* 왕관이 박스 밖으로 나와도 안 잘리도록 overflow 없는 래퍼 */
const LogoWrap = styled.div`
  position: relative;
  width: 92px;
  height: 92px;
`;

const LogoBox = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 22px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef2f1"};
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const Crown = styled.img`
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 34px;
  height: 34px;
  object-fit: contain;
  z-index: 3;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const TeamName = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const TeamMeta = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ $mine, theme }) =>
    $mine ? theme.colors.primary : theme.colors.textWeak};
`;

const VsBadge = styled.div`
  align-self: center;
  margin-top: 24px;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 16px;
  font-style: italic;
  font-weight: 800;
  display: grid;
  place-items: center;
  box-shadow: 0 6px 14px rgba(79, 70, 229, 0.32);
`;

/* ===== 선수단 ===== */
const Body = styled.div`
  flex: 1;
  padding: 16px 16px 110px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RosterHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RosterTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RosterCount = styled.span`
  color: ${({ theme }) => theme.colors.textWeak};
  font-weight: 600;
  font-size: 14px;
`;

const RosterNote = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ListCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px;
  padding: 4px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  animation: ${cardIn} 0.45s ease both;
`;

const PlayerRow = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 0;
  border: none;
  background: transparent;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  cursor: pointer;
  text-align: left;

  &:last-child {
    border-bottom: none;
  }
  &:active {
    opacity: 0.7;
  }
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const Avatar = styled.img`
  width: 46px;
  height: 46px;
  border-radius: 999px;
  object-fit: cover;
  display: block;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const PlayerCrown = styled.img`
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
`;

const PlayerTexts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const PlayerNameWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const PlayerName = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CaptainTag = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const PlayerPos = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const PlayerRank = styled.span`
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CenterState = styled.div`
  min-height: 200px;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 14px;
`;

/* ===== 하단 액션 ===== */
const Footer = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors.bg};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  display: flex;
  gap: 12px;
`;

const RequestBtn = styled.button`
  flex: 1;
  height: 56px;
  border: none;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(79, 70, 229, 0.3);
  transition: transform 0.12s ease;

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

const CycleBtn = styled.button`
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.primary};
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:active {
    transform: rotate(-180deg);
  }
  &:disabled {
    opacity: 0.5;
  }
`;

function PeopleIcon({ size = 18, color = "#4f46e5" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 6.2A3 3 0 0 1 16 12M17 14.4c2.3.5 4 2.3 4 4.6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CycleIcon({ size = 24, color = "#4f46e5" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.3-4.9M4 13a8 8 0 0 0 14.3 4.9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 4v3.5h-3.5M4 20v-3.5h3.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MatchOpponentRevealPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const region = location.state?.region || "";
  const regionGu = String(location.state?.regionGu || "").trim();
  const regionSido = String(location.state?.regionSido || "").trim();

  const { activeTeamId, loading: clubLoading } = useClubContext();
  const { myTeam, opponentTeams, preloadMatchingHomeData } = useMatchingData();

  const [rankMap, setRankMap] = useState(null);
  const [playerRankMap, setPlayerRankMap] = useState(null);
  const [memberCounts, setMemberCounts] = useState(null); // Map | null(로딩 중)
  const [cycle, setCycle] = useState(0);
  const [oppDetail, setOppDetail] = useState(null); // 선택 상대 멤버 조립본
  const [loadingDetail, setLoadingDetail] = useState(true);

  // 데이터 미로딩 진입 대비
  useEffect(() => {
    if (clubLoading || !activeTeamId) return;
    if (myTeam && opponentTeams?.length) return;
    preloadMatchingHomeData(activeTeamId).catch(() => {});
  }, [clubLoading, activeTeamId, myTeam, opponentTeams, preloadMatchingHomeData]);

  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((m) => alive && setRankMap(m))
      .catch(() => {});
    getPlayerRankMap()
      .then((m) => alive && setPlayerRankMap(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 선택 지역의 팀만 보여준다(폴백 없음)
  const pool = useMemo(() => {
    const all = Array.isArray(opponentTeams) ? opponentTeams : [];
    if (!regionGu && !regionSido) return all;
    return all.filter((t) => {
      const tGu = String(t.regionGu || "").trim();
      const tSido = String(t.regionSido || "").trim();
      const tRegion = String(t.region || "").trim();

      // 1) 구조화된 지역(regionSido/regionGu)이 정확히 일치
      const structuredMatch =
        (!regionGu || tGu === regionGu) && (!regionSido || tSido === regionSido);
      if ((tGu || tSido) && structuredMatch) return true;

      // 2) 구조화된 지역이 없는 팀은 자유 텍스트 region 문자열로 폴백 매칭
      if (!tGu && !tSido && tRegion) {
        if (regionGu && tRegion.includes(regionGu)) return true;
        if (regionSido && tRegion.includes(regionSido)) return true;
      }
      return false;
    });
  }, [opponentTeams, regionGu, regionSido]);

  // 후보 팀 멤버 수 조회 → 3명 미만 팀은 제외
  const poolIdsKey = useMemo(
    () =>
      pool
        .map((t) => String(t.clubId || t.id || "").trim())
        .filter(Boolean)
        .join(","),
    [pool]
  );

  useEffect(() => {
    const ids = poolIdsKey ? poolIdsKey.split(",") : [];
    if (ids.length === 0) {
      setMemberCounts(new Map());
      return;
    }
    let alive = true;
    setMemberCounts(null);
    getClubMemberCounts(ids)
      .then((m) => alive && setMemberCounts(m))
      .catch(() => alive && setMemberCounts(new Map()));
    return () => {
      alive = false;
    };
  }, [poolIdsKey]);

  // 팀원 3명 이상인 팀만 매칭 대상
  const eligiblePool = useMemo(() => {
    if (!memberCounts) return null; // 멤버 수 로딩 중
    return pool.filter(
      (t) =>
        (memberCounts.get(String(t.clubId || t.id || "").trim()) || 0) >=
        MIN_TEAM_MEMBERS
    );
  }, [pool, memberCounts]);

  const countsLoading = eligiblePool === null;
  const opponent =
    eligiblePool && eligiblePool.length
      ? eligiblePool[cycle % eligiblePool.length]
      : null;
  const oppId = opponent ? String(opponent.clubId || opponent.id || "").trim() : "";

  // 상대 선수단 로드
  useEffect(() => {
    if (!oppId) {
      setOppDetail(null);
      setLoadingDetail(false);
      return;
    }
    let alive = true;
    setLoadingDetail(true);
    getTeamProfile(oppId)
      .then((p) => {
        if (alive) setOppDetail(p || null);
      })
      .catch(() => alive && setOppDetail(null))
      .finally(() => alive && setLoadingDetail(false));
    return () => {
      alive = false;
    };
  }, [oppId]);

  const myRank = rankMap?.get?.(String(activeTeamId)) || null;
  const oppRank = oppId && rankMap?.get?.(oppId);
  const winProb = useMemo(() => {
    if (!myTeam || !opponent) return null;
    try {
      return estimateWinProbability(myTeam, opponent)?.prob ?? null;
    } catch {
      return null;
    }
  }, [myTeam, opponent]);

  const members = Array.isArray(oppDetail?.members) ? oppDetail.members : [];

  const eligibleCount = eligiblePool ? eligiblePool.length : 0;

  const handleCycle = () => {
    if (eligibleCount <= 1) return;
    setCycle((c) => c + 1);
  };

  const handleRequest = () => {
    if (!oppId) return;
    navigate(`/matching/analysis/${oppId}`);
  };

  const goTeam = (clubId) => {
    const id = String(clubId || "").trim();
    if (id) navigate(`/team/${id}`);
  };

  const goPlayer = (userId) => {
    const id = String(userId || "").trim();
    if (id) navigate(`/player/${id}`);
  };

  const ownerUid = String(oppDetail?.ownerUid || "").trim();
  const myClubId = String(myTeam?.clubId || myTeam?.id || activeTeamId || "").trim();

  const showInitialLoading = clubLoading || !myTeam || countsLoading;

  if (showInitialLoading) {
    return (
      <Page>
        <CenterState>
          <Spinner />
        </CenterState>
      </Page>
    );
  }

  if (!opponent) {
    return (
      <Page>
        <CenterState>
          {region ? `${region} 주변에 ` : ""}팀원 {MIN_TEAM_MEMBERS}명 이상인 매칭
          가능한 상대가 아직 없어요.
        </CenterState>
      </Page>
    );
  }

  const myMeta = `우리팀${myRank ? ` · ${myRank}위` : ""}`;
  const oppMetaParts = [];
  if (oppRank) oppMetaParts.push(`${oppRank}위`);
  if (winProb != null) oppMetaParts.push(`${winProb}%`);
  const oppMeta = oppMetaParts.join(" · ");

  // 애니메이션 재생용 키(상대/사이클 바뀔 때마다 등장 애니메이션 다시)
  const animKey = `${oppId}-${cycle}`;

  return (
    <Page>
      <MatchupBar>
        <Matchup key={animKey}>
          <TeamCol onClick={() => goTeam(myClubId)}>
            <LogoWrap>
              {myRank && myRank <= 3 ? <Crown src={images.logo} alt={`${myRank}위`} /> : null}
              <LogoBox>
                <LogoImg
                  src={teamLogoSrc(myTeam?.logoUrl || images[myTeam?.logoKey])}
                  alt={myTeam?.name || "우리팀"}
                />
              </LogoBox>
            </LogoWrap>
            <TeamName>{myTeam?.name || "우리팀"}</TeamName>
            <TeamMeta $mine>{myMeta}</TeamMeta>
          </TeamCol>

          <VsBadge>VS</VsBadge>

          <TeamCol onClick={() => goTeam(oppId)}>
            <LogoWrap>
              {oppRank && oppRank <= 3 ? <Crown src={images.logo} alt={`${oppRank}위`} /> : null}
              <LogoBox>
                <LogoImg
                  src={teamLogoSrc(opponent.logoUrl || images[opponent.logoKey])}
                  alt={opponent.name}
                />
              </LogoBox>
            </LogoWrap>
            <TeamName>{opponent.name}</TeamName>
            <TeamMeta>{oppMeta || "상대팀"}</TeamMeta>
          </TeamCol>
        </Matchup>
      </MatchupBar>

      <Body>
        <RosterHead>
          <RosterTitle>
            <PeopleIcon />
            상대팀 선수단 <RosterCount>{members.length}명</RosterCount>
          </RosterTitle>
          <RosterNote>라인업은 매칭 후 확정</RosterNote>
        </RosterHead>

        {loadingDetail ? (
          <CenterState>
            <Spinner />
          </CenterState>
        ) : members.length === 0 ? (
          <CenterState>아직 등록된 선수단 정보가 없어요.</CenterState>
        ) : (
          <ListCard key={animKey}>
            {members.map((m, idx) => {
              const uid = String(m.userId || m.id || "").trim();
              const isLeader = ownerUid ? uid === ownerUid : idx === 0;
              const pRank = uid && playerRankMap?.get?.(uid);
              const showPlayerCrown = pRank && pRank <= 3;
              return (
                <PlayerRow
                  key={uid || idx}
                  type="button"
                  onClick={() => goPlayer(uid)}
                >
                  <AvatarWrap>
                    {showPlayerCrown ? (
                      <PlayerCrown src={images.logo} alt={`${pRank}위`} />
                    ) : null}
                    {m.avatarUrl ? (
                      <Avatar
                        src={m.avatarUrl}
                        alt={m.name || m.nickname || "선수"}
                      />
                    ) : (
                      <AvatarPlaceholder size={46} />
                    )}
                  </AvatarWrap>

                  <PlayerTexts>
                    <PlayerNameWrap>
                      <PlayerName>{m.name || m.nickname || "선수"}</PlayerName>
                      {isLeader ? <CaptainTag>팀장</CaptainTag> : null}
                    </PlayerNameWrap>
                    <PlayerPos>{m.position || m.positionLabel || "포지션 미정"}</PlayerPos>
                  </PlayerTexts>

                  {pRank ? <PlayerRank>{pRank}위</PlayerRank> : null}
                </PlayerRow>
              );
            })}
          </ListCard>
        )}
      </Body>

      <Footer>
        <RequestBtn type="button" onClick={handleRequest} disabled={!oppId}>
          이 팀에 매칭 요청
        </RequestBtn>
        <CycleBtn
          type="button"
          onClick={handleCycle}
          disabled={eligibleCount <= 1}
          aria-label="다른 상대 찾기"
          title="다른 상대 찾기"
        >
          <CycleIcon />
        </CycleBtn>
      </Footer>
    </Page>
  );
}
