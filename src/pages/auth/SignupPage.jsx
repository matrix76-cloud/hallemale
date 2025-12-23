/* eslint-disable */
// src/pages/auth/SignupPage.jsx
// ✅ 닉네임 입력 제거 → 자동 생성(사용자xxxx)
// ✅ 전화번호 인증을 회원가입 페이지에 포함
// ✅ 테스트 구간(01062141000 ~ 01062142000)만 devCode 화면 노출 + 서버 호출 생략
// ✅ 그 외 번호는 SMS API로 발송(코드 화면 노출 X)
// ✅ 인증 성공(테스트 구간에서만 가능) 시에만 "가입 완료" 버튼 활성화

import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import BrandHeader from "../../components/auth/BrandHeader";
import { signUpWithEmail } from "../../services/authService";

/* ===== Config (PhoneVerifyDialog와 동일) ===== */
const SMS_API_URL = "https://sendsms-v6bdtk44vq-du.a.run.app";
const TEST_RANGE_START = "01062141000";
const TEST_RANGE_END = "01062142000";

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

/* ================= styled (기존 유지 + OTP UI) ================= */

const Wrap = styled.div`
  min-height: 100vh;
  padding: 40px 24px 32px;
  display: flex;
  flex-direction: column;
`;

const HeaderTop = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 12px;
  font-size: ${({ theme }) => theme.fontSizes.title}px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.border || "#e0e0e0"};
`;

const Form = styled.form`
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RequiredMark = styled.span`
  color: #ff4b4b;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
`;

const Input = styled.input`
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border || "#e0e0e0"};
  padding: 8px 0;
  font-size: ${({ theme }) => theme.fontSizes.bodyLg}px;
  outline: none;

  &::placeholder {
    color: ${({ theme }) => theme.colors.muted || "#b3b3b3"};
  }

  &:focus {
    border-bottom-color: ${({ theme }) => theme.colors.primary};
  }
`;

const HelperText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.muted || "#999"};
`;

const PrimaryButtonWrap = styled.div`
  margin-top: auto;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TermsBlock = styled.div`
  margin-top: 8px;
  padding-top: 8px;
`;

const TermsTitle = styled.p`
  margin: 0 0 8px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TermsItem = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.text || "#333"};
  margin-bottom: 6px;

  input {
    width: 14px;
    height: 14px;
  }
`;

const TermsText = styled.span``;

const BadgeRequired = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.caption}px;
  color: ${({ theme }) => theme.colors.primary};
  margin-left: 4px;
`;

const BadgeOptional = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.caption}px;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  margin-left: 4px;
`;

const ViewLink = styled.button`
  margin-left: auto;
  border: none;
  background: transparent;
  padding: 0 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:active {
    transform: translateY(1px);
  }
`;

const BottomTextRow = styled.div`
  margin-top: 14px;
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors?.muted || "#6b7280"};
`;

const LinkButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:active {
    transform: translateY(1px);
  }
`;

/* ✅ OTP UI */
const InlineRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
`;

const SmallBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border || "#e5e7eb"};
  background: #ffffff;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
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
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  background: #f9fafb;
  font-size: 13px;
  color: #111827;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const CodeLabel = styled.div`
  color: #6b7280;
  font-size: 12px;
`;

const CodeValue = styled.div`
  font-size: 15px;
  letter-spacing: 1px;
`;

const VerifiedPill = styled.div`
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-size: 12px;
`;

const WarnPill = styled.div`
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
  font-size: 12px;
