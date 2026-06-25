/* eslint-disable */
// src/pages/owner/components/LockedPreview.jsx
// 뒤에 콘텐츠를 흐릿하게(blur) 깔고, 앞에 안내(notice)를 띄우는 잠금 미리보기.
// 구장 미등록/심사중일 때 예약관리 화면을 막으면서도 "이런 화면이 열려요"를 보여준다.
import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  position: relative;
  flex: 1;
  min-height: calc(100dvh - 160px);
`;

const Behind = styled.div`
  filter: blur(5px) saturate(0.85);
  opacity: 0.45;
  pointer-events: none;
  user-select: none;
  transform: scale(0.99);
`;

const Front = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "linear-gradient(180deg, rgba(11,18,32,0.45), rgba(11,18,32,0.72))"
      : "linear-gradient(180deg, rgba(249,250,251,0.5), rgba(249,250,251,0.78))"};
`;

const FrontInner = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
`;

export default function LockedPreview({ notice, children }) {
  return (
    <Wrap>
      <Behind aria-hidden="true">{children}</Behind>
      <Front>
        <FrontInner>{notice}</FrontInner>
      </Front>
    </Wrap>
  );
}
