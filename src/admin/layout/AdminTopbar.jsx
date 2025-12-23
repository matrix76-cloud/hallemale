/* eslint-disable */
// src/admin/layout/AdminTopbar.jsx
import React from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { TOP_MENUS } from "../../utils/menus";

const BAR_H = 64;
const TAB_H = 40;

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  height: ${BAR_H}px;
  min-height: ${BAR_H}px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
`;

const Title = styled.div`
  flex: 0 0 auto;
  font-size: 18px;
  letter-spacing: -0.2px;
  margin-right: 14px;
`;

const Rail = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
`;

const TabsWrap = styled.nav`
  display: flex;
  align-items: center;
  gap: 22px;
  height: ${BAR_H}px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabBtn = styled.button`
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  height: ${TAB_H}px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 18px;
  letter-spacing: -0.2px;

  color: ${({ $active, theme }) =>
    $active
      ? theme?.colors?.primary || theme?.primary || "#4f46e5"
      : "#2a2e37"};

  font-weight: ${({ $active }) => ($active ? 700 : 600)};

  &:hover {
    color: #111;
  }
`;

const Grow = styled.div`
  flex: 1;
  min-width: 40px;
`;

const Hint = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

export default function AdminTopbar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const p = String(pathname || "").toLowerCase();

  return (
    <Bar>
      <Title>할래말래 Admin</Title>

      <Rail>
        <TabsWrap>
          {TOP_MENUS.map((m) => {
            const to = m.to || "/admin/dashboard";
            const toLower = String(to).toLowerCase();
            const active = p === toLower || p.startsWith(`${toLower}/`);

            return (
              <TabBtn key={m.key} type="button" $active={active} onClick={() => nav(to)}>
                {m.label}
              </TabBtn>
            );
          })}
        </TabsWrap>

        <Grow />
        <Hint>운영자 전용</Hint>
      </Rail>
    </Bar>
  );
}
