/* eslint-disable */
// src/pages/auth/LinkPhonePage.jsx
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import BrandHeader from "../../components/auth/BrandHeader";
import Button from "../../components/common/Button";
import Spinner from "../../components/common/Spinner";
import OtpInput from "../../components/auth/OtpInput";
import {
  formatKRPhone,
  toE164KR,
  genOtp6,
  sendOtpViaProxy,
} from "../../services/recoveryService";
import { linkPhoneToUid } from "../../services/phoneService";
import { useAuth } from "../../hooks/useAuth";

const TEST_RANGE_START = "01062141000";
const TEST_RANGE_END = "01062142000";

function onlyDigits(s = "") {
  return String(s || "").replace(/\D+/g, "");
}

function leftPad11(d = "") {
  return String(d || "").padStart(11, "0");
}

function inTestRange(rawDigits = "") {
  const d = leftPad11(onlyDigits(rawDigits));
  return d >= TEST_RANGE_START && d <= TEST_RANGE_END;
}

/* ── styled ── */

const Wrap = styled.div`
  min-height: 100vh;
  padding: 40px 24px 32px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const HeaderTop = styled.div`
  margin-bottom: 26px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const Desc = styled.p`
  margin: 8px 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
  margin-top: 12px;
`;

const Form = styled.div`
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

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.small || 13}px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Input = styled.input`
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 10px 0;
  font-size: ${({ theme }) => theme.fontSizes.bodyLg || 16}px;
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

const Helper = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.35;
`;

const InlineRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
`;

const SmallBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 11px 12px;
  font-size: 13px;
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
  margin-top: 8px;
  padding: 10px 12px;
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

const PillOk = styled.div`
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(34, 197, 94, 0.18)"
      : "rgba(16, 185, 129, 0.12)"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#86efac" : "#059669")};
  font-size: 12px;
`;

