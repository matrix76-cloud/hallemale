/* eslint-disable */
// src/pages/owner/OwnerSignupPage.jsx
// 구장 관리자 전용 회원가입 — 한 화면에 질문 하나씩(4단계). 가입 후 구장 온보딩으로 이동.
//
// 예전엔 이메일·비밀번호·비밀번호확인·담당자명·휴대폰·인증번호 6개를 한 화면에 세웠다.
// 같은 서비스인데 구장 온보딩만 단계형이라 톤이 갈렸고, 끝까지 다 채운 뒤에야 에러를 봤다.
// 지금은 단계마다 그 자리에서 검증하고, 어느 단계에서 나갔는지도 계측한다.
import { showAlert } from "../../utils/appDialog";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { ownerSignUpEmail, OWNER_PW_MIN } from "../../services/ownerAuthService";
import { requestPhoneOtp, verifyPhoneOtp, isKrMobile } from "../../services/phoneOtpService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";
import { track } from "../../utils/analytics";
import {
  WizardShell, WizardProgress, WizardBody, WizardTitle, WizardSub, WizardHint,
  WizardFooter, WizardBack, WizardNext, WizardInput,
} from "../../components/wizard/SignupWizard";

const STEPS = ["email", "password", "name", "phone"];
const TITLES = {
  email: "이메일을 알려주세요",
  password: "비밀번호를 만들어주세요",
  name: "담당자님 성함이 어떻게 되세요?",
  phone: "휴대폰 번호를 인증해주세요",
};
const SUBS = {
  email: "로그인할 때 쓰는 아이디예요.",
  password: `${OWNER_PW_MIN}자 이상, 영문과 숫자를 함께 넣어주세요.`,
  name: "예약 문의나 심사 확인 때 이 이름으로 연락드려요.",
  phone: "본인 확인용이에요. 예약자에게 공개되지 않아요.",
};

