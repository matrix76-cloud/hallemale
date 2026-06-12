/* eslint-disable */
// src/pages/auth/LoginPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { signInWithSocial } from "../../services/authService";
import { images } from "../../utils/imageAssets";
import { isInWebView } from "../../bridge/webviewBridge";

import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

export default function LoginPage() {
  const navigate = useNavigate();

  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const { preloadHomeData } = useHomeData();
  const { preloadMatchingHomeData } = useMatchingData();

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const activeTeamId = String(club?.id || "").trim();

  // 카카오 로그인은 RN WebView(앱) 안에서만 동작
  const inApp = isInWebView();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postLoginPreload, setPostLoginPreload] = useState(false);
  const [preloading, setPreloading] = useState(false);

  const preloadOnceRef = useRef(false);

  // 이미 로그인 상태면 홈으로 이동 (소셜 로그인 후 WebView 리로드 대응)
  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn && !postLoginPreload) {
      navigate("/home", { replace: true });
    }
  }, [authLoading, isLoggedIn, postLoginPreload, navigate]);

  const canRunPreload = useMemo(() => {
    if (!postLoginPreload) return false;
    if (authLoading || clubLoading) return false;
    if (!isLoggedIn) return false;
    if (!uid) return false;
    return true;
  }, [postLoginPreload, authLoading, clubLoading, isLoggedIn, uid]);

  useEffect(() => {
    if (!canRunPreload) return;
    if (preloadOnceRef.current) return;

    preloadOnceRef.current = true;

    (async () => {
      const startedAt = Date.now();
      const MIN_MS = 700;

      setPreloading(true);
      try {
        const tasks = [];
        tasks.push(preloadHomeData(uid));
        if (activeTeamId) tasks.push(preloadMatchingHomeData(activeTeamId));
        await Promise.all(tasks);
      } catch (e) {
        console.error("[LoginPage] preload failed:", e);
      } finally {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, MIN_MS - elapsed);

        setTimeout(() => {
          setPreloading(false);
          setPostLoginPreload(false);
          navigate("/home", { replace: true });
        }, wait);
      }
    })();
  }, [canRunPreload, preloadHomeData, preloadMatchingHomeData, uid, activeTeamId, navigate]);

  const busy = isSubmitting || preloading || postLoginPreload;

  const handleKakao = async () => {
    if (busy) return;

    setIsSubmitting(true);
    setPostLoginPreload(true);
    try {
      const res = await signInWithSocial({ provider: "kakao", keepLogin: true });

      if (!res || res.success !== true) {
        setPostLoginPreload(false);
        const code = res?.error_code || "";
        if (code === "web_unsupported" || code === "not_in_app") {
          window.alert("카카오 로그인은 앱에서만 이용할 수 있어요.");
        } else if (code === "timeout") {
          window.alert("로그인 시간이 초과되었어요. 다시 시도해 주세요.");
        } else {
          window.alert("카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }

      // 성공 → preload effect가 /home으로 이동시킴
      preloadOnceRef.current = false;
      setPreloading(true);
    } catch (err) {
      setPostLoginPreload(false);
      window.alert("카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Wrap>
      {busy && (
        <Overlay>
          <OverlayInner>
            <MiniSpinner />
            <OverlayText>{preloading ? "데이터 불러오는 중…" : "로그인 중…"}</OverlayText>
          </OverlayInner>
        </Overlay>
      )}

      <Hero>
        <HeroLogo
          src={images.logo}
          alt="할래말래 로고"
          loading="eager"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <HeroTitle>할래말래</HeroTitle>
        <HeroSub>생활체육 팀 매칭의 시작</HeroSub>
      </Hero>

      <Spacer />

      <BottomArea>
        <KakaoBtn type="button" onClick={handleKakao} disabled={busy}>
          <KakaoIcon viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M9 1.5C4.86 1.5 1.5 4.14 1.5 7.39c0 2.08 1.38 3.9 3.46 4.95-.15.53-.55 1.98-.63 2.29-.1.38.14.38.29.27.12-.08 1.86-1.26 2.62-1.78.41.06.83.09 1.26.09 4.14 0 7.5-2.64 7.5-5.89S13.14 1.5 9 1.5Z"
            />
          </KakaoIcon>
          카카오로 시작하기
        </KakaoBtn>
      </BottomArea>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const Hero = styled.div`
  width: 100%;
  padding: 72px 24px 40px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const HeroLogo = styled.img`
  width: 120px;
  height: 120px;
  object-fit: contain;
`;

const HeroTitle = styled.div`
  margin-top: -6px;
  font-weight: 800 !important;
  font-size: 34px !important;
  color: ${({ theme }) => theme.colors.textStrong};
  letter-spacing: -0.03em;
`;

const HeroSub = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
  letter-spacing: -0.02em;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-height: 24px;
`;

const BottomArea = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 20px 20px calc(32px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeIn} 0.45s ease-out both;
  animation-delay: 0.1s;
`;

const KakaoBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 10px;
  border: none;
  background: #fee500;
  color: #191600;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: filter 0.15s, transform 0.1s;

  &:hover { filter: brightness(0.96); }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const KakaoIcon = styled.svg`
  width: 18px;
  height: 18px;
  color: #191600;
`;

const WebNotice = styled.div`
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  letter-spacing: -0.02em;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(11, 18, 32, 0.85)" : "rgba(255, 255, 255, 0.85)"};
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const OverlayInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const OverlayText = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MiniSpinner = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99, 102, 241, 0.20)" : "rgba(79, 70, 229, 0.15)"};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`;
