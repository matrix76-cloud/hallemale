/* eslint-disable */
// src/pages/owner/OwnerSignupPage.jsx
// 구장 관리자 전용 회원가입 — 이메일/비밀번호. 가입 후 구장 온보딩으로 이동.
import { showAlert } from "../../utils/appDialog";
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { ownerSignUpEmail, OWNER_PW_MIN } from "../../services/ownerAuthService";
import { requestPhoneOtp, verifyPhoneOtp, isKrMobile } from "../../services/phoneOtpService";
import { markUserAsOwner } from "../../services/ownerVenueService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";
import { track } from "../../utils/analytics";

export default function OwnerSignupPage() {
  const navigate = useNavigate();
  const { isLoggedIn, uid } = useOwnerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // 휴대폰 SMS 인증 (사용자앱과 동일한 phoneOtpService 재사용)
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  // 번호를 고치면 인증을 다시 받아야 한다
  const changePhone = (v) => {
    setManagerPhone(v.replace(/[^0-9]/g, ""));
    setOtpSent(false);
    setOtpCode("");
    setPhoneVerified(false);
  };

  const sendOtp = async () => {
    if (otpBusy) return;
    if (!isKrMobile(managerPhone)) {
      showAlert("휴대폰번호 형식이 올바르지 않아요.");
      return;
    }
    setOtpBusy(true);
    try {
      await requestPhoneOtp(managerPhone, "signup");
      setOtpSent(true);
      showAlert("인증번호를 보냈어요. 문자 메시지를 확인해주세요.");
    } catch (e) {
      showAlert(e?.message || "인증번호 발송에 실패했어요.");
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmOtp = async () => {
    if (otpBusy) return;
    setOtpBusy(true);
    try {
      await verifyPhoneOtp(managerPhone, otpCode);
      setPhoneVerified(true);
    } catch (e) {
      const left = e?.attemptsLeft;
      showAlert(
        (e?.message || "인증번호가 올바르지 않아요.") +
          (typeof left === "number" ? `\n남은 시도 ${left}회` : "")
      );
    } finally {
      setOtpBusy(false);
    }
  };

  // 비밀번호 조건 충족 여부 — 입력 중 실시간 표시
  const pwLenOk = password.length >= OWNER_PW_MIN;
  const pwAlphaOk = /[A-Za-z]/.test(password);
  const pwDigitOk = /[0-9]/.test(password);
  const pwMatch = password.length > 0 && password === password2;

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
      const res = await ownerSignUpEmail({
        email,
        password,
        managerName,
        managerPhone,
        phoneVerified,
        keepLogin: true,
      });
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
          placeholder={`비밀번호 (${OWNER_PW_MIN}자 이상, 영문+숫자)`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />

        {password.length > 0 && (
          <RuleRow>
            <Rule $ok={pwLenOk}>{pwLenOk ? "✓" : "·"} {OWNER_PW_MIN}자 이상</Rule>
            <Rule $ok={pwAlphaOk}>{pwAlphaOk ? "✓" : "·"} 영문</Rule>
            <Rule $ok={pwDigitOk}>{pwDigitOk ? "✓" : "·"} 숫자</Rule>
          </RuleRow>
        )}

        <Input
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 확인"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          disabled={busy}
        />
        {password2.length > 0 && !pwMatch && (
          <RuleRow>
            <Rule $ok={false}>· 비밀번호가 일치하지 않아요</Rule>
          </RuleRow>
        )}

        <FieldLabel>담당자 정보</FieldLabel>
        <Input
          type="text"
          autoComplete="name"
          placeholder="담당자 이름"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          disabled={busy}
        />
        <Row>
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="휴대폰번호 (- 없이)"
            value={managerPhone}
            onChange={(e) => changePhone(e.target.value)}
            disabled={busy || phoneVerified}
            maxLength={11}
          />
          <SideBtn
            type="button"
            onClick={sendOtp}
            disabled={busy || otpBusy || phoneVerified || !isKrMobile(managerPhone)}
          >
            {phoneVerified ? "인증완료" : otpSent ? "재발송" : "인증번호"}
          </SideBtn>
        </Row>

        {otpSent && !phoneVerified && (
          <Row>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="인증번호 6자리"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
              disabled={busy || otpBusy}
              maxLength={6}
            />
            <SideBtn type="button" onClick={confirmOtp} disabled={busy || otpBusy || otpCode.length < 4}>
              확인
            </SideBtn>
          </Row>
        )}

        {phoneVerified && (
          <RuleRow>
            <Rule $ok={true}>✓ 휴대폰 인증이 완료됐어요</Rule>
          </RuleRow>
        )}

        <SubmitBtn type="submit" disabled={busy || !phoneVerified}>가입하기</SubmitBtn>

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

const RuleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: -4px 2px 0;
`;

const Rule = styled.span`
  font-size: 12.5px;
  color: ${({ $ok, theme }) => ($ok ? theme.colors.primary : theme.colors.textWeak)};
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const SideBtn = styled.button`
  flex: 0 0 auto;
  height: 52px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const FieldLabel = styled.div`
  margin: 6px 2px -2px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
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
