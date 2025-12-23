/* eslint-disable */
// src/components/home/TeamProfileSection.jsx
import React from "react";
import styled from "styled-components";
import { images } from "../../utils/imageAssets";
import { useNavigate } from "react-router-dom";

const SectionWrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: "GmarketSans";
`;

/* ============ 위: 팀 프로필 카드 ============ */

const ProfileCard = styled.div`
  background: #ffffff;
  border-radius: 20px;
  padding: 16px 18px 18px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  }
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const LogoOuter = styled.div`
  position: relative;
  width: 92px;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoBase = styled.div`
  width: 140px;
  height: 100px;
  overflow: hidden;
  background: #f4f4ff;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
`;

const TeamMeta = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TeamNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "GmarketSans";
  font-weight: 500;
`;

const TeamName = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MemberBadge = styled.div`
  padding: 2px 8px;
  border-radius: 999px;
  background: #f4f4f5;
  font-size: 11px;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MemberIcon = styled.span`
  font-size: 12px;
`;

const TeamDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  word-break: keep-all;
`;

const TagRow = styled.div`
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Tag = styled.span`
  font-size: 11px;
  color: #6366f1;
`;

/* ============ 아래: 기능 카드 2개 (1안: 타이틀/서브 2줄 리듬 통일) ============ */

const ActionsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const ActionCard = styled.button`
  border: none;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  padding: 12px 12px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  min-width: 0;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  }
`;

const ActionIconWrap = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $tone }) =>
    $tone === "primary" ? "rgba(99, 102, 241, 0.12)" : "rgba(2, 132, 199, 0.10)"};
  flex: 0 0 auto;
`;

const ActionIcon = styled.div`
  font-size: 24px;
`;

const ActionBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ActionTitle = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  font-family: "GmarketSans";
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActionSubLine = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  line-height: 1.25;

  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  overflow: hidden;
`;

const SubItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const SubDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${({ $tone }) => ($tone === "primary" ? "#2563eb" : "#9ca3af")};
  flex: 0 0 auto;
`;

const SubText = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
`;

const SubLabel = styled.span`
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const SubCount = styled.span`
  color: ${({ $tone }) => ($tone === "primary" ? "#2563eb" : "#111827")};
`;

function toInt(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export default function TeamProfileSection({ team, rank = 1, matchRoomCounts }) {
  const navigate = useNavigate();

  if (!team) return null;

  const logoSrc =
    (team.logoUrl && String(team.logoUrl).trim()) ||
    (team.logoKey && images[team.logoKey]) ||
    images.logo;

  const memberCount = toInt(team.memberCount, NaN) ?? toInt(team.players?.length, NaN) ?? 0;
  const memberCountLabel = `${Number.isFinite(memberCount) ? memberCount : 0}명`;

  // ✅ 목업: 실데이터 아직이면 샘플로 보이게
  const ongoing = Number.isFinite(Number(matchRoomCounts?.ongoing))
    ? Number(matchRoomCounts.ongoing)
    : 2;

  const confirmed = Number.isFinite(Number(matchRoomCounts?.confirmed))
    ? Number(matchRoomCounts.confirmed)
    : 1;

  const handleManageClick = () => {
    navigate("/matching");
  };

  const handleGoMatchingRoomList = () => {
    navigate("/match-roomlist");
  };

  const handleGoMyTeamDetail = () => {
    const teamId = team.clubId || team.id;
    if (!teamId) return;
    navigate(`/team/${teamId}`);
  };

  return (
    <SectionWrap>
      <SectionTitle>팀 프로필</SectionTitle>

      <ProfileCard onClick={handleGoMyTeamDetail}>
        <TopRow>
          <LogoOuter>
            <LogoBase>
              <LogoImg src={logoSrc} alt={`${team.name} 로고`} />
            </LogoBase>
          </LogoOuter>

          <TeamMeta>
            <TeamNameRow>
              <TeamName>{team.name}</TeamName>
              <MemberBadge>
                <MemberIcon>👥</MemberIcon>
                <span>{memberCountLabel}</span>
              </MemberBadge>
            </TeamNameRow>

            <TeamDesc>{team.description}</TeamDesc>

            {team.tags && team.tags.length > 0 && (
              <TagRow>
                {team.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </TagRow>
            )}
          </TeamMeta>
        </TopRow>
      </ProfileCard>

      <ActionsRow>
        <ActionCard type="button" onClick={handleManageClick}>
          <ActionIconWrap $tone="primary">
            <ActionIcon>🏀</ActionIcon>
          </ActionIconWrap>
          <ActionBody>
            <ActionTitle>매칭하기</ActionTitle>
            <ActionSubLine>다른팀에 신청</ActionSubLine>
          </ActionBody>
        </ActionCard>

        <ActionCard type="button" onClick={handleGoMatchingRoomList}>
          <ActionIconWrap $tone="secondary">
            <ActionIcon>🗂️</ActionIcon>
          </ActionIconWrap>
          <ActionBody>
            <ActionTitle>매칭룸</ActionTitle>

            <ActionSubLine>
              <SubItem>
  
                <SubText>
                  <SubLabel>조율중</SubLabel>
                  <SubCount $tone="secondary">{ongoing}</SubCount>
                </SubText>
              </SubItem>

              <SubItem>

                <SubText>
                  <SubLabel>확정</SubLabel>
                  <SubCount $tone="primary">{confirmed}</SubCount>
                </SubText>
              </SubItem>
            </ActionSubLine>
          </ActionBody>
        </ActionCard>
      </ActionsRow>
    </SectionWrap>
  );
}
