/* eslint-disable */
// src/pages/owner/OwnerSignupPage.jsx
// 구장 관리자 전용 회원가입 — 한 화면에 질문 하나씩(4단계). 가입 후 구장 온보딩으로 이동.
//
// 예전엔 이메일·비밀번호·비밀번호확인·담당자명·휴대폰·인증번호 6개를 한 화면에 세웠다.
// 같은 서비스인데 구장 온보딩만 단계형이라 톤이 갈렸고, 끝까지 다 채운 뒤에야 에러를 봤다.
// 지금은 단계마다 그 자리에서 검증하고, 어느 단계에서 나갔는지도 계측한다.
//
// 휴대폰 인증은 "발송 → 문자 대기 → 확인 → 가입" 네 번을 기다리는 구간이라,
// 알림창(showAlert)으로 흐름을 끊지 않고 화면 안에서 상태가 바뀌게 만들었다:
//  · 발송/확인/가입 각각 진행 중임이 버튼과 안내줄에 바로 보인다
//  · 6자리를 다 넣으면 [확인]을 누르지 않아도 알아서 검증한다(사용자앱 PhoneVerifyPage 와 동일)
//  · 유효시간·재발송 쿨다운을 초 단위로 보여줘 "언제까지 기다려야 하나"를 없앤다
import React, { useEffect, useRef, useState } from "react";
import styled, { ThemeProvider, keyframes } from "styled-components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ownerSignUpEmail, OWNER_PW_MIN } from "../../services/ownerAuthService";
import { requestPhoneOtp, verifyPhoneOtp, isKrMobile } from "../../services/phoneOtpService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";
import { track } from "../../utils/analytics";
import { C, ownerAuthTheme } from "./components/od";
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
const LABELS = {
  email: "이메일", password: "비밀번호", name: "담당자명", phone: "휴대폰 인증",
};

