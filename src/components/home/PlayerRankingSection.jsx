/* eslint-disable */
// src/components/home/PlayerRankingSection.jsx
// ✅ 팀장 뱃지 위치: "아바타 이미지 밑"으로 이동 (p.isTeamCaptain === true)
// ✅ 나머지(왕관/랭킹/카드)는 그대로

import React from "react";
import styled, { keyframes, css } from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import PositionChip from "../common/PositionChip";

const SectionWrap = styled.section`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: "GmarketSans";
`;

const MoreButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  font-size: 13px;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RowWrap = styled.div`
  display: flex;
  align-items: stretch;
  gap: 6px;
`;

const RankCell = styled.div`
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
`;

const RankNumber = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RankBadge = styled.div`
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  background: rgba(17, 24, 39, 0.06);
  color: #111827;
`;

const CrownImg = styled.img`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
`;

const NewBadge = styled.span`
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  background: #22c55e;
  color: #ffffff;
`;

const blinkHighlight = keyframes`
  0% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: #ffffff;
  }
  40% {
    border-color: rgba(79, 70, 229, 0.9);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25);
    background-color: #fef9c3;
  }
  60% {
    border-color: rgba(79, 70, 229, 0.4);
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.15);
    background-color: rgba(254, 249, 195, 0.7);
  }
  100% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: #ffffff;
  }
`;

const PlayerCard = styled.div`
  flex: 1;
  border-radius: 18px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;

  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  border: 1px solid transparent;
  cursor: pointer;

  ${({ $highlight }) =>
    $highlight &&
    css`
      animation: ${blinkHighlight} 3.2s ease-in-out infinite;
    `}
`;

/* ✅ 아바타 + 팀장뱃지 세로 스택 */
const AvatarStack = styled.div`
  width: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const AvatarCircle = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  object-fit: cover;
`;

/* ✅ 팀장 pill (아바타 밑) */
const CaptainPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 10px;
  border-radius: 999px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

const PlayerMeta = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const PlayerName = styled.span`
  font-size: 14px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatRow = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamPill = styled.div`
  margin-left: 4px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`;

const TeamLogoWrap = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
`;

function positionLabel(pos) {
  const p = String(pos || "").trim();
  if (p === "guard") return "가드";
  if (p === "forward") return "포워드";
  if (p === "center") return "센터";
  return "";
}

function rankLabel(rank) {
  if (rank === 1) return "1등";
  if (rank === 2) return "2등";
  if (rank === 3) return "3등";
  return String(rank || "");
}

export default function PlayerRankingSection({ rows = [] }) {
  const nav = useNavigate();

  const handleMore = () => {
    nav(`/playerranking`);
  };

  const handlePlayerClick = (userId) => {
    if (!userId) return;
    nav(`/player/${userId}`);
  };

  const handleTeamClick = (clubId) => {
    if (!clubId) return;
    nav(`/team/${clubId}`);
  };

  if (!rows.length) return null;

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>개인 랭킹 바로보기</SectionTitle>
        <MoreButton type="button" onClick={handleMore}>
          전체보기
        </MoreButton>
      </HeaderRow>

      <ListWrap>
        {rows.map((p, index) => {
          const rank = p.rank || index + 1;
          const showCrown = rank <= 3;

          const avatarSrc =
            (p.avatarUrl && String(p.avatarUrl).trim()) ||
            images.profileDefault ||
            images.logo;

          const clubLogoSrc =
            (p.clubLogoUrl && String(p.clubLogoUrl).trim()) || images.logo;

          const clubName = p.clubName || "소속 없음";

          const isTop1 = rank === 1;
          const isTop3 = rank === 3;
          const highlight = isTop1 || isTop3;

          return (
            <RowWrap key={`${p.userId}-${rank}`}>
              <RankCell>
                {showCrown ? (
                  <RankBadge>
                    <CrownImg src={images.logo} alt="crown" />
                    {rankLabel(rank)}
                  </RankBadge>
                ) : (
                  <RankNumber>{rank}</RankNumber>
                )}
                {isTop3 && <NewBadge>NEW</NewBadge>}
              </RankCell>

              <PlayerCard
                $highlight={highlight}
                onClick={() => handlePlayerClick(p.userId)}
              >
                <AvatarStack>
                  <AvatarCircle
                    src={avatarSrc}
                    alt={p.name || p.nickname || "player"}
                  />
                  {p.isTeamCaptain === true ? <CaptainPill>팀장</CaptainPill> : null}
                </AvatarStack>

                <PlayerMeta>
                  <NameRow>
                    <PlayerName>{p.name || p.nickname || "사용자"}</PlayerName>
                    <PositionChip label={positionLabel(p.mainPosition)} size="sm" />
                  </NameRow>

                  <StatRow>
                    {p.wins || 0}승 {p.losses || 0}패 {p.draws || 0}무
                  </StatRow>
                </PlayerMeta>

                <TeamPill
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTeamClick(p.clubId);
                  }}
                >
                  <TeamLogoWrap>
                    <TeamLogoImg src={clubLogoSrc} alt={clubName} />
                  </TeamLogoWrap>
                  <TeamName>{clubName}</TeamName>
                </TeamPill>
              </PlayerCard>
            </RowWrap>
          );
        })}
      </ListWrap>
    </SectionWrap>
  );
}
