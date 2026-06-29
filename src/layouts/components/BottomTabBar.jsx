/* eslint-disable */
// src/layouts/components/BottomTabBar.jsx
import React from "react";
import styled, { keyframes, css } from "styled-components";
import { bottomTabIcons } from "../../utils/imageAssets";

// 로고(왕관)와 동일한 보라색 — 선택된 탭 강조색
const LOGO_PURPLE = "#7C5CC9";

const Wrap = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(${({ theme }) => theme.layout.bottomTabHeight}px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
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
    $active ? LOGO_PURPLE : theme.colors.textWeak};
  cursor: pointer;
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

// 아이콘 이미지를 마스크로 사용 → 색을 CSS로 직접 지정(선택=로고 보라색, 비선택=흐린 글씨색)
const IconImg = styled.span`
  width: 18px;
  height: 18px;
  display: block;
  background-color: ${({ $active, theme }) =>
    $active ? LOGO_PURPLE : theme.colors.textWeak};
  -webkit-mask: ${({ $src }) => `url(${$src})`} center / 100% 100% no-repeat;
  mask: ${({ $src }) => `url(${$src})`} center / 100% 100% no-repeat;
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
  background: #ef4444;
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

// 팀장만 매칭관리 탭 노출. 팀원은 홈/커뮤니티/내정보만(매칭·전적 탭 없음).
const LEADER_SECOND_TAB = { key: "matchingmanage", iconKey: "matchingmanage", label: "매칭관리", path: "/matchingmanage" };

export default function BottomTabBar({ currentPath, onNavigate, matchingCount = 0, isTeamLeader = false }) {
  const formatCount = (n) => {
    if (!n || n <= 0) return "";
    if (n > 9) return "9+";
    return String(n);
  };

  const tabs = [
    { key: "home", iconKey: "home", label: "홈", path: "/home" },
    // 팀장만 매칭관리 탭. 팀원은 홈/커뮤니티/내정보 3개만.
    ...(isTeamLeader ? [LEADER_SECOND_TAB] : []),
    { key: "community", iconKey: "community", label: "커뮤니티", path: "/community" },
    { key: "my", iconKey: "my", label: "내정보", path: "/my" },
  ];

  return (
    <Wrap>
      {tabs.map((tab) => {
        const active = currentPath.startsWith(tab.path);
        // 매칭관리(팀장) 탭에만 받은 제안 배지 표시
        const showBadge = tab.key === "matchingmanage" && matchingCount > 0;

        return (
          <Item
            key={tab.key}
            $active={active}
            type="button"
            onClick={() => onNavigate(tab.path)}
          >
            <IconWrap>
              <IconImg
                $active={active}
                $src={bottomTabIcons[tab.iconKey].active}
                role="img"
                aria-label={tab.label}
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
