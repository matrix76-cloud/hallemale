/* eslint-disable */
// src/components/home/TeamProfileSection.jsx
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { useNavigate } from "react-router-dom";
import {
  FiMessageSquare,
  FiCheckCircle,
  FiFlag,
  FiXCircle,
  FiAward,
  FiZap,
  FiCalendar,
  FiUsers,
} from "react-icons/fi";

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

/* 카드 우하단 데코 — 3D 이모지 스티커를 라인 아이콘으로 교체.
   스티커는 카드마다 하나씩 박히면 앱이 가벼워 보인다. 아이콘은 옅게 깔아
   카드 성격만 알려주고 콘텐츠를 방해하지 않는다. */
const ProfileDeco = styled.div`
  position: absolute;
  right: 10px;
  bottom: 8px;
  display: flex;
  /* 흰 카드라 회색 데코는 먼지처럼 보였다. 트로피는 금색 계열이 성격에 맞는다. */
  color: #F5B301;
  opacity: 0.85;
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
  display: inline-flex;
  align-items: center;
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
  background: linear-gradient(135deg, #9575CD 0%, #7C5CC9 100%);
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

/* 매칭하기 카드 우하단 아이콘 — 보라 채움 위라 흰색 대신 밝은 라일락(톤온톤)으로 색을 준다 */
const BigIcon = styled.div`
  position: absolute;
  right: 12px;
  bottom: 10px;
  display: flex;
  color: #E9D5FF;
  opacity: 0.55;
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
  max-width: 100%;
  /* 한 줄로만 표시 (줄바꿈 금지) */
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 500;
  letter-spacing: -0.3px;
`;

/* 구장 예약 바로가기 — 매칭하기 카드와 같은 형태, 흰 카드 채움(주황은 아이콘에만) */
const WideActionCard = styled.button`
  position: relative;
  overflow: hidden;
  width: 100%;
  min-height: 84px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 18px;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 16px 16px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  text-align: left;

  &:active {
    transform: translateY(1px);
  }
`;

/* 흰 카드 위 텍스트 — 채움 카드용 BigTitle/BigSubtitle(흰 글씨) 대체 */
const WideTitle = styled(BigTitle)`
  color: ${({ theme }) => theme.colors.textStrong};
`;

const WideSubtitle = styled(BigSubtitle)`
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 구장 예약 카드 우측 아이콘 — 매칭하기와 동일 규격, 카드가 흰색이라 아이콘이 색을 맡는다 */
const WideIcon = styled.div`
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  color: #F97316;
  pointer-events: none;
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
  /* 하단 54px 여백은 60px 3D 스티커 자리였다. 아이콘으로 바뀌어 필요 없어졌다. */
  padding: 14px 12px 16px;
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
const CardsWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/* 팀 미가입 시 팀 프로필 카드 자리를 대신하는 안내 + CTA.
   매칭하기·매칭룸을 누르면 이 카드로 스크롤하며 $flash 로 잠깐 테두리를 세운다. */
const LockCard = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ $flash, theme }) =>
    $flash ? theme.colors.primary : theme.colors.border};
  border-radius: 16px;
  padding: 24px 18px;
  text-align: center;
  transition: border-color 180ms ease, box-shadow 180ms ease;
  box-shadow: ${({ $flash, theme }) =>
    $flash ? `0 0 0 3px ${theme.colors.primary}26` : "none"};
`;

const LockTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LockMsg = styled.div`
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LockBtnRow = styled.div`
  margin-top: 16px;
  display: flex;
  gap: 8px;
`;

const LockPrimary = styled.button`
  flex: 1;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

