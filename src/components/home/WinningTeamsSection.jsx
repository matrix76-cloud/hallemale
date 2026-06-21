/* eslint-disable */
// src/components/home/WinningTeamsSection.jsx
import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { useNavigate } from "react-router-dom";

const SectionWrap = styled.section`
  margin-top: 8px;
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

/* 🔥 가로 슬라이드 컨테이너 */
const SlideRow = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 2px 4px;
  scroll-snap-type: x mandatory;

  scrollbar-width: none;
  -ms-overflow-style: none;

  & > * {
    scroll-snap-align: start;
  }

  &::-webkit-scrollbar {
    display: none;
  }
`;

/* 카드: 위 이미지, 아래 텍스트/버튼 (컴팩트 높이) */
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

const ImageArea = styled.div`
  width: 100%;
`;

const TeamImage = styled.img`
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
`;

const CardBody = styled.div`
  padding: 6px 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
`;

const TeamName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  line-height: 1.2;
`;

/* ✅ 기존 streakLabel 없을 수 있으니 winRate로 표시 */
const StreakText = styled.div`
  font-size: 12px;
  margin-top: 1px;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  text-align: center;
`;

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function formatWinRate(t) {
  const wr = toNum(t?.winRate, NaN);
  if (Number.isFinite(wr)) return `승률 ${(wr * 100).toFixed(0)}%`;

  const wins = toNum(t?.wins, 0);
  const total = toNum(t?.totalMatches, NaN);
  if (Number.isFinite(total) && total > 0) return `승률 ${Math.round((wins / total) * 100)}%`;

  return "기록 준비중";
}

// ✅ props로 목록을 받는 버전
// items: [{ clubId/id, logoUrl/logoKey, name, winRate/wins/totalMatches, streakLabel? ... }]
export default function WinningTeamsSection({ items = [] }) {
  const navigate = useNavigate();
  const slideRef = useRef(null);

  // 최대 5팀까지만 사용
  const limitedItems = useMemo(() => {
    return (items || []).slice(0, 5);
  }, [items]);

  useEffect(() => {
    const el = slideRef.current;
    if (!el) return;
    if (!limitedItems.length) return;

    const pageSize = 3;
    const pageCount = Math.ceil(limitedItems.length / pageSize);
    if (pageCount <= 1) return;

    let page = 0;
    const interval = setInterval(() => {
      page = (page + 1) % pageCount;
      const pageWidth = el.clientWidth;
      el.scrollTo({
        left: pageWidth * page,
        behavior: "smooth",
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [limitedItems]);

  if (!limitedItems.length) return null;

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>연승팀 대결 신청하기</SectionTitle>
      </HeaderRow>

      <SlideRow ref={slideRef}>
        {limitedItems.map((t) => {
          const teamId = t.clubId || t.id;
          const imgSrc = teamLogoSrc((t.logoUrl && String(t.logoUrl).trim()) || (t.logoKey && images[t.logoKey]));

          return (
            <Card key={teamId} onClick={() => navigate(`/team/${teamId}`)}>
              <ImageArea>
                <TeamImage src={imgSrc} alt={t.name} />
              </ImageArea>

              <CardBody>
                <NameRow>
                  <TeamName>{t.name}</TeamName>
                </NameRow>

                <StreakText>{t.streakLabel || formatWinRate(t)}</StreakText>
              </CardBody>
            </Card>
          );
        })}
      </SlideRow>
    </SectionWrap>
  );
}
