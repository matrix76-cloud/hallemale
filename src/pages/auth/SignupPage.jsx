/* eslint-disable */
// src/pages/auth/SignupPage.jsx
// ✅ step: 1(약관) → 2(계정) → 3(전화인증/가입완료)
// ✅ 닉네임 입력 제거 → 자동 생성(사용자xxxx)
// ✅ 테스트 구간(01010001000 ~ 01010002000)만 devCode 화면 노출 + 서버 호출 생략
// ✅ 그 외 번호는 SMS 게이트웨이로 발송 + 클라에서도 OTP 보관(입력 시 통과)
// ✅ 인증 성공 시에만 "가입 완료" 버튼 활성화

import React, { useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import BrandHeader from "../../components/auth/BrandHeader";
import Button from "../../components/common/Button";
import OtpInput from "../../components/auth/OtpInput";
import { signUpWithEmail } from "../../services/authService";

/* ===== Config ===== */
// ✅ sms-gateway VM
const SMS_GATEWAY_URL = "https://asia-northeast3-halle-bf789.cloudfunctions.net/sendSmsProxy";
const SMS_GATEWAY_KEY = "sms-gateway-shared-key-2025";
const SMS_APP_KEY = "halle"; // ✅ 할래말래 프로젝트

const TEST_RANGE_START = "01010001000";
const TEST_RANGE_END = "01010002000";

/* ===== Utils ===== */
const onlyDigits = (s = "") => (s || "").replace(/\D+/g, "");
const leftPad11 = (d = "") => String(d || "").padStart(11, "0");
const inTestRange = (rawDigits = "") => {
  const d = leftPad11(onlyDigits(rawDigits));
  return d >= TEST_RANGE_START && d <= TEST_RANGE_END;
};
const formatKRPhone = (raw) => {
  let d = onlyDigits(raw);
  if (d.startsWith("82")) d = "0" + d.slice(2);
  if (d.length >= 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
  if (d.length >= 10)
    return d.startsWith("02")
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
  if (d.length > 7) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d;
};
const toE164KR = (raw) => {
  const d = onlyDigits(raw);
  if (!d) return "";
  const local = d.startsWith("0") ? d.slice(1) : d;
  return `+82${local}`;
};
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const makeAutoNickname = () => {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `사용자${n}`;
};

/* ================= styled ================= */

const Wrap = styled.div`
  min-height: 100vh;
  padding: 40px 24px 32px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const HeaderTop = styled.div`
  margin-bottom: 18px;
`;

const StepRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
`;

const StepText = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Progress = styled.div`
  height: 6px;
  width: 100%;
  margin-top: 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${({ $pct }) => `${$pct}%`};
  background: #ed7f34;
  border-radius: 999px;
`;

const SectionTitle = styled.h2`
  margin: 18px 0 12px;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
`;

const Form = styled.form`
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Label = styled.label`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RequiredMark = styled.span`
  color: #ff4b4b;
  font-size: 14px;
`;

const Input = styled.input`
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 10px 0;
  font-size: 16px;
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  outline: none;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }

  &:focus {
    border-bottom-color: ${({ theme }) => theme.colors.primary};
  }
`;

const HelperText = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TermsBlock = styled.div`
  margin-top: 4px;
  padding-top: 4px;
`;

const TermsTitle = styled.p`
  margin: 0 0 10px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TermsItem = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  margin-bottom: 10px;

  input {
    width: 16px;
    height: 16px;
  }
`;

const BadgeRequired = styled.span`
  font-size: 12px;
  color: #ed7f34;
  margin-left: 6px;
`;

const BadgeOptional = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-left: 6px;
`;

const ViewLink = styled.button`
  margin-left: auto;
  border: none;
  background: transparent;
  padding: 0 4px;
  font-size: 12px;
  color: #ed7f34;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:active {
    transform: translateY(1px);
  }
`;

/* OTP UI */
const InlineRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
`;

const SmallBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 12px 12px;
  font-size: 14px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textStrong};
  flex-shrink: 0;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:active {
    transform: translateY(1px);
  }
`;

const CodeBox = styled.div`
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const CodeLabel = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
`;

const CodeValue = styled.div`
  font-size: 15px;
  letter-spacing: 1px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const E164Hint = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
`;

const VerifiedPill = styled.div`
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(34, 197, 94, 0.18)"
      : "rgba(16, 185, 129, 0.12)"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#86efac" : "#059669")};
  font-size: 13px;
`;

const WarnPill = styled.div`
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(245, 158, 11, 0.16)"
      : "rgba(245, 158, 11, 0.14)"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fbbf24" : "#b45309")};
  font-size: 13px;
