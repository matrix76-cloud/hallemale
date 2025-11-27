/* eslint-disable */
import React from "react";
import styled, { css, keyframes } from "styled-components";
import { TEAM_RANKING } from "../../mock/teamsMock";
import { images } from "../../utils/imageAssets";

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
  font-size: 15px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
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
  border-radius: 16px;
  padding: 6px 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

// 🔹 헤더 줄
const ColumnsHeader = styled.div`
  display: grid;
  grid-template-columns: 48px 2fr 0.7fr 0.7fr 1.1fr;
  padding: 6px 10px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  background: #eef2ff;
  border-radius: 12px 12px 8px 8px;
  font-weight: 500;
`;

const ColLabel = styled.div`
  text-align: ${({ align }) => align || "left"};
`;

/* ================== 테두리 + 배경 애니 ================== */
const pulseBorder = keyframes`
  0% {
    border-color: transparent;
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: transparent;
  }
  10% {
    border-color: rgba(79, 70, 229, 0.9);
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.35);
    background-color: #f3f4f6; /* 옅은 회색 */
  }
  30% {
    border-color: rgba(79, 70, 229, 0.4);
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.2);
    background-color: rgba(243, 244, 246, 0.8); /* 연회색 살짝 유지 */
  }
  45% {
    border-color: transparent;
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: transparent;
  }
  100% {
    border-color: transparent;
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: transparent;
  }
`;

// 🔹 랭킹 행
const Row = styled.div`
  display: grid;
  grid-template-columns: 40px 2fr 0.7fr 0.7fr 1.1fr;
  align-items: center;
  padding: 6px 10px;
  border-radius: 10px;
  position: relative;

  &:not(:last-child) {
    margin-bottom: 2px;
  }

  /* 실시간 테두리 + 배경 하이라이트 */
  border: 1px solid transparent;

  ${({ $delay }) => css`
    animation: ${pulseBorder} 5s linear infinite;
    animation-delay: ${$delay}s;
  `}
`;

const RankCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
`;

const Medal = styled.span`
  font-size: 20px;
  line-height: 1;
`;

const TeamCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const LogoWrap = styled.div`
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

// 상위 3개 왕관
const CrownTop = styled.div`
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
`;

const CrownImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

// 🔹 팀명: 한 줄 유지, 길면 … 처리
const TeamName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatCell = styled.div`
  font-size: 12px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textStrong};
`;

// 🔹 최근 팀전적(두 줄: 숫자 + 배지)
const RecordCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11px;
  line-height: 1.1;
`;

const RecordNumbers = styled.span`
  font-weight: 600;
`;

// 승/무/패 배지
const ResultBadge = styled.span`
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  color: #ffffff;
  background: ${({ kind }) =>
    kind === "win"
      ? "#16a34a"
      : kind === "lose"
      ? "#ef4444"
      : "#6b7280"};
`;

const statMedal = (rank) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
};

export default function TeamRankingSection() {
  const rows = TEAM_RANKING.slice(0, 5); // 상위 5개만

  const handleMore = () => {
    // TODO: 전체 팀 랭킹 페이지 이동
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
          const medal = statMedal(t.rank);
          const isTop3 = t.rank <= 3;

          const wins = t.wins || 0;
          const losses = t.losses || 0;
          const draws = t.draws || 0;

          const recordNumbers =
            draws > 0 ? `${wins}:${losses}:${draws}` : `${wins}:${losses}`;

          let resultKind = "draw";
          let resultText = "무";

          if (wins > losses && wins >= draws) {
            resultKind = "win";
            resultText = "승";
          } else if (losses > wins && losses >= draws) {
            resultKind = "lose";
            resultText = "패";
          }

          // 🔁 아래에서 위로: 마지막 줄이 먼저, 위로 올라오게
          const delay = (rows.length - idx - 1) * 0.7;

          return (
            <Row key={t.clubId || t.name} $delay={delay}>
              <RankCell>
                {medal ? <Medal>{medal}</Medal> : t.rank}
              </RankCell>

              <TeamCell>
                <LogoWrap>
                  <LogoImg src={images[t.logoKey]} alt={t.name} />
                  {isTop3 && (
                    <CrownTop>
                      <CrownImg src={images.logo} alt="왕관" />
                    </CrownTop>
                  )}
                </LogoWrap>
                <TeamName title={t.name}>{t.name}</TeamName>
              </TeamCell>

              <StatCell>{Math.round(t.winRate * 100)}%</StatCell>
              <StatCell>{t.totalMatches}</StatCell>

              <RecordCell>
                <RecordNumbers>{recordNumbers}</RecordNumbers>
                <ResultBadge kind={resultKind}>{resultText}</ResultBadge>
              </RecordCell>
            </Row>
          );
        })}
      </Card>
    </SectionWrap>
  );
}
