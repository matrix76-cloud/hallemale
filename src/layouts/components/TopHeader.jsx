/* eslint-disable */
// src/layouts/components/TopHeader.jsx
import React from "react";
import styled from "styled-components";
import {
  AiOutlineMessage,
  AiOutlineLeft,
} from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import BrandHeader from "../../components/auth/BrandHeader";
import { PiBellLight } from "react-icons/pi";

import useUnreadChatCount from "../../hooks/useUnreadChatCount";
import { goBackOrHome } from "../../utils/navigation";
import { useUIContext } from "../../context/UIContext";

const Wrap = styled.header`
  height: calc(52px + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  padding-left: calc(16px + env(safe-area-inset-left));
  padding-right: calc(16px + env(safe-area-inset-right));
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.card};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h3`
  font-size: 16px;
  margin: 0;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const RightIcons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

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
  font-size: 20px;
`;

const Badge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
`;

const LeftArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const TitleCol = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const Subtitle = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak || "#6b7280"};
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RightArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TabHeaderWrap = styled(Wrap)`
  justify-content: space-between;
`;

const LeftSpacer = styled.div`
  width: 48px;
`;

export default function TopHeader({
  title,
  showBack = false,
  onBack,
  rightActions = [],
}) {
  const navigate = useNavigate();
  const unreadChatCount = useUnreadChatCount();
  const ui = useUIContext();
  const headerSubtitle = ui?.headerSubtitle || "";

  const isHome = title === "할래말래";

  const handleDefaultBack = () => {
    if (onBack) onBack();
    else goBackOrHome(navigate);
  };

  const handleBellClick = () => {
    navigate("/notifications");
  };

  const handleChatClick = () => {
    navigate("/chats");
  };

  if (showBack || (rightActions && rightActions.length > 0)) {
    return (
      <Wrap>
        <LeftArea>
          {showBack && (
            <IconButton type="button" onClick={handleDefaultBack}>
              <AiOutlineLeft />
            </IconButton>
          )}
          <TitleCol>
            <Title>{title}</Title>
            {headerSubtitle && <Subtitle>{headerSubtitle}</Subtitle>}
          </TitleCol>
        </LeftArea>
        <RightArea>
          {rightActions.map((act) => (
            <IconButton key={act.key} type="button" onClick={act.onClick}>
              {act.icon}
            </IconButton>
          ))}
        </RightArea>
      </Wrap>
    );
  }

  if (isHome) {
    return (
      <TabHeaderWrap>
        <BrandHeader />
        <RightIcons>
          <IconButton type="button" onClick={handleBellClick}>
            <PiBellLight />
          </IconButton>

          <IconButton type="button" onClick={handleChatClick}>
            <AiOutlineMessage />
            {unreadChatCount > 0 && (
              <Badge>{unreadChatCount > 99 ? "99+" : unreadChatCount}</Badge>
            )}
          </IconButton>
        </RightIcons>
      </TabHeaderWrap>
    );
  }

  return (
    <TabHeaderWrap>
      <LeftSpacer />
      <Title>{title}</Title>
      <RightIcons>
        <IconButton type="button" onClick={handleBellClick}>
          <PiBellLight />
        </IconButton>

        <IconButton type="button" onClick={handleChatClick}>
          <AiOutlineMessage />
          {unreadChatCount > 0 && (
            <Badge>{unreadChatCount > 99 ? "99+" : unreadChatCount}</Badge>
          )}
        </IconButton>
      </RightIcons>
    </TabHeaderWrap>
  );
}