const CODE_LEN = 6;
const DEFAULT_TTL = 180; // 서버가 expiresInSec 를 안 주는 경우의 기본값(3분)
const RESEND_COOLDOWN = 20; // 연타로 발송 한도(서버: 시간당 5회)를 태우지 않게 하는 최소 간격

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export default function OwnerSignupPage() {
  const navigate = useNavigate();
  const { isLoggedIn, uid } = useOwnerAuth();
  // ?step=<key> 로 특정 단계부터 열 수 있다 (리뷰 보드가 단계별로 프레임을 띄운다 — 온보딩과 동일).
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(() => {
    const i = STEPS.indexOf(searchParams.get("step"));
    return i >= 0 ? i : 0;
  });
  const id = STEPS[step];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [busy, setBusy] = useState(false);
  // 단계 안에서 그 자리에 뜨는 오류 — 알림창을 띄우면 입력 흐름이 끊기고 원인 필드도 안 보인다.
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 휴대폰 SMS 인증 (사용자앱과 동일한 phoneOtpService 재사용)
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false); // 발송 중
  const [verifying, setVerifying] = useState(false); // 코드 확인 중
  const [ttlLeft, setTtlLeft] = useState(0); // 인증번호 유효 잔여초
  const [coolLeft, setCoolLeft] = useState(0); // 재발송 대기 잔여초
  // 자동 확인이 같은 코드로 두 번 발사되는 것을 막는 동기 가드.
  // (state 는 비동기 반영이라 StrictMode 의 이펙트 2회 실행을 못 막는다 — PhoneVerifyPage 와 같은 이유)
  const verifyingRef = useRef(false);
  const codeRef = useRef(null);

  // 단계가 바뀌면 첫 입력에 포커스 — 매 단계 입력창을 손으로 누르게 하지 않는다
  const firstRef = useRef(null);
  useEffect(() => {
    setError("");
    const t = setTimeout(() => firstRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [step]);

  // 유효시간·재발송 쿨다운 카운트다운 (인증번호를 보낸 뒤에만 돈다)
  useEffect(() => {
    if (!otpSent || phoneVerified) return;
    const t = setInterval(() => {
      setTtlLeft((s) => (s <= 0 ? 0 : s - 1));
      setCoolLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [otpSent, phoneVerified]);

  const expired = otpSent && !phoneVerified && ttlLeft <= 0;

  // 번호를 고치면 인증을 다시 받아야 한다
  const changePhone = (v) => {
    setManagerPhone(v.replace(/[^0-9]/g, ""));
    setOtpSent(false);
    setOtpCode("");
    setPhoneVerified(false);
    setTtlLeft(0);
    setCoolLeft(0);
    setError("");
    setNotice("");
  };

  const sendOtp = async () => {
    if (otpBusy || coolLeft > 0) return;
    if (!isKrMobile(managerPhone)) {
      setError("휴대폰번호 형식이 올바르지 않아요.");
      return;
    }
    setOtpBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await requestPhoneOtp(managerPhone, "signup");
      setOtpSent(true);
      setOtpCode("");
      setTtlLeft(r?.expiresInSec || DEFAULT_TTL);
      setCoolLeft(RESEND_COOLDOWN);
      // 서버는 문자 발송이 실패해도 ok:true 로 답한다(smsStatus 로만 알린다).
      // 이걸 안 보면 "보냈어요"만 뜬 채 영영 안 오는 문자를 기다리게 된다.
      if (r?.smsStatus === "failed") {
        setError("문자 발송에 실패했어요. 번호를 확인하고 다시 시도해주세요.");
      } else if (r?.testCode) {
        setNotice(`테스트 인증번호: ${r.testCode}`); // 앱 심사용 번호
      } else {
        setNotice("인증번호를 보냈어요. 문자를 확인해주세요.");
      }
      setTimeout(() => codeRef.current?.focus(), 80);
    } catch (e) {
      setError(e?.message || "인증번호 발송에 실패했어요.");
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmOtp = async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError("");
    try {
      await verifyPhoneOtp(managerPhone, code);
      setPhoneVerified(true);
      setNotice("");
    } catch (e) {
      const left = e?.attemptsLeft;
      setError(
        (e?.message || "인증번호가 올바르지 않아요.") +
          (typeof left === "number" ? ` (남은 시도 ${left}회)` : "")
      );
      setOtpCode(""); // 바로 다시 칠 수 있게 비운다
      setTimeout(() => codeRef.current?.focus(), 60);
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  // 6자리를 다 넣으면 [확인]을 기다리지 않고 바로 검증한다.
  useEffect(() => {
    if (id !== "phone" || !otpSent || phoneVerified || expired) return;
    if (otpCode.length === CODE_LEN && !verifyingRef.current) confirmOtp(otpCode);
  }, [otpCode, id, otpSent, phoneVerified, expired]); // eslint-disable-line

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
      if (id === "email") return setError("이메일 형식을 확인해주세요.");
      if (id === "password") return setError(pwMatch ? "비밀번호 조건을 확인해주세요." : "비밀번호가 일치하지 않아요.");
      if (id === "name") return setError("담당자 이름을 2자 이상 입력해주세요.");
      if (id === "phone") return setError("휴대폰 인증을 완료해주세요.");
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
    setError("");
    try {
      const res = await ownerSignUpEmail({
        email, password, managerName, managerPhone,
        phoneVerified, keepLogin: true,
      });
      if (!res || res.success !== true) {
        setError(res?.error_message || "가입에 실패했어요.");
        setBusy(false);
        return;
      }
      track("owner_signup"); // 공급 퍼널 최상단 — 구장주 가입
      // 성공 시 화면 전환은 위 useEffect(인증 상태 변화 감지)에 일임한다.
      // busy 는 일부러 풀지 않는다 — 세션이 반영되기 전에 버튼이 되살아나면
      // 같은 이메일로 한 번 더 눌러 "이미 가입된 이메일" 오류를 보게 된다.
    } catch (e) {
      setError(e?.message || "가입에 실패했어요.");
      setBusy(false);
    }
  };

  // Enter 로도 넘어가게 — 모바일 키보드의 "완료"가 다음 단계로 이어진다
  const onKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); goNext(); } };

  return (
    // 사용자가 앱을 다크로 켜뒀어도 구장주 가입은 워크스페이스와 같은 팔레트로 고정한다.
    <ThemeProvider theme={ownerAuthTheme}>
      <WizardShell>
        {busy && (
          <Overlay>
            <Spinner />
            <OverlayText>가입 처리 중…</OverlayText>
          </Overlay>
        )}

        <WizardProgress step={step + 1} total={STEPS.length} />
        <StepMeta>
          <StepName>{LABELS[id]}</StepName>
          <StepCount>{step + 1} / {STEPS.length}</StepCount>
        </StepMeta>

        <WizardBody>
          <WizardTitle>{TITLES[id]}</WizardTitle>
          <WizardSub>{SUBS[id]}</WizardSub>

          {id === "email" && (
            <WizardInput
              ref={firstRef}
              type="email" inputMode="email" autoComplete="email"
              placeholder="owner@example.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={onKeyDown} disabled={busy}
            />
          )}

          {id === "password" && (
            <>
              <PwBox>
                <WizardInput
                  ref={firstRef}
                  type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="비밀번호"
                  value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={onKeyDown} disabled={busy}
                />
                <PwToggle type="button" onClick={() => setShowPw((v) => !v)} disabled={busy}>
                  {showPw ? "숨기기" : "보기"}
                </PwToggle>
              </PwBox>
              {password.length > 0 && (
                <RuleRow>
                  <Rule $ok={pwLenOk}>{pwLenOk ? "✓" : "·"} {OWNER_PW_MIN}자 이상</Rule>
                  <Rule $ok={pwAlphaOk}>{pwAlphaOk ? "✓" : "·"} 영문</Rule>
                  <Rule $ok={pwDigitOk}>{pwDigitOk ? "✓" : "·"} 숫자</Rule>
                </RuleRow>
              )}
              <WizardInput
                type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="비밀번호 확인"
                value={password2} onChange={(e) => { setPassword2(e.target.value); setError(""); }}
                onKeyDown={onKeyDown} disabled={busy}
              />
              {password2.length > 0 && !pwMatch && (
                <RuleRow><Rule $ok={false}>· 비밀번호가 일치하지 않아요</Rule></RuleRow>
              )}
              <WizardHint>구장 예약·매출을 다루는 계정이라 사용자 앱보다 기준이 높아요.</WizardHint>
            </>
          )}

          {id === "name" && (
            <WizardInput
              ref={firstRef}
              type="text" autoComplete="name" placeholder="예: 홍길동"
              value={managerName} onChange={(e) => { setManagerName(e.target.value); setError(""); }}
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
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!otpSent) sendOtp(); } }}
                />
                <SideBtn
                  type="button" onClick={sendOtp}
                  disabled={busy || otpBusy || phoneVerified || coolLeft > 0 || !isKrMobile(managerPhone)}
                >
                  {phoneVerified ? "인증완료"
                    : otpBusy ? "발송 중…"
                    : coolLeft > 0 ? `${coolLeft}초`
                    : otpSent ? "재발송" : "인증번호"}
                </SideBtn>
              </Row>

              {otpSent && !phoneVerified && (
                <>
                  <Row>
                    <WizardInput
                      ref={codeRef}
                      type="tel" inputMode="numeric" placeholder="인증번호 6자리"
                      value={otpCode}
                      onChange={(e) => { setOtpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_LEN)); setError(""); }}
                      disabled={busy || verifying || expired} maxLength={CODE_LEN}
                    />
                    <SideBtn type="button" onClick={() => confirmOtp(otpCode)}
                      disabled={busy || verifying || expired || otpCode.length < CODE_LEN}>
                      {verifying ? "확인 중…" : "확인"}
                    </SideBtn>
                  </Row>
                  {/* 안내·타이머·오류가 같은 자리에서 교체된다 — 줄이 늘었다 줄었다 하면 버튼이 움직인다 */}
                  <StatusLine>
                    {expired
                      ? <Bad>인증번호가 만료됐어요. 재발송해주세요.</Bad>
                      : verifying
                        ? <Muted>인증번호를 확인하고 있어요…</Muted>
                        : <Muted>남은 시간 {mmss(ttlLeft)} · 6자리를 넣으면 자동으로 확인해요</Muted>}
                  </StatusLine>
                </>
              )}

              {phoneVerified && <RuleRow><Rule $ok={true}>✓ 휴대폰 인증이 완료됐어요</Rule></RuleRow>}
              <WizardHint>가입 후 구장 정보를 등록하면 예약을 받을 수 있어요.</WizardHint>
            </>
          )}

          <StatusLine>
            {error ? <Bad>{error}</Bad> : notice ? <Good>{notice}</Good> : null}
          </StatusLine>

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
    </ThemeProvider>
  );
}

