/* eslint-disable */
// src/routes/AppRoutes.jsx
import React, { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useWebviewBridgeContext } from "../context/WebviewBridgeContext";
import { useUI } from "../hooks/useUI";
import { goBackOrHome } from "../utils/navigation";

import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

import HomePage from "../pages/home/HomePage";
import LoginPage from "../pages/auth/LoginPage";
import ClubOnboardingPage from "../pages/auth/ClubOnboardingPage";

import InvitesPage from "../pages/invites/InvitesPage";

import NotFoundPage from "../pages/system/NotFoundPage";
import AppLoadingPage from "../pages/system/AppLoadingPage";
import AgreementGate from "../components/auth/AgreementGate";
import SplashPage from "../pages/system/SplashPage";

import { useAuth } from "../hooks/useAuth";
import { useClub } from "../hooks/useClub";
import WelcomePage from "../pages/auth/WelcomePage";
import KakaoCallbackPage from "../pages/auth/KakaoCallbackPage";
import MatchRoomListPage from "../pages/matching/MatchRoomListPage";
import MatchRoomDetailPage from "../pages/matching/MatchRoomDetailPage";
import MyProfilePage from "../pages/my/MyProfilePage";
import MyProfileDetailPage from "../pages/my/MyProfileDetailPage";
import MyPostsPage from "../pages/my/MyPostsPage";
import MyReportsPage from "../pages/my/MyReportsPage";
import MyPersonalMatchesPage from "../pages/my/MyPersonalMatchesPage";
import MyMatchedMatchesPage from "../pages/my/MyMatchedMatchesPage";
import InquiryPage from "../pages/my/InquiryPage";

import PlayerProfilePage from "../pages/player/PlayerProfilePage";
import TeamProfilePage from "../pages/team/TeamProfilePage";
import MatchingPage from "../pages/matching/MatchingPage";
import MatchingManagePage from "../pages/matching/MatchingManagePage";

import NotificationsPage from "../pages/notifications/NotificationsPage";
import ChatListPage from "../pages/chat/ChatListPage";
import NotificationSettingsPage from "../pages/settings/NotificationSettingsPage";
import NoticeListPage from "../pages/settings/NoticeListPage";
import SettingsBlockedPage from "../pages/settings/SettingsBlockedPage";
import WithdrawPage from "../pages/settings/WithdrawPage";
import FAQPage from "../pages/settings/FAQPage";

import NotificationDetailPage from "../pages/notifications/NotificationDetailPage";
import ChatRoomPage from "../pages/chat/ChatRoomPage";
import CommunityListPage from "../pages/community/CommunityListPage";
import CommunityWritePage from "../pages/community/CommunityWritePage";
import CommunityDetailPage from "../pages/community/CommunityDetailPage";

import TeamCreatePage from "../pages/team/TeamCreatePage";
import TeamManagePage from "../pages/team/TeamManagePage";

import MyProfileEditPage from "../pages/my/MyProfileEditPage";
import MyProfileSkillsEditPage from "../pages/my/MyProfileSkillsEditPage";
import MyProfileBodyEditPage from "../pages/my/MyProfileBodyEditPage";
import MyProfileIntroEditPage from "../pages/my/MyProfileIntroEditPage";
import MyProfileMediaEditPage from "../pages/my/MyProfileMediaEditPage";
import MyProfileTeamJoinEditPage from "../pages/my/MyProfileTeamJoinEditPage";
import { hardScrollReset } from "../utils/hardScrollReset";
import MyTeamInvitesPage from "../pages/my/MyTeamInvitesPage";
import MyTeamInviteDetailPage from "../pages/my/MyTeamInviteDetailPage";
import TeamJoinRequestsPage from "../components/team/TeamJoinRequestsPage";
import TeamJoinRequestDetailPage from "../components/team/TeamJoinRequestDetailPage";

import TermsPage from "../pages/legal/TermsPage";
import PrivacyPage from "../pages/legal/PrivacyPage";
import PlayerRankingFullPage from "../pages/player/PlayerRankingFullPage";
import TeamRankingFullPage from "../pages/team/TeamRankingFullPage";
import ImpactCampaignPage from "../pages/home/ImpactCampaignPage";
import MatchAnalysisPage from "../pages/matching/MatchAnalysisPage";

