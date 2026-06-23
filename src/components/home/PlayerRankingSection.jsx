// src/components/home/PlayerRankingSection.jsx
/* eslint-disable */
// ✅ 홈 섹션: "점수 높은 순" 상위 5명만 먼저 노출
// ✅ 점수 규칙: 승 +5, 무 +2, 패 +1
// ✅ 팀장 뱃지 위치: "아바타 이미지 밑" (p.isTeamCaptain === true)

import React, { useMemo, useState, useEffect } from "react";
import styled, { keyframes, css } from "styled-components";
import { useNavigate } from "react-router-dom";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { getTeamRankMap } from "../../services/teamRankingService";
import PositionChip from "../common/PositionChip";
import AvatarPlaceholder from "../common/AvatarPlaceholder";

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
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const MoreButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.textWeak};
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

const RowWrap = styled.div`
  display: flex;
  align-items: stretch;
  gap: 6px;
`;

const RankCell = styled.div`
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
`;

const RankBadge = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  /* 1~3위: 보라색(팀 랭킹과 동일), 그 외: 기본 글씨색 — 원형 배경 없음 */
  color: ${({ $top, theme }) =>
    $top ? theme.colors.primary : theme.colors.textStrong};
`;

const CrownImg = styled.img`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
`;

const NewBadge = styled.span`
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  background: #22c55e;
  color: #ffffff;
`;

const blinkHighlight = keyframes`
  0% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: var(--rank-card-bg);
  }
  40% {
    border-color: rgba(79, 70, 229, 0.9);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25);
    background-color: var(--rank-highlight-strong);
  }
  60% {
    border-color: rgba(79, 70, 229, 0.4);
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.15);
    background-color: var(--rank-highlight-weak);
  }
  100% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
    background-color: var(--rank-card-bg);
  }
`;

const PlayerCard = styled.div`
  flex: 1;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;

  --rank-card-bg: ${({ theme }) => theme.colors.card};
  --rank-highlight-strong: ${({ theme }) =>
    theme.mode === "dark" ? "#3a2f0a" : "#fef9c3"};
  --rank-highlight-weak: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(58, 47, 10, 0.7)" : "rgba(254, 249, 195, 0.7)"};

  background: var(--rank-card-bg);
  box-shadow: ${({ theme }) => theme.shadows.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  cursor: pointer;

  ${({ $highlight }) =>
    $highlight &&
    css`
      animation: ${blinkHighlight} 3.2s ease-in-out infinite;
    `}
`;

/* ✅ 아바타 + 팀장뱃지 세로 스택 */
const AvatarStack = styled.div`
  width: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const AvatarCircle = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  object-fit: cover;
`;

/* ✅ 팀장 pill (아바타 밑) */
const CaptainPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

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
  min-width: 0;
`;

const PlayerName = styled.span`
  font-size: 14px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatRow = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamPill = styled.div`
  margin-left: 4px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`;

/* 소속팀 1~3위: 클럽 로고 위에 겹쳐 배치되는 왕관 */
const TeamLogoBox = styled.span`
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
`;

const TeamCrown = styled.img`
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  width: 17px;
  height: 17px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.25));
`;

const TeamLogoWrap = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
`;

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function positionLabel(pos) {
  const p = String(pos || "").trim();
  if (p === "guard") return "가드";
  if (p === "forward") return "포워드";
  if (p === "center") return "센터";
  return "";
}

function rankLabel(rank) {
  return `${rank || ""}위`;
}

function calcPoints(p) {
  const w = toNum(p?.wins, 0);
  const d = toNum(p?.draws, 0);
  const l = toNum(p?.losses, 0);
  return w * 5 + d * 2 + l * 1;
}

