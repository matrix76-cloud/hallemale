// src/layouts/MainLayout.jsx
import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import TopHeader from "./components/TopHeader";
import BottomTabBar from "./components/BottomTabBar";
import PageContainer from "./components/PageContainer";
import { useUI } from "../hooks/useUI";

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ToastWrap = styled.div`
  position: fixed;
  left: 50%;
  bottom: 80px;
  transform: translateX(-50%);
  background: rgba(17, 24, 39, 0.9);
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  z-index: 1000;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
`;

const ModalCard = styled.div`
  width: 88%;
  max-width: 360px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 16px;
  padding: 20px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const ModalTitle = styled.h2`
  font-size: 16px;
  margin: 0 0 8px;
`;

const ModalBody = styled.p`
  font-size: 14px;
  margin: 0 0 16px;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const SheetWrap = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -6px 16px rgba(15, 23, 42, 0.12);
  padding: 16px;
  z-index: 950;
`;

// ★ 헤더 ON/OFF를 라우터에서 제어할 수 있게 prop 추가
export default function MainLayout({ hideHeader = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    toast,
    modal,
    hideModal,
    bottomSheet,
    hideBottomSheet,
    globalLoading
  } = useUI();

  const getTitle = () => {
    if (location.pathname.startsWith("/matching")) return "매칭";
    if (location.pathname.startsWith("/gym")) return "커뮤니티";
    if (location.pathname.startsWith("/my")) return "내 정보";
    if (location.pathname.startsWith("/settings")) return "설정";
    if (location.pathname.startsWith("/match-room")) return "매칭룸";
    return "할래말래";
  };

  return (
    <Wrap>
      {/* 라우트에서 hideHeader=true로 주면 TopHeader 숨김 */}
      {!hideHeader && <TopHeader title={getTitle()} />}

      <Main>
        <PageContainer>
          <Outlet />
        </PageContainer>
      </Main>

      {!hideHeader && <BottomTabBar currentPath={location.pathname} onNavigate={navigate} />}

      {toast && <ToastWrap>{toast.message}</ToastWrap>}

      {modal && (
        <ModalOverlay onClick={hideModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            {modal.title && <ModalTitle>{modal.title}</ModalTitle>}
            <ModalBody>{modal.message}</ModalBody>
            <ModalActions>
              {modal.onCancel && (
                <button onClick={modal.onCancel}>취소</button>
              )}
              <button
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
                  hideModal();
                }}
              >
                확인
              </button>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {bottomSheet && (
        <ModalOverlay onClick={hideBottomSheet}>
          <SheetWrap onClick={(e) => e.stopPropagation()}>
            {bottomSheet()}
          </SheetWrap>
        </ModalOverlay>
      )}

      {globalLoading && (
        <ModalOverlay>
          <div>로딩중...</div>
        </ModalOverlay>
      )}
    </Wrap>
  );
}
