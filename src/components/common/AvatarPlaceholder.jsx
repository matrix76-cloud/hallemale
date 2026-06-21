/* eslint-disable */
// src/components/common/AvatarPlaceholder.jsx
import React from "react";
import styled from "styled-components";

/**
 * ✅ 회색 사람(실루엣) 기본 아바타
 * - 이미지가 없을 때 사용
 * - 크기(size)만 주면 됨
 */
export default function AvatarPlaceholder({ size = 60, className, accent = false }) {
  return (
    <Wrap
      className={className}
      style={{ width: size, height: size }}
      aria-label="avatar placeholder"
      $accent={accent}
    >
      <Svg viewBox="0 0 64 64" aria-hidden="true">
        <Circle cx="32" cy="24" r="12" $accent={accent} />
        <Body d="M10 58c2-14 14-20 22-20s20 6 22 20" $accent={accent} />
      </Svg>
    </Wrap>
  );
}

const Wrap = styled.div`
  border-radius: 999px;
  background: ${({ $accent }) => ($accent ? "#ede9fe" : "#e5e7eb")};
  display: grid;
  place-items: center;
  overflow: hidden;
`;

const Svg = styled.svg`
  width: 70%;
  height: 70%;
`;

const Circle = styled.circle`
  fill: ${({ $accent }) => ($accent ? "#8b7cf6" : "#9ca3af")};
`;

const Body = styled.path`
  fill: none;
  stroke: ${({ $accent }) => ($accent ? "#8b7cf6" : "#9ca3af")};
  stroke-width: 6;
  stroke-linecap: round;
`;
