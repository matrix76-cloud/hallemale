/* eslint-disable */
// src/components/player/PlayerSummaryCard.jsx
import React from "react";
import styled, { css } from "styled-components";

const Card = styled.section`
  background: #ffffff;
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.06);
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
  background: #f3f4f6;
  overflow: hidden;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: #9ca3af;
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
  color: #111827;
`;

const Badge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
`;

const Location = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const TeamChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TeamChip = styled.button`
  border: none;
  background: #fff7ed;
  color: #c2410c;
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
  background: #fee2e2;
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

  ${({ tone }) => {
    if (tone === "primary") {
      return css`
        background: #e0ebff;
        color: #1d4ed8;
      `;
    }
    if (tone === "outline") {
      return css`
        border: 1px solid #e5e7eb;
        background: #ffffff;
        color: #4b5563;
      `;
    }
    if (tone === "danger") {
      return css`
        background: #fee2e2;
        color: #b91c1c;
      `;
    }
    return css`
      background: #f3f4f6;
      color: #4b5563;
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
