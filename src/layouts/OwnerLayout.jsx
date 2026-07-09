/* eslint-disable */
// src/layouts/OwnerLayout.jsx
// 구장 관리자 워크스페이스 레이아웃 (헤더 + 본문 + 바텀탭)
import React from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { OwnerProvider, useOwner } from "../context/OwnerContext";
import OwnerBottomTabBar from "./components/OwnerBottomTabBar";
import OwnerSpinner from "../pages/owner/components/OwnerSpinner";
import OwnerNotifBell from "../pages/owner/components/OwnerNotifBell";
import OwnerAgreementGate from "../pages/owner/OwnerAgreementGate";
import { C } from "../pages/owner/components/od";
import { useUI } from "../hooks/useUI";
import { images } from "../utils/imageAssets";

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
  gap: 6px;
  padding: 0 12px;
  position: relative;
  background: ${C.white};
  border-bottom: 1px solid ${C.slate200};
`;

const CenterTitle = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  font-weight: 700;
  color: ${C.slate800};
  pointer-events: none;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BrandLogo = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
`;

const BrandName = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${C.slate800};
`;

const BackBtn = styled.button`
  width: 32px;
  height: 40px;
  margin-left: -6px;
  border: none;
  background: transparent;
  font-size: 24px;
  color: ${C.slate800};
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

const TAB_PATHS = ["/owner/home", "/owner/sales", "/owner/venue", "/owner/my"];

// 상단 헤더 중앙에 표시할 현재 페이지 이름 (하단탭/서브페이지별)
function getTitle(p) {
  if (p.startsWith("/owner/home")) return "예약관리";
  if (p.startsWith("/owner/sales")) return "예약통계";
  if (p.startsWith("/owner/venue")) return "구장정보";
  if (p.startsWith("/owner/withdraw")) return "회원탈퇴";
  if (p.startsWith("/owner/inquiry")) return "1:1 문의";
  if (p.startsWith("/owner/notifications")) return "알림";
  if (p.startsWith("/owner/my")) return "내정보";
  if (p.startsWith("/owner/register")) return "구장 등록";
  if (p.startsWith("/owner/onboarding")) return "구장 등록";
  if (p.startsWith("/owner/pending")) return "심사 현황";
  return "";
}

// 필수 동의(만 19세 이상 사업자 · 구장 관리자 이용약관 · 개인정보처리방침) 완료 여부
function hasOwnerConsent(userDoc) {
  return (
    userDoc?.ownerTermsConsent === true &&
    userDoc?.ownerPrivacyConsent === true &&
    userDoc?.ownerAdultConsent === true
  );
}

// 구장 미등록(venue 없음) 오너는 워크스페이스로 못 들어가고 온보딩에 머문다.
// (예외: 온보딩/등록/내정보/탈퇴/문의 — 가입 직후 앱 진입 방지 + 로그아웃/탈퇴/고객지원 경로는 열어둠)
// ⚡ memo: OwnerShell이 토스트 때문에 리렌더돼도 현재 페이지(Outlet)는 다시 그리지 않는다.
//    자체 구독(useOwner/useLocation)이 바뀌면 정상적으로 갱신된다.
const OwnerGate = React.memo(function OwnerGate() {
  const { loading, venue } = useOwner();
  const { pathname } = useLocation();
  const p = (pathname || "").toLowerCase();
  const exempt = /\/owner\/(onboarding|register|withdraw|my|inquiry|notifications)(\/|$)/.test(p);
  if (loading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue && !exempt) return <Navigate to="/owner/onboarding" replace />;
  return <Outlet />;
});

export default function OwnerLayout() {
  return (
    <OwnerProvider>
      <OwnerShell />
    </OwnerProvider>
  );
}

function OwnerShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useUI() || {};
  const { loading, userDoc } = useOwner();
  const p = (location.pathname || "").toLowerCase();

  const hasTab = TAB_PATHS.some((t) => p.startsWith(t));
  const showBack = !hasTab && !p.endsWith("/owner") && !p.endsWith("/owner/");
  const isHome = p.startsWith("/owner/home"); // 홈만 브랜드(로고+텍스트), 나머지는 페이지명

  // 필수 동의 전에는 워크스페이스 전체를 막고 동의 게이트를 띄운다.
  if (!loading && !hasOwnerConsent(userDoc)) return <OwnerAgreementGate />;

  return (
    <>
      <Wrap>
        <Header>
          {showBack && (
            <BackBtn type="button" onClick={() => navigate(-1)} aria-label="뒤로">
              ‹
            </BackBtn>
          )}
          {isHome && (
            <Brand>
              <BrandLogo src={images.logo} alt="할래말래 로고" />
              <BrandName>할래말래</BrandName>
            </Brand>
          )}
          {!isHome && <CenterTitle>{getTitle(p)}</CenterTitle>}
          {hasTab && <OwnerNotifBell onClick={() => navigate("/owner/notifications")} />}
        </Header>

        <Main $hasTab={hasTab}>
          <OwnerGate />
        </Main>

        {hasTab && (
          <OwnerBottomTabBar currentPath={location.pathname} onNavigate={navigate} />
        )}

        {toast && <ToastWrap>{toast.message}</ToastWrap>}
      </Wrap>
    </>
  );
}
