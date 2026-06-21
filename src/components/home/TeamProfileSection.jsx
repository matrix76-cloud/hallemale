/* eslint-disable */
// src/components/home/TeamProfileSection.jsx
import React from "react";
import styled, { css } from "styled-components";
import { images, teamLogoSrc } from "../../utils/imageAssets";
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

/* 팀프로필 + 매칭하기 가로 한 줄 */
const ProfileRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 10px;
`;

const ProfileCard = styled.div`
  flex: 1.7;
  min-width: 0;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 8px;
  padding: 16px 16px 18px;
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
  flex: 1;
  min-width: 0;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.06)"};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 14px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: center;

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
  display: grid;
  place-items: center;
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
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
`;

const StatValue = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const NumberBadge = styled.div`
  width: 100%;
  height: 42px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#f3f4f6"};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.06)"};
`;

const NumberText = styled.div`
  font-size: 20px;
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
  position: relative;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.06)"};
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? theme.colors.surface
      : "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)"};
  border-radius: 8px;
  padding: 10px 7px;
  cursor: pointer;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? "0 4px 10px rgba(0, 0, 0, 0.25)"
      : "0 8px 18px rgba(15, 23, 42, 0.05)"};

  &:active {
    transform: translateY(1px);
  }
`;

const StatLabel = styled.div`
  font-size: 11px;
  text-align: center;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textWeak};
`;

// 반응 필요(미확인) 빨간 배지 — 박스 우상단
const AttentionBadge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ff5a5a;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(255, 90, 90, 0.45);
`;



/* ✅ 팀 미가입 시: 카드는 보이되 잠금(블러+클릭 차단) + 안내 오버레이 */
const LockWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DimArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  ${({ $locked }) =>
    $locked &&
    css`
      pointer-events: none;
      user-select: none;
      filter: blur(1.5px) grayscale(0.15);
      opacity: 0.6;
    `}
`;

const LockOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.55)"};
`;

const LockIcon = styled.div`
  font-size: 30px;
`;

const LockText = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LockButton = styled.button`
  height: 42px;
  padding: 0 20px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

function toInt(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export default function TeamProfileSection({ team, rank = 1, matchRoomCounts, matchRoomAttention }) {
  const navigate = useNavigate();

  // ✅ 팀 미가입: 카드는 보여주되 잠금 처리 + 안내 오버레이
  const locked = !team;
  const safeTeam = team || {
    name: "우리 팀",
    description: "아직 소속된 팀이 없어요. 팀에 가입하거나 팀을 만들어 보세요.",
    tags: [],
  };

  const logoSrc = teamLogoSrc(
    (safeTeam.logoUrl && String(safeTeam.logoUrl).trim()) ||
    (safeTeam.logoKey && images[safeTeam.logoKey])
  );

  const memberCount = toInt(safeTeam.memberCount, NaN) ?? toInt(safeTeam.players?.length, NaN) ?? 0;
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

    const cancelled = safeCount(matchRoomCounts?.cancelled, 0);

    // 반응 필요(미확인) 배지 수
    const attnOngoing = safeCount(matchRoomAttention?.ongoing, 0);
    const attnConfirmed = safeCount(matchRoomAttention?.confirmed, 0);
    const attnPast = safeCount(matchRoomAttention?.past, 0);
    const attnCancelled = safeCount(matchRoomAttention?.cancelled, 0);



  const handleGoMyTeamDetail = () => {
    const teamId = team?.clubId || team?.id;
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

      <LockWrap>
        {locked && (
          <LockOverlay>
            <LockIcon>🔒</LockIcon>
            <LockText>
              팀에 먼저 가입하거나
              <br />
              팀을 생성해 주세요
            </LockText>
            <LockButton type="button" onClick={() => navigate("/team/create")}>
              팀 만들기
            </LockButton>
          </LockOverlay>
        )}

        <DimArea $locked={locked} aria-hidden={locked}>
      <ProfileRow>
      <ProfileCard onClick={handleGoMyTeamDetail}>
        <TopRow>
          <LogoOuter>
            <LogoBase>
              <LogoImg src={logoSrc} alt={`${safeTeam.name} 로고`} />
            </LogoBase>
          </LogoOuter>

          <TeamMeta>
            <TeamNameRow>
              <TeamName>{safeTeam.name}</TeamName>
              <MemberBadge>
                <MemberIcon>👥</MemberIcon>
                <span>{memberCountLabel}</span>
              </MemberBadge>
            </TeamNameRow>

            <TeamDesc>{safeTeam.description}</TeamDesc>

            {safeTeam.tags && safeTeam.tags.length > 0 && (
              <TagRow>
                {safeTeam.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </TagRow>
            )}
          </TeamMeta>
        </TopRow>
      </ProfileCard>

        <BigActionCard type="button" onClick={handleGoMatching}>
          <BigIconWrap>
            <BigIcon>🏀</BigIcon>
          </BigIconWrap>

          <BigBody>
            <BigTitle>매칭하기</BigTitle>
            <BigSub>다른 팀에게 연습경기 대결을 신청해요</BigSub>
          </BigBody>

          <GoPill>GO</GoPill>
        </BigActionCard>
      </ProfileRow>

      <ActionsCol>
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
              {attnOngoing > 0 && <AttentionBadge>{attnOngoing}</AttentionBadge>}
              <StatLabel>조율중 경기</StatLabel>
              <NumberBadge>
                <NumberText>{ongoing}</NumberText>
              </NumberBadge>

            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("confirmed")}>
              {attnConfirmed > 0 && <AttentionBadge>{attnConfirmed}</AttentionBadge>}
              <StatLabel>확정된 경기</StatLabel>
              <NumberBadge>
                <NumberText>{confirmed}</NumberText>
              </NumberBadge>

            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("past")}>
              {attnPast > 0 && <AttentionBadge>{attnPast}</AttentionBadge>}
              <StatLabel>지난 경기</StatLabel>
              <NumberBadge>
                <NumberText>{past}</NumberText>
              </NumberBadge>

            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("cancelled")}>
              {attnCancelled > 0 && <AttentionBadge>{attnCancelled}</AttentionBadge>}
              <StatLabel>취소된 경기</StatLabel>
              <NumberBadge>
                <NumberText>{cancelled}</NumberText>
              </NumberBadge>
            </StatItem>
          </StatRow>
        </MatchRoomCard>
      </ActionsCol>
        </DimArea>
      </LockWrap>
    </SectionWrap>
  );
}
