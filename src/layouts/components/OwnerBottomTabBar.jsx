/* eslint-disable */
// src/layouts/components/OwnerBottomTabBar.jsx
// 구장 관리자 바텀탭: 예약 / 내 구장 / 내정보
import React from "react";
import styled from "styled-components";
import { FiCalendar, FiMapPin, FiUser } from "react-icons/fi";

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
  gap: 3px;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textWeak)};
  cursor: pointer;
`;

const IconWrap = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;

const TABS = [
  { key: "home", Icon: FiCalendar, label: "예약", path: "/owner/home" },
  { key: "venue", Icon: FiMapPin, label: "내 구장", path: "/owner/venue" },
  { key: "my", Icon: FiUser, label: "내정보", path: "/owner/my" },
];

export default function OwnerBottomTabBar({ currentPath = "", onNavigate }) {
  return (
    <Wrap>
      {TABS.map((tab) => {
        const active = currentPath.startsWith(tab.path);
        const Icon = tab.Icon;
        return (
          <Item key={tab.key} $active={active} type="button" onClick={() => onNavigate(tab.path)}>
            <IconWrap>
              <Icon size={20} />
            </IconWrap>
            <span>{tab.label}</span>
          </Item>
        );
      })}
    </Wrap>
  );
}
