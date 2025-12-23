/* eslint-disable */
// src/components/home/FavoriteTeamsSection.jsx
import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";

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
  font-family: "GmarketSans";
`;

const EmptyBox = styled.div`
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  padding: 14px 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
    background: #e5e7eb;
    border-radius: 999px;
  }
`;

/* 카드 */
const Card = styled.div`
  flex: 0 0 calc((100% - 20px) / 3);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
`;

const LogoArea = styled.div`
  width: 100%;
  padding: 12px 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TeamLogo = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 999px;
  object-fit: cover;
  background: #e5e7eb;
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
  font-family: "GmarketSans";
`;

// ✅ items: [{ id/clubId, name, logoUrl/logoKey ... }]
export default function FavoriteTeamsSection({ items = [] }) {
  const navigate = useNavigate();
  const slideRef = useRef(null);

  const limitedItems = useMemo(() => (items || []).slice(0, 9), [items]);

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
        <EmptyBox>즐겨찾기한 팀이 없습니다.</EmptyBox>
      ) : (
        <SlideRow ref={slideRef}>
          {limitedItems.map((t) => {
            const teamId = t.clubId || t.id;
            const logoSrc =
              (t.logoUrl && String(t.logoUrl).trim()) ||
              (t.logoKey && images[t.logoKey]) ||
              images.logo;

            return (
              <Card key={teamId} onClick={() => handleViewTeam(teamId)}>
                <LogoArea>
                  <TeamLogo src={logoSrc} alt={t.name} />
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
