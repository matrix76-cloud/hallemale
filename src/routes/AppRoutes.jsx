// src/routes/AppRoutes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

import HomePage from "../pages/home/HomePage";
import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import ClubOnboardingPage from "../pages/auth/ClubOnboardingPage";

import MatchingHomePage from "../pages/matching/MatchingHomePage";
import GymListPage from "../pages/gym/GymListPage";
import MyOverviewPage from "../pages/my/MyOverviewPage";
import SettingsHomePage from "../pages/settings/SettingsHomePage";

import MatchRoomPage from "../pages/matchRoom/MatchRoomPage";
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

function RequireAuth({ children }) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <AppLoadingPage />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return children;
}

function RequireClub({ children }) {
  const { club, loading } = useClub();

  if (loading) return <AppLoadingPage />;
  // if (!club) return <Navigate to="/onboarding/club" replace />;

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* 루트는 이제 스플래시로 진입 */}
      <Route path="/" element={<SplashPage />} />

      {/* Auth 영역 */}
      <Route element={<AuthLayout />}>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signupsuccess" element={<SignupSuccessPage />} />
        <Route path="/onboarding/club" element={<ClubOnboardingPage />} />
      </Route>

      {/* 메인 앱 영역 - 헤더 있는 레이아웃 */}
      <Route
        element={
          <RequireAuth>
            <RequireClub>
              <MainLayout /> {/* 기본: 헤더 ON */}
            </RequireClub>
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/match-rooms" element={<MatchRoomListPage />} />
        <Route path="/gym" element={<GymListPage />} />
        <Route path="/my" element={<MyProfilePage />} />

      </Route>

      {/* 메인 앱 영역 - 헤더 없는 레이아웃 */}
      <Route
        element={
          <RequireAuth>
            <RequireClub>
              <MainLayout hideHeader /> {/* 헤더 OFF */}
            </RequireClub>
          </RequireAuth>
        }
      >
        
        <Route path="/matching" element={<MatchingHomePage />} />
        {/* 매칭룸 상세 / 초대 */}
        <Route path="/match-room/:matchId" element={<MatchRoomDetailPage />} />

        {/* 내 정보 관련 상세 */}
        <Route path="/my/profile/detail" element={<MyProfileDetailPage />} />
        <Route path="/my/posts" element={<MyPostsPage />} />
        <Route
          path="/my/personal-matches"
          element={<MyPersonalMatchesPage />}
        />
        <Route
          path="/my/matched-matches"
          element={<MyMatchedMatchesPage />}
        />


        <Route path="/invites" element={<InvitesPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
