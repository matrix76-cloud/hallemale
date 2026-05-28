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
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

/* ============ 위: 팀 프로필 카드 ============ */

const ProfileCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 8px;
  padding: 16px 18px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
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
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f4f4ff"};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
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
  font-weight: 600;
`;

const TeamName = styled.div`
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MemberBadge = styled.div`
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f4f4f5"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textNormal};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MemberIcon = styled.span`
  font-size: 12px;
`;

const TeamDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
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
  color: ${({ theme }) => theme.colors.primary};
`;

/* ============ 아래: 홈 액션 ============ */

const ActionsCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

/* 매칭하기 카드(이미 적용된 버전과 맞춰둠) */
const BigActionCard = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.06)"};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 14px 14px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;

  &:active {
    transform: translateY(1px);
  }
`;

const BigTop = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BigIconWrap = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.colors.primary ? `${theme.colors.primary}18` : "rgba(99, 102, 241, 0.12)"};
  flex: 0 0 auto;
`;

const BigIcon = styled.div`
  font-size: 26px;
`;

const BigBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const BigTitle = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  font-weight: 600;
  letter-spacing: -0.2px;
`;

const BigSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.25;
`;

const GoPill = styled.div`
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.primary || "#2563eb"};
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  flex: 0 0 auto;
`;

/* ✅ 매칭룸 카드(문구/숫자 멋내기) */
const MatchRoomCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 12px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MatchRoomHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const MatchRoomTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  font-weight: 600;
`;

const FolderIconWrap = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(56, 189, 248, 0.16)" : "rgba(2, 132, 199, 0.1)"};
`;

const FolderIcon = styled.div`
  font-size: 22px;
`;

const MatchRoomLinkText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary || "#2563eb"};
  cursor: pointer;
  white-space: nowrap;
`;

/* ✅ 3개 박스 업그레이드 */
const StatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
`;

const StatValue = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const NumberBadge = styled.div`
  width: 62px;
  height: 48px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#f3f4f6"};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.06)"};
`;

const NumberText = styled.div`
  font-size: 22px;
  line-height: 1;
  letter-spacing: -0.8px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 700;
`;

const StatHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;



const StatItem = styled.button`
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.06)"};
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? theme.colors.surface
      : "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)"};
  border-radius: 8px;
  padding: 12px 12px 12px;
  cursor: pointer;
  text-align: left;

  display: flex;
  flex-direction: column;
  gap: 10px;

  min-height: 98px;

  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? "0 4px 10px rgba(0, 0, 0, 0.25)"
      : "0 8px 18px rgba(15, 23, 42, 0.05)"};

  &:active {
    transform: translateY(1px);
  }
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
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

  console.log(matchRoomCounts);


    const safeCount = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
    };

    const ongoing = safeCount(
      matchRoomCounts?.ongoing ??
        matchRoomCounts?.adjusting ??
        matchRoomCounts?.proposed ??
        matchRoomCounts?.pending,
      0
    );

    const confirmed = safeCount(
      matchRoomCounts?.confirmed ??
        matchRoomCounts?.scheduled ??
        matchRoomCounts?.upcoming,
      0
    );

    // ✅ 지난 경기: 실제 프로젝트에서 흔히 쓰는 키들을 전부 커버
    const past = safeCount(
      matchRoomCounts?.past ??
        matchRoomCounts?.finished ??
        matchRoomCounts?.history ??
        matchRoomCounts?.previous ??
        matchRoomCounts?.prev ??
        matchRoomCounts?.done,
      0
    );



  const handleGoMyTeamDetail = () => {
    const teamId = team.clubId || team.id;
    if (!teamId) return;
    navigate(`/team/${teamId}`);
  };

  const handleGoMatching = () => {
    navigate("/matching");
  };

  const goMatchRoomList = (tab) => {
    const t = String(tab || "").trim();
    if (!t) {
      navigate("/match-roomlist");
      return;
    }
    navigate(`/match-roomlist?tab=${encodeURIComponent(t)}`);
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

      <ActionsCol>
        <BigActionCard type="button" onClick={handleGoMatching}>
          <BigTop>
            <BigIconWrap>
              <BigIcon>🏀</BigIcon>
            </BigIconWrap>

            <BigBody>
              <BigTitle>매칭하기</BigTitle>
              <BigSub>다른 팀에게 연습경기 대결을 신청해요</BigSub>
            </BigBody>
          </BigTop>

          <GoPill>GO</GoPill>
        </BigActionCard>

        <MatchRoomCard>
          <MatchRoomHeader>
            <MatchRoomTitle>
              <FolderIconWrap>
                <FolderIcon>🗂️</FolderIcon>
              </FolderIconWrap>
              <span>매칭룸</span>
            </MatchRoomTitle>



            <MatchRoomLinkText onClick={() => navigate("/matches/finished")}>
              내 팀 경기 기록 보기
            </MatchRoomLinkText>

          </MatchRoomHeader>

          <StatRow>
            <StatItem type="button" onClick={() => goMatchRoomList("ongoing")}>
              <StatLabel>조율중 경기</StatLabel>
              <NumberBadge>
                <NumberText>{ongoing}</NumberText>
              </NumberBadge>
     
            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("confirmed")}>
              <StatLabel>확정된 경기</StatLabel>
              <NumberBadge>
                <NumberText>{confirmed}</NumberText>
              </NumberBadge>
   
            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("past")}>
              <StatLabel>지난 경기</StatLabel>
              <NumberBadge>
                <NumberText>{past}</NumberText>
              </NumberBadge>

            </StatItem>
          </StatRow>
        </MatchRoomCard>
      </ActionsCol>
    </SectionWrap>
  );
}
