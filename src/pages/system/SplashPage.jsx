// src/pages/system/SplashPage.jsx
/* eslint-disable */
import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

import splashImg from "../../assets/images/splash_hallemalla.png"; // 경로/이름만 맞게

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Wrap = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SplashImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;

  opacity: 0;
  animation: ${fadeIn} 1200ms ease-out forwards;
`;

export default function SplashPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();

  const { preloadHomeData } = useHomeData();
  const { preloadMatchingHomeData } = useMatchingData();

  const onceRef = useRef(false);

  // ✅ uid SSOT: firebase auth uid
  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  // ✅ activeTeamId SSOT: useClub가 내려주는 club 문서 id 하나만 신뢰
  const activeTeamId = String(club?.id || "").trim();

  useEffect(() => {
    if (onceRef.current) return;
    if (authLoading || clubLoading) return;

    if (!isLoggedIn) {
      onceRef.current = true;
      const t = setTimeout(() => navigate("/welcome", { replace: true }), 1200);
      return () => clearTimeout(t);
    }

    if (!uid) return;

    onceRef.current = true;

    (async () => {
      const startedAt = Date.now();
      const MIN_SPLASH_MS = 1200;

      try {
        const tasks = [];

        // ✅ 홈 전체 프리로드(필수)
        tasks.push(preloadHomeData(uid));

        // ✅ 매칭 프리로드(팀이 있을 때만)
        if (activeTeamId) {
          tasks.push(preloadMatchingHomeData(activeTeamId));
        }

        await Promise.all(tasks);
      } catch (e) {
        console.error("[SplashPage] preload failed:", e);
      } finally {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => {
          navigate("/home", { replace: true });
        }, wait);
      }
    })();
  }, [
    authLoading,
    clubLoading,
    isLoggedIn,
    uid,
    activeTeamId,
    preloadHomeData,
    preloadMatchingHomeData,
    navigate,
  ]);

  return (
    <Wrap>
      <SplashImage src={splashImg} alt="할래말래 스플래시" />
    </Wrap>
  );
}
