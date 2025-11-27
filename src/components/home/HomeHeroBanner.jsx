// src/components/home/HomeHeroBanner.jsx
/* eslint-disable */
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { images } from "../../utils/imageAssets";

const BANNERS = [
  { id: 1, src: images.homeBanner1, alt: "홈 배너 1" },
  { id: 2, src: images.homeBanner2, alt: "홈 배너 2" },
  { id: 3, src: images.homeBanner3, alt: "홈 배너 3" },
  { id: 4, src: images.homeBanner4, alt: "홈 배너 4" },
];

// 높이를 고정하지 않고 이미지 비율대로
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
  flex-shrink: 0;
`;

const SlideImg = styled.img`
  width: 100%;
  height: auto;
  display: block;
`;

// 1/4 인디케이터
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

// 도트 네비
const Dots = styled.div`
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
`;

const Dot = styled.button`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: ${({ active }) => (active ? "#ffffff" : "rgba(255,255,255,0.4)")};
`;

export default function HomeHeroBanner() {
  const [index, setIndex] = useState(0);
  const total = BANNERS.length;

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, 4000);
    return () => clearInterval(timer);
  }, [total]);

  const handleDotClick = (i) => setIndex(i);
  const offset = -(index * 100);

  return (
    <Wrap>
      <Track style={{ transform: `translateX(${offset}%)` }}>
        {BANNERS.map((banner) => (
          <Slide key={banner.id}>
            <SlideImg src={banner.src} alt={banner.alt} />
          </Slide>
        ))}
      </Track>

      <Pagination>
        {index + 1} / {total}
      </Pagination>

      <Dots>
        {BANNERS.map((b, i) => (
          <Dot
            key={b.id}
            type="button"
            active={i === index}
            onClick={() => handleDotClick(i)}
          />
        ))}
      </Dots>
    </Wrap>
  );
}
