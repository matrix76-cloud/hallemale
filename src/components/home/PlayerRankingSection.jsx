/* eslint-disable */
import React from "react";
import styled, { keyframes, css } from "styled-components";
import { images, playerAvatars } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";

/**
 * 임시 랭킹 더미 데이터
 * 나중에 users + stats 기반으로 교체 예정
 */
const PLAYER_RANKING = [
  {
    userId: "user_cheongcho_han_juseong",
    name: "한주성",
    position: "센터",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "cheongcho_tigers",
  },
  {
    userId: "user_deokso_kim_doyun",
    name: "김주성",
    position: "가드",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "cheongcho_tigers",
  },
  {
    userId: "user_cheongcho_kim_dongcheon",
    name: "김도윤",
    position: "포워드",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "cheongcho_tigers",
  },
  {
    userId: "user_shinchon_park_junyoung",
    name: "한주성",
    position: "센터",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "shinchon_sharks",
  },
  {
    userId: "user_bulldogs_kang_taehyun",
    name: "한주성",
    position: "센터",
    wins: 12,
    losses: 6,
    draws: 1,
    clubId: "hangang_bulldogs",
  },
];

const SectionWrap = styled.section`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MoreButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  font-size: 13px;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/* 전체 한 줄 카드 */
const RowWrap = styled.div`
  display: flex;
  align-items: stretch;
  gap: 6px;
`;

/* 왼쪽 메달/순위 + NEW 뱃지 */
const RankCell = styled.div`
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
`;

const RankMedal = styled.span`
  font-size: 20px;
`;

const RankNumber = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* NEW 뱃지 (3등용 더미) */
const NewBadge = styled.span`
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  background: #22c55e;
  color: #ffffff;
`;

/* 1등 / 3등만 깜빡이는 하이라이트 */
const blinkHighlight = keyframes`
  0% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: #ffffff;
  }
  40% {
    border-color: rgba(79, 70, 229, 0.9);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25);
    background-color: #fef9c3;
  }
  60% {
    border-color: rgba(79, 70, 229, 0.4);
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.15);
    background-color: rgba(254, 249, 195, 0.7);
  }
  100% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: #ffffff;
  }
`;

/* 가운데 메인 카드 */
const PlayerCard = styled.div`
  flex: 1;
  border-radius: 18px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;

  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  border: 1px solid transparent;

  ${({ $highlight }) =>
    $highlight &&
    css`
      animation: ${blinkHighlight} 3.2s ease-in-out infinite;
    `}
`;

/* 아바타 + 월계관 */
const AvatarWrap = styled.div`
  position: relative;
  width: 40px;
  height: 40px;
`;

const AvatarCircle = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
`;

const Wreath = styled.div`
  position: absolute;
  inset: -4px;
  border-radius: 999px;
`;

/* 이름/포지션 + 승/패/무 */
const PlayerMeta = styled.div`
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

const PlayerName = styled.span`
  font-size: 14px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const PositionText = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

/* 승/무/패 텍스트만 */
const StatRow = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 오른쪽 팀 pill: 로고 + 팀명만 */
const TeamPill = styled.div`
  margin-left: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TeamLogoWrap = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

// 메달 아이콘
const getMedal = (rank) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
};

// clubId로 팀 메타 찾기
const clubMap = TEAMS.reduce((acc, team) => {
  acc[team.clubId] = team;
  return acc;
}, {});

export default function PlayerRankingSection() {
  const rows = PLAYER_RANKING.slice(0, 5);

  const handleMore = () => {
    // TODO: 전체 개인 랭킹 페이지 이동
  };

  if (!rows.length) return null;

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>개인 랭킹 바로보기</SectionTitle>
        <MoreButton type="button" onClick={handleMore}>
          전체보기
        </MoreButton>
      </HeaderRow>

      <ListWrap>
        {rows.map((p, index) => {
          const rank = index + 1;
          const medal = getMedal(rank);
          const avatarSrc =
            playerAvatars[p.userId] || images.profileDefault || images.logo;
          const club = clubMap[p.clubId];
          const clubLogo = (club && images[club.logoKey]) || images.logo;

          const isTop1 = rank === 1;
          const isTop3 = rank === 3;
          const highlight = isTop1 || isTop3;

          return (
            <RowWrap key={p.userId}>
              <RankCell>
                {medal ? (
                  <RankMedal>{medal}</RankMedal>
                ) : (
                  <RankNumber>{rank}</RankNumber>
                )}
                {isTop3 && <NewBadge>NEW</NewBadge>}
              </RankCell>

              <PlayerCard $highlight={highlight}>
                <AvatarWrap>
                  <AvatarCircle src={avatarSrc} alt={p.name} />
                  <Wreath />
                </AvatarWrap>

                <PlayerMeta>
                  <NameRow>
                    <PlayerName>{p.name}</PlayerName>
                    <PositionText>{p.position}</PositionText>
                  </NameRow>

                  <StatRow>
                    {p.wins}승 {p.losses}패 {p.draws}무
                  </StatRow>
                </PlayerMeta>

                <TeamPill>
                  <TeamLogoWrap>
                    <TeamLogoImg src={clubLogo} alt={club?.name || "팀"} />
                  </TeamLogoWrap>
                  <TeamName>{club?.name || "소속 없음"}</TeamName>
                </TeamPill>
              </PlayerCard>
            </RowWrap>
          );
        })}
      </ListWrap>
    </SectionWrap>
  );
}
