// src/pages/system/SplashPage.jsx
/* eslint-disable */
import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

import logoImg from "../../assets/images/logo.png";
import { runSchemaDumpFront } from "../../services/schemaDumpService";

// 로고/텍스트가 아래에서 살짝 떠오르며 페이드인
const fadeUp = keyframes`
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const Wrap = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const LogoCard = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 26px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
  animation: ${fadeUp} 700ms ease-out both;
`;

const LogoImage = styled.img`
  width: 60px;
  height: 60px;
  object-fit: contain;
`;

const BrandName = styled.h1`
  margin: 22px 0 0;
  font-size: 30px;
  font-weight: 800;
  color: #41522f;
  letter-spacing: -0.5px;
  animation: ${fadeUp} 700ms ease-out 120ms both;
`;

const Tagline = styled.p`
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 500;
  color: #7b8c5f;
  animation: ${fadeUp} 700ms ease-out 220ms both;
`;

export default function SplashPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();

  const { preloadHomeData } = useHomeData();
  const { preloadMatchingHomeData } = useMatchingData();

  const onceRef = useRef(false);
  const timerRef = useRef(null);

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const activeTeamId = String(club?.id || "").trim();
  const phoneE164 = String(userDoc?.phoneE164 || "").trim();

  // 언마운트 때만 타이머 정리 (의존성 변경으로 인한 재실행에선 타이머를 지우지 않음)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (onceRef.current) return;
    if (authLoading || clubLoading) return;

    if (!isLoggedIn) {
      onceRef.current = true;
      timerRef.current = setTimeout(() => navigate("/welcome", { replace: true }), 1000);
      return;
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
    // (cleanup으로 지우지 않음 — 의존성 재실행 때 타이머가 사라져 멈추는 문제 방지)
    timerRef.current = setTimeout(() => {
      // 카카오 단일 로그인 전환으로 전화번호 인증 단계 제거 → 항상 /home
      navigate("/home", { replace: true });
    }, SPLASH_MS);
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
      <LogoCard>
        <LogoImage src={logoImg} alt="할래말래 로고" />
      </LogoCard>
      <BrandName>할래말래</BrandName>
      <Tagline>이번주, 경기 한판 할래말래</Tagline>
    </Wrap>
  );
}
