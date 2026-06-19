/* eslint-disable */
// src/components/home/FavoritePlayersSection.jsx
import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
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

const AvatarArea = styled.div`
  width: 100%;
  padding: 10px 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PlayerAvatar = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 999px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const CardBody = styled.div`
  padding: 4px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const PlayerName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ✅ items: [{ userId, nickname/name, avatarUrl/photoUrl ... }]
export default function FavoritePlayersSection({ items = [] }) {
  const navigate = useNavigate();
  const slideRef = useRef(null);

  const limitedItems = useMemo(() => (items || []).slice(0, 9), [items]);

  const handleViewPlayer = (playerId) => {
    navigate(`/player/${playerId}`);
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
        <SectionTitle>즐겨찾는 선수</SectionTitle>
      </HeaderRow>

      {!limitedItems.length ? (
        <EmptyState compact text="즐겨찾기한 선수가 없습니다." />
      ) : (
        <SlideRow ref={slideRef}>
          {limitedItems.map((p) => {
            const playerId = p.userId || p.uid || p.id;
            const name = p.nickname || p.name || "선수";
            const avatarSrc =
              (p.avatarUrl && String(p.avatarUrl).trim()) ||
              (p.photoUrl && String(p.photoUrl).trim()) ||
              images.profileDefault ||
              images.logo;

            return (
              <Card key={playerId} onClick={() => handleViewPlayer(playerId)}>
                <AvatarArea>
                  <PlayerAvatar src={avatarSrc} alt={name} />
                </AvatarArea>
                <CardBody>
                  <PlayerName>{name}</PlayerName>
                </CardBody>
              </Card>
            );
          })}
        </SlideRow>
      )}
    </SectionWrap>
  );
}
