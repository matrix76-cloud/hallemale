/* eslint-disable */
// src/pages/auth/ChangePasswordPage.jsx
// 임시 비밀번호로 로그인한 사용자에게 강제로 뜨는 비밀번호 변경 게이트.
// 서버(recoverAccountByPhone)가 users.mustChangePassword=true 를 세우고,
// RequirePasswordChange 게이트가 이 화면을 띄운다. 바꾸기 전에는 서비스로 못 들어간다.
//
// 임시 비밀번호는 평문으로 문자에 실려 나간 값이다 — 문자가 남아 있는 한 계정도 열려 있는 셈이라
// 여기서 반드시 갈아끼운다.
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { changePassword } from "../../services/authService";
import { checkPassword, PASSWORD_RULE_TEXT } from "../../utils/passwordPolicy";
import { showConfirm } from "../../utils/appDialog";
import { track } from "../../utils/analytics";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import { useExitConfirm } from "../../hooks/useExitConfirm";

/** Firebase 오류코드 → 사람이 읽을 문구 */
function changeErrorMessage(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "현재 비밀번호가 올바르지 않아요. 문자로 받은 임시 비밀번호를 확인해 주세요.";
    case "auth/weak-password":
      return "비밀번호가 너무 단순해요. 다른 비밀번호를 사용해 주세요.";
    case "auth/too-many-requests":
      return "시도가 너무 많았어요. 잠시 후 다시 시도해 주세요.";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인해 주세요.";
    default:
      return "";
  }
}

export default function ChangePasswordPage() {
  const { refreshUser, signOut } = useAuth();

  // 게이트 화면 — 뒤로 갈 곳이 없으므로 하드웨어 뒤로가기는 앱 종료 확인으로 받는다.
  const confirmExit = useExitConfirm();
  useBackInterceptor(true, confirmExit);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nextError = useMemo(() => (next.length >= 6 ? checkPassword(next) : ""), [next]);
  const mismatch = next2.length > 0 && next !== next2;
  // 임시 비밀번호를 그대로 새 비밀번호로 쓰면 바꾸는 의미가 없다.
  const sameAsCurrent = next.length > 0 && next === current;

  const canSubmit =
    current.length > 0 && !checkPassword(next) && next === next2 && !sameAsCurrent && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      track("password_change_complete");
      await refreshUser();
      // mustChangePassword=false 가 반영되면 상위 RequirePasswordChange 가 통과시킨다.
    } catch (e) {
      setError(changeErrorMessage(e?.code) || e?.message || "비밀번호 변경에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    const ok = await showConfirm("로그아웃할까요? 비밀번호는 그대로 유지돼요.");
    if (!ok) return;
    await signOut();
  };

  return (
    <Wrap>
      <Inner>
        <Head>
          <Title>
            새 비밀번호를
            <br />
            정해 주세요.
          </Title>
          <Sub>임시 비밀번호는 문자에 남아 있어요. 지금 바꿔야 계정이 안전해요.</Sub>
        </Head>

        <FieldGroup>
          <Label htmlFor="current">현재 비밀번호<Req>*</Req></Label>
          <Input
            id="current"
            type="password"
            autoComplete="current-password"
            placeholder="문자로 받은 임시 비밀번호"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="next">새 비밀번호<Req>*</Req></Label>
          <Input
            id="next"
            type="password"
            autoComplete="new-password"
            placeholder={PASSWORD_RULE_TEXT}
            value={next}
            maxLength={32}
            onChange={(e) => setNext(e.target.value)}
            disabled={busy}
            $error={!!nextError || sameAsCurrent}
          />
          <Hint $error={!!nextError || sameAsCurrent}>
            {sameAsCurrent
              ? "임시 비밀번호와 다른 비밀번호로 정해 주세요."
              : nextError || PASSWORD_RULE_TEXT}
          </Hint>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="next2">새 비밀번호 확인<Req>*</Req></Label>
          <Input
            id="next2"
            type="password"
            autoComplete="new-password"
            placeholder="한 번 더 입력해 주세요"
            value={next2}
            maxLength={32}
            onChange={(e) => setNext2(e.target.value)}
            disabled={busy}
            $error={mismatch}
          />
          {mismatch && <Hint $error>비밀번호가 서로 달라요.</Hint>}
        </FieldGroup>

        {!!error && <ErrorBox role="alert">{error}</ErrorBox>}

        <Spacer />

        <SubmitBtn type="button" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? "변경 중…" : "비밀번호 변경"}
        </SubmitBtn>

        <SignOutBtn type="button" onClick={handleSignOut} disabled={busy}>
          로그아웃
        </SignOutBtn>
      </Inner>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const Wrap = styled.div`
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  justify-content: center;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  padding-top: calc(56px + env(safe-area-inset-top));
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
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
  line-height: 1.55;
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
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.danger};
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

const SignOutBtn = styled.button`
  margin-top: 12px;
  width: 100%;
  height: 44px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
`;
