/* eslint-disable */
// src/routes/AppRoutes.jsx
import React, { lazy, Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useWebviewBridgeContext } from "../context/WebviewBridgeContext";
import { useUI } from "../hooks/useUI";
import { goBackOrHome } from "../utils/navigation";

// ⚡ 아래 모듈만 메인 번들에 남긴다. 앱 부팅(/ → /login)과 카카오 콜백(/oauth/kakao)의
//    임계 경로라서, 청크를 한 번 더 받으러 가면 그만큼 로그인이 늦어진다.
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import NotFoundPage from "../pages/system/NotFoundPage";
import AppLoadingPage from "../pages/system/AppLoadingPage";
import SplashPage from "../pages/system/SplashPage";
import LoginPage from "../pages/auth/LoginPage";
import WelcomePage from "../pages/auth/WelcomePage";
import KakaoCallbackPage from "../pages/auth/KakaoCallbackPage";

import { useAuth } from "../hooks/useAuth";
import { useOwnerAuth } from "../hooks/useOwnerAuth";
import { useClub } from "../hooks/useClub";
import { hardScrollReset } from "../utils/hardScrollReset";

// ── 나머지 페이지는 전부 라우트 단위 청크로 분리 ──
const HomePage = lazy(() => import("../pages/home/HomePage"));
const ClubOnboardingPage = lazy(() => import("../pages/auth/ClubOnboardingPage"));
const InvitesPage = lazy(() => import("../pages/invites/InvitesPage"));
const AgreementGate = lazy(() => import("../components/auth/AgreementGate"));
const PhoneVerifyPage = lazy(() => import("../pages/auth/PhoneVerifyPage"));
const SignupCompletePage = lazy(() => import("../pages/auth/SignupCompletePage"));
const MatchRoomListPage = lazy(() => import("../pages/matching/MatchRoomListPage"));
const MatchRoomDetailPage = lazy(() => import("../pages/matching/MatchRoomDetailPage"));
const MyProfilePage = lazy(() => import("../pages/my/MyProfilePage"));
const MyProfileDetailPage = lazy(() => import("../pages/my/MyProfileDetailPage"));
const MyPostsPage = lazy(() => import("../pages/my/MyPostsPage"));
const MyReportsPage = lazy(() => import("../pages/my/MyReportsPage"));
const MyPersonalMatchesPage = lazy(() => import("../pages/my/MyPersonalMatchesPage"));
const InquiryPage = lazy(() => import("../pages/my/InquiryPage"));

const PlayerProfilePage = lazy(() => import("../pages/player/PlayerProfilePage"));
const TeamProfilePage = lazy(() => import("../pages/team/TeamProfilePage"));
const MatchingPage = lazy(() => import("../pages/matching/MatchingPage"));
const MatchRegionSelectPage = lazy(() => import("../pages/matching/MatchRegionSelectPage"));
const MatchSearchingPage = lazy(() => import("../pages/matching/MatchSearchingPage"));
const MatchOpponentRevealPage = lazy(() => import("../pages/matching/MatchOpponentRevealPage"));
const MatchingManagePage = lazy(() => import("../pages/matching/MatchingManagePage"));

const NotificationsPage = lazy(() => import("../pages/notifications/NotificationsPage"));
const ChatListPage = lazy(() => import("../pages/chat/ChatListPage"));
const NotificationSettingsPage = lazy(() => import("../pages/settings/NotificationSettingsPage"));
const NoticeListPage = lazy(() => import("../pages/settings/NoticeListPage"));
const SettingsBlockedPage = lazy(() => import("../pages/settings/SettingsBlockedPage"));
const WithdrawPage = lazy(() => import("../pages/settings/WithdrawPage"));
const FAQPage = lazy(() => import("../pages/settings/FAQPage"));

const NotificationDetailPage = lazy(() => import("../pages/notifications/NotificationDetailPage"));
const ChatRoomPage = lazy(() => import("../pages/chat/ChatRoomPage"));
const CommunityListPage = lazy(() => import("../pages/community/CommunityListPage"));
const CommunityWritePage = lazy(() => import("../pages/community/CommunityWritePage"));
const CommunityDetailPage = lazy(() => import("../pages/community/CommunityDetailPage"));