export default function PlayerRankingSection({ rows = [] }) {
  const nav = useNavigate();
  const [teamRankMap, setTeamRankMap] = useState(null);

  // ✅ 팀 전역 랭킹 — 소속팀(클럽) 1~3위면 로고 위에 왕관 표시용
  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((map) => {
        if (alive) setTeamRankMap(map);
      })
      .catch((e) => console.warn("[PlayerRankingSection] getTeamRankMap failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, []);

  const topRows = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];
    const sorted = [...base].sort((a, b) => {
      const pa = calcPoints(a);
      const pb = calcPoints(b);
      if (pb !== pa) return pb - pa;

      const wa = toNum(a?.wins, 0);
      const wb = toNum(b?.wins, 0);
      if (wb !== wa) return wb - wa;

      const ta = toNum(a?.wins, 0) + toNum(a?.losses, 0) + toNum(a?.draws, 0);
      const tb = toNum(b?.wins, 0) + toNum(b?.losses, 0) + toNum(b?.draws, 0);
      if (tb !== ta) return tb - ta;

      const na = String(a?.name || a?.nickname || "").toLowerCase();
      const nb = String(b?.name || b?.nickname || "").toLowerCase();
      if (na === nb) return 0;
      return na > nb ? 1 : -1;
    });

    return sorted.slice(0, 5).map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [rows]);

  const handleMore = () => nav(`/playerranking`);

  const handlePlayerClick = (userId) => {
    if (!userId) return;
    nav(`/player/${userId}`);
  };

  const handleTeamClick = (clubId) => {
    if (!clubId) return;
    nav(`/team/${clubId}`);
  };

  if (!topRows.length) return null;

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>개인 랭킹 바로보기</SectionTitle>
        <MoreButton type="button" onClick={handleMore}>
          전체보기
        </MoreButton>
      </HeaderRow>

      <ListWrap>
        {topRows.map((p, index) => {
          const rank = p.rank || index + 1;
          const showCrown = rank <= 3;

          const avatarSrc = p.avatarUrl && String(p.avatarUrl).trim();

          const clubLogoSrc = teamLogoSrc(p.clubLogoUrl && String(p.clubLogoUrl).trim());
          const clubRank = teamRankMap?.get(String(p.clubId || "").trim());

          const clubName = p.clubName || "소속 없음";

          const isTop1 = rank === 1;
          const isNew = !!p.isNew; // 7일 내 랭킹 신규 진입자
          const highlight = isTop1 || isNew;

          return (
            <RowWrap key={`${p.userId || index}-${rank}`}>
              <RankCell>
                <RankBadge $top={showCrown}>
                  {showCrown ? <CrownImg src={images.logo} alt={`${rank}위`} /> : null}
                  {rankLabel(rank)}
                </RankBadge>
                {isNew && <NewBadge>NEW</NewBadge>}
              </RankCell>

              <PlayerCard
                $highlight={highlight}
                onClick={() => handlePlayerClick(p.userId)}
              >
                <AvatarStack>
                  {avatarSrc ? (
                    <AvatarCircle
                      src={avatarSrc}
                      alt={p.name || p.nickname || "player"}
                    />
                  ) : (
                    <AvatarPlaceholder size={40} />
                  )}
                  {p.isTeamCaptain === true ? <CaptainPill>팀장</CaptainPill> : null}
                </AvatarStack>

                <PlayerMeta>
                  <NameRow>
                    <PlayerName>{p.name || p.nickname || "사용자"}</PlayerName>
                    <PositionChip label={positionLabel(p.mainPosition)} size="sm" />
                  </NameRow>

                  <StatRow>
                    {toNum(p.wins, 0)}승 {toNum(p.losses, 0)}패 {toNum(p.draws, 0)}무
                  </StatRow>
                </PlayerMeta>

                <TeamPill
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTeamClick(p.clubId);
                  }}
                >
                  <TeamLogoBox>
                    {clubRank && clubRank <= 3 ? (
                      <TeamCrown src={images.logo} alt={`${clubRank}위`} />
                    ) : null}
                    <TeamLogoWrap>
                      <TeamLogoImg src={clubLogoSrc} alt={clubName} />
                    </TeamLogoWrap>
                  </TeamLogoBox>
                  <TeamName>{clubName}</TeamName>
                </TeamPill>
              </PlayerCard>
            </RowWrap>
          );
        })}
      </ListWrap>
    </SectionWrap>
  );
}
