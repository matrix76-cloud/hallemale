/* eslint-disable */
// src/pages/auth/LoginPage.jsx
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { signInWithSocial } from "../../services/authService";
import { images } from "../../utils/imageAssets";

import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();

  const { isLoggedIn, loading: authLoading } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const busy = isSubmitting;

  // 이미 로그인된 상태면(소셜 redirect 복귀 포함) 바로 홈으로 이동.
  // 데이터 프리로드는 홈/매칭 페이지가 각자 스켈레톤과 함께 알아서 로드하므로
  // 여기서 기다리지 않는다.
  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) navigate("/home", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  // 구글 소셜 로그인
  const handleGoogle = async () => {
    if (busy) return;

    setIsSubmitting(true);
    try {
      const res = await signInWithSocial({ provider: "google", keepLogin: true });

      if (!res || res.success !== true) {
        const code = res?.error_code || "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          // 사용자가 팝업을 닫음 — 조용히 무시
        } else {
          window.alert("구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }

      // 팝업 성공 시 즉시 홈으로 (redirect 폴백이면 이미 페이지가 이동됨)
      navigate("/home", { replace: true });
    } catch (err) {
      window.alert("구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKakao = async () => {
    if (busy) return;

    setIsSubmitting(true);
    try {
      const res = await signInWithSocial({ provider: "kakao", keepLogin: true });

      if (!res || res.success !== true) {
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

      // 성공 시 즉시 홈으로 이동
      navigate("/home", { replace: true });
    } catch (err) {
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
            <OverlayText>로그인 중…</OverlayText>
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

        {/* 구글 소셜 로그인 버튼 */}
        <GoogleBtn type="button" onClick={handleGoogle} disabled={busy}>
          <GoogleIcon viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
          </GoogleIcon>
          구글로 시작하기
        </GoogleBtn>
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

/* 구글 소셜 로그인 버튼 스타일 */
const GoogleBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border || "#dadce0"};
  background: #ffffff;
  color: #3c4043;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: filter 0.15s, transform 0.1s, background 0.15s;

  &:hover { background: #f7f8f8; }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const GoogleIcon = styled.svg`
  width: 18px;
  height: 18px;
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