// ✅ Admin
import AdminShell from "../admin/layout/AdminShell";
import AdminLoginPage from "../pages/admin/AdminLoginPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminUsersReportsPage from "../pages/admin/AdminUsersReportsPage";
import AdminUsersBlocksPage from "../pages/admin/AdminUsersBlocksPage";
import AdminTeamsListPage from "../pages/admin/AdminTeamsListPage";
import AdminTeamsReportsPage from "../pages/admin/AdminTeamsReportsPage";
import AdminTeamsBlocksPage from "../pages/admin/AdminTeamsBlocksPage";
import AdminMatchesListPage from "../pages/admin/AdminMatchesListPage";
import AdminMatchesIssuesPage from "../pages/admin/AdminMatchesIssuesPage";
import AdminCommunityPostsPage from "../pages/admin/AdminCommunityPostsPage";
import AdminCommunityPostDetailPage from "../pages/admin/AdminCommunityPostDetailPage";
import AdminCommunityReportsPage from "../pages/admin/AdminCommunityReportsPage";
import AdminNotifyNoticesPage from "../pages/admin/AdminNotifyNoticesPage";
import AdminNotifyPushPage from "../pages/admin/AdminNotifyPushPage";
import AdminInquiriesPage from "../pages/admin/AdminInquiriesPage";
import AdminSettingsAdminsPage from "../pages/admin/AdminSettingsAdminsPage";
import AdminSettingsPolicyPage from "../pages/admin/AdminSettingsPolicyPage";
import AdminGamesUpcomingPage from "../pages/admin/AdminGamesUpcomingPage";
import AdminGamesPastPage from "../pages/admin/AdminGamesPastPage";
import AdminPlayersListPage from "../pages/admin/AdminPlayersListPage";
import AdminPlayersRankingPage from "../pages/admin/AdminPlayersRankingPage";
import AdminTeamsRankingPage from "../pages/admin/AdminTeamsRankingPage";
import AdminChatListPage from "../pages/admin/AdminChatListPage";
import AdminChatRoomDetailPage from "../pages/admin/AdminChatRoomDetailPage";
import AdminBannersPage from "../pages/admin/AdminBannersPage";
import AdminVenuesPage from "../pages/admin/AdminVenuesPage";
import AdminUpdatesPage from "../pages/admin/AdminUpdatesPage";
import FinishedMatchesPage from "../pages/matching/FinishedMatchesPage";
import MyTeamMatchesPage from "../pages/matching/MyTeamMatchesPage";
import EventPage from "../pages/event/EventPage";
import AdminEventPopupsPage from "../pages/admin/AdminEventPopupsPage";
import VenueDetailPage from "../pages/venue/VenueDetailPage";

// ✅ 구장 관리자(구장주) 워크스페이스
import OwnerLayout from "../layouts/OwnerLayout";
import OwnerLoginPage from "../pages/owner/OwnerLoginPage";
import OwnerEntry from "../pages/owner/OwnerEntry";
import OwnerRegisterPage from "../pages/owner/OwnerRegisterPage";
import OwnerStatusPage from "../pages/owner/OwnerStatusPage";
import OwnerHomePage from "../pages/owner/OwnerHomePage";
import OwnerVenuePage from "../pages/owner/OwnerVenuePage";
import OwnerMyPage from "../pages/owner/OwnerMyPage";

