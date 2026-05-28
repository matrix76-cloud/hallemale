/* eslint-disable */
// src/components/team/TeamSummaryCard.jsx
import React from "react";
import styled from "styled-components";

const Card = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Logo = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Meta = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TeamNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TeamName = styled.span`
  font-size: 16px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RegionText = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const StreakBadge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f97316;
  color: #ffffff;
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TagChip = styled.span`
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Description = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const ActionsRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
`;

const GhostButton = styled.button`
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 6px 12px;
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`;

export default function TeamSummaryCard({
  team,
  onFavorite,
  onContact,
}) {
  if (!team) return null;

  const tags = Array.isArray(team.tags) ? team.tags : [];
  const streakLabel = team.streak?.label;

  return (
    <Card>
      <TopRow>
        <Logo>
          {team.logoUrl ? (
            <LogoImg src={team.logoUrl} alt={team.name} />
          ) : (
            <span>팀</span>
          )}
        </Logo>
        <Meta>
          <TeamNameRow>
            <TeamName>{team.name}</TeamName>
            {streakLabel && <StreakBadge>{streakLabel}</StreakBadge>}
          </TeamNameRow>
          {team.region && <RegionText>{team.region}</RegionText>}
        </Meta>
      </TopRow>

      {team.description && <Description>{team.description}</Description>}

      {tags.length > 0 && (
        <TagsRow>
          {tags.map((t) => (
            <TagChip key={t}>{t}</TagChip>
          ))}
        </TagsRow>
      )}

      <ActionsRow>
        <GhostButton type="button" onClick={onFavorite}>
          ⭐ 즐겨찾기
        </GhostButton>
        <GhostButton type="button" onClick={onContact}>
          📩 팀에게 연락
        </GhostButton>
      </ActionsRow>
    </Card>
  );
}
