// src/pages/auth/WelcomePage.jsx
/* eslint-disable */
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import AppLoadingPage from "../system/AppLoadingPage";

export default function WelcomePage() {
  const { isLoggedIn, loading } = useAuth();

  // 로딩 중이면 대기
  if (loading) return <AppLoadingPage />;

  // 이미 로그인 → SplashPage(/)에서 preload 후 /home으로 이동
  if (isLoggedIn) return <Navigate to="/" replace />;

  // 미로그인 → 로그인 페이지
  return <Navigate to="/login" replace />;
}
