/* eslint-disable */
// src/pages/owner/OwnerLoginPage.jsx
// 구장 관리자 로그인 — 소셜 로그인(카카오/구글) 재활용 + role=owner 마킹
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { ownerSignInWithSocial } from "../../services/ownerAuthService";
import { markUserAsOwner } from "../../services/ownerVenueService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";

export default function OwnerLoginPage() {
  const navigate = useNavigate();
  // 사용자 앱과 분리된 구장주 전용 세션(ownerAuth) 기준
  const { isLoggedIn, uid } = useOwnerAuth();
  const [busy, setBusy] = useState(false);

  // 구장주 인증이 끝나면(팝업/redirect 복귀 모두) 즉시 /owner 로 이동한다.
  useEffect(() => {
    if (isLoggedIn && uid) {
      markUserAsOwner(uid).catch(() => {});
      navigate("/owner", { replace: true });
    }
  }, [isLoggedIn, uid, navigate]);

  const doLogin = async (provider) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await ownerSignInWithSocial({ provider, keepLogin: true });
      if (!res || res.success !== true) {
        const code = res?.error_code || "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          // 사용자가 닫음 — 무시
        } else if (code === "web_unsupported" || code === "not_in_app") {
          window.alert(`${provider === "kakao" ? "카카오" : "구글"} 로그인은 앱에서 이용해주세요.`);
        } else {
          window.alert("로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
        }
        return;
      }
      // 성공 시 화면 전환은 위 useEffect(인증 상태 변화 감지)에 일임한다.
      // 여기서 navigate 하면 isLoggedIn 반영 전이라 RequireOwnerAuth 가 다시
      // /owner/login 으로 튕겨내는 레이스가 생긴다. (redirect 방식은 이미 페이지 이탈)
    } catch (e) {
      window.alert("로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      {busy && (
        <Overlay>
          <Spinner />
          <OverlayText>로그인 중…</OverlayText>
        </Overlay>
      )}

      <Hero>
        <Logo>🏟️</Logo>
        <Title>할래말래 구장 관리자</Title>
        <Sub>내 구장을 등록하고 예약을 관리하세요</Sub>
      </Hero>

      <Spacer />

      <Bottom>
        <KakaoBtn type="button" onClick={() => doLogin("kakao")} disabled={busy}>
          카카오로 시작하기
        </KakaoBtn>
        <GoogleBtn type="button" onClick={() => doLogin("google")} disabled={busy}>
          구글로 시작하기
        </GoogleBtn>
        <Notice>구장 관리자 전용 로그인입니다.</Notice>
      </Bottom>
    </Wrap>
  );
}

const fadeIn = keyframes`from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}`;
const spin = keyframes`to{transform:rotate(360deg);}`;

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: env(safe-area-inset-top);
`;

const Hero = styled.div`
  width: 100%;
  padding: 80px 24px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const Logo = styled.div`font-size: 72px; line-height: 1;`;

const Title = styled.div`
  margin-top: 8px;
  font-weight: 800;
  font-size: 26px;
  color: ${({ theme }) => theme.colors.textStrong};
  letter-spacing: -0.02em;
`;

const Sub = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Spacer = styled.div`flex: 1 1 auto; min-height: 24px;`;

const Bottom = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 20px 20px calc(36px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeIn} 0.45s ease-out both;
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
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; }
`;

const GoogleBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: #fff;
  color: #3c4043;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; }
`;

const Notice = styled.div`
  text-align: center;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(11,18,32,0.85)" : "rgba(255,255,255,0.85)")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 9999;
`;

const Spinner = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`;

const OverlayText = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
