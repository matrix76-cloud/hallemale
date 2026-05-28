/* eslint-disable */
// src/components/player/PlayerSummaryCard.jsx
import React from "react";
import styled, { css } from "styled-components";

const Card = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  overflow: hidden;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AvatarImg = styled.img`
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

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Name = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Badge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eff6ff"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#1d4ed8")};
`;

const Location = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TeamChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TeamChip = styled.button`
  border: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(251,146,60,0.16)" : "#fff7ed"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fdba74" : "#c2410c")};
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`;

const TeamLogo = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fee2e2"};
  display: grid;
  place-items: center;
  font-size: 10px;
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TagChip = styled.span`
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;

  ${({ tone, theme }) => {
    const dark = theme.mode === "dark";
    if (tone === "primary") {
      return css`
        background: ${dark ? "rgba(99,102,241,0.18)" : "#e0ebff"};
        color: ${dark ? "#a5b4fc" : "#1d4ed8"};
      `;
    }
    if (tone === "outline") {
      return css`
        border: 1px solid ${theme.colors.border};
        background: ${theme.colors.card};
        color: ${theme.colors.textNormal};
      `;
    }
    if (tone === "danger") {
      return css`
        background: ${dark ? "rgba(248,113,113,0.16)" : "#fee2e2"};
        color: ${dark ? "#fca5a5" : "#b91c1c"};
      `;
    }
    return css`
      background: ${dark ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
      color: ${theme.colors.textNormal};
    `;
  }}
`;

export default function PlayerSummaryCard({ player, onTeamClick }) {
  if (!player) return null;

  const mainTeam = player.mainTeam || player.teams?.[0];

  return (
    <Card>
      <Row>
        <Avatar>
          {player.avatarUrl ? (
            <AvatarImg src={player.avatarUrl} alt={player.name} />
          ) : (
            <span>사진 없음</span>
          )}
        </Avatar>
        <Meta>
          <NameRow>
            <Name>{player.name || "이름 미등록"}</Name>
            {player.skillLevelLabel && (
              <Badge>{player.skillLevelLabel}</Badge>
            )}
          </NameRow>
          {player.locationText && <Location>{player.locationText}</Location>}
        </Meta>
      </Row>

      {mainTeam && (
        <TeamChipRow>
          <TeamChip onClick={() => onTeamClick && onTeamClick(mainTeam)}>
            <TeamLogo>
              {mainTeam.logoUrl ? (
                <TeamLogoImg src={mainTeam.logoUrl} alt={mainTeam.name} />
              ) : (
                <span>팀</span>
              )}
            </TeamLogo>
            <span>{mainTeam.name}</span>
          </TeamChip>
        </TeamChipRow>
      )}

      {Array.isArray(player.tags) && player.tags.length > 0 && (
        <TagRow>
          {player.tags.map((tag) => (
            <TagChip key={tag.id || tag.label} tone={tag.tone}>
              {tag.label}
            </TagChip>
          ))}
        </TagRow>
      )}
    </Card>
  );
}
