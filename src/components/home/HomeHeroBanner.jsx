// src/components/home/HomeHeroBanner.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { images } from "../../utils/imageAssets";
import {
  listActiveBanners,
  incrementBannerImpression,
  incrementBannerClick,
} from "../../services/bannersService";

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
  ${({ $height }) => ($height ? `height: ${$height};` : `aspect-ratio: 2 / 1;`)}
  flex-shrink: 0;
  position: relative;
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
`;

const SlideImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

// 로딩 중 자리 차지용(옛 fallback 배너가 깜빡이지 않게) — 빈 영역만 유지
const LoadingSlide = styled.div`
  width: 100%;
  ${({ $height }) => ($height ? `height: ${$height};` : `aspect-ratio: 2 / 1;`)}
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "#eceef2"};
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
    linkUrl: String(b.linkUrl || ""),
    side: b.side || "left",
    textAlign: b.textAlign || "left",
    offsetX: 0,
    offsetY: 0,
  };
}

export default function HomeHeroBanner({ placement = "home", fallback = BANNERS, slideHeight = null }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [remoteBanners, setRemoteBanners] = useState(null); // null = 로딩중, [] = 비어있음
  const seenImpRef = useRef(new Set()); // 이번 마운트에서 노출 집계한 배너 id

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await listActiveBanners(placement);
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
  }, [placement]);

  const isLoading = remoteBanners === null; // 어드민 배너 fetch 진행중

  // 어드민에 등록된 배너가 있으면 그걸 사용, 없으면 fallback.
  // 단, 로딩중에는 fallback을 쓰지 않음 → 옛 배너가 깜빡였다 사라지는 현상 방지
  const banners = useMemo(() => {
    if (isLoading) return [];
    if (Array.isArray(remoteBanners) && remoteBanners.length > 0) {
      return remoteBanners.map(normalizeRemoteBanner);
    }
    return fallback;
  }, [isLoading, remoteBanners, fallback]);

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

  // ✅ 현재 보이는 배너 노출 집계
  // - 한 방문(마운트) 동안 배너별 1회만 집계 → 4초 자동 회전 반복 노출은 과집계하지 않음
  // - 앱을 나갔다 다시 들어오면(재마운트) 다시 집계됨 (재방문 노출도 집계)
  useEffect(() => {
    if (!Array.isArray(remoteBanners) || remoteBanners.length === 0) return;
    const b = banners[index];
    if (!b || !b.id) return;
    if (seenImpRef.current.has(b.id)) return;
    seenImpRef.current.add(b.id);

    incrementBannerImpression(b.id);
  }, [index, banners, remoteBanners]);

  const handleBannerClick = (banner) => {
    // 스와이프(드래그) 동작이면 링크 클릭으로 처리하지 않음
    if (dragRef.current.moved) return;

    const isRemote = Array.isArray(remoteBanners) && remoteBanners.length > 0;
    if (isRemote && banner?.id) {
      incrementBannerClick(banner.id);
    }

    const url = String(banner?.linkUrl || "").trim();
    if (!url) return;

    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      navigate(url.startsWith("/") ? url : `/${url}`);
    }
  };

  const handleDotClick = (i) => setIndex(i);
  const offset = -(index * 100);

  // ✅ 스와이프(터치/마우스 드래그)로 좌우 이동
  const dragRef = useRef({ startX: null, moved: false });

  const goPrev = () => setIndex((prev) => (prev - 1 + total) % total);
  const goNext = () => setIndex((prev) => (prev + 1) % total);

  const onSwipeStart = (x) => {
    dragRef.current = { startX: x, moved: false };
  };
  const onSwipeEnd = (x) => {
    const { startX } = dragRef.current;
    if (startX == null || total <= 1) return;
    const dx = x - startX;
    const THRESHOLD = 40; // px
    if (dx <= -THRESHOLD) {
      goNext();
      dragRef.current.moved = true;
    } else if (dx >= THRESHOLD) {
      goPrev();
      dragRef.current.moved = true;
    }
    dragRef.current.startX = null;
  };

  const handleTouchStart = (e) => onSwipeStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => onSwipeEnd(e.changedTouches[0].clientX);
  const handleMouseDown = (e) => onSwipeStart(e.clientX);
  const handleMouseUp = (e) => onSwipeEnd(e.clientX);

  // 로딩 중에는 옛 fallback 대신 빈 자리만 유지(레이아웃 흔들림/깜빡임 방지)
  if (isLoading) {
    return (
      <Wrap>
        <LoadingSlide $height={slideHeight} />
      </Wrap>
    );
  }

  if (total === 0) return null;

  return (
    <Wrap
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <Track style={{ transform: `translateX(${offset}%)` }}>
        {banners.map((banner) => (
          <Slide
            key={banner.id}
            $clickable={!!banner.linkUrl}
            $height={slideHeight}
            onClick={() => handleBannerClick(banner)}
          >
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
