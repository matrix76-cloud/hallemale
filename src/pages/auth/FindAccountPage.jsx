/* eslint-disable */
// src/pages/auth/FindAccountPage.jsx
// 계정 찾기 · 비밀번호 재설정 — 전화번호 인증 하나로 둘 다 처리한다.
//   1) 전화번호 입력 → 인증번호 발송
//   2) 6자리 입력 → 서버(recoverAccountByPhone)가 인증번호 검증 + 계정 조회 + 임시 비밀번호 문자 발송
//   3) 결과 — 이메일 계정이면 "문자로 보냄", 소셜 계정이면 "그 소셜로 로그인하세요"
//
// 인증번호 검증을 서버가 직접 하는 이유: verifyPhoneOtp 를 먼저 부르면 인증번호가 소비돼
// 계정 조회 단계에서 다시 쓸 수 없다. 그래서 이 화면은 verifyPhoneOtp 를 쓰지 않는다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requestPhoneOtp, recoverAccountByPhone, isKrMobile } from "../../services/phoneOtpService";
import { track } from "../../utils/analytics";
import AuthPageHeader from "../../components/auth/AuthPageHeader";

const CODE_LEN = 6;
const DEFAULT_SEC = 180;

function formatPhone(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const PROVIDER_LABEL = {
  kakao: "카카오",
  google: "구글",
  apple: "애플",
};

// 리뷰 보드용 — ?step= 으로 중간 단계를 바로 연다 (구장주 가입 화면의 ?step= 과 같은 방식).
// 실제 사용자는 이 파라미터 없이 들어오므로 흐름에는 영향이 없다.
// 인증번호 발송과 계정 조회를 거치지 않으면 2·3단계 화면을 볼 방법이 없어서 뚫어 둔다.
const PREVIEW = {
  code: { step: "code", result: null },
  done: {
    step: "done",
    result: { tempIssued: true, provider: "email", maskedEmail: "ha**********@gmail.com" },
  },
  social: {
    step: "done",
    result: { tempIssued: false, provider: "kakao", maskedEmail: "ha**********@gmail.com" },
  },
};

export default function FindAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preview = PREVIEW[searchParams.get("step")] || null;

  const [step, setStep] = useState(preview?.step || "phone"); // "phone" | "code" | "done"
  const [phone, setPhone] = useState(preview ? "01012345678" : "");
  const [code, setCode] = useState("");
  const [result, setResult] = useState(preview?.result || null); // { tempIssued, provider, maskedEmail, tempPassword? }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(preview ? DEFAULT_SEC : 0);

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = isKrMobile(phoneDigits);
  const expired = step === "code" && secondsLeft <= 0;

  useEffect(() => {
    if (step !== "code") return;
    const id = setInterval(() => setSecondsLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);

  const sendCode = async () => {
    if (busy || !phoneValid) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await requestPhoneOtp(phoneDigits, "recover");
      setStep("code");
      setCode("");
      setSecondsLeft(r?.expiresInSec || DEFAULT_SEC);
      if (r?.testCode) setNotice(`테스트 인증번호: ${r.testCode}`);
    } catch (e) {
      setError(e?.message || "인증번호 발송에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (busy || code.length !== CODE_LEN) return;
    setBusy(true);
    setError("");
    try {
      const r = await recoverAccountByPhone(phoneDigits, code);
      setResult(r);
      setStep("done");
      track("account_recover_success", { tempIssued: !!r?.tempIssued });
    } catch (e) {
      if (e?.code === "account/not-found") {
        setError("이 번호로 가입된 계정이 없어요. 번호를 다시 확인해 주세요.");
      } else if (e?.code === "otp/mismatch") {
        const left = typeof e?.attemptsLeft === "number" ? e.attemptsLeft : null;
        setError(
          "인증번호가 일치하지 않아요. 다시 입력해 주세요." +
            (left != null ? ` (남은 시도 ${left}회)` : "")
        );
        setCode("");
      } else {
        setError(e?.message || "계정을 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 3) 결과 ---------- */
  if (step === "done" && result) {
    const social = !result.tempIssued;
    const label = PROVIDER_LABEL[result.provider] || "소셜";

    return (
      <Wrap>
        <AuthPageHeader title="계정 찾기" onBack={() => navigate("/login", { replace: true })} />
        <Inner>
          <Head>
            <Title>{social ? `${label} 계정으로\n가입돼 있어요.` : "임시 비밀번호를\n문자로 보냈어요."}</Title>
            <Sub>
              {social
                ? `${label}로 시작하기를 눌러 로그인해 주세요.`
                : "문자로 받은 임시 비밀번호로 로그인하면, 새 비밀번호를 정하는 화면이 바로 나와요."}
            </Sub>
          </Head>

          {!!result.maskedEmail && (
            <ResultBox>
              <ResultLabel>가입된 이메일</ResultLabel>
              <ResultValue>{result.maskedEmail}</ResultValue>
            </ResultBox>
          )}

          {/* 앱 심사용 테스트 번호에서만 내려온다(운영 번호에는 없음) */}
          {!!result.tempPassword && (
            <ResultBox>
              <ResultLabel>테스트 임시 비밀번호</ResultLabel>
              <ResultValue>{result.tempPassword}</ResultValue>
            </ResultBox>
          )}

          <Spacer />

          <SubmitBtn
            type="button"
            onClick={() =>
              navigate(social ? "/login" : "/login/email", { replace: true })
            }
          >
            로그인하러 가기
          </SubmitBtn>
        </Inner>
      </Wrap>
    );
  }

  /* ---------- 2) 인증번호 입력 ---------- */
  if (step === "code") {
    return (
      <Wrap>
        <AuthPageHeader
          title="계정 찾기"
          onBack={() => {
            setStep("phone");
            setCode("");
            setError("");
            setNotice("");
          }}
        />
        <Inner>
          <Head>
            <Title>인증번호를 입력해 주세요.</Title>
            <Sub>{formatPhone(phone)} 으로 보냈어요.</Sub>
          </Head>

          <FieldGroup>
            <Label htmlFor="code">인증번호</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6자리"
              value={code}
              maxLength={CODE_LEN}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LEN))}
              disabled={busy}
              $error={!!error}
            />
            <Hint $error={!!error || expired}>
              {error ||
                (expired
                  ? "인증번호가 만료됐어요. 재전송해 주세요."
                  : `남은 시간 ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`)}
            </Hint>
          </FieldGroup>

          {!!notice && <Notice>{notice}</Notice>}

          <ResendBtn type="button" onClick={sendCode} disabled={busy}>
            인증번호 재전송
          </ResendBtn>

          <Spacer />

          <SubmitBtn
            type="button"
            disabled={busy || code.length !== CODE_LEN || expired}
            onClick={submitCode}
          >
            {busy ? "확인 중…" : "확인"}
          </SubmitBtn>
        </Inner>
      </Wrap>
    );
  }

  /* ---------- 1) 전화번호 입력 ---------- */
  return (
    <Wrap>
      <AuthPageHeader title="계정 찾기" />
      <Inner>
        <Head>
          <Title>
            가입할 때 인증한
            <br />
            휴대폰 번호를 알려주세요.
          </Title>
          <Sub>가입된 이메일을 알려드리고, 임시 비밀번호를 문자로 보내드려요.</Sub>
        </Head>

        <FieldGroup>
          <Label htmlFor="phone">휴대폰 번호</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            disabled={busy}
            $error={!!error}
          />
          <Hint $error={!!error}>{error || "국내 휴대폰 번호만 인증할 수 있어요."}</Hint>
        </FieldGroup>

        <Spacer />

        <SubmitBtn type="button" disabled={busy || !phoneValid} onClick={sendCode}>
          {busy ? "발송 중…" : "인증번호 받기"}
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
  white-space: pre-line;
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
  margin-bottom: 18px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
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

const Notice = styled.div`
  margin-bottom: 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.primary};
`;

const ResendBtn = styled.button`
  align-self: flex-start;
  border: none;
  background: transparent;
  padding: 6px 2px;
  font-size: 13px;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.textWeak};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ResultBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  margin-bottom: 12px;
`;

const ResultLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ResultValue = styled.div`
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textStrong};
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
