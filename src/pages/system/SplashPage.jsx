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
import { track } from "../../utils/analytics";

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
  animation: ${fadeUp} 320ms ease-out both;
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
  animation: ${fadeUp} 320ms ease-out 60ms both;
`;

const Tagline = styled.p`
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 500;
  color: #7b8c5f;
  animation: ${fadeUp} 320ms ease-out 110ms both;
`;

// 스플래시 최소 노출 시간.
// 준비(auth/club)가 이보다 오래 걸리면 추가 대기 없이 즉시 진입한다.
// 0 이 아닌 이유: 웜 스타트에서 화면이 한 프레임 번쩍이고 사라지는 걸 막는 하한선.
const MIN_SPLASH_MS = 300;

export default function SplashPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();

  const { preloadHomeData } = useHomeData();
  const { preloadMatchingHomeData } = useMatchingData();

  const onceRef = useRef(false);
  const timerRef = useRef(null);
  const mountedAtRef = useRef(Date.now());

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const activeTeamId = String(club?.id || "").trim();
  const phoneE164 = String(userDoc?.phoneE164 || "").trim();

  // 앱 진입(스플래시) 1회 기록 — 퍼널 최상단
  useEffect(() => { track("app_open"); }, []);

  // 언마운트 때만 타이머 정리 (의존성 변경으로 인한 재실행에선 타이머를 지우지 않음)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 준비 완료 시점 기준으로 "남은 최소 노출분"만 채우고 이동한다.
  // (예전엔 준비가 끝난 뒤에도 무조건 1000ms를 더 기다렸다)
  const gotoAfterMinSplash = (dest) => {
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAtRef.current));
    timerRef.current = setTimeout(() => navigate(dest, { replace: true }), wait);
  };

  useEffect(() => {
    if (onceRef.current) return;
    if (authLoading || clubLoading) return;

    if (!isLoggedIn) {
      onceRef.current = true;
      gotoAfterMinSplash("/welcome");
      return;
    }

    if (!uid) return;

    onceRef.current = true;

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

    // ✅ 프리로드 완료를 기다리지 않고 즉시 이동
    //    (홈/매칭 페이지에 자체 fallback 로드가 있어 미완료여도 안전)
    // (cleanup으로 지우지 않음 — 의존성 재실행 때 타이머가 사라져 멈추는 문제 방지)
    // 구장주 로그인 등에서 지정한 복귀 경로 우선, 없으면 /home
    let dest = "/home";
    try {
      const saved = localStorage.getItem("hm.postLoginRedirect");
      if (saved) {
        dest = saved;
        localStorage.removeItem("hm.postLoginRedirect");
      }
    } catch {}
    gotoAfterMinSplash(dest);
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
