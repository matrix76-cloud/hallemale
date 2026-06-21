/* eslint-disable */
// src/components/common/TeamAvatarPlaceholder.jsx
import React from "react";
import styled from "styled-components";

/**
 * ✅ 팀 로고 미등록 시 기본 placeholder
 * - 연한 회색 둥근 사각형 + 두 사람(그룹) 실루엣
 * - 크기(size)만 주면 됨. className 으로 모양/배경 오버라이드 가능
 */
export default function TeamAvatarPlaceholder({ size = 60, className }) {
  return (
    <Wrap
      className={className}
      style={{ width: size, height: size }}
      aria-label="team avatar placeholder"
    >
      <Svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </Svg>
    </Wrap>
  );
}

const Wrap = styled.div`
  border-radius: 22px;
  background: #eef0f4;
  display: grid;
  place-items: center;
  overflow: hidden;
`;

const Svg = styled.svg`
  width: 50%;
  height: 50%;
  fill: #b8bfca;
`;
