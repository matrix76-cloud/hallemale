/* eslint-disable */
// src/layouts/components/BottomTabBar.jsx
import React from "react";
import styled, { keyframes, css } from "styled-components";
import { bottomTabIcons } from "../../utils/imageAssets";

const Wrap = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${({ theme }) => theme.layout.bottomTabHeight}px;
  background: ${({ theme }) => theme.colors.card};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  z-index: 50;
`;

const Item = styled.button`
  flex: 1;
  border: none;
  background: transparent;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textWeak};
  cursor: pointer;
  font-family: "GmarketSans";
`;

const blink = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6);
  }
  50% {
    transform: scale(1.08);
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
`;

const IconWrap = styled.div`
  position: relative;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const IconImg = styled.img`
  width: 18px;
  height: 18px;
`;

const Label = styled.span`
  margin-top: 1px;
`;

const Badge = styled.span`
  position: absolute;
  top: -4px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #f97316;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;

  ${({ $blink }) =>
    $blink &&
    css`
      animation: ${blink} 1.2s ease-in-out infinite;
    `}
`;

const tabs = [
  { key: "home", label: "홈", path: "/home" },
  { key: "matchingmanage", label: "매칭관리", path: "/matchingmanage" },
  { key: "community", label: "커뮤니티", path: "/community" },
  { key: "my", label: "내정보", path: "/my" },
];

export default function BottomTabBar({ currentPath, onNavigate, matchingCount = 0 }) {
  const formatCount = (n) => {
    if (!n || n <= 0) return "";
    if (n > 9) return "9+";
    return String(n);
  };

  return (
    <Wrap>
      {tabs.map((tab) => {
        const active = currentPath.startsWith(tab.path);
        const isMatchingTab = tab.key === "matchingmanage";
        const showBadge = isMatchingTab && matchingCount > 0;

        return (
          <Item
            key={tab.key}
            $active={active}
            type="button"
            onClick={() => onNavigate(tab.path)}
          >
            <IconWrap>
              <IconImg
                src={
                  active
                    ? bottomTabIcons[tab.key].active
                    : bottomTabIcons[tab.key].inactive
                }
                alt={tab.label}
              />
              {showBadge && (
                <Badge $blink={!active}>{formatCount(matchingCount)}</Badge>
              )}
            </IconWrap>
            <Label>{tab.label}</Label>
          </Item>
        );
      })}
    </Wrap>
  );
}
