/* eslint-disable */
// src/components/home/FavoriteTeamsSection.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { getTeamRankMap } from "../../services/teamRankingService";
import EmptyState from "../common/EmptyState";

const SectionWrap = styled.section`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const EmptyBox = styled.div`
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 14px 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

/* 가로 슬라이드 컨테이너 */
const SlideRow = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 2px 4px;
  scroll-snap-type: x mandatory;

  & > * {
    scroll-snap-align: start;
  }

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 999px;
  }
`;

/* 카드 */
const Card = styled.div`
  flex: 0 0 calc((100% - 20px) / 3);
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
`;

const LogoArea = styled.div`
  width: 100%;
  /* 상단 패딩 확보: 1~3위 왕관이 카드(overflow:hidden) 밖으로 잘리지 않도록 */
  padding: 28px 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* 로고 + 왕관 오버레이용 래퍼 */
const LogoBox = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
`;

/* 1~3위: 팀 로고 위에 살짝 겹쳐 배치(로고 PNG 하단 여백 보정) */
const CrownImg = styled.img`
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 38px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
`;

const TeamLogo = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 18px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const CardBody = styled.div`
  padding: 4px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TeamName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ✅ items: [{ id/clubId, name, logoUrl/logoKey ... }]
export default function FavoriteTeamsSection({ items = [] }) {
  const navigate = useNavigate();
  const slideRef = useRef(null);
  const [teamRankMap, setTeamRankMap] = useState(null);

  const limitedItems = useMemo(() => (items || []).slice(0, 9), [items]);

  // ✅ 팀 전역 랭킹 — 1~3위면 로고 위에 왕관 표시용
  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((map) => {
        if (alive) setTeamRankMap(map);
      })
      .catch((e) => console.warn("[FavoriteTeamsSection] getTeamRankMap failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, []);

  const handleViewTeam = (teamId) => {
    navigate(`/team/${teamId}`);
  };

  useEffect(() => {
    const el = slideRef.current;
    if (!el) return;
    if (!limitedItems.length) return;

    const pageSize = 3;
    const pageCount = Math.ceil(limitedItems.length / pageSize);
    if (pageCount <= 1) return;

    let page = 0;
    const timer = setInterval(() => {
      page = (page + 1) % pageCount;
      const pageWidth = el.clientWidth;
      el.scrollTo({ left: pageWidth * page, behavior: "smooth" });
    }, 5000);

    return () => clearInterval(timer);
  }, [limitedItems.length]);

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>즐겨찾는 팀</SectionTitle>
      </HeaderRow>

      {!limitedItems.length ? (
        <EmptyState compact text="즐겨찾기한 팀이 없습니다." />
      ) : (
        <SlideRow ref={slideRef}>
          {limitedItems.map((t) => {
            const teamId = t.clubId || t.id;
            const logoSrc = teamLogoSrc(
              (t.logoUrl && String(t.logoUrl).trim()) ||
              (t.logoKey && images[t.logoKey])
            );

            const rank = teamRankMap?.get(String(teamId || "").trim());
            const showCrown = rank && rank <= 3;

            return (
              <Card key={teamId} onClick={() => handleViewTeam(teamId)}>
                <LogoArea>
                  <LogoBox>
                    {showCrown ? <CrownImg src={images.logo} alt={`${rank}위`} /> : null}
                    <TeamLogo src={logoSrc} alt={t.name} />
                  </LogoBox>
                </LogoArea>
                <CardBody>
                  <TeamName>{t.name}</TeamName>
                </CardBody>
              </Card>
            );
          })}
        </SlideRow>
      )}
    </SectionWrap>
  );
}
