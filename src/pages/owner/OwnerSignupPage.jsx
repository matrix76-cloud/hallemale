/* eslint-disable */
// src/pages/owner/OwnerSignupPage.jsx
// 구장 관리자 전용 회원가입 — 이메일/비밀번호. 가입 후 구장 온보딩으로 이동.
import { showAlert } from "../../utils/appDialog";
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { ownerSignUpEmail } from "../../services/ownerAuthService";
import { markUserAsOwner } from "../../services/ownerVenueService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";
import { track } from "../../utils/analytics";

export default function OwnerSignupPage() {
  const navigate = useNavigate();
  const { isLoggedIn, uid } = useOwnerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  // 가입/로그인 완료되면 구장 온보딩으로 이동
  useEffect(() => {
    if (isLoggedIn && uid) {
      markUserAsOwner(uid).catch(() => {});
      navigate("/owner/onboarding", { replace: true });
    }
  }, [isLoggedIn, uid, navigate]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    if (password !== password2) {
      showAlert("비밀번호가 일치하지 않아요.");
      return;
    }
    setBusy(true);
    try {
      const res = await ownerSignUpEmail({ email, password, keepLogin: true });
      if (!res || res.success !== true) {
        showAlert(res?.error_message || "가입에 실패했어요.");
        return;
      }
      track("owner_signup"); // 공급 퍼널 최상단 — 구장주 가입
      // 성공 시 화면 전환은 위 useEffect(인증 상태 변화 감지)에 일임한다.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      {busy && (
        <Overlay>
          <Spinner />
          <OverlayText>가입 처리 중…</OverlayText>
        </Overlay>
      )}

      <Hero>
        <Logo>🏟️</Logo>
        <Title>할래말래 사장님 회원가입</Title>
        <Sub>이메일과 비밀번호로 가입하세요</Sub>
      </Hero>

      <Spacer />

      <Bottom onSubmit={handleSubmit} as="form">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 확인"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          disabled={busy}
        />

        <SubmitBtn type="submit" disabled={busy}>가입하기</SubmitBtn>

        <Links>
          <LinkBtn type="button" onClick={() => navigate("/owner/login")}>
            이미 계정이 있어요 · 로그인
          </LinkBtn>
        </Links>

        <Notice>가입 후 구장 정보를 등록하면 예약을 받을 수 있어요.</Notice>
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
  padding: 72px 24px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const Logo = styled.div`font-size: 72px; line-height: 1;`;

const Title = styled.div`
  margin-top: 8px;
  font-weight: 800;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.textStrong};
  letter-spacing: -0.02em;
  text-align: center;
`;

const Sub = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const Spacer = styled.div`flex: 1 1 auto; min-height: 16px;`;

const Bottom = styled.form`
  width: 100%;
  max-width: 400px;
  padding: 20px 20px calc(36px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeIn} 0.45s ease-out both;
`;

const Input = styled.input`
  width: 100%;
  height: 52px;
  padding: 0 16px;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 15px;
  font-family: inherit;
  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary}; }
  &::placeholder { color: ${({ theme }) => theme.colors.textWeak}; }
  &:disabled { opacity: 0.6; }
`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 4px;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Links = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
`;

const LinkBtn = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px;
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