const TeamCreatePage = lazy(() => import("../pages/team/TeamCreatePage"));
const TeamManagePage = lazy(() => import("../pages/team/TeamManagePage"));

const MyProfileEditPage = lazy(() => import("../pages/my/MyProfileEditPage"));
const MyProfileSkillsEditPage = lazy(() => import("../pages/my/MyProfileSkillsEditPage"));
const MyProfileBodyEditPage = lazy(() => import("../pages/my/MyProfileBodyEditPage"));
const MyProfileIntroEditPage = lazy(() => import("../pages/my/MyProfileIntroEditPage"));
const MyProfileMediaEditPage = lazy(() => import("../pages/my/MyProfileMediaEditPage"));
const MyProfileTeamJoinEditPage = lazy(() => import("../pages/my/MyProfileTeamJoinEditPage"));
const MyTeamInvitesPage = lazy(() => import("../pages/my/MyTeamInvitesPage"));
const MyTeamInviteDetailPage = lazy(() => import("../pages/my/MyTeamInviteDetailPage"));
const TeamJoinRequestsPage = lazy(() => import("../components/team/TeamJoinRequestsPage"));
const TeamJoinRequestDetailPage = lazy(() => import("../components/team/TeamJoinRequestDetailPage"));

const TermsPage = lazy(() => import("../pages/legal/TermsPage"));
const PrivacyPage = lazy(() => import("../pages/legal/PrivacyPage"));
const OperationPage = lazy(() => import("../pages/legal/OperationPage"));
const RefundPage = lazy(() => import("../pages/legal/RefundPage"));
const PlayerRankingFullPage = lazy(() => import("../pages/player/PlayerRankingFullPage"));
const TeamRankingFullPage = lazy(() => import("../pages/team/TeamRankingFullPage"));
const TeamMatchHistoryFullPage = lazy(() => import("../pages/team/TeamMatchHistoryFullPage"));
const PlayerMatchHistoryFullPage = lazy(() => import("../pages/player/PlayerMatchHistoryFullPage"));
const ImpactCampaignPage = lazy(() => import("../pages/home/ImpactCampaignPage"));
const MatchAnalysisPage = lazy(() => import("../pages/matching/MatchAnalysisPage"));

// ✅ Admin
const AdminShell = lazy(() => import("../admin/layout/AdminShell"));
const AdminLoginPage = lazy(() => import("../pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage"));
const AdminUsersReportsPage = lazy(() => import("../pages/admin/AdminUsersReportsPage"));
const AdminUsersBlocksPage = lazy(() => import("../pages/admin/AdminUsersBlocksPage"));
const AdminTeamsListPage = lazy(() => import("../pages/admin/AdminTeamsListPage"));
const AdminTeamsReportsPage = lazy(() => import("../pages/admin/AdminTeamsReportsPage"));
const AdminTeamsBlocksPage = lazy(() => import("../pages/admin/AdminTeamsBlocksPage"));
const AdminMatchesListPage = lazy(() => import("../pages/admin/AdminMatchesListPage"));
const AdminMatchesIssuesPage = lazy(() => import("../pages/admin/AdminMatchesIssuesPage"));
const AdminCommunityPostsPage = lazy(() => import("../pages/admin/AdminCommunityPostsPage"));
const AdminCommunityPostDetailPage = lazy(() => import("../pages/admin/AdminCommunityPostDetailPage"));
const AdminCommunityReportsPage = lazy(() => import("../pages/admin/AdminCommunityReportsPage"));
const AdminNotifyNoticesPage = lazy(() => import("../pages/admin/AdminNotifyNoticesPage"));
const AdminNotifyPushPage = lazy(() => import("../pages/admin/AdminNotifyPushPage"));
const AdminInquiriesPage = lazy(() => import("../pages/admin/AdminInquiriesPage"));
const AdminSettingsAdminsPage = lazy(() => import("../pages/admin/AdminSettingsAdminsPage"));
const AdminSettingsPolicyPage = lazy(() => import("../pages/admin/AdminSettingsPolicyPage"));
const AdminGamesUpcomingPage = lazy(() => import("../pages/admin/AdminGamesUpcomingPage"));
const AdminGamesPastPage = lazy(() => import("../pages/admin/AdminGamesPastPage"));
const AdminPlayersListPage = lazy(() => import("../pages/admin/AdminPlayersListPage"));
const AdminPlayersRankingPage = lazy(() => import("../pages/admin/AdminPlayersRankingPage"));
const AdminTeamsRankingPage = lazy(() => import("../pages/admin/AdminTeamsRankingPage"));
const AdminChatListPage = lazy(() => import("../pages/admin/AdminChatListPage"));
const AdminChatRoomDetailPage = lazy(() => import("../pages/admin/AdminChatRoomDetailPage"));
const AdminBannersPage = lazy(() => import("../pages/admin/AdminBannersPage"));
const AdminVenuesPage = lazy(() => import("../pages/admin/AdminVenuesPage"));
const AdminSettlementsPage = lazy(() => import("../pages/admin/AdminSettlementsPage"));
const AdminRefundsPage = lazy(() => import("../pages/admin/AdminRefundsPage"));
const AdminUpdatesPage = lazy(() => import("../pages/admin/AdminUpdatesPage"));
const AdminEventPopupsPage = lazy(() => import("../pages/admin/AdminEventPopupsPage"));

