/* eslint-disable */
// src/pages/auth/EmailLoginPage.jsx
// 이메일 + 비밀번호 로그인. 소셜 버튼은 /login 에 그대로 두고, 이 화면은 이메일 전용이다.
// 비밀번호를 잊었을 때의 유일한 복구 경로는 /find-account (전화번호 인증 → 임시 비밀번호 문자).
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { signInWithEmail } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import { track } from "../../utils/analytics";
import AuthPageHeader from "../../components/auth/AuthPageHeader";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Firebase 오류코드 → 사람이 읽을 문구 */
function loginErrorMessage(code) {
  switch (code) {
    // 어느 쪽이 틀렸는지 알려주면 가입 여부가 새어 나간다 → 한 문구로 묶는다.
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "이메일 또는 비밀번호가 올바르지 않아요.";
    case "auth/too-many-requests":
      return "시도가 너무 많았어요. 잠시 후 다시 시도해 주세요.";
    case "auth/user-disabled":
      return "이용이 중지된 계정이에요. 고객센터로 문의해 주세요.";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인해 주세요.";
    default:
      return "로그인에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
}

export default function EmailLoginPage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [keepLogin, setKeepLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) navigate("/home", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  const canSubmit = EMAIL_RE.test(email) && pw.length > 0 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await signInWithEmail({ email: email.trim(), password: pw, keepLogin });
      track("login_email_success");
      navigate("/home", { replace: true });
    } catch (e) {
      setError(loginErrorMessage(e?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <AuthPageHeader title="이메일 로그인" />
      <Inner>
        <FieldGroup>
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="hallaemallae@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            disabled={busy}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="pw">비밀번호</Label>
          <Input
            id="pw"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            disabled={busy}
          />
        </FieldGroup>

        <KeepRow
          role="button"
          tabIndex={0}
          onClick={() => setKeepLogin((v) => !v)}
        >
          <Check $on={keepLogin}>{keepLogin ? "✓" : ""}</Check>
          <KeepText>로그인 상태 유지</KeepText>
        </KeepRow>

        {!!error && <ErrorBox role="alert">{error}</ErrorBox>}

        <SubmitBtn type="button" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? "로그인 중…" : "로그인"}
        </SubmitBtn>

        <LinkRow>
          <LinkBtn type="button" onClick={() => navigate("/find-account")}>
            계정·비밀번호 찾기
          </LinkBtn>
          <Dot>·</Dot>
          <LinkBtn type="button" onClick={() => navigate("/signup/email")}>
            이메일로 가입
          </LinkBtn>
        </LinkRow>
      </Inner>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const Wrap = styled.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
`;

const Inner = styled.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding: 16px 20px calc(24px + env(safe-area-inset-bottom));
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 22px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Input = styled.input`
  min-width: 0;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 0;
  padding: 10px 2px;
  font-size: 16px;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
    opacity: 0.7;
  }
  &:focus {
    border-bottom-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.6;
  }
`;

const KeepRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  cursor: pointer;
  user-select: none;
`;

const Check = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : "transparent")};
  color: #ffffff;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
  flex: 0 0 auto;
`;

const KeepText = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ErrorBox = styled.div`
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.danger};
`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: transform 0.1s;

  &:active {
    transform: translateY(1px);
  }
  &:disabled {
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(157,134,220,0.28)" : "#d7cef4"};
    color: #ffffff;
    opacity: 1;
    cursor: not-allowed;
  }
`;

const LinkRow = styled.div`
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const LinkBtn = styled.button`
  border: none;
  background: transparent;
  padding: 6px 2px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  cursor: pointer;

  &:active {
    opacity: 0.6;
  }
`;

const Dot = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  opacity: 0.6;
`;