const LockGhost = styled.button`
  flex: 1;
  height: 44px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

function toInt(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export default function TeamProfileSection({ team, rank = 1, matchRoomCounts, matchRoomAttention, matchRoomUnread }) {
  const navigate = useNavigate();

  // ✅ 팀 미가입: 아래에서 안내 카드로 대체 렌더한다(빈 카드를 깔지 않는다)
  const locked = !team;
  const safeTeam = team || {};

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



  // 팀 미가입자도 매칭하기·매칭룸 카드를 그대로 보되, 누르면 팀 프로필 카드로 유도한다.
  // (팀이 없으면 매칭/매칭룸은 clubId 기준이라 열어봐야 빈 화면이다)
  const lockRef = useRef(null);
  const [flash, setFlash] = useState(false);
  const flashTimerRef = useRef(null);
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), []);

  const guideToTeamCard = () => {
    try {
      lockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {}
    setFlash(true);
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(false), 1400);
  };

  const handleGoMyTeamDetail = () => {
    const teamId = team?.clubId || team?.id;
    if (!teamId) return;
    navigate(`/team/${teamId}`);
  };

  const handleGoMatching = () => {
    if (locked) return guideToTeamCard();
    navigate("/matching");
  };

  const goMatchRoomList = (tab) => {
    if (locked) return guideToTeamCard();
    const t = String(tab || "").trim();
    if (!t) {
      navigate("/match-roomlist");
      return;
    }
    navigate(`/match-roomlist?tab=${encodeURIComponent(t)}`);
  };

  const goFinishedMatches = () => {
    if (locked) return guideToTeamCard();
    navigate("/matches/finished");
  };

  // 매칭하기 카드 — 팀 유무에 따라 배치만 달라지고 카드 자체는 동일하다
  const matchingCard = (
    <BigActionCard type="button" onClick={handleGoMatching}>
      <BigTitle>매칭하기</BigTitle>
      <BigSubtitle>원하는 팀과 경기 잡기</BigSubtitle>
      <BigIcon><FiZap size={46} /></BigIcon>
    </BigActionCard>
  );

  return (
    <SectionWrap>
      <SectionTitle>팀 프로필</SectionTitle>

      <CardsWrap>
      {/* 팀 미가입: 팀 프로필 카드 자리만 안내 카드로 바뀌고, 아래 액션 카드들은 그대로 나온다 */}
      {locked ? (
        <>
          <LockCard ref={lockRef} $flash={flash}>
            <LockTitle>아직 소속된 팀이 없어요</LockTitle>
            <LockMsg>
              팀을 만들거나 받은 초대를 수락하면<br />
              매칭·랭킹을 이용할 수 있어요.
            </LockMsg>
            <LockBtnRow>
              <LockPrimary type="button" onClick={() => navigate("/team/create")}>
                팀 만들기
              </LockPrimary>
              <LockGhost type="button" onClick={() => navigate("/my/team-invites")}>
                받은 초대
              </LockGhost>
            </LockBtnRow>
          </LockCard>
          <ProfileRow>{matchingCard}</ProfileRow>
        </>
      ) : (
        <ProfileRow>
          <ProfileCard onClick={handleGoMyTeamDetail}>
            <ProfileDeco><FiAward size={44} /></ProfileDeco>
            <TopRow>
              <LogoOuter>
                <LogoBase>
                  <LogoImg src={logoSrc} alt={`${safeTeam.name} 로고`} />
                </LogoBase>
              </LogoOuter>

              <TeamMeta>
                <TeamName>{safeTeam.name}</TeamName>

                <MemberBadge>
                  <MemberIcon><FiUsers size={12} /></MemberIcon>
                  <span>{memberCountLabel}</span>
                </MemberBadge>
              </TeamMeta>
            </TopRow>
          </ProfileCard>

          {matchingCard}
        </ProfileRow>
      )}

      <WideActionCard type="button" onClick={() => navigate("/venues")}>
        <WideTitle>구장 예약 바로가기</WideTitle>
        <WideSubtitle>제휴 구장 코트·시간 예약하기</WideSubtitle>
        <WideIcon><FiCalendar size={40} /></WideIcon>
      </WideActionCard>

      <ActionsCol>
        <MatchRoomCard>
          <MatchRoomHeader>
            <MatchRoomTitle>
              <span>매칭룸</span>
            </MatchRoomTitle>

            <MatchRoomLinkText onClick={goFinishedMatches}>
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

        </MatchRoomCard>
      </ActionsCol>
      </CardsWrap>
    </SectionWrap>
  );
}