function RequireAuth({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <AppLoadingPage />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

// 카카오 단일 로그인으로 전환하며 전화번호 인증 단계 제거 (2026-06-12).
// 게이트는 통과만 시킨다. (/link-phone 라우트는 남겨두되 더 이상 진입하지 않음)
function RequirePhone({ children }) {
  return children;
}

// 최초 로그인 후 1회: 만 14세 이상 + 이용약관·개인정보처리방침 동의 게이트.
// 동의 내역(users.termsConsent/privacyConsent/ageOver14Consent)이 없으면 진입을 막고 동의 화면을 띄운다.
function RequireConsent({ children }) {
  const { userDoc, loading } = useAuth();
  if (loading) return <AppLoadingPage />;
  const agreed =
    userDoc?.termsConsent === true &&
    userDoc?.privacyConsent === true &&
    userDoc?.ageOver14Consent === true;
  if (!agreed) return <AgreementGate />;
  return children;
}

function RequireClub({ children }) {
  const { loading } = useClub();
  if (loading) return <AppLoadingPage />;
  return children;
}

// 구장 관리자 전용 인증 게이트 — 미로그인 시 /owner/login 으로 (일반 /login 아님)
function RequireOwnerAuth({ children }) {
  const { isLoggedIn, loading, firebaseUser } = useAuth();
  console.log("🔑OWNER RequireOwnerAuth:", { loading, isLoggedIn, uid: firebaseUser?.uid || null });
  if (loading) return <AppLoadingPage />;
  if (!isLoggedIn) return <Navigate to="/owner/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isLoggedIn, loading, userDoc } = useAuth();
  if (loading) return <AppLoadingPage />;

  let devAdminAuthed = false;
  try {
    devAdminAuthed = localStorage.getItem("HALLE_ADMIN_AUTHED") === "1";
  } catch (e) {}

  if (devAdminAuthed) return children;
  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;

  const isAdmin = userDoc?.isAdmin === true || userDoc?.role === "admin";
  if (!isAdmin) return <Navigate to="/home" replace />;

  return children;
}

// ── 종료 모달이 뜨는 페이지 (백스택 없는 진입점) ──
const ROOT_PATHS = ["/", "/welcome", "/home"];
// ── 하단 탭바 중 홈이 아닌 탭 (뒤로가기 시 홈으로 이동) ──
const FOOTER_NON_HOME = ["/matchingmanage", "/records", "/community", "/my"];

/**
 * 라우트 변경 시 RN에 NAV_STATE 발송 + BACK_REQUEST / APP_EXIT_REQUEST 수신 처리
 */
function BridgeNavSync() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const bridge = useWebviewBridgeContext();
  const { modal, bottomSheet, hideModal, hideBottomSheet, showModal } = useUI();

  // 최신 UI 상태를 ref로 유지 (subscribe 콜백 안에서 stale closure 방지)
  const uiRef = useRef({ modal, bottomSheet, hideModal, hideBottomSheet, showModal });
  uiRef.current = { modal, bottomSheet, hideModal, hideBottomSheet, showModal };

  const hasBlockingUI = !!(modal || bottomSheet);

  // 라우트 또는 블로킹 UI 변경 시 NAV_STATE 발송
  useEffect(() => {
    if (!bridge?.isWebView) return;

    const p = pathname.toLowerCase();
    const isRoot = ROOT_PATHS.includes(p);

    bridge.sendToApp("NAV_STATE", {
      isRoot,
      path: pathname,
      canGoBackInWeb: !isRoot,
      hasBlockingUI,
    });
  }, [pathname, hasBlockingUI, bridge]);

  // BACK_REQUEST: 모달 닫기 또는 뒤로가기
  useEffect(() => {
    if (!bridge?.subscribe) return;

    return bridge.subscribe("BACK_REQUEST", () => {
      const ui = uiRef.current;
      if (ui.modal) { ui.hideModal(); return; }
      if (ui.bottomSheet) { ui.hideBottomSheet(); return; }
      // 푸터 탭(홈 제외)에 있을 때는 홈으로 이동
      const p = (typeof window !== "undefined" ? window.location.pathname : "").toLowerCase();
      if (FOOTER_NON_HOME.includes(p)) {
        navigate("/home");
        return;
      }
      goBackOrHome(navigate);
    });
  }, [bridge, navigate]);

  // APP_EXIT_REQUEST: 루트에서 뒤로가기 → 종료 확인 모달
  useEffect(() => {
    if (!bridge?.subscribe) return;

    return bridge.subscribe("APP_EXIT_REQUEST", () => {
      const ui = uiRef.current;
      // 이미 블로킹 UI가 떠 있으면 그것부터 닫기 (BACK_REQUEST와 동일 가드)
      if (ui.modal) { ui.hideModal(); return; }
      if (ui.bottomSheet) { ui.hideBottomSheet(); return; }
      ui.showModal({
        title: "앱 종료",
        message: "앱을 종료하시겠습니까?",
        onConfirm: () => {
          ui.hideModal();
          bridge.sendToApp("EXIT_APP");
        },
        onCancel: () => ui.hideModal(),
      });
    });
  }, [bridge]);

  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  React.useLayoutEffect(() => {
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {}
    hardScrollReset();
  }, [pathname]);

  return null;
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <BridgeNavSync />
      <Routes>
        <Route path="/" element={<SplashPage />} />

        {/* 카카오 웹 로그인 콜백 (인증 불필요) */}
        <Route path="/oauth/kakao" element={<KakaoCallbackPage />} />

        <Route element={<AuthLayout />}>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding/club" element={<ClubOnboardingPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route
          element={
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          }
        >
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

          <Route path="/admin/users" element={<Navigate to="/admin/users/list" replace />} />
          <Route path="/admin/teams" element={<Navigate to="/admin/teams/list" replace />} />
          <Route path="/admin/matches" element={<Navigate to="/admin/matches/list" replace />} />
          <Route path="/admin/community" element={<Navigate to="/admin/community/posts" replace />} />
          <Route path="/admin/notify" element={<Navigate to="/admin/notify/notices" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/settings/admins" replace />} />

          <Route path="/admin/users/list" element={<AdminPlayersListPage />} />
          <Route path="/admin/users/ranking" element={<AdminPlayersRankingPage />} />
          <Route path="/admin/users/reports" element={<AdminUsersReportsPage />} />
          <Route path="/admin/users/blocks" element={<AdminUsersBlocksPage />} />

          <Route path="/admin/teams/list" element={<AdminTeamsListPage />} />
          <Route path="/admin/teams/ranking" element={<AdminTeamsRankingPage />} />
          <Route path="/admin/teams/reports" element={<AdminTeamsReportsPage />} />
          <Route path="/admin/teams/blocks" element={<AdminTeamsBlocksPage />} />

          <Route path="/admin/matches/list" element={<AdminMatchesListPage />} />
          <Route path="/admin/matches/issues" element={<AdminMatchesIssuesPage />} />

          <Route path="/admin/community/posts" element={<AdminCommunityPostsPage />} />
          <Route path="/admin/community/posts/:postId" element={<AdminCommunityPostDetailPage />} />
          <Route path="/admin/community/reports" element={<AdminCommunityReportsPage />} />

          <Route path="/admin/notify/notices" element={<AdminNotifyNoticesPage />} />
          <Route path="/admin/notify/push" element={<AdminNotifyPushPage />} />

          <Route path="/admin/settings/admins" element={<AdminSettingsAdminsPage />} />
          <Route path="/admin/settings/policy" element={<AdminSettingsPolicyPage />} />

          <Route path="/admin/games" element={<Navigate to="/admin/games/upcoming" replace />} />
          <Route path="/admin/games/upcoming" element={<AdminGamesUpcomingPage />} />
          <Route path="/admin/games/past" element={<AdminGamesPastPage />} />

          {/* 신규: 채팅 / 배너 / 앱 업데이트 */}
          <Route path="/admin/chat" element={<Navigate to="/admin/chat/list" replace />} />
          <Route path="/admin/chat/list" element={<AdminChatListPage />} />
          <Route path="/admin/chat/list/:chatId" element={<AdminChatRoomDetailPage />} />
          <Route path="/admin/banners" element={<AdminBannersPage />} />
          <Route path="/admin/venues" element={<AdminVenuesPage />} />
          <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
          <Route path="/admin/popups" element={<AdminEventPopupsPage />} />
          <Route path="/admin/updates" element={<AdminUpdatesPage />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <RequirePhone>
                <RequireConsent>
                <RequireClub>
                  <MainLayout />
                </RequireClub>
                </RequireConsent>
              </RequirePhone>
            </RequireAuth>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/matchingmanage" element={<MatchingManagePage />} />
          <Route path="/records" element={<MyTeamMatchesPage />} />
          <Route path="/community" element={<CommunityListPage />} />
          <Route path="/my" element={<MyProfilePage />} />

          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/match-roomlist" element={<MatchRoomListPage />} />
          <Route path="/match-roomdetail/:roomId" element={<MatchRoomDetailPage />} />
          <Route path="/match-roomdetail/:roomId/venue" element={<MatchRoomDetailPage />} />

          <Route path="/venues/:id" element={<VenueDetailPage />} />

          <Route path="/matches/finished" element={<FinishedMatchesPage />} />
          <Route path="/event/:id" element={<EventPage />} />

          <Route path="/team/:teamId" element={<TeamProfilePage />} />
          <Route path="/teamRanking" element={<TeamRankingFullPage />} />
          <Route path="/player/:playerId" element={<PlayerProfilePage />} />
          <Route path="/playerRanking" element={<PlayerRankingFullPage />} />

          <Route path="/team/create" element={<TeamCreatePage />} />
          <Route path="/team/:clubId/manage" element={<TeamManagePage />} />

          <Route path="/my/team-invites" element={<MyTeamInvitesPage />} />
          <Route path="/my/team-invites/:clubId/:inviteId" element={<MyTeamInviteDetailPage />} />

          <Route path="/team/:clubId/join-requests" element={<TeamJoinRequestsPage />} />
          <Route path="/team/:clubId/join-requests/:requestId" element={<TeamJoinRequestDetailPage />} />

          <Route path="/my/profile/detail" element={<MyProfileDetailPage />} />
          <Route path="/my/profile/edit" element={<MyProfileEditPage />} />
          <Route path="/my/profile/edit/skills" element={<MyProfileSkillsEditPage />} />
          <Route path="/my/profile/edit/body" element={<MyProfileBodyEditPage />} />
          <Route path="/my/profile/edit/intro" element={<MyProfileIntroEditPage />} />
          <Route path="/my/profile/edit/media" element={<MyProfileMediaEditPage />} />
          <Route path="/my/profile/edit/team-join" element={<MyProfileTeamJoinEditPage />} />

          <Route path="/my/posts" element={<MyPostsPage />} />
          <Route path="/my/personal-matches" element={<MyPersonalMatchesPage />} />
          <Route path="/my/matched-matches" element={<MyMatchedMatchesPage />} />
          <Route path="/my/reports" element={<MyReportsPage />} />
          <Route path="/my/inquiry" element={<InquiryPage />} />

          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/notificationsdetail/:notificationId" element={<NotificationDetailPage />} />
          <Route path="/chats" element={<ChatListPage />} />
          <Route path="/chats/:chatId" element={<ChatRoomPage />} />

          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="/settings/notices" element={<NoticeListPage />} />
          <Route path="/settings/block-report" element={<SettingsBlockedPage />} />
          <Route path="/settings/blocked" element={<SettingsBlockedPage />} />
          <Route path="/settings/withdraw" element={<WithdrawPage />} />
          <Route path="/settings/faq" element={<FAQPage />} />

          <Route path="/community/write" element={<CommunityWritePage />} />
          <Route path="/communitypost/:postId" element={<CommunityDetailPage />} />

          <Route path="/impact" element={<ImpactCampaignPage />} />
          <Route path="/matching/analysis/:clubId" element={<MatchAnalysisPage />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <RequirePhone>
                <RequireConsent>
                <RequireClub>
                  <MainLayout hideHeader />
                </RequireClub>
                </RequireConsent>
              </RequirePhone>
            </RequireAuth>
          }
        >
          <Route path="/invites" element={<InvitesPage />} />
        </Route>

        {/* ✅ 구장 관리자(구장주) 워크스페이스 — 별도 라우트 트리 */}
        <Route path="/owner/login" element={<OwnerLoginPage />} />
        <Route
          element={
            <RequireOwnerAuth>
              <OwnerLayout />
            </RequireOwnerAuth>
          }
        >
          <Route path="/owner" element={<OwnerEntry />} />
          <Route path="/owner/register" element={<OwnerRegisterPage />} />
          <Route path="/owner/pending" element={<OwnerStatusPage />} />
          {/* 소프트 게이트: 막지 않고 입장 → 각 탭에서 등록/심사 안내 */}
          <Route path="/owner/home" element={<OwnerHomePage />} />
          <Route path="/owner/venue" element={<OwnerVenuePage />} />
          <Route path="/owner/my" element={<OwnerMyPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
