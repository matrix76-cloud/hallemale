/* eslint-disable */
// src/components/team/TeamStatsSection.jsx
import React from "react";
import styled from "styled-components";

const Section = styled.section`
  margin-top: 24px;
`;

const Title = styled.h2`
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
`;

const LineBox = styled.div`

  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #4b5563;
`;

const StatLabel = styled.span`
  color: #6b7280;
`;

const StatValue = styled.span`
  font-weight: 600;
  color: #111827;
`;

export default function TeamStatsSection({ stats, streak }) {
  if (!stats) return null;

  const total = stats.totalMatches ?? 0;
  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const winRatePercent = stats.winRatePercent ?? 0;
  const streakLabel = streak?.label;

  return (
    <Section>
    
      <LineBox>
        <StatRow>
          <StatLabel>경기 수</StatLabel>
          <StatValue>{total}</StatValue>
        </StatRow>
        <StatRow>
          <StatLabel>승률</StatLabel>
          <StatValue>{winRatePercent}%</StatValue>
        </StatRow>
        <StatRow>
          <StatLabel>최근 상태</StatLabel>
          <StatValue>{streakLabel || "-"}</StatValue>
        </StatRow>
        <StatRow>
          <StatLabel>상세</StatLabel>
          <StatValue>
            {total}전 {wins}승 {losses}패 {draws}무
          </StatValue>
        </StatRow>
      </LineBox>
    </Section>
  );
}
