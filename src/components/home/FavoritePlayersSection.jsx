/* eslint-disable */
// src/components/home/FavoritePlayersSection.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import { getPlayerRankMap } from "../../services/rankingService";
import EmptyState from "../common/EmptyState";
import AvatarPlaceholder from "../common/AvatarPlaceholder";

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
  /* 상단 패딩 확보: 1~3위 왕관이 카드(overflow:hidden) 밖으로 잘리지 않도록 */
  padding: 28px 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* 아바타 + 왕관 오버레이용 래퍼 */
const AvatarBox = styled.div`
  position: relative;
  width: 60px;
  height: 60px;
`;

/* 1~3위: 프로필 사진 위에 살짝 겹쳐 배치(로고 PNG 하단 여백 보정) */
const CrownImg = styled.img`
  position: absolute;
  top: -23px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
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
  const [playerRankMap, setPlayerRankMap] = useState(null);

  const limitedItems = useMemo(() => (items || []).slice(0, 9), [items]);

  // ✅ 선수 전역 랭킹 — 1~3위면 프로필 위에 왕관 표시용
  useEffect(() => {
    let alive = true;
    getPlayerRankMap()
      .then((map) => {
        if (alive) setPlayerRankMap(map);
      })
      .catch((e) => console.warn("[FavoritePlayersSection] getPlayerRankMap failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, []);

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
              "";

            const rank = playerRankMap?.get(String(playerId || "").trim());
            const showCrown = rank && rank <= 3;

            return (
              <Card key={playerId} onClick={() => handleViewPlayer(playerId)}>
                <AvatarArea>
                  <AvatarBox>
                    {showCrown ? <CrownImg src={images.logo} alt={`${rank}위`} /> : null}
                    {avatarSrc ? (
                      <PlayerAvatar src={avatarSrc} alt={name} />
                    ) : (
                      <AvatarPlaceholder size={60} />
                    )}
                  </AvatarBox>
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
