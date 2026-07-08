/* eslint-disable */
// src/layouts/components/OwnerBottomTabBar.jsx
// 구장 관리자 바텀탭 (3탭) — 예약관리 / 예약통계 / 구장정보
import React from "react";
import styled from "styled-components";
import { LuCalendar, LuChartColumn, LuSettings } from "react-icons/lu";
import { C } from "../../pages/owner/components/od";

const Wrap = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(62px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: ${C.white};
  border-top: 1px solid ${C.slate200};
  display: flex;
  z-index: 50;
  max-width: 448px;
  margin: 0 auto;
`;

const Item = styled.button`
  flex: 1;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: ${({ $active }) => ($active ? C.violet600 : C.slate400)};
  cursor: pointer;
`;

const Badge = styled.span`
  position: absolute;
  top: -5px;
  right: -9px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  background: ${C.amber500};
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const IconWrap = styled.span`
  position: relative;
  display: flex;
`;

const TABS = [
  { key: "home", Icon: LuCalendar, label: "예약관리", path: "/owner/home" },
  { key: "sales", Icon: LuChartColumn, label: "예약통계", path: "/owner/sales" },
  { key: "venue", Icon: LuSettings, label: "구장정보", path: "/owner/venue" },
];

export default function OwnerBottomTabBar({ currentPath = "", onNavigate, pendingCount = 0 }) {
  return (
    <Wrap>
      {TABS.map((tab) => {
        const active = currentPath.startsWith(tab.path);
        const Icon = tab.Icon;
        const showBadge = tab.key === "home" && pendingCount > 0;
        return (
          <Item key={tab.key} $active={active} type="button" onClick={() => onNavigate(tab.path)}>
            <IconWrap>
              <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              {showBadge && <Badge>{pendingCount > 9 ? "9+" : pendingCount}</Badge>}
            </IconWrap>
            <span>{tab.label}</span>
          </Item>
        );
      })}
    </Wrap>
  );
}
