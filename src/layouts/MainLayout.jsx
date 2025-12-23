/* eslint-disable */
// src/layouts/MainLayout.jsx
import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import TopHeader from "./components/TopHeader";
import BottomTabBar from "./components/BottomTabBar";
import PageContainer from "./components/PageContainer";
import { useUI } from "../hooks/useUI";
import useMatchBadgeCount from "../hooks/useMatchBadgeCount";

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

export default function MainLayout({ hideHeader = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast, modal, hideModal, bottomSheet, hideBottomSheet, globalLoading } = useUI();

  // ✅ 매칭 배지 카운트(팀단위 notifications)
  const { count: matchingCount, refresh: refreshMatchBadge, uid, clubId } = useMatchBadgeCount();

  const path = location.pathname || "/";
  const p = path.toLowerCase();

  const getTitle = () => {
    if (p.startsWith("/home")) return "할래말래";
    if (p.startsWith("/matchingmanage")) return "할래말래 매칭관리";
    if (p === "/matching") return "매칭하기	";
    if (p === "/match-roomlist") return "매칭룸";
    if (p.startsWith("/match-roomdetail")) return "매칭공간";

    if (p.startsWith("/matching/analysis")) return "AI 분석";

    if (p === "/team/create") return "팀 구성하기";
    if (p.startsWith("/team/") && p.includes("/manage")) return "팀 관리";
    if (p === "/teamranking") return "팀전체순위";
    if (p === "/playerranking") return "선수전체순위";
    if (p.startsWith("/team")) return "팀 프로필";

    if (p.startsWith("/player")) return "선수 프로필";
    if (p === "/notifications") return "알림";
    if (p.startsWith("/notificationsdetail")) return "알림세부내용";
    if (p.startsWith("/chats")) return "채팅";

    if (p === "/terms") return "이용약관";
    if (p === "/privacy") return "개인정보처리방침";

    if (p === "/my/profile/detail") return "나의 프로필";
    if (p === "/my/profile/edit") return "프로필 수정";
    if (p === "/my/posts") return "내가 쓴 게시글";
    if (p === "/my/personal-matches") return "개인 활동 경기";
    if (p === "/my/matched-matches") return "내가 매칭된 경기";

    if (p === "/settings/notifications") return "알림 설정";
    if (p === "/settings/notices") return "공지사항";
    if (p === "/settings/block-report") return "신고/차단";
    if (p === "/settings/faq") return "FAQ";
    if (p === "/settings/password") return "비밀번호 변경";

    if (p.startsWith("/my")) return "할래말래 내 정보";
    if (p === "/community/write") return "게시글 쓰기";
    if (p.startsWith("/communitypost")) return "게시물";
    if (p.startsWith("/community")) return "할래말래 커뮤니티";

    if (p === "/my/team-invites") return "받은 초대";
    if (p.startsWith("/my/team-invites/")) return "초대 상세";
    if (p.includes("/join-requests")) return "참여요청";
    if (p === "/impact") return "할래말래 기부금 캠페인";

    return "할래말래";
  };

  const showBack =
    p === "/matching" ||
    p.startsWith("/matching/analysis") ||
    p.startsWith("/team") ||
    p.startsWith("/player") ||
    p.startsWith("/match-roomlist") ||
    p.startsWith("/match-roomdetail") ||
    p === "/notifications" ||
    p.startsWith("/notificationsdetail") ||
    p.startsWith("/chats") ||
    p === "/my/profile/detail" ||
    p === "/my/profile/edit" ||
    p === "/my/posts" ||
    p === "/community/write" ||
    p.startsWith("/communitypost") ||
    p === "/my/personal-matches" ||
    p === "/my/matched-matches" ||
    p === "/my/team-invites" ||
    p.startsWith("/my/team-invites/") ||
    p.includes("/join-requests") ||
    p === "/terms" ||
    p === "/privacy" ||
    p === "/impact" ||
    p.startsWith("/settings/");

  const isFullScreenPage =
    p.startsWith("/team") ||
    p.startsWith("/player") ||
    p.startsWith("/notification") ||
    p === "/matching" ||
    p.startsWith("/matching/analysis") ||
    p.startsWith("/chats") ||
    p === "/terms" ||
    p === "/privacy" ||
    p === "/impact" ||
    p.startsWith("/matchingmanage") ||
    p.startsWith("/my");

  const title = getTitle();

  // ✅ 매칭관리 화면 들어가면 배지 갱신 한 번(읽음 처리 후 0 반영 빠르게)
  useEffect(() => {
    if (!refreshMatchBadge) return;
    if (!uid || !clubId) return;
    if (p.startsWith("/matchingmanage")) {
      refreshMatchBadge();
    }
  }, [p, refreshMatchBadge, uid, clubId]);

  return (
    <Wrap>
      {!hideHeader && <TopHeader title={title} showBack={showBack} />}

      <Main>
        {isFullScreenPage ? (
          <Outlet />
        ) : (
          <PageContainer>
            <Outlet />
          </PageContainer>
        )}
      </Main>

      {!hideHeader && !showBack && (
        <BottomTabBar
          currentPath={location.pathname}
          onNavigate={navigate}
          matchingCount={matchingCount}
        />
      )}

      {toast && <ToastWrap>{toast.message}</ToastWrap>}

      {modal && (
        <ModalOverlay onClick={hideModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            {modal.title && <ModalTitle>{modal.title}</ModalTitle>}
            <ModalBody>{modal.message}</ModalBody>
            <ModalActions>
              {modal.onCancel && <button onClick={modal.onCancel}>취소</button>}
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
