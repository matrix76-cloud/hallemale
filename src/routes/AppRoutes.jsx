/* eslint-disable */
// src/routes/AppRoutes.jsx
// ✅ /admin 라우팅 추가(한 앱에 admin 포함)
// ✅ /admin/login 은 RequireAdmin 제외, 나머지 /admin/* 은 RequireAdmin + AdminShell
// ✅ /admin/users 같은 섹션 루트는 list로 리다이렉트 추가

import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

import HomePage from "../pages/home/HomePage";
import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import ClubOnboardingPage from "../pages/auth/ClubOnboardingPage";

import InvitesPage from "../pages/invites/InvitesPage";

import NotFoundPage from "../pages/system/NotFoundPage";
import AppLoadingPage from "../pages/system/AppLoadingPage";
import SplashPage from "../pages/system/SplashPage";

import { useAuth } from "../hooks/useAuth";
import { useClub } from "../hooks/useClub";
import WelcomePage from "../pages/auth/WelcomePage";
import SignupSuccessPage from "../pages/auth/SignupSuccessPage";
import MatchRoomListPage from "../pages/matching/MatchRoomListPage";
import MatchRoomDetailPage from "../pages/matching/MatchRoomDetailPage";
import MyProfilePage from "../pages/my/MyProfilePage";
import MyProfileDetailPage from "../pages/my/MyProfileDetailPage";
import MyPostsPage from "../pages/my/MyPostsPage";
import MyPersonalMatchesPage from "../pages/my/MyPersonalMatchesPage";
import MyMatchedMatchesPage from "../pages/my/MyMatchedMatchesPage";

import PlayerProfilePage from "../pages/player/PlayerProfilePage";
import TeamProfilePage from "../pages/team/TeamProfilePage";
import MatchingPage from "../pages/matching/MatchingPage";
import MatchingManagePage from "../pages/matching/MatchingManagePage";

import NotificationsPage from "../pages/notifications/NotificationsPage";
import ChatListPage from "../pages/chat/ChatListPage";
import NotificationSettingsPage from "../pages/settings/NotificationSettingsPage";
import NoticeListPage from "../pages/settings/NoticeListPage";
import BlockReportPage from "../pages/settings/BlockReportPage";
import FAQPage from "../pages/settings/FAQPage";
import ChangePasswordPage from "../pages/settings/ChangePasswordPage";

import NotificationDetailPage from "../pages/notifications/NotificationDetailPage";
import ChatRoomPage from "../pages/chat/ChatRoomPage";
import CommunityListPage from "../pages/community/CommunityListPage";
import CommunityWritePage from "../pages/community/CommunityWritePage";
import CommunityDetailPage from "../pages/community/CommunityDetailPage";

import TeamCreatePage from "../pages/team/TeamCreatePage";
import TeamManagePage from "../pages/team/TeamManagePage";

import MyProfileEditPage from "../pages/my/MyProfileEditPage";
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
import AdminPlayerApprovalsPage from "../pages/admin/AdminPlayerApprovalsPage";
import AdminTeamsListPage from "../pages/admin/AdminTeamsListPage";
import AdminTeamsApprovalsPage from "../pages/admin/AdminTeamsApprovalsPage";
import AdminMatchesListPage from "../pages/admin/AdminMatchesListPage";
import AdminMatchesIssuesPage from "../pages/admin/AdminMatchesIssuesPage";
import AdminCommunityPostsPage from "../pages/admin/AdminCommunityPostsPage";
import AdminCommunityReportsPage from "../pages/admin/AdminCommunityReportsPage";
import AdminNotifyNoticesPage from "../pages/admin/AdminNotifyNoticesPage";
import AdminNotifyPushPage from "../pages/admin/AdminNotifyPushPage";
import AdminNotifyHistoryPage from "../pages/admin/AdminNotifyHistoryPage";
import AdminSettingsAdminsPage from "../pages/admin/AdminSettingsAdminsPage";
import AdminSettingsPolicyPage from "../pages/admin/AdminSettingsPolicyPage";
import AdminGamesUpcomingPage from "../pages/admin/AdminGamesUpcomingPage";
import AdminGamesPastPage from "../pages/admin/AdminGamesPastPage";
import AdminPlayersListPage from "../pages/admin/AdminPlayersListPage";

function RequireAuth({ children }) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <AppLoadingPage />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return children;
}

function RequireClub({ children }) {
  const { club, loading } = useClub();

  if (loading) return <AppLoadingPage />;
  return children;
}

