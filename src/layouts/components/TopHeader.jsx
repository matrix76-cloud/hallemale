// src/layouts/components/TopHeader.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { AiOutlineBell, AiOutlineMessage } from "react-icons/ai";
import BrandHeader from "../../components/auth/BrandHeader";

const Wrap = styled.header`
  height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: ${({ isHome }) => (isHome ? "space-between" : "center")};
  background: ${({ theme }) => theme.colors.card};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

// 홈이 아닐 때 가운데 타이틀
const Title = styled.h1`
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.colors.textStrong};
`;

// 홈일 때 우측 아이콘 래퍼
const RightIcons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

// 공통 아이콘 버튼
const IconButton = styled.button`
  position: relative;
  border: none;
  background: transparent;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textStrong || "#111"};
  font-size: 22px;
`;

// 안읽음 뱃지
const Badge = styled.span`
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.card || "#fff"};
`;

export default function TopHeader({ title }) {
  const isHome = title === "할래말래";

  const handleBellClick = () => {
    // TODO: 알림 페이지/모달 연결
  };

  const handleChatClick = () => {
    // TODO: 채팅 목록/알림 페이지로 이동
  };

  if (isHome) {
    // 홈 헤더: 로고 + 알림/채팅 아이콘 2개
    return (
      <Wrap isHome>
        <BrandHeader />
        <RightIcons>
          <IconButton type="button" onClick={handleBellClick}>
            <AiOutlineBell />
            <Badge>2</Badge>
          </IconButton>
          <IconButton type="button" onClick={handleChatClick}>
            <AiOutlineMessage />
            <Badge>3</Badge>
          </IconButton>
        </RightIcons>
      </Wrap>
    );
  }

  // 그 외: 가운데 타이틀만
  return (
    <Wrap>
      <Title>{title}</Title>
    </Wrap>
  );
}
