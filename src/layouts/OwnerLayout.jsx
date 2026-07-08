/* eslint-disable */
// src/layouts/OwnerLayout.jsx
// 구장 관리자 워크스페이스 레이아웃 (헤더 + 본문 + 바텀탭)
import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { OwnerProvider } from "../context/OwnerContext";
import OwnerBottomTabBar from "./components/OwnerBottomTabBar";
import { C } from "../pages/owner/components/od";
import { useUI } from "../hooks/useUI";

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${C.slate100};
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  max-width: 448px;
  margin: 0 auto;
`;

const Header = styled.header`
  height: 54px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: ${C.violet600};
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #fff;
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
  font-size: 24px;
  color: #fff;
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

const ToastWrap = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(84px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  max-width: 88%;
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  padding: 11px 18px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  text-align: center;
  z-index: 400;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
`;

const TAB_PATHS = ["/owner/home", "/owner/sales", "/owner/venue"];

function getTitle(p) {
  if (p.startsWith("/owner/home")) return "예약관리";
  if (p.startsWith("/owner/sales")) return "예약통계";
  if (p.startsWith("/owner/venue")) return "구장정보";
  if (p.startsWith("/owner/my")) return "내정보";
  if (p.startsWith("/owner/register")) return "구장 등록";
  if (p.startsWith("/owner/pending")) return "심사 현황";
  return "구장 관리자";
}

export default function OwnerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useUI() || {};
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

        {toast && <ToastWrap>{toast.message}</ToastWrap>}
      </Wrap>
    </OwnerProvider>
  );
}