`;

export default function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [phone, setPhone] = useState(""); // formatted string
  const [codeInput, setCodeInput] = useState("");

  const [devCode, setDevCode] = useState(""); // ✅ 테스트 구간에서만 노출
  const [sentToE164, setSentToE164] = useState(""); // 어떤 번호로 보냈는지(검증용)
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [agreeAll, setAgreeAll] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const digits = useMemo(() => onlyDigits(phone), [phone]);
  const isDev = useMemo(() => inTestRange(digits), [digits]);

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

      // ✅ 테스트 구간: 서버 호출 생략 + devCode 노출
      if (isDev) {
        setDevCode(otp);
        return;
      }

      // ✅ 실번호: 서버로 발송(코드 노출 X)
      setDevCode("");

      const resp = await fetch(SMS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: onlyDigits(phone), // digits
          templateId: "VERIFY_CODE",
          variables: { code: otp },
        }),
      });

      let data = null;
      try {
        data = await resp.json();
      } catch {
        /**/
      }

      if (!resp.ok || data?.ok === false) {
        const msg =
          (data && (data.error || data.result?.message)) || `발송 실패(${resp.status})`;
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

      // ✅ 테스트 구간만 클라 검증 허용(지금은 테스트 플로우)
      if (!isDev) {
        window.alert("현재는 테스트 번호(01062141000~01062142000)에서만 가입을 완료할 수 있어요.");
        return;
      }

      if (String(codeInput).trim() !== String(devCode).trim()) {
        window.alert("인증번호가 올바르지 않습니다.");
        return;
      }

      setPhoneVerified(true);
      window.alert("전화번호 인증이 완료되었습니다.");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!email.trim() || !password || !passwordConfirm) {
      window.alert("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      window.alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!agreePrivacy || !agreeTerms) {
      window.alert("필수 약관에 모두 동의해주세요.");
      return;
    }

    if (!phoneVerified) {
      window.alert("전화번호 인증을 완료해주세요.");
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
      </HeaderTop>

      <SectionTitle>회원가입</SectionTitle>
      <SectionDivider />

      <Form onSubmit={handleSubmit}>
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

        {/* ✅ 전화번호 인증 */}
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

          {isDev ? (
            <HelperText>테스트 번호(01062141000~01062142000)에서는 인증번호가 화면에 표시됩니다.</HelperText>
          ) : (
            <HelperText>실번호는 문자로 인증번호가 발송됩니다.</HelperText>
          )}

          {/* ✅ devCode는 테스트 구간에서만 노출 */}
          {isDev && codeSent && devCode ? (
            <CodeBox>
              <div>
                <CodeLabel>개발모드 코드</CodeLabel>
                <CodeValue>{devCode}</CodeValue>
              </div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>{sentToE164}</div>
            </CodeBox>
          ) : null}

          {codeSent ? (
            <>
              <InlineRow style={{ marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="인증번호 6자리"
                    value={codeInput}
                    onChange={(e) => setCodeInput(onlyDigits(e.target.value).slice(0, 6))}
                    disabled={isSubmitting || otpBusy || phoneVerified}
                  />
                </div>
                <SmallBtn type="button" onClick={handleVerifyOtp} disabled={!canVerifyOtp}>
                  {otpBusy ? "확인중..." : "확인"}
                </SmallBtn>
              </InlineRow>

              {phoneVerified ? <VerifiedPill>✅ 전화번호 인증 완료</VerifiedPill> : null}

              {!isDev && !phoneVerified ? (
                <WarnPill>현재는 테스트 번호 구간에서만 가입 완료까지 진행합니다.</WarnPill>
              ) : null}
            </>
          ) : null}
        </Field>

        <TermsBlock>
          <TermsTitle>약관동의</TermsTitle>

          <TermsItem>
            <input
              type="checkbox"
              checked={agreeAll}
              onChange={(e) => handleChangeAll(e.target.checked)}
              disabled={isSubmitting || otpBusy}
            />
            <TermsText>전체 동의</TermsText>
          </TermsItem>

          <TermsItem>
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => handleToggleItem("privacy", e.target.checked)}
              disabled={isSubmitting || otpBusy}
            />
            <TermsText>
              개인정보 수집·이용 동의
              <BadgeRequired>[필수]</BadgeRequired>
            </TermsText>
            <ViewLink
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate("/privacy");
              }}
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
            <TermsText>
              서비스 약관 동의
              <BadgeRequired>[필수]</BadgeRequired>
            </TermsText>
            <ViewLink
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate("/terms");
              }}
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
            <TermsText>
              마케팅 정보 수신 동의
              <BadgeOptional>[선택]</BadgeOptional>
            </TermsText>
          </TermsItem>
        </TermsBlock>

        <PrimaryButtonWrap>
          <Button fullWidth type="submit" disabled={!canSubmit}>
            {isSubmitting ? "처리중..." : "가입 완료"}
          </Button>

          {!phoneVerified ? <HelperText>가입 완료 버튼은 전화번호 인증 후 활성화됩니다.</HelperText> : null}
        </PrimaryButtonWrap>
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