`;

/* 하단 버튼 영역 */
const BtnRow = styled.div`
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BottomTextRow = styled.div`
  margin-top: 14px;
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LinkButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:active {
    transform: translateY(1px);
  }
`;

const SecondaryBtn = styled.button`
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  border-radius: 8px;
  padding: 13px 14px;
  font-size: 16px;
  cursor: pointer;

  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:active {
    transform: translateY(1px);
  }
`;


export default function SignupPage() {
  const navigate = useNavigate();

  // step: 1(약관) → 2(계정) → 3(전화인증)
  const [step, setStep] = useState(1);
  const stepRef = useRef(1);
  stepRef.current = step;

  // Step2
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Step3
  const [phone, setPhone] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [sentToE164, setSentToE164] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Step1
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const digits = useMemo(() => onlyDigits(phone), [phone]);
  const isDev = useMemo(() => inTestRange(digits), [digits]);

  const pct = useMemo(() => (step === 1 ? 33 : step === 2 ? 66 : 100), [step]);

  const canStep1Next = useMemo(() => agreePrivacy && agreeTerms, [agreePrivacy, agreeTerms]);

  const canStep2Next = useMemo(() => {
    if (!email.trim()) return false;
    if (!password) return false;
    if (password.length < 6) return false;
    if (password !== passwordConfirm) return false;
    return true;
  }, [email, password, passwordConfirm]);

  const canSendOtp = useMemo(() => {
    const d = onlyDigits(phone);
    return (d.length === 10 || d.length === 11) && !otpBusy && !isSubmitting && secondsLeft <= 0;
  }, [phone, otpBusy, isSubmitting, secondsLeft]);

  const canVerifyOtp = useMemo(() => {
    return codeSent && !phoneVerified && codeInput.trim().length === 6 && !otpBusy && !isSubmitting;
  }, [codeSent, phoneVerified, codeInput, otpBusy, isSubmitting]);

  const canSubmit = useMemo(() => {
    const basic =
      !!email.trim() &&
      !!password &&
      !!passwordConfirm &&
      password === passwordConfirm &&
      agreePrivacy &&
      agreeTerms &&
      phoneVerified;

    return basic && !isSubmitting && !otpBusy;
  }, [email, password, passwordConfirm, agreePrivacy, agreeTerms, phoneVerified, isSubmitting, otpBusy]);

  const handleChangeAll = (checked) => {
    setAgreeAll(checked);
    setAgreePrivacy(checked);
    setAgreeTerms(checked);
    setAgreeMarketing(checked);
  };

  const handleToggleItem = (key, checked) => {
    if (key === "privacy") setAgreePrivacy(checked);
    if (key === "terms") setAgreeTerms(checked);
    if (key === "marketing") setAgreeMarketing(checked);

    const nextAll =
      (key === "privacy" ? checked : agreePrivacy) &&
      (key === "terms" ? checked : agreeTerms) &&
      (key === "marketing" ? checked : agreeMarketing);

    setAgreeAll(nextAll);
  };

  const resetOtpState = () => {
    setCodeInput("");
    setDevCode("");
    setSentOtp("");
    setSentToE164("");
    setCodeSent(false);
    setPhoneVerified(false);
    setSecondsLeft(0);
  };

  const handlePhoneChange = (v) => {
    const d = onlyDigits(v).slice(0, 11);
    setPhone(formatKRPhone(d));
    resetOtpState();
  };

  // ✅ resend countdown
  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const handleSendOtp = async () => {
    if (!canSendOtp) return;

    setOtpBusy(true);
    try {
      const otp = genOtp();
      const e164 = toE164KR(phone);

      setSentToE164(e164);
      setCodeSent(true);
      setPhoneVerified(false);
      setCodeInput("");
      setSecondsLeft(60);

      // ✅ 어떤 경우든 클라에도 OTP 저장(입력 검증용)
      setSentOtp(otp);

      // ✅ 테스트 구간: 서버 호출 생략 + devCode 노출
      if (isDev) {
        setDevCode(otp);
        return;
      }

      // ✅ 실번호: 문자 발송 + 코드 화면 노출 X
      setDevCode("");

      const resp = await fetch(SMS_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SMS_GATEWAY_KEY}`,
        },
        body: JSON.stringify({
          to: onlyDigits(phone),
          templateId: "VERIFY_CODE",
          app: SMS_APP_KEY,
          variables: { code: otp },
        }),
      });

    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const msg =
        (data && (data.error || data.message || data.data?.error || data.data?.result?.message)) ||
        `발송 실패(${resp.status})`;
      window.alert(`인증 코드를 전송하지 못했습니다. ${msg}`);
      resetOtpState();
      return;
    }

    // ✅ 프록시가 ok:false로 내려주는 경우도 처리
    if (data?.ok === false) {
      const msg =
        data?.error ||
        data?.message ||
        data?.data?.error ||
        data?.data?.result?.message ||
        "발송 실패";
      window.alert(`인증 코드를 전송하지 못했습니다. ${msg}`);
      resetOtpState();
      return;
    }

    window.alert("인증번호를 전송했습니다. 문자 메시지를 확인해 주세요.");

    } catch (e) {
      window.alert("코드 전송 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      resetOtpState();
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!canVerifyOtp) return;

    setOtpBusy(true);
    try {
      if (!sentToE164 || toE164KR(phone) !== sentToE164) {
        window.alert("인증번호를 다시 요청해주세요.");
        resetOtpState();
        return;
      }

      const expected = String(sentOtp || devCode || "").trim();
      const got = String(codeInput || "").trim();
      if (!expected || got !== expected) {
        window.alert("인증번호가 올바르지 않습니다.");
        return;
      }

      setPhoneVerified(true);
      window.alert("전화번호 인증이 완료되었습니다.");
    } finally {
      setOtpBusy(false);
    }
  };

  const goNext = () => {
    if (step === 1) {
      if (!canStep1Next) {
        window.alert("필수 약관에 모두 동의해주세요.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canStep2Next) {
        if (!email.trim()) return window.alert("이메일을 입력해주세요.");
        if (!password || password.length < 6) return window.alert("비밀번호는 6자 이상으로 설정해주세요.");
        if (password !== passwordConfirm) return window.alert("비밀번호 확인이 일치하지 않습니다.");
        return;
      }
      setStep(3);
      return;
    }
  };

  const goPrev = () => {
    if (step <= 1) return;
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!canSubmit) {
      if (!agreePrivacy || !agreeTerms) return window.alert("필수 약관에 모두 동의해주세요.");
      if (!email.trim()) return window.alert("이메일을 입력해주세요.");
      if (!password) return window.alert("비밀번호를 입력해주세요.");
      if (password !== passwordConfirm) return window.alert("비밀번호 확인이 일치하지 않습니다.");
      if (!phoneVerified) return window.alert("전화번호 인증을 완료해주세요.");
      return;
    }

    const autoNickname = makeAutoNickname();

    setIsSubmitting(true);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        nickname: autoNickname,
        consents: {
          privacy: agreePrivacy,
          terms: agreeTerms,
          marketing: agreeMarketing,
        },
        phoneE164: sentToE164 || toE164KR(phone),
        phoneVerified: true,
      });

      navigate("/signupsuccess", { replace: true });
    } catch (err) {
      const msg = (err && err.message) || "";

      if (msg.includes("auth/email-already-in-use")) {
        window.alert("이미 가입된 이메일입니다. 로그인으로 이동해 주세요.");
        navigate("/login");
        return;
      }
      if (msg.includes("auth/invalid-email")) {
        window.alert("이메일 형식이 올바르지 않습니다.");
        return;
      }
      if (msg.includes("auth/weak-password")) {
        window.alert("비밀번호가 너무 약합니다. 6자 이상으로 설정해 주세요.");
        return;
      }

      window.alert("회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoLogin = () => navigate("/login");

  return (
    <Wrap>
      <HeaderTop>
        <BrandHeader />
        <StepRow>
          <StepText>회원가입</StepText>
          <StepText>{step}/3</StepText>
        </StepRow>
        <Progress>
          <ProgressFill $pct={pct} />
        </Progress>
      </HeaderTop>

      <SectionTitle>{step === 1 ? "약관 동의" : step === 2 ? "계정 정보" : "전화번호 인증"}</SectionTitle>
      <SectionDivider />

      <Form onSubmit={handleSubmit}>
        {/* ---------------- Step 1: 약관 ---------------- */}
        {step === 1 && (
          <TermsBlock>
            <TermsTitle>약관동의</TermsTitle>

            <TermsItem>
              <input
                type="checkbox"
                checked={agreeAll}
                onChange={(e) => handleChangeAll(e.target.checked)}
                disabled={isSubmitting || otpBusy}
              />
              <span>전체 동의</span>
            </TermsItem>

            <TermsItem>
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => handleToggleItem("privacy", e.target.checked)}
                disabled={isSubmitting || otpBusy}
              />
              <span>
                개인정보 수집·이용 동의<BadgeRequired>[필수]</BadgeRequired>
              </span>
              <ViewLink
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate("/privacy");
                }}
                disabled={isSubmitting || otpBusy}
              >
                보기
              </ViewLink>
            </TermsItem>

            <TermsItem>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => handleToggleItem("terms", e.target.checked)}
                disabled={isSubmitting || otpBusy}
              />
              <span>
                서비스 약관 동의<BadgeRequired>[필수]</BadgeRequired>
              </span>
              <ViewLink
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate("/terms");
                }}
                disabled={isSubmitting || otpBusy}
              >
                보기
              </ViewLink>
            </TermsItem>

            <TermsItem>
              <input
                type="checkbox"
                checked={agreeMarketing}
                onChange={(e) => handleToggleItem("marketing", e.target.checked)}
                disabled={isSubmitting || otpBusy}
              />
              <span>
                마케팅 정보 수신 동의<BadgeOptional>[선택]</BadgeOptional>
              </span>
            </TermsItem>
          </TermsBlock>
        )}

        {/* ---------------- Step 2: 이메일/비번 ---------------- */}
        {step === 2 && (
          <>
            <Field>
              <LabelRow>
                <Label htmlFor="email">이메일</Label>
                <RequiredMark>*</RequiredMark>
              </LabelRow>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || otpBusy}
              />
              <HelperText>로그인에 사용할 이메일을 입력해주세요.</HelperText>
            </Field>

            <Field>
              <LabelRow>
                <Label htmlFor="password">비밀번호</Label>
                <RequiredMark>*</RequiredMark>
              </LabelRow>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호 (6자 이상)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || otpBusy}
              />
              <HelperText>6자 이상으로 설정해주세요.</HelperText>
            </Field>

            <Field>
              <LabelRow>
                <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
                <RequiredMark>*</RequiredMark>
              </LabelRow>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호 확인"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={isSubmitting || otpBusy}
              />
              <HelperText>비밀번호를 한 번 더 입력해주세요.</HelperText>
            </Field>
          </>
        )}

        {/* ---------------- Step 3: 전화인증 + 가입완료 ---------------- */}
        {step === 3 && (
          <Field>
            <LabelRow>
              <Label htmlFor="phone">전화번호</Label>
              <RequiredMark>*</RequiredMark>
            </LabelRow>

            <InlineRow>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={isSubmitting || otpBusy}
                />
              </div>

              <SmallBtn type="button" onClick={handleSendOtp} disabled={!canSendOtp}>
                {secondsLeft > 0 ? `재전송 (${secondsLeft}s)` : otpBusy ? "전송중..." : "인증번호 전송"}
              </SmallBtn>
            </InlineRow>

   

            {isDev && codeSent && devCode ? (
              <CodeBox>
                <div>
                  <CodeLabel>개발모드 코드</CodeLabel>
                  <CodeValue>{devCode}</CodeValue>
                </div>
                <E164Hint>{sentToE164}</E164Hint>
              </CodeBox>
            ) : null}

            {codeSent ? (
              <>
                <InlineRow style={{ marginTop: 12, alignItems: "stretch" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <OtpInput
                      value={codeInput}
                      onChange={(v) => setCodeInput(onlyDigits(v).slice(0, 6))}
                      disabled={isSubmitting || otpBusy || phoneVerified}
                    />
                  </div>
                  <SmallBtn type="button" onClick={handleVerifyOtp} disabled={!canVerifyOtp}>
                    {otpBusy ? "확인중..." : "확인"}
                  </SmallBtn>
                </InlineRow>

                {phoneVerified ? <VerifiedPill>✅ 전화번호 인증 완료</VerifiedPill> : null}

                {!isDev && !phoneVerified ? <WarnPill>문자로 받은 인증번호를 입력해주세요.</WarnPill> : null}
              </>
            ) : null}
          </Field>
        )}

        {/* -------- Buttons -------- */}
        <BtnRow>
          {step === 1 && (
            <>
              <Button fullWidth type="button" onClick={goNext} disabled={!canStep1Next || isSubmitting || otpBusy}>
                다음
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button fullWidth type="button" onClick={goNext} disabled={!canStep2Next || isSubmitting || otpBusy}>
                다음
              </Button>
              <SecondaryBtn fullWidth type="button" onClick={goPrev} disabled={isSubmitting || otpBusy} variant="outline">
                이전
              </SecondaryBtn>
            </>
          )}

          {step === 3 && (
            <>
              <Button fullWidth type="submit" disabled={!canSubmit}>
                {isSubmitting ? "처리중..." : "가입 완료"}
              </Button>
              <SecondaryBtn fullWidth type="button" onClick={goPrev} disabled={isSubmitting || otpBusy} variant="outline">
                이전
              </SecondaryBtn>

              {!phoneVerified ? <HelperText>가입 완료 버튼은 전화번호 인증 후 활성화됩니다.</HelperText> : null}
            </>
          )}
        </BtnRow>
      </Form>

      <BottomTextRow>
        <span>이미 아이디가 있으신가요?</span>
        <LinkButton type="button" onClick={handleGoLogin}>
          로그인
        </LinkButton>
      </BottomTextRow>
    </Wrap>
  );
}
