// src/pages/system/SplashPage.jsx
/* eslint-disable */
import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

import splashImg from "../../assets/images/splash_player.png";
import { runSchemaDumpFront } from "../../services/schemaDumpService";

// 실사 사진이 천천히 확대되는 Ken Burns 줌 + 페이드인
const kenBurns = keyframes`
  0%   { opacity: 0; transform: scale(1); }
  18%  { opacity: 1; }
  100% { opacity: 1; transform: scale(1.1); }
`;

const Wrap = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SplashImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform-origin: 50% 42%;
  will-change: transform, opacity;
  animation: ${kenBurns} 1000ms ease-out both;
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
      const t = setTimeout(() => navigate("/welcome", { replace: true }), 1000);
      return () => clearTimeout(t);
    }

    if (!uid) return;

    onceRef.current = true;

    const SPLASH_MS = 1000;

    console.log("[SplashPage] ready", {
      isLoggedIn,
      uid: uid ? "ok" : "missing",
      activeTeamId: activeTeamId || "(none)",
    });

    // ✅ 프리로드는 백그라운드로만 실행(대기하지 않음)
    // - schema dump: 서비스에서 env로 on/off 처리 (REACT_APP_SCHEMA_DUMP=1일 때만 실제 실행)
    Promise.all([
      runSchemaDumpFront({
        rootCollections: ["chatRooms", "clubs","community_posts","games","match_requests","notifications","users","users_by_phone"],
        sampleCount: 2,
        maxDepth: 2,
        schemaDepth: 6,
      }),
      preloadHomeData(uid),
      ...(activeTeamId ? [preloadMatchingHomeData(activeTeamId)] : []),
    ]).catch((e) => {
      console.error("[SplashPage] preload failed:", e);
    });

    // ✅ 프리로드 완료 여부와 무관하게 1초 후 무조건 이동
    const t = setTimeout(() => {
      // 카카오 단일 로그인 전환으로 전화번호 인증 단계 제거 → 항상 /home
      navigate("/home", { replace: true });
    }, SPLASH_MS);
    return () => clearTimeout(t);
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