const BtnArea = styled.div`
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.72)"};
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const OverlayInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const OverlayText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

// App Store 리뷰어 데모 계정 — 전화번호 인증 화면 자체를 건너뜀
const REVIEWER_EMAILS = ["appreview@hallamalle.com"];

export default function LinkPhonePage() {
  const navigate = useNavigate();
  const { userDoc, refreshUser } = useAuth();

  // 리뷰어 데모 계정이 이 화면에 도달하면 즉시 홈으로 우회
  React.useEffect(() => {
    const email = String(userDoc?.email || "").trim().toLowerCase();
    if (email && REVIEWER_EMAILS.includes(email)) {
      navigate("/home", { replace: true });
    }
  }, [userDoc, navigate]);

  const [phone, setPhone] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const [codeSent, setCodeSent] = useState(false);
  const [sentOtp, setSentOtp] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sentToE164, setSentToE164] = useState("");

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [busy, setBusy] = useState(false);

  const digits = useMemo(() => onlyDigits(phone), [phone]);
  const isDev = useMemo(() => inTestRange(digits), [digits]);

  const canSendOtp = useMemo(() => {
    const d = onlyDigits(phone);
    return (d.length === 10 || d.length === 11) && !busy && secondsLeft <= 0;
  }, [phone, busy, secondsLeft]);

  const canVerifyOtp = useMemo(() => {
    return codeSent && !phoneVerified && onlyDigits(codeInput).length === 6 && !busy;
  }, [codeSent, phoneVerified, codeInput, busy]);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const resetOtpState = () => {
    setCodeInput("");
    setCodeSent(false);
    setSentOtp("");
    setDevCode("");
    setSentToE164("");
    setSecondsLeft(0);
    setPhoneVerified(false);
  };

  const onPhoneChange = (v) => {
    const d = onlyDigits(v).slice(0, 11);
    setPhone(formatKRPhone(d));
    resetOtpState();
  };

  const handleSendOtp = async () => {
    if (!canSendOtp) return;

    setBusy(true);
    try {
      const otp = genOtp6();
      const e164 = toE164KR(phone);

      setSentToE164(e164);
      setCodeSent(true);
      setPhoneVerified(false);
      setCodeInput("");
      setSecondsLeft(60);
      setSentOtp(otp);

      if (isDev) {
        setDevCode(otp);
        return;
      }

      setDevCode("");
      await sendOtpViaProxy({ phone, app: "halle", code: otp });
      window.alert("인증번호를 전송했습니다. 문자 메시지를 확인해 주세요.");
    } catch (e) {
      window.alert(`인증번호 전송에 실패했습니다. ${String(e?.message || e)}`);
      resetOtpState();
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!canVerifyOtp) return;

    if (!sentToE164 || toE164KR(phone) !== sentToE164) {
      window.alert("인증번호를 다시 요청해주세요.");
      resetOtpState();
      return;
    }

    const expected = String(sentOtp || devCode || "").trim();
    const got = String(onlyDigits(codeInput)).trim();

    if (!expected || got !== expected) {
      window.alert("인증번호가 올바르지 않습니다.");
      return;
    }

    setPhoneVerified(true);
  };

  const handleLinkPhone = async () => {
    if (!phoneVerified || !sentToE164) return;

    setBusy(true);
    try {
      await linkPhoneToUid({
        uid: userDoc?.uid || userDoc?.id,
        phoneE164: sentToE164,
        provider: userDoc?.provider || "",
        email: userDoc?.email || "",
      });

      await refreshUser();
      navigate("/home", { replace: true });
    } catch (e) {
      window.alert(`전화번호 연동에 실패했습니다. ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {busy && (
        <Overlay>
          <OverlayInner>
            <Spinner />
            <OverlayText>처리 중…</OverlayText>
          </OverlayInner>
        </Overlay>
      )}

      <Wrap>
        <HeaderTop>
          <BrandHeader />
        </HeaderTop>

        <SectionTitle>전화번호 인증</SectionTitle>
        <Desc>
          서비스 이용을 위해 전화번호 인증이 필요합니다.
          <br />
          인증된 전화번호는 계정 연동에 사용됩니다.
        </Desc>
        <SectionDivider />

        <Form>
          <Field>
            <Label>전화번호</Label>
            <InlineRow>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  disabled={busy}
                />
              </div>
              <SmallBtn type="button" onClick={handleSendOtp} disabled={!canSendOtp}>
                {secondsLeft > 0 ? `재전송 (${secondsLeft}s)` : busy ? "전송중..." : "인증번호 전송"}
              </SmallBtn>
            </InlineRow>

            <Helper>
              {isDev
                ? "테스트 번호(01062141000~01062142000)에서는 인증번호가 화면에 표시됩니다."
                : "문자로 받은 인증번호를 입력해주세요."}
            </Helper>

            {isDev && codeSent && devCode ? (
              <CodeBox>
                <div>개발모드 코드</div>
                <div style={{ letterSpacing: 1, fontSize: 15 }}>{devCode}</div>
              </CodeBox>
            ) : null}
          </Field>

          {codeSent ? (
            <Field>
              <Label>인증번호</Label>
              <InlineRow style={{ alignItems: "stretch" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <OtpInput
                    value={codeInput}
                    onChange={(v) => setCodeInput(onlyDigits(v).slice(0, 6))}
                    disabled={busy || phoneVerified}
                  />
                </div>
                <SmallBtn type="button" onClick={handleVerifyOtp} disabled={!canVerifyOtp}>
                  {busy ? "확인중..." : "확인"}
                </SmallBtn>
              </InlineRow>

              {phoneVerified ? <PillOk>본인 인증 완료</PillOk> : null}
            </Field>
          ) : null}
        </Form>

        <BtnArea>
          <Button
            fullWidth
            type="button"
            onClick={handleLinkPhone}
            disabled={!phoneVerified || busy}
          >
            전화번호 연동 완료
          </Button>
        </BtnArea>
      </Wrap>
    </>
  );
}
