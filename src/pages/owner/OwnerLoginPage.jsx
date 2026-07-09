/* eslint-disable */
// src/pages/owner/OwnerLoginPage.jsx
// 구장 관리자 로그인 — 이메일/비밀번호 (사용자 앱 소셜 로그인과 분리)
// 로그인 / 비밀번호 찾기 2모드. 회원가입은 전용 페이지(/owner/signup).
import { showAlert } from "../../utils/appDialog";
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import {
  ownerSignInEmail,
  ownerSendPasswordReset,
} from "../../services/ownerAuthService";
import { markUserAsOwner } from "../../services/ownerVenueService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";

export default function OwnerLoginPage() {
  const navigate = useNavigate();
  // 사용자 앱과 분리된 구장주 전용 세션(ownerAuth) 기준
  const { isLoggedIn, uid } = useOwnerAuth();
  const [mode, setMode] = useState("login"); // login | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // 구장주 인증이 끝나면 즉시 /owner 로 이동한다.
  useEffect(() => {
    if (isLoggedIn && uid) {
      markUserAsOwner(uid).catch(() => {});
      navigate("/owner", { replace: true });
    }
  }, [isLoggedIn, uid, navigate]);

  const switchMode = (m) => {
    setMode(m);
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;

    if (mode === "reset") {
      setBusy(true);
      try {
        const res = await ownerSendPasswordReset(email);
        if (res.success) {
          showAlert("비밀번호 재설정 메일을 보냈어요.\n메일함(스팸함 포함)을 확인해주세요.");
          switchMode("login");
        } else {
          showAlert(res.error_message || "메일 발송에 실패했어요.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const res = await ownerSignInEmail({ email, password, keepLogin: true });
      if (!res || res.success !== true) {
        showAlert(res?.error_message || "요청을 처리하지 못했어요.");
        return;
      }
      // 성공 시 화면 전환은 위 useEffect(인증 상태 변화 감지)에 일임한다.
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "reset" ? "비밀번호 찾기" : "할래말래 사장님";
  const sub =
    mode === "reset"
      ? "가입한 이메일로 재설정 링크를 보내드려요"
      : "내 구장을 등록하고 예약을 관리하세요";
  const submitLabel = mode === "reset" ? "재설정 메일 보내기" : "로그인";

  return (
    <Wrap>
      {busy && (
        <Overlay>
          <Spinner />
          <OverlayText>처리 중…</OverlayText>
        </Overlay>
      )}

      <Hero>
        <Logo>🏟️</Logo>
        <Title>{title}</Title>
        <Sub>{sub}</Sub>
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
        {mode !== "reset" && (
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        )}

        <SubmitBtn type="submit" disabled={busy}>
          {submitLabel}
        </SubmitBtn>

        <Links>
          {mode === "login" ? (
            <>
              <LinkBtn type="button" onClick={() => navigate("/owner/signup")}>회원가입</LinkBtn>
              <Dot>·</Dot>
              <LinkBtn type="button" onClick={() => switchMode("reset")}>비밀번호 찾기</LinkBtn>
            </>
          ) : (
            <LinkBtn type="button" onClick={() => switchMode("login")}>로그인으로 돌아가기</LinkBtn>
          )}
        </Links>

        <Notice>할래말래 사장님 전용 로그인입니다.</Notice>
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
  gap: 8px;
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

const Dot = styled.span`color: ${({ theme }) => theme.colors.textWeak};`;

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
