// src/pages/system/SplashPage.jsx
/* eslint-disable */
import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

import splashImg from "../../assets/images/splash_hallemalla.png";
import { runSchemaDumpFront } from "../../services/schemaDumpService";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Wrap = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#f3f4f6"};
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

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const activeTeamId = String(club?.id || "").trim();
  const phoneE164 = String(userDoc?.phoneE164 || "").trim();

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

        console.log("[SplashPage] ready", {
          isLoggedIn,
          uid: uid ? "ok" : "missing",
          activeTeamId: activeTeamId || "(none)",
        });

        // ✅ schema dump: 서비스에서 env로 on/off 처리 (Splash에서 별도 체크 X)
        // - REACT_APP_SCHEMA_DUMP=1 이면 덤프 실행
        // - 아니면 서비스에서 disabled 로그 찍고 return null
        tasks.push(
          runSchemaDumpFront({
            rootCollections: ["chatRooms", "clubs","community_posts","games","match_requests","notifications","users","users_by_phone"],
            sampleCount: 2,
            maxDepth: 2,
            schemaDepth: 6,
          })
        );

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
          // 카카오 단일 로그인 전환으로 전화번호 인증 단계 제거 → 항상 /home
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
