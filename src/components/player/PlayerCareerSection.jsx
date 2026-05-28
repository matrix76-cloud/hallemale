/* eslint-disable */
// src/components/player/PlayerCareerSection.jsx
import React from "react";
import styled from "styled-components";

const Section = styled.section`
  margin-top: 16px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 6px;
`;

const StatCard = styled.div`
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border-radius: 8px;
  padding: 6px 4px;
  text-align: center;
`;

const StatLabel = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const StatValue = styled.div`
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
`;

const CareerTitle = styled.div`
  flex: 1.7;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CareerMeta = styled.div`
  flex: 1;
  text-align: right;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function PlayerCareerSection({ stats, careers }) {
  if (
    (!stats || Object.keys(stats || {}).length === 0) &&
    (!Array.isArray(careers) || careers.length === 0)
  ) {
    return null;
  }

  return (
    <Section>

      {Array.isArray(careers) && careers.length > 0 && (
        <List>
          {careers.map((c) => (
            <Row key={c.id || c.title + c.dateText}>
              <CareerTitle>{c.title}</CareerTitle>
              <CareerMeta>{c.dateText}</CareerMeta>
            </Row>
          ))}
        </List>
      )}
    </Section>
  );
}
