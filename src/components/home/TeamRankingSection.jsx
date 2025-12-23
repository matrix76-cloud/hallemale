/* eslint-disable */
// src/components/home/TeamRankingSection.jsx
// ✅ 요청: 1등/2등/3등 Row 배경을 "선수 카드 느낌"으로 (회색 계열로 통일)
// - Top3: 연한 회색 배경 + 은은한 테두리/그림자(고정)
// - 나머지: 기존 pulseBorder 애니 유지
// - 팀 로고는 그대로, 순위 뱃지는 왕관+텍스트 유지

import React from "react";
import styled, { css, keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";

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

const Card = styled.div`
  background: #f9fafb;
  border-radius: 18px;
  padding: 8px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ColumnsHeader = styled.div`
  display: grid;
  grid-template-columns: 44px 2fr 0.7fr 0.7fr 1.1fr;
  padding: 8px 12px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  background: #eef2ff;
  border-radius: 14px 14px 10px 10px;
  font-weight: 500;
`;

const ColLabel = styled.div`
  text-align: ${({ align }) => align || "left"};
`;

/* 기존 pulse */
const pulseBorder = keyframes`
  0% { border-color: transparent; box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); background-color: transparent; }
  10% { border-color: rgba(79, 70, 229, 0.9); box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.35); background-color: #f3f4f6; }
  30% { border-color: rgba(79, 70, 229, 0.4); box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2); background-color: rgba(243, 244, 246, 0.8); }
  45% { border-color: transparent; box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); background-color: transparent; }
  100% { border-color: transparent; box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); background-color: transparent; }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 44px 2fr 0.7fr 0.7fr 1.1fr;
  align-items: center;
  padding: 10px 12px;
  min-height: 54px;
  border-radius: 14px;
  position: relative;
  cursor: pointer;

  &:not(:last-child) {
    margin-bottom: 6px;
  }

  border: 1px solid transparent;

  /* ✅ Top3는 회색 카드 고정, 나머지는 pulse */
  ${({ $top }) =>
    $top
      ? css`
          background: #ffffff;
          border-color: rgba(15, 23, 42, 0.08);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
        `
      : css`
          animation: ${pulseBorder} 5s linear infinite;
        `}
  ${({ $top, $delay }) =>
    !$top &&
    css`
      animation-delay: ${$delay}s;
    `}
`;

const RankCell = styled.div`
  width: 38px;
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: center;
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


// const RankBadge = styled.div`
//   width: 28px;
//   height: 28px;
//   border-radius: 999px;
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   font-size: 11px;
//   font-weight: 800;
//   line-height: 1;
//   position: relative;

//   background: ${({ $variant }) =>
//     $variant === "gold"
//       ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 55%, #fef3c7 100%)"
//       : $variant === "silver"
//       ? "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 55%, #f9fafb 100%)"
//       : $variant === "bronze"
//       ? "linear-gradient(135deg, #f97316 0%, #ea580c 55%, #fed7aa 100%)"
//       : "#f3f4f6"};

//   color: ${({ $variant }) => ($variant ? "#ffffff" : "#111827")};
//   box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04);

//   ${({ $variant }) =>
//     $variant &&
//     css`
//       &::before {
//         content: "";
//         position: absolute;
//         bottom: 100%;
//         left: 50%;
//         transform: translateX(-50%);
//         border-bottom: 6px solid
//           ${$variant === "gold"
//             ? "#fbbf24"
//             : $variant === "silver"
//             ? "#d1d5db"
//             : "#f97316"};
//         border-left: 5px solid transparent;
//         border-right: 5px solid transparent;
//       }
//     `}
// `;

const CrownImg = styled.img`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 28px;
  object-fit: contain;
  pointer-events: none;
`;

const TeamCell = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LogoWrap = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
`;

const StatCell = styled.div`
  font-size: 12px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RecordCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11px;
  line-height: 1.1;
  gap: 4px;
`;

const RecordNumbers = styled.span`
  font-weight: 600;
`;

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function formatWinRatePct(winRate) {
  const wr = toNum(winRate, NaN);
  if (!Number.isFinite(wr)) return "0%";
  return `${Math.round(wr * 100)}%`;
}

function getRankVariant(rank) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "";
}

function rankLabel(rank) {
  if (rank === 1) return "1등";
  if (rank === 2) return "2등";
  if (rank === 3) return "3등";
  return String(rank || "");
}

export default function TeamRankingSection({ rows = [] }) {
  const nav = useNavigate();

  const handleMore = () => nav(`/teamranking`);

  const handleTeamClick = (clubId) => {
    if (!clubId) return;
    nav(`/team/${clubId}`);
  };

  if (!rows.length) return null;

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>전체 팀 랭킹 바로보기</SectionTitle>
        <MoreButton type="button" onClick={handleMore}>
          전체보기
        </MoreButton>
      </HeaderRow>

      <Card>
        <ColumnsHeader>
          <ColLabel align="center">순위</ColLabel>
          <ColLabel>팀명</ColLabel>
          <ColLabel align="center">승률</ColLabel>
          <ColLabel align="center">참가</ColLabel>
          <ColLabel align="center">최근 팀전적</ColLabel>
        </ColumnsHeader>

        {rows.map((t, idx) => {
          const wins = toNum(t.wins, 0);
          const losses = toNum(t.losses, 0);
          const draws = toNum(t.draws, 0);

          const recordNumbers = draws > 0 ? `${wins}:${losses}:${draws}` : `${wins}:${losses}`;

          let resultKind = "draw";
          if (wins > losses && wins >= draws) resultKind = "win";
          else if (losses > wins && losses >= draws) resultKind = "lose";

          const delay = (rows.length - idx - 1) * 0.7;

          const teamId = t.clubId || t.id;
          const logoSrc =
            (t.logoUrl && String(t.logoUrl).trim()) ||
            (t.logoKey && images[t.logoKey]) ||
            images.logo;

          const rank = t.rank || idx + 1;
          const variant = getRankVariant(rank);
          const showCrown = rank <= 3;
          const isTop = rank <= 3;

          return (
            <Row
              key={teamId || t.name || idx}
              $delay={delay}
              $top={isTop}
              onClick={() => handleTeamClick(teamId)}
            >
              <RankCell>
                <RankBadge $variant={variant}>
                  {showCrown ? <CrownImg src={images.logo} alt="crown" /> : null}
                  {rankLabel(rank)}
                </RankBadge>
              </RankCell>

              <TeamCell>
                <LogoWrap>
                  <LogoImg src={logoSrc} alt={t.name} />
                </LogoWrap>
                <TeamName title={t.name}>{t.name}</TeamName>
              </TeamCell>

              <StatCell>{formatWinRatePct(t.winRate)}</StatCell>
              <StatCell>{toNum(t.totalMatches, 0)}</StatCell>

              <RecordCell>
                <RecordNumbers>{recordNumbers}</RecordNumbers>
                {resultKind === "win" && <WinChip size="sm" />}
                {resultKind === "lose" && <LoseChip size="sm" />}
                {resultKind === "draw" && <DrawChip size="sm" />}
              </RecordCell>
            </Row>
          );
        })}
      </Card>
    </SectionWrap>
  );
}
