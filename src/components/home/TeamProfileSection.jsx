/* eslint-disable */
// src/components/home/TeamProfileSection.jsx
import React from "react";
import styled, { css } from "styled-components";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { useNavigate } from "react-router-dom";
import { FiMessageSquare, FiCheckCircle, FiFlag, FiXCircle } from "react-icons/fi";
import { useUIContext } from "../../context/UIContext";

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
  position: relative;
  overflow: hidden;
  flex: 1.4;
  min-width: 0;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

/* 팀 프로필 우하단 3D 데코 (매칭하기 카드와 톤 맞춤) */
const ProfileDeco = styled.img`
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 56px;
  height: 56px;
  object-fit: contain;
  transform: rotate(8deg);
  opacity: 0.95;
  filter: drop-shadow(0 6px 12px rgba(15, 23, 42, 0.2));
  pointer-events: none;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoOuter = styled.div`
  position: relative;
  width: 66px;
  height: 66px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoBase = styled.div`
  width: 66px;
  height: 66px;
  border-radius: 14px;
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

const TeamName = styled.div`
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const MemberBadge = styled.div`
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f4f4f5"};
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textNormal};
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const MemberIcon = styled.span`
  font-size: 12px;
`;

/* ============ 아래: 홈 액션 ============ */

const ActionsCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

/* 매칭하기 카드 — 앱2 스타일 피처 카드 (보라 채움 · 제목 좌상단 · 3D 우하단) */
const BigActionCard = styled.button`
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  min-height: 138px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(135deg, #7c6ef2 0%, #4f46e5 100%);
  box-shadow: 0 14px 26px -10px rgba(79, 70, 229, 0.6);
  padding: 16px 16px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 6px;
  text-align: left;

  &:active {
    transform: translateY(1px);
  }
`;

/* 3D 농구공 — 우하단 코너에 살짝 걸치게 (앱2 일러스트 배치) */
const BigIcon = styled.img`
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 70px;
  height: 70px;
  object-fit: contain;
  transform: rotate(-8deg);
  filter: drop-shadow(0 8px 14px rgba(15, 23, 42, 0.3));
  pointer-events: none;
`;

const BigTitle = styled.div`
  position: relative;
  z-index: 1;
  font-size: 18px;
  color: #ffffff;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const BigSubtitle = styled.div`
  position: relative;
  z-index: 1;
  max-width: calc(100% - 20px);
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 500;
  letter-spacing: -0.2px;
`;

/* ✅ 매칭룸 카드(매칭하기 버튼처럼 코너 3D) */
const MatchRoomCard = styled.div`
  position: relative;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 14px 12px 54px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

/* 카드 우하단 매칭룸 3D (매칭하기 농구공 배치와 동일) */
const MatchRoomDeco = styled.img`
  position: absolute;
  right: 2px;
  bottom: 4px;
  width: 60px;
  height: 60px;
  object-fit: contain;
  transform: rotate(-6deg);
  filter: drop-shadow(0 8px 14px rgba(15, 23, 42, 0.22));
  pointer-events: none;
  z-index: 0;
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
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  font-weight: 700;
`;

const MatchRoomLinkText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak || "#9ca3af"};
  cursor: pointer;
  white-space: nowrap;
`;

/* ✅ 상태 카운트 4열 */
const StatRow = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
`;

const StatValue = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 상태별 컬러 카운트 (0이면 흐리게) */
const StatCount = styled.div`
  font-size: 23px;
  line-height: 1;
  letter-spacing: -0.6px;
  font-weight: 800;
  color: ${({ $zero, $tone, theme }) =>
    $zero
      ? theme.colors.textWeak
      : $tone === "confirm"
      ? theme.colors.primary
      : theme.colors.textStrong};
`;

const StatHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;



const StatItem = styled.button`
  position: relative;
  border: none;
  background: transparent;
  padding: 6px 4px;
  cursor: pointer;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  &:active {
    transform: translateY(1px);
  }
`;