const spin = keyframes`to{transform:rotate(360deg);}`;

const StepMeta = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px max(20px, env(safe-area-inset-left)) 0 max(20px, env(safe-area-inset-right));
`;
const StepName = styled.span`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: ${C.violet600};
`;
const StepCount = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${C.slate400};
`;
const RuleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: -4px 2px 0;
`;
const Rule = styled.span`
  font-size: 12.5px;
  font-weight: ${({ $ok }) => ($ok ? 600 : 400)};
  color: ${({ $ok }) => ($ok ? C.violet600 : C.slate400)};
`;
const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;
const PwBox = styled.div`
  position: relative;
  & > input { padding-right: 68px; }
`;
const PwToggle = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: ${C.slate500};
  font-size: 12.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  padding: 6px;
`;
const SideBtn = styled.button`
  flex: 0 0 auto;
  min-width: 88px;
  height: 54px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid ${C.violet300};
  background: ${C.white};
  color: ${C.violet600};
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { border-color: ${C.slate200}; color: ${C.slate400}; cursor: not-allowed; }
`;
/* 안내·오류가 뜨고 사라져도 아래 내용이 흔들리지 않게 자리를 미리 잡아둔다 */
const StatusLine = styled.div`
  min-height: 20px;
  font-size: 12.5px;
  line-height: 1.5;
`;
const Muted = styled.span`color: ${C.slate500};`;
const Good = styled.span`color: ${C.violet600}; font-weight: 600;`;
const Bad = styled.span`color: ${C.red500}; font-weight: 600;`;
const LinkBtn = styled.button`
  align-self: center;
  margin-top: 8px;
  background: none;
  border: none;
  color: ${C.slate500};
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 4px;
  text-decoration: underline;
  text-underline-offset: 3px;
`;
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.88);
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
  border: 3px solid ${C.slate200};
  border-top-color: ${C.violet600};
  animation: ${spin} 0.8s linear infinite;
`;
const OverlayText = styled.div`
  font-size: 14px;
  color: ${C.slate500};
`;
