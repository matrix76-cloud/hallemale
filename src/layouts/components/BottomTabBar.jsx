// src/layouts/components/BottomTabBar.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { bottomTabIcons } from "../../utils/imageAssets";

const Wrap = styled.nav`
  height: ${({ theme }) => theme.layout.bottomTabHeight}px;
  background: ${({ theme }) => theme.colors.card};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
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
  color: ${({ active, theme }) =>
    active ? theme.colors.primary : theme.colors.textWeak};
  cursor: pointer;
`;

const IconImg = styled.img`
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
`;

const Label = styled.span`
  margin-top: 1px;
`;

// 탭은 4개 (홈 / 매칭 / GYM / 내정보)
const tabs = [
  { key: "home", label: "홈", path: "/home" },
  { key: "matching", label: "매칭관리", path: "/matching" },
  { key: "gym", label: "커뮤니티", path: "/gym" },
  { key: "my", label: "내정보", path: "/my" },
];

export default function BottomTabBar({ currentPath, onNavigate }) {
  return (
    <Wrap>
      {tabs.map((tab) => {
        const active = currentPath.startsWith(tab.path);

        return (
          <Item
            key={tab.key}
            active={active}
            type="button"
            onClick={() => onNavigate(tab.path)}
          >
            <IconImg
              src={
                active
                  ? bottomTabIcons[tab.key].active
                  : bottomTabIcons[tab.key].inactive
              }
              alt={tab.label}
            />
            <Label>{tab.label}</Label>
          </Item>
        );
      })}
    </Wrap>
  );
}
