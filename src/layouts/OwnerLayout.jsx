/* eslint-disable */
// src/layouts/OwnerLayout.jsx
// 구장 관리자 워크스페이스 레이아웃 (헤더 + 본문 + 바텀탭)
import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { OwnerProvider } from "../context/OwnerContext";
import OwnerBottomTabBar from "./components/OwnerBottomTabBar";

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
`;

const Header = styled.header`
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: ${({ theme }) => theme.colors.card};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const BackBtn = styled.button`
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  font-size: 22px;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
`;

const Main = styled.main`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-bottom: ${({ $hasTab }) =>
    $hasTab
      ? `calc(${72}px + env(safe-area-inset-bottom))`
      : "env(safe-area-inset-bottom)"};
`;

const TAB_PATHS = ["/owner/home", "/owner/venue", "/owner/my"];

function getTitle(p) {
  if (p.startsWith("/owner/home")) return "예약 관리";
  if (p.startsWith("/owner/venue")) return "내 구장";
  if (p.startsWith("/owner/my")) return "내정보";
  if (p.startsWith("/owner/register")) return "구장 등록";
  if (p.startsWith("/owner/pending")) return "심사 현황";
  return "구장 관리자";
}

export default function OwnerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const p = (location.pathname || "").toLowerCase();

  const hasTab = TAB_PATHS.some((t) => p.startsWith(t));
  const showBack = !hasTab && !p.endsWith("/owner") && !p.endsWith("/owner/");

  return (
    <OwnerProvider>
      <Wrap>
        <Header>
          {showBack && (
            <BackBtn type="button" onClick={() => navigate(-1)} aria-label="뒤로">
              ‹
            </BackBtn>
          )}
          <HeaderTitle>{getTitle(p)}</HeaderTitle>
        </Header>

        <Main $hasTab={hasTab}>
          <Outlet />
        </Main>

        {hasTab && (
          <OwnerBottomTabBar currentPath={location.pathname} onNavigate={navigate} />
        )}
      </Wrap>
    </OwnerProvider>
  );
}
