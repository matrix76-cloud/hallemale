// src/components/home/TeamProfileSection.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { TEAMS } from "../../mock/teamsMock";
import { images } from "../../utils/imageAssets";
import { useNavigate } from "react-router-dom";

const SectionWrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.bodyLg || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
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
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

/* 로고 + 왕관 구조
 * LogoOuter (72x72, overflow visible)
 *  ├─ LogoBase (64x64, 둥근 로고)
 *  └─ CrownWrap (absolute, 위로 튀어나옴)
 */

const LogoOuter = styled.div`
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoBase = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 18px;
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
`;

// 👑 메인 로고(왕관 이미지) + 숫자 배지
const CrownWrap = styled.div`
  position: absolute;
  top: -20px;       /* 더 위로 */
  left: 50%;
  transform: translateX(-50%);
  width: 44px;      /* 더 크게 */
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CrownImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const CrownNumber = styled.span`
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
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
`;

const TeamName = styled.div`
  font-size: 18px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
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

/* ============ 아래: 액션 카드 두 개 ============ */

const ActionsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const ActionCard = styled.button`
  border: none;
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 12px 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`;

const ActionIconCircle = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ActionIconImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const ActionLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
`;

// 버튼 카드 아이콘 이미지 (imageAssets에 키만 맞춰두면 됨)
const ACTION_IMAGES = {
  manage: images.teamActionManage,
  pool: images.teamActionPool,
};

export default function TeamProfileSection() {
  const myTeam = TEAMS[0]; // TODO: 나중에 실제 내 클럽으로 교체
  if (!myTeam) return null;

  const logoSrc = myTeam.logoKey ? images[myTeam.logoKey] : null;
  const memberCountLabel = `${myTeam.players.length}명`;
  const rankNumber = 1; // TODO: 실제 랭킹 값으로 교체


  const navigate = useNavigate();

  const handleManageClick = () => {
    // TODO: 매칭관리 페이지로 이동
        navigate("/matching");
  };

  const handleGoMatchingPoolClick = () => {
    // TODO: 매칭 룸 페이지로 이동
      navigate("/match-rooms");
  };

  return (
    <SectionWrap>
      <SectionTitle>팀 프로필</SectionTitle>

      {/* 위: 팀 프로필 카드 */}
      <ProfileCard>
        <TopRow>
          <LogoOuter>
            <LogoBase>
              {logoSrc && <LogoImg src={logoSrc} alt={`${myTeam.name} 로고`} />}
            </LogoBase>

            <CrownWrap>
              <CrownImg src={images.logo} alt="랭킹 크라운" />
              <CrownNumber>{rankNumber}</CrownNumber>
            </CrownWrap>
          </LogoOuter>

          <TeamMeta>
            <TeamNameRow>
              <TeamName>{myTeam.name}</TeamName>
              <MemberBadge>
                <MemberIcon>👥</MemberIcon>
                <span>{memberCountLabel}</span>
              </MemberBadge>
            </TeamNameRow>
            <TeamDesc>{myTeam.description}</TeamDesc>
            {myTeam.tags && myTeam.tags.length > 0 && (
              <TagRow>
                {myTeam.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </TagRow>
            )}
          </TeamMeta>
        </TopRow>
      </ProfileCard>

      {/* 아래: 액션 카드 2개 */}
      <ActionsRow>
        <ActionCard type="button" onClick={handleManageClick}>
          <ActionIconCircle>
            <ActionIconImg src={ACTION_IMAGES.manage} alt="매칭관리" />
          </ActionIconCircle>
          <ActionLabel>매칭</ActionLabel>
        </ActionCard>

        <ActionCard type="button" onClick={handleGoMatchingPoolClick}>
          <ActionIconCircle>
            <ActionIconImg src={ACTION_IMAGES.pool} alt="매칭풀 바로가기" />
          </ActionIconCircle>
          <ActionLabel>매칭룸 바로가기</ActionLabel>
        </ActionCard>
      </ActionsRow>
    </SectionWrap>
  );
}
