// src/components/home/HomeHeroBanner.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { images } from "../../utils/imageAssets";
import { listActiveBanners } from "../../services/bannersService";

// 어드민에서 등록된 배너가 없을 때만 사용하는 fallback (기본 4개)
const BANNERS = [
  {
    id: 1,
    src: images.homeBanner1,
    alt: "홈 배너 1",
    title: "팀 만들고\n오늘 한 판 어때?",
    desc: "친구/동호회 팀 생성하고 바로 매칭",
    side: "left",
    textAlign: "left",
    offsetX: 0,
    offsetY: 0,
  },
  {
    id: 3,
    src: images.homeBanner3,
    alt: "홈 배너 3",
    title: "지금 뜨는 팀\n한눈에 보기",
    desc: "랭킹 · 인기팀 · 인기선수 모아보기",
    side: "left",
    textAlign: "left",
    offsetX: 0,
    offsetY: 0,
  },
  {
    id: 4,
    src: images.homeBanner4,
    alt: "홈 배너 4",
    title: "우리 팀도\n연승 가보자",
    desc: "승패 기록으로 팀 성장",
    side: "right",
    textAlign: "right",
    offsetX: 0,
    offsetY: 0,
  },
];

const scroll = keyframes``;

const Wrap = styled.section`
  width: 100%;
  position: relative;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
`;

const Track = styled.div`
  display: flex;
  width: 100%;
  transition: transform 0.4s ease;
`;

const Slide = styled.div`
  min-width: 100%;
  width: 100%;
  aspect-ratio: 2 / 1;
  flex-shrink: 0;
  position: relative;
`;

const SlideImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const TextLayer = styled.div`
  position: absolute;
  top: ${({ $offsetY }) => `${36 + ($offsetY || 0)}px`};

  ${({ $side, $offsetX }) =>
    $side === "right"
      ? `
        right: ${18 + ($offsetX || 0)}px;
        left: 92px;
        text-align: right;
      `
      : `
        left: ${18 + ($offsetX || 0)}px;
        right: 92px;
        text-align: left;
      `}

  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
`;

const Title = styled.div`
  white-space: pre-line;
  font-size: 18px;
  letter-spacing: -0.03em;
  color: rgba(17, 24, 39, 0.92);
  line-height: 1.18;
  font-weight: 600;
`;

const Desc = styled.div`
  font-size: 12px;
  color: rgba(17, 24, 39, 0.62);
  line-height: 1.35;
`;

const Pagination = styled.div`
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 11px;
`;

const Dots = styled.div`
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
`;

// ✅ active prop이 DOM으로 내려가지 않게 transient prop($active) 사용
const Dot = styled.button`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: ${({ $active }) => ($active ? "#ffffff" : "rgba(255,255,255,0.4)")};
`;

// 어드민 등록 배너 → 표시 형태로 정규화
function normalizeRemoteBanner(b) {
  // 제목 안의 \n 시퀀스를 실제 줄바꿈으로 변환 (어드민 입력 편의)
  const title = String(b.title || "").replace(/\\n/g, "\n");
  return {
    id: b.id,
    src: b.imageUrl,
    alt: title || "홈 배너",
    title,
    desc: String(b.desc || ""),
    side: b.side || "left",
    textAlign: b.textAlign || "left",
    offsetX: 0,
    offsetY: 0,
  };
}

export default function HomeHeroBanner() {
  const [index, setIndex] = useState(0);
  const [remoteBanners, setRemoteBanners] = useState(null); // null = 로딩중, [] = 비어있음

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await listActiveBanners();
        if (!alive) return;
        setRemoteBanners(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.warn("[HomeHeroBanner] fetch failed, using fallback:", e?.message || e);
        if (alive) setRemoteBanners([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 어드민에 등록된 배너가 있으면 그걸 사용, 없으면 코드 내 기본 BANNERS
  const banners = useMemo(() => {
    if (Array.isArray(remoteBanners) && remoteBanners.length > 0) {
      return remoteBanners.map(normalizeRemoteBanner);
    }
    return BANNERS;
  }, [remoteBanners]);

  const total = banners.length;

  useEffect(() => {
    setIndex(0);
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, 4000);
    return () => clearInterval(timer);
  }, [total]);

  const handleDotClick = (i) => setIndex(i);
  const offset = -(index * 100);

  if (total === 0) return null;

  return (
    <Wrap>
      <Track style={{ transform: `translateX(${offset}%)` }}>
        {banners.map((banner) => (
          <Slide key={banner.id}>
            <SlideImg src={banner.src} alt={banner.alt} />

            <TextLayer
              $side={banner.side || "left"}
              $offsetX={banner.offsetX || 0}
              $offsetY={banner.offsetY || 0}
            >
              <Title style={{ textAlign: banner.textAlign || "left" }}>
                {banner.title}
              </Title>
              <Desc style={{ textAlign: banner.textAlign || "left" }}>
                {banner.desc}
              </Desc>
            </TextLayer>
          </Slide>
        ))}
      </Track>

      <Pagination>
        {index + 1} / {total}
      </Pagination>

      <Dots>
        {banners.map((b, i) => (
          <Dot
            key={b.id}
            type="button"
            $active={i === index}
            onClick={() => handleDotClick(i)}
          />
        ))}
      </Dots>
    </Wrap>
  );
}
