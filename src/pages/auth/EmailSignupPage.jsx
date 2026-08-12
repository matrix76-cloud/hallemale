/* eslint-disable */
// src/pages/auth/EmailSignupPage.jsx
// 이메일 회원가입 — 계정 생성에 꼭 필요한 것(이메일·비밀번호)만 받는다.
// 나머지 회원정보는 계정이 생긴 뒤 기존 게이트가 순서대로 받는다:
//   동의(AgreementGate) → 전화인증(PhoneVerifyPage) → 기본정보(SignupBasicInfoPage) → 완료
// 여기서 이름·전화까지 한 화면에 몰면 첫 화면 이탈이 커져서 일부러 쪼갰다.
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { signUpWithEmail } from "../../services/authService";
import { checkPassword, PASSWORD_RULE_TEXT } from "../../utils/passwordPolicy";
import { track } from "../../utils/analytics";
import AuthPageHeader from "../../components/auth/AuthPageHeader";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Firebase 오류코드 → 사람이 읽을 문구 */
function signupErrorMessage(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 가입된 이메일이에요. 로그인하거나 계정 찾기를 이용해 주세요.";
    case "auth/invalid-email":
      return "이메일 형식을 다시 확인해 주세요.";
    case "auth/weak-password":
      return "비밀번호가 너무 단순해요. 다른 비밀번호를 사용해 주세요.";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인해 주세요.";
    default:
      return "가입에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
}

export default function EmailSignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emailInvalid = email.length > 0 && !EMAIL_RE.test(email);
  // 입력 중인 사람에게 "8자 이상" 경고를 계속 띄우면 잔소리가 된다 → 6자부터 검사.
  const pwError = useMemo(() => (pw.length >= 6 ? checkPassword(pw) : ""), [pw]);
  const pw2Mismatch = pw2.length > 0 && pw !== pw2;

  const canSubmit =
    EMAIL_RE.test(email) && !checkPassword(pw) && pw === pw2 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await signUpWithEmail({ email: email.trim(), password: pw, keepLogin: true });
      track("signup_email_complete"); // 이메일 계정 생성 — 온보딩 퍼널 진입
      // 계정이 생기면 onAuthStateChanged 가 발화하고, 상위 게이트가 동의 화면부터 이어받는다.
      navigate("/home", { replace: true });
    } catch (e) {
      setError(signupErrorMessage(e?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <AuthPageHeader title="이메일로 가입" />
      <Inner>
        <Head>
          <Title>
            이메일과 비밀번호를
            <br />
            정해 주세요.
          </Title>
          <Sub>가입 후 동의·본인인증·기본정보 순서로 이어져요.</Sub>
        </Head>

        <FieldGroup>
          <Label htmlFor="email">이메일<Req>*</Req></Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="hallaemallae@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            disabled={busy}
            $error={emailInvalid}
          />
          <Hint $error={emailInvalid}>
            {emailInvalid ? "이메일 형식을 다시 확인해 주세요." : "로그인할 때 쓰는 아이디예요."}
          </Hint>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="pw">비밀번호<Req>*</Req></Label>
          <Input
            id="pw"
            type="password"
            autoComplete="new-password"
            placeholder={PASSWORD_RULE_TEXT}
            value={pw}
            maxLength={32}
            onChange={(e) => setPw(e.target.value)}
            disabled={busy}
            $error={!!pwError}
          />
          <Hint $error={!!pwError}>{pwError || PASSWORD_RULE_TEXT}</Hint>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="pw2">비밀번호 확인<Req>*</Req></Label>
          <Input
            id="pw2"
            type="password"
            autoComplete="new-password"
            placeholder="한 번 더 입력해 주세요"
            value={pw2}
            maxLength={32}
            onChange={(e) => setPw2(e.target.value)}
            disabled={busy}
            $error={pw2Mismatch}
          />
          {pw2Mismatch && <Hint $error>비밀번호가 서로 달라요.</Hint>}
        </FieldGroup>

        {!!error && <ErrorBox role="alert">{error}</ErrorBox>}

        <Notice>
          비밀번호를 잊으면 <b>가입할 때 인증한 휴대폰 번호</b>로 임시 비밀번호를 받을 수 있어요.
        </Notice>

        <Spacer />

        <SubmitBtn type="button" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? "가입 중…" : "다음"}
        </SubmitBtn>
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
  padding: 8px 20px calc(24px + env(safe-area-inset-bottom));
`;

const Head = styled.div`
  margin-bottom: 26px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 23px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.p`
  margin: 10px 0 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
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

const Req = styled.span`
  margin-left: 2px;
  color: ${({ theme }) => theme.colors.danger};
  font-weight: 800;
`;

/* 밑줄형 입력 — 가입 기본정보 화면(SignupBasicInfoPage)과 같은 결 */
const Input = styled.input`
  min-width: 0;
  border: none;
  border-bottom: 1px solid
    ${({ $error, theme }) => ($error ? theme.colors.danger : theme.colors.border)};
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
    border-bottom-color: ${({ $error, theme }) =>
      $error ? theme.colors.danger : theme.colors.primary};
  }
  &:disabled {
    opacity: 0.6;
  }
`;

const Hint = styled.span`
  font-size: 12px;
  color: ${({ $error, theme }) => ($error ? theme.colors.danger : theme.colors.textWeak)};
`;

const ErrorBox = styled.div`
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.danger};
`;

const Notice = styled.div`
  font-size: 12px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};

  b {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-height: 28px;
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