/* 라벨 + 왼쪽 아이콘 한 줄 */
const StatLabelRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const StatIco = styled.span`
  display: inline-flex;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const StatLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textNormal};
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

function toInt(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export default function TeamProfileSection({ team, rank = 1, matchRoomCounts, matchRoomAttention, matchRoomUnread }) {
  const navigate = useNavigate();
  const { showModal, hideModal } = useUIContext();

  // ✅ 팀 미가입: 카드는 그대로 보여주되, 클릭 시 가입/생성 유도 모달만 띄운다
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
    // - 조율중/확정: 안 읽은 메시지 수(목록 카드 빨간 배지와 동일 기준). 없으면 '반응 필요 방 수'로 fallback
    // - 지난/취소: 기존처럼 반응 필요한 방 수(결과 입력 등 상태 기반)
    const attnOngoing = safeCount(matchRoomUnread?.ongoing ?? matchRoomAttention?.ongoing, 0);
    const attnConfirmed = safeCount(matchRoomUnread?.confirmed ?? matchRoomAttention?.confirmed, 0);
    const attnPast = safeCount(matchRoomAttention?.past, 0);
    const attnCancelled = safeCount(matchRoomAttention?.cancelled, 0);



  const handleGoMyTeamDetail = () => {
    // 팀 없는 사용자: 팀 상세 대신 가입/생성 유도 모달
    if (locked) {
      showModal({
        title: "아직 팀이 없어요",
        message: "팀에 가입하거나 팀을 만들면 이용할 수 있어요. 팀 만들기로 이동할까요?",
        onCancel: hideModal,
        onConfirm: () => navigate("/team/create"),
      });
      return;
    }
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
        <DimArea>
      <ProfileRow>
      <ProfileCard onClick={handleGoMyTeamDetail}>
        <ProfileDeco src={images.emoji3dTrophy} alt="" />
        <TopRow>
          <LogoOuter>
            <LogoBase>
              <LogoImg src={logoSrc} alt={`${safeTeam.name} 로고`} />
            </LogoBase>
          </LogoOuter>

          <TeamMeta>
            <TeamName>{safeTeam.name}</TeamName>

            <MemberBadge>
              <MemberIcon>👥</MemberIcon>
              <span>{memberCountLabel}</span>
            </MemberBadge>
          </TeamMeta>
        </TopRow>
      </ProfileCard>

        <BigActionCard type="button" onClick={handleGoMatching}>
          <BigTitle>매칭하기</BigTitle>
          <BigSubtitle>원하는 팀과 경기 잡기</BigSubtitle>
          <BigIcon src={images.emoji3dBasketball} alt="" />
        </BigActionCard>
      </ProfileRow>

      <ActionsCol>
        <MatchRoomCard>
          <MatchRoomHeader>
            <MatchRoomTitle>
              <span>매칭룸</span>
            </MatchRoomTitle>

            <MatchRoomLinkText onClick={() => navigate("/matches/finished")}>
              내 팀 경기 기록 보기
            </MatchRoomLinkText>
          </MatchRoomHeader>

          <StatRow>
            <StatItem type="button" onClick={() => goMatchRoomList("ongoing")}>
              {attnOngoing > 0 && <AttentionBadge>{attnOngoing}</AttentionBadge>}
              <StatLabelRow>
                <StatIco $tone="adjust"><FiMessageSquare /></StatIco>
                <StatLabel>조율중</StatLabel>
              </StatLabelRow>
              <StatCount $tone="adjust" $zero={ongoing === 0}>{ongoing}</StatCount>
            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("confirmed")}>
              {attnConfirmed > 0 && <AttentionBadge>{attnConfirmed}</AttentionBadge>}
              <StatLabelRow>
                <StatIco $tone="confirm"><FiCheckCircle /></StatIco>
                <StatLabel>확정</StatLabel>
              </StatLabelRow>
              <StatCount $tone="confirm" $zero={confirmed === 0}>{confirmed}</StatCount>
            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("past")}>
              {attnPast > 0 && <AttentionBadge>{attnPast}</AttentionBadge>}
              <StatLabelRow>
                <StatIco $tone="past"><FiFlag /></StatIco>
                <StatLabel>지난</StatLabel>
              </StatLabelRow>
              <StatCount $tone="past" $zero={past === 0}>{past}</StatCount>
            </StatItem>

            <StatItem type="button" onClick={() => goMatchRoomList("cancelled")}>
              {attnCancelled > 0 && <AttentionBadge>{attnCancelled}</AttentionBadge>}
              <StatLabelRow>
                <StatIco $tone="cancel"><FiXCircle /></StatIco>
                <StatLabel>취소</StatLabel>
              </StatLabelRow>
              <StatCount $tone="cancel" $zero={cancelled === 0}>{cancelled}</StatCount>
            </StatItem>
          </StatRow>

          <MatchRoomDeco src={images.emoji3dFolder} alt="" />
        </MatchRoomCard>
      </ActionsCol>
        </DimArea>
      </LockWrap>
    </SectionWrap>
  );
}