export default function OwnerSignupPage() {
  const navigate = useNavigate();
  const { isLoggedIn, uid } = useOwnerAuth();
  const [step, setStep] = useState(0);
  const id = STEPS[step];

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

  // 단계가 바뀌면 첫 입력에 포커스 — 매 단계 입력창을 손으로 누르게 하지 않는다
  const firstRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => firstRef.current?.focus(), 120); return () => clearTimeout(t); }, [step]);

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
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // 단계별 통과 조건 — 다음 버튼이 열리는 기준이자 아래 안내 문구의 기준
  const canNext = (() => {
    if (id === "email") return emailOk;
    if (id === "password") return pwLenOk && pwAlphaOk && pwDigitOk && pwMatch;
    if (id === "name") return managerName.trim().length >= 2;
    if (id === "phone") return phoneVerified;
    return true;
  })();

  // 가입/로그인 완료되면 구장 온보딩으로 이동
  useEffect(() => {
    if (isLoggedIn && uid) {
      navigate("/owner/onboarding", { replace: true });
    }
  }, [isLoggedIn, uid, navigate]);

  const goNext = () => {
    if (!canNext) {
      if (id === "email") return showAlert("이메일 형식을 확인해주세요.");
      if (id === "password") return showAlert(pwMatch ? "비밀번호 조건을 확인해주세요." : "비밀번호가 일치하지 않아요.");
      if (id === "name") return showAlert("담당자 이름을 입력해주세요.");
      return;
    }
    if (step < STEPS.length - 1) {
      track("owner_signup_step", { step: id }); // 어느 단계에서 이탈하는지 정량화
      setStep((s) => s + 1);
      return;
    }
    handleSubmit();
  };
  const goBack = () => (step === 0 ? navigate("/owner/login") : setStep((s) => s - 1));

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await ownerSignUpEmail({
        email, password, managerName, managerPhone,
        phoneVerified, keepLogin: true,
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

  // Enter 로도 넘어가게 — 모바일 키보드의 "완료"가 다음 단계로 이어진다
  const onKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); goNext(); } };

  return (
    <WizardShell>
      <WizardProgress step={step + 1} total={STEPS.length} />

      <WizardBody>
        <WizardTitle>{TITLES[id]}</WizardTitle>
        <WizardSub>{SUBS[id]}</WizardSub>

        {id === "email" && (
          <WizardInput
            ref={firstRef}
            type="email" inputMode="email" autoComplete="email"
            placeholder="owner@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKeyDown} disabled={busy}
          />
        )}

        {id === "password" && (
          <>
            <WizardInput
              ref={firstRef}
              type="password" autoComplete="new-password" placeholder="비밀번호"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown} disabled={busy}
            />
            {password.length > 0 && (
              <RuleRow>
                <Rule $ok={pwLenOk}>{pwLenOk ? "✓" : "·"} {OWNER_PW_MIN}자 이상</Rule>
                <Rule $ok={pwAlphaOk}>{pwAlphaOk ? "✓" : "·"} 영문</Rule>
                <Rule $ok={pwDigitOk}>{pwDigitOk ? "✓" : "·"} 숫자</Rule>
              </RuleRow>
            )}
            <WizardInput
              type="password" autoComplete="new-password" placeholder="비밀번호 확인"
              value={password2} onChange={(e) => setPassword2(e.target.value)}
              onKeyDown={onKeyDown} disabled={busy}
            />
            {password2.length > 0 && !pwMatch && (
              <RuleRow><Rule $ok={false}>· 비밀번호가 일치하지 않아요</Rule></RuleRow>
            )}
          </>
        )}

        {id === "name" && (
          <WizardInput
            ref={firstRef}
            type="text" autoComplete="name" placeholder="예: 홍길동"
            value={managerName} onChange={(e) => setManagerName(e.target.value)}
            onKeyDown={onKeyDown} disabled={busy}
          />
        )}

        {id === "phone" && (
          <>
            <Row>
              <WizardInput
                ref={firstRef}
                type="tel" inputMode="numeric" autoComplete="tel"
                placeholder="휴대폰번호 (- 없이)"
                value={managerPhone} onChange={(e) => changePhone(e.target.value)}
                disabled={busy || phoneVerified} maxLength={11}
              />
              <SideBtn
                type="button" onClick={sendOtp}
                disabled={busy || otpBusy || phoneVerified || !isKrMobile(managerPhone)}
              >
                {phoneVerified ? "인증완료" : otpSent ? "재발송" : "인증번호"}
              </SideBtn>
            </Row>

            {otpSent && !phoneVerified && (
              <Row>
                <WizardInput
                  type="tel" inputMode="numeric" placeholder="인증번호 6자리"
                  value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={busy || otpBusy} maxLength={6}
                />
                <SideBtn type="button" onClick={confirmOtp} disabled={busy || otpBusy || otpCode.length < 4}>
                  확인
                </SideBtn>
              </Row>
            )}

            {phoneVerified && <RuleRow><Rule $ok={true}>✓ 휴대폰 인증이 완료됐어요</Rule></RuleRow>}
            <WizardHint>가입 후 구장 정보를 등록하면 예약을 받을 수 있어요.</WizardHint>
          </>
        )}

        {step === 0 && (
          <LinkBtn type="button" onClick={() => navigate("/owner/login")}>
            이미 계정이 있어요 · 로그인
          </LinkBtn>
        )}
      </WizardBody>

      <WizardFooter>
        <WizardBack type="button" onClick={goBack} disabled={busy}>
          {step === 0 ? "로그인" : "이전"}
        </WizardBack>
        <WizardNext type="button" onClick={goNext} disabled={busy || !canNext}>
          {busy ? "가입 처리 중…" : step === STEPS.length - 1 ? "가입하기" : "다음"}
        </WizardNext>
      </WizardFooter>
    </WizardShell>
  );
}

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
  height: 54px;
  padding: 0 16px;
  border-radius: 12px;
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
const LinkBtn = styled.button`
  align-self: center;
  margin-top: 8px;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 4px;
`;
