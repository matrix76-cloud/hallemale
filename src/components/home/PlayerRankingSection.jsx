// src/components/home/PlayerRankingSection.jsx
/* eslint-disable */
// ✅ 홈 섹션: "점수 높은 순" 상위 5명만 먼저 노출
// ✅ 점수 규칙: 승 +5, 무 +2, 패 +1
// ✅ 팀장 뱃지 위치: "아바타 이미지 밑" (p.isTeamCaptain === true)

import React, { useMemo, useState, useEffect } from "react";
import styled from "styled-components";
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
  /* 순위는 전부 기본 글씨색. 1~3위는 왕관으로 이미 구분되므로 색까지 쓰지 않는다. */
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 1~3위: 프로필 사진 위에 살짝 겹쳐 배치(로고 PNG 하단 여백 보정) — 앱 전체 공통 기준 */
const CrownImg = styled.img`
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
`;

/* NEW — 배경 박스 없이 초록 글씨만 */
const NewBadge = styled.span`
  font-size: 10px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.accent};
`;

/* 강조 카드 — 예전엔 형광 노랑(#fef9c3) 배경이 3.2초 주기로 무한 점멸했다.
   신규 진입자가 여럿이면 카드 여러 장이 동시에 깜빡여 목록을 읽을 수 없었고,
   깜빡임 자체는 정보를 담지 않는다. 신규 표시는 NEW 라벨 하나로 충분하다. */
const PlayerCard = styled.div`
  flex: 1;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;

  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  cursor: pointer;
`;

/* ✅ 아바타 + 팀장뱃지 세로 스택 */
const AvatarStack = styled.div`
  width: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

/* 아바타 + 왕관 오버레이용 래퍼 */
const AvatarBox = styled.div`
  position: relative;
  width: 40px;
  height: 40px;
`;

const AvatarCircle = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  object-fit: cover;
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

          const isNew = !!p.isNew; // 7일 내 랭킹 신규 진입자
          return (
            <RowWrap key={`${p.userId || index}-${rank}`}>
              <RankCell>
                <RankBadge $top={showCrown}>
                  {rankLabel(rank)}
                </RankBadge>
                {isNew && <NewBadge>NEW</NewBadge>}
              </RankCell>

              <PlayerCard onClick={() => handlePlayerClick(p.userId)}>
                <AvatarStack>
                  <AvatarBox>
                    {showCrown ? <CrownImg src={images.logo} alt={`${rank}위`} /> : null}
                    {avatarSrc ? (
                      <AvatarCircle
                        src={avatarSrc}
                        alt={p.name || p.nickname || "player"}
                      />
                    ) : (
                      <AvatarPlaceholder size={40} />
                    )}
                  </AvatarBox>
                </AvatarStack>

                <PlayerMeta>
                  <NameRow>
                    <PlayerName>{p.name || p.nickname || "사용자"}</PlayerName>
                    <PositionChip label={positionLabel(p.mainPosition)} size="sm" tone="text" />
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