const FinishedMatchesPage = lazy(() => import("../pages/matching/FinishedMatchesPage"));
const MyTeamMatchesPage = lazy(() => import("../pages/matching/MyTeamMatchesPage"));
const EventPage = lazy(() => import("../pages/event/EventPage"));
const VenueListPage = lazy(() => import("../pages/venue/VenueListPage"));
const VenueBookingPage = lazy(() => import("../pages/venue/VenueBookingPage"));
const CourtBookingPage = lazy(() => import("../pages/venue/CourtBookingPage"));

// ✅ 구장 관리자(구장주) 워크스페이스
const OwnerLayout = lazy(() => import("../layouts/OwnerLayout"));
const OwnerLoginPage = lazy(() => import("../pages/owner/OwnerLoginPage"));
const OwnerEntry = lazy(() => import("../pages/owner/OwnerEntry"));
const OwnerRegisterPage = lazy(() => import("../pages/owner/OwnerRegisterPage"));
const OwnerStatusPage = lazy(() => import("../pages/owner/OwnerStatusPage"));
const OwnerHomePage = lazy(() => import("../pages/owner/OwnerHomePage"));
const OwnerVenuePage = lazy(() => import("../pages/owner/OwnerVenuePage"));
const OwnerMyPage = lazy(() => import("../pages/owner/OwnerMyPage"));
const OwnerWithdrawPage = lazy(() => import("../pages/owner/OwnerWithdrawPage"));
const OwnerSignupPage = lazy(() => import("../pages/owner/OwnerSignupPage"));
const OwnerOnboardingPage = lazy(() => import("../pages/owner/OwnerOnboardingPage"));
const OwnerSalesPage = lazy(() => import("../pages/owner/OwnerSalesPage"));
const OwnerLegalPage = lazy(() => import("../pages/owner/OwnerLegalPage"));
const OwnerInquiryPage = lazy(() => import("../pages/owner/OwnerInquiryPage"));
const OwnerNotificationsPage = lazy(() => import("../pages/owner/OwnerNotificationsPage"));