function RequireAdmin({ children }) {
  const { isLoggedIn, loading, userDoc } = useAuth();

  if (loading) return <AppLoadingPage />;

  // ✅ 개발용 관리자 세션(아이디 1 / 비번 1)
  let devAdminAuthed = false;
  try {
    devAdminAuthed = localStorage.getItem("HALLE_ADMIN_AUTHED") === "1";
  } catch (e) {}

  // ✅ dev 세션이면 Firebase 로그인/role 체크 없이 통과
  if (devAdminAuthed) return children;

  // ✅ 운영 모드(나중에): Firebase 로그인 + isAdmin
  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;

  const isAdmin = userDoc?.isAdmin === true || userDoc?.role === "admin";
  if (!isAdmin) return <Navigate to="/home" replace />;

  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  React.useLayoutEffect(() => {
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }
    hardScrollReset();
  }, [pathname]);

  return null;
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<SplashPage />} />

        <Route element={<AuthLayout />}>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signupsuccess" element={<SignupSuccessPage />} />
          <Route path="/onboarding/club" element={<ClubOnboardingPage />} />
        </Route>

        {/* Public MainLayout (약관/개인정보) */}
        <Route element={<MainLayout />}>
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>

        {/* ✅ Admin: login (public) */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* ✅ Admin: protected */}
        <Route
          element={
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          }
        >
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

          {/* ✅ 섹션 루트 리다이렉트 (404 방지) */}
          <Route path="/admin/users" element={<Navigate to="/admin/users/list" replace />} />
          <Route path="/admin/teams" element={<Navigate to="/admin/teams/list" replace />} />
          <Route path="/admin/matches" element={<Navigate to="/admin/matches/list" replace />} />
          <Route path="/admin/community" element={<Navigate to="/admin/community/posts" replace />} />
          <Route path="/admin/notify" element={<Navigate to="/admin/notify/notices" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/settings/admins" replace />} />

          <Route path="/admin/users/list" element={<AdminPlayersListPage />} />
          <Route path="/admin/users/reports" element={<AdminUsersReportsPage />} />
          <Route path="/admin/users/player-approvals" element={<AdminPlayerApprovalsPage />} />

          <Route path="/admin/teams/list" element={<AdminTeamsListPage />} />
          <Route path="/admin/teams/approvals" element={<AdminTeamsApprovalsPage />} />

          <Route path="/admin/matches/list" element={<AdminMatchesListPage />} />
          <Route path="/admin/matches/issues" element={<AdminMatchesIssuesPage />} />

          <Route path="/admin/community/posts" element={<AdminCommunityPostsPage />} />
          <Route path="/admin/community/reports" element={<AdminCommunityReportsPage />} />

          <Route path="/admin/notify/notices" element={<AdminNotifyNoticesPage />} />
          <Route path="/admin/notify/push" element={<AdminNotifyPushPage />} />
          <Route path="/admin/notify/history" element={<AdminNotifyHistoryPage />} />

          <Route path="/admin/settings/admins" element={<AdminSettingsAdminsPage />} />
          <Route path="/admin/settings/policy" element={<AdminSettingsPolicyPage />} />

          <Route path="/admin/games" element={<Navigate to="/admin/games/upcoming" replace />} />

            {/* ✅ games */}
          <Route path="/admin/games/upcoming" element={<AdminGamesUpcomingPage />} />
          <Route path="/admin/games/past" element={<AdminGamesPastPage />} />

        </Route>

        {/* Main app */}
        <Route
          element={
            <RequireAuth>
              <RequireClub>
                <MainLayout />
              </RequireClub>
            </RequireAuth>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/matchingmanage" element={<MatchingManagePage />} />
          <Route path="/community" element={<CommunityListPage />} />
          <Route path="/my" element={<MyProfilePage />} />

          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/match-roomlist" element={<MatchRoomListPage />} />
  

          <Route path="/match-roomdetail/:roomId" element={<MatchRoomDetailPage />} />

          <Route path="/team/:teamId" element={<TeamProfilePage />} />
          <Route path="/teamRanking" element={<TeamRankingFullPage />} />
          <Route path="/player/:playerId" element={<PlayerProfilePage />} />
          <Route path="/playerRanking" element={<PlayerRankingFullPage />} />

          <Route path="/team/create" element={<TeamCreatePage />} />
          <Route path="/team/:clubId/manage" element={<TeamManagePage />} />

          <Route path="/my/team-invites" element={<MyTeamInvitesPage />} />
          <Route path="/my/team-invites/:clubId/:inviteId" element={<MyTeamInviteDetailPage />} />

          <Route path="/team/:clubId/join-requests" element={<TeamJoinRequestsPage />} />
          <Route
            path="/team/:clubId/join-requests/:requestId"
            element={<TeamJoinRequestDetailPage />}
          />

          <Route path="/my/profile/detail" element={<MyProfileDetailPage />} />
          <Route path="/my/profile/edit" element={<MyProfileEditPage />} />

          <Route path="/my/posts" element={<MyPostsPage />} />
          <Route path="/my/personal-matches" element={<MyPersonalMatchesPage />} />
          <Route path="/my/matched-matches" element={<MyMatchedMatchesPage />} />

          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/notificationsdetail/:notificationId"
            element={<NotificationDetailPage />}
          />
          <Route path="/chats" element={<ChatListPage />} />
          <Route path="/chats/:chatId" element={<ChatRoomPage />} />

          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="/settings/notices" element={<NoticeListPage />} />
          <Route path="/settings/block-report" element={<BlockReportPage />} />
          <Route path="/settings/faq" element={<FAQPage />} />
          <Route path="/settings/password" element={<ChangePasswordPage />} />

          <Route path="/community/write" element={<CommunityWritePage />} />
          <Route path="/communitypost/:postId" element={<CommunityDetailPage />} />

          <Route path="/impact" element={<ImpactCampaignPage />} />
          <Route path="/matching/analysis/:clubId" element={<MatchAnalysisPage />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <RequireClub>
                <MainLayout hideHeader />
              </RequireClub>
            </RequireAuth>
          }
        >
          <Route path="/invites" element={<InvitesPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