function RequireAuth({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <AppLoadingPage />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

// 소셜(카카오/구글) 최초 로그인 후 1회: 전화번호 SMS 인증 게이트 (2026-07-06 재도입).
// users.phoneVerified 가 true 가 아니면 진입을 막고 전화번호 인증 화면을 띄운다.
// 전화번호를 키로 카카오/구글 동일인 계정을 통합한다. (RequireConsent 통과 후 진입)
function RequirePhone({ children }) {
  const { userDoc, loading } = useAuth();
  if (loading) return <AppLoadingPage />;
  if (userDoc?.isAdmin === true) return children; // 어드민 세션 면제
  if (userDoc?.phoneVerified === true) return children;
  return <PhoneVerifyPage />;
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

// 전화번호 인증까지 마친 신규 가입자에게 1회 노출되는 회원가입 완료 화면 게이트.
// users.welcomeSeen 이 true 가 아니면 완료 화면을 띄운다. (RequirePhone 통과 후 진입)
function RequireWelcome({ children }) {
  const { userDoc, loading } = useAuth();
  if (loading) return <AppLoadingPage />;
  if (userDoc?.isAdmin === true) return children; // 어드민 세션 면제
  if (userDoc?.welcomeSeen === true) return children;
  return <SignupCompletePage />;
}

function RequireClub({ children }) {
  const { loading } = useClub();
  if (loading) return <AppLoadingPage />;
  return children;
}

// 구장 관리자 전용 인증 게이트 — 사용자 앱과 분리된 ownerAuth 세션 기준.
// 미로그인 시 /owner/login 으로 (일반 /login 아님)
function RequireOwnerAuth({ children }) {
  const { isLoggedIn, loading } = useOwnerAuth();
  if (loading) return <AppLoadingPage />;
  if (!isLoggedIn) return <Navigate to="/owner/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { loading, userDoc } = useAuth();
  if (loading) return <AppLoadingPage />;

  // ✅ 진짜 Firebase 어드민 세션(admin 클레임)만 통과. localStorage 우회 제거.
  const isAdmin = userDoc?.isAdmin === true;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

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
  const {
    modal,
    bottomSheet,
    hideModal,
    hideBottomSheet,
    showModal,
    blockingCount,
    runTopBackInterceptor,
    headerConfig,
  } = useUI();

  // 최신 UI 상태를 ref로 유지 (subscribe 콜백 안에서 stale closure 방지)
  const uiRef = useRef({});
  uiRef.current = {
    modal,
    bottomSheet,
    hideModal,
    hideBottomSheet,
    showModal,
    runTopBackInterceptor,
    headerConfig,
  };

  // 자체 오버레이(RegionPickerSheet 등)가 등록한 인터셉터도 블로킹 UI로 취급
  const hasBlockingUI = !!(modal || bottomSheet) || (blockingCount || 0) > 0;

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
      // ✅ 자체 오버레이(지역 선택 시트 등) 열려 있으면 먼저 닫기
      if (ui.runTopBackInterceptor && ui.runTopBackInterceptor()) return;
      // 푸터 탭(홈 제외)에 있을 때는 홈으로 이동
      const p = (typeof window !== "undefined" ? window.location.pathname : "").toLowerCase();
      if (FOOTER_NON_HOME.includes(p)) {
        navigate("/home");
        return;
      }
      // ✅ 페이지가 지정한 뒤로가기가 있으면 그대로 사용 (헤더 백버튼과 동작 일치).
      //    없을 때만 히스토리 pop. 확정 경기·구장 정하기처럼 목적지가 정해진 화면에서
      //    HW 뒤로가기가 조율 중 히스토리로 되돌아가는 것을 막는다.
      if (ui.headerConfig?.onBack) {
        ui.headerConfig.onBack();
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
      if (ui.runTopBackInterceptor && ui.runTopBackInterceptor()) return;
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

/**
 * 유휴 시점에 하단 탭 청크를 미리 받아둔다. 탭 전환 때 네트워크를 기다리지 않게 하는 용도라
 * 사용자 앱 경로에서만 돈다. (어드민/구장주는 탭 구성이 달라 받아봐야 버려짐)
 * /oauth/kakao 도 제외 — 콜백 페이지가 흐름에 맞는 도착지를 직접 워밍하고, 여기서 끼어들면
 * 진행 중인 토큰 발급 요청과 대역폭을 다툰다.
 */
function PrefetchTabChunks() {
  const { pathname } = useLocation();

  useEffect(() => {
    const p = pathname.toLowerCase();
    if (p.startsWith("/admin") || p.startsWith("/owner")) return;
    if (p.startsWith("/oauth/")) return;

    const idle =
      window.requestIdleCallback || ((cb) => window.setTimeout(cb, 1500));
    const cancel =
      window.cancelIdleCallback || window.clearTimeout;

    const handle = idle(() => {
      import("../pages/home/HomePage");
      import("../pages/matching/MatchingManagePage");
      import("../pages/matching/MyTeamMatchesPage");
      import("../pages/community/CommunityListPage");
      import("../pages/my/MyProfilePage");
    });

    return () => {
      try { cancel(handle); } catch {}
    };
  }, [pathname]);

  return null;
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <BridgeNavSync />
      <PrefetchTabChunks />
      <Suspense fallback={<AppLoadingPage />}>
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
          <Route path="/operation" element={<OperationPage />} />
          <Route path="/refund" element={<RefundPage />} />
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
          <Route path="/admin/settlements" element={<AdminSettlementsPage />} />
          <Route path="/admin/refunds" element={<AdminRefundsPage />} />
          <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
          <Route path="/admin/popups" element={<AdminEventPopupsPage />} />
          <Route path="/admin/updates" element={<AdminUpdatesPage />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <RequireConsent>
                <RequirePhone>
                <RequireWelcome>
                <RequireClub>
                  <MainLayout />
                </RequireClub>
                </RequireWelcome>
                </RequirePhone>
              </RequireConsent>
            </RequireAuth>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/matchingmanage" element={<MatchingManagePage />} />
          <Route path="/records" element={<MyTeamMatchesPage />} />
          <Route path="/community" element={<CommunityListPage />} />
          <Route path="/my" element={<MyProfilePage />} />

          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/matching/region" element={<MatchRegionSelectPage />} />
          <Route path="/matching/searching" element={<MatchSearchingPage />} />
          <Route path="/matching/opponent" element={<MatchOpponentRevealPage />} />
          <Route path="/match-roomlist" element={<MatchRoomListPage />} />
          <Route path="/match-roomdetail/:roomId" element={<MatchRoomDetailPage />} />
          <Route path="/match-roomdetail/:roomId/venue" element={<MatchRoomDetailPage />} />

          <Route path="/venues" element={<VenueListPage />} />
          <Route path="/venue-book/:id" element={<VenueBookingPage />} />
          <Route path="/venue-book/:id/court/:courtId" element={<CourtBookingPage />} />

          <Route path="/matches/finished" element={<FinishedMatchesPage />} />
          <Route path="/event/:id" element={<EventPage />} />

          <Route path="/team/:teamId" element={<TeamProfilePage />} />
          <Route path="/team/:teamId/matches" element={<TeamMatchHistoryFullPage />} />
          <Route path="/teamRanking" element={<TeamRankingFullPage />} />
          <Route path="/player/:playerId" element={<PlayerProfilePage />} />
          <Route path="/player/:playerId/matches" element={<PlayerMatchHistoryFullPage />} />
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
              <RequireConsent>
                <RequirePhone>
                <RequireClub>
                  <MainLayout hideHeader />
                </RequireClub>
                </RequirePhone>
              </RequireConsent>
            </RequireAuth>
          }
        >
          <Route path="/invites" element={<InvitesPage />} />
        </Route>

        {/* ✅ 구장 관리자(구장주) 워크스페이스 — 별도 라우트 트리 */}
        <Route path="/owner/login" element={<OwnerLoginPage />} />
        <Route path="/owner/signup" element={<OwnerSignupPage />} />
        {/* 약관은 로그인·동의 게이트에서도 열려야 하므로 인증 밖의 공개 라우트 */}
        <Route path="/owner/terms" element={<OwnerLegalPage type="owner_terms" />} />
        <Route path="/owner/privacy" element={<OwnerLegalPage type="privacy" />} />
        <Route
          element={
            <RequireOwnerAuth>
              <OwnerLayout />
            </RequireOwnerAuth>
          }
        >
          <Route path="/owner" element={<OwnerEntry />} />
          <Route path="/owner/onboarding" element={<OwnerOnboardingPage />} />
          <Route path="/owner/register" element={<OwnerRegisterPage />} />
          <Route path="/owner/pending" element={<OwnerStatusPage />} />
          {/* 소프트 게이트: 막지 않고 입장 → 각 탭에서 등록/심사 안내 */}
          <Route path="/owner/home" element={<OwnerHomePage />} />
          <Route path="/owner/sales" element={<OwnerSalesPage />} />
          <Route path="/owner/venue" element={<OwnerVenuePage />} />
          <Route path="/owner/my" element={<OwnerMyPage />} />
          <Route path="/owner/notifications" element={<OwnerNotificationsPage />} />
          <Route path="/owner/inquiry" element={<OwnerInquiryPage />} />
          <Route path="/owner/withdraw" element={<OwnerWithdrawPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </>
  );
}
