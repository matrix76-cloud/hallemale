/* eslint-disable */
// src/pages/auth/PhoneVerifyPage.jsx
// 소셜(카카오/구글) 최초 로그인 후 전화번호 인증 게이트.
// 1) 전화번호 입력 → 인증번호 발송(Solapi)
// 2) 숫자패드로 6자리 코드 입력 → 검증 → 전화번호 기반 계정 통합
//   - 코드 입력 UI는 plhouse DeviceApprovalGate(점 + 온스크린 숫자패드) 참고
import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { requestPhoneOtp, verifyPhoneOtp, toE164Kr, isKrMobile } from "../../services/phoneOtpService";
import { getPrimaryUidByPhone, linkPhoneToUid } from "../../services/phoneService";
import { linkSocialToExistingUser, getUserProfileByUid } from "../../services/userService";
import { db } from "../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import { track } from "../../utils/analytics";

const CODE_LEN = 6;
const DEFAULT_SEC = 180; // 3분

function formatPhone(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export default function PhoneVerifyPage() {
  const { firebaseUser, userDoc, refreshUser, signOut } = useAuth();

  const [step, setStep] = useState("phone"); // "phone" | "code"
  const [phone, setPhone] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // 동시/중복 제출 방지용 동기 가드. state(submitting)는 비동기 반영이라
  // 같은 틱에 doVerify가 두 번 들어오면 둘 다 통과해버린다(StrictMode 이펙트 2회 실행 포함).
  const verifyingRef = useRef(false);

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = isKrMobile(phoneDigits);
  const expired = step === "code" && secondsLeft <= 0;

  // 안드로이드 하드웨어 뒤로가기 처리(전화인증 게이트).
  //  - 코드 입력 단계: 전화번호 입력 단계로 되돌림
  //  - 전화번호 단계: 뒤로가기를 '소비'만 함(게이트 위에 "앱 종료?" 모달이 뜨는 문제 방지)
  useBackInterceptor(true, () => {
    if (step === "code") {
      setStep("phone");
      setInput("");
      setError("");
      setNotice("");
    }
    // phone 단계에서는 아무것도 하지 않음(게이트 유지). '다른 계정으로 로그인'은 화면 버튼으로.
  });

  // 카운트다운 타이머 (code 스텝 진입 중에만)
  useEffect(() => {
    if (step !== "code") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  const sendCode = async () => {
    if (sending || !phoneValid) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const r = await requestPhoneOtp(phoneDigits, "signup");
      setStep("code");
      setInput("");
      setSecondsLeft(r?.expiresInSec || DEFAULT_SEC);
      // 앱 심사용 테스트 번호면 코드가 화면에 노출됨
      if (r?.testCode) setNotice(`테스트 인증번호: ${r.testCode}`);
    } catch (e) {
      setError(e?.message || "인증번호 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (sending) return;
    setInput("");
    setError("");
    await sendCode();
  };

  const doVerify = async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setSubmitting(true);
    setError("");

    // 1) 인증번호 검증 — 실패(오답/만료/시도초과 등)면 재입력 유도
    try {
      await verifyPhoneOtp(phoneDigits, code);
    } catch (e) {
      let msg = e?.message || "인증에 실패했습니다.";
      if (e?.code === "otp/mismatch") {
        const left = typeof e?.attemptsLeft === "number" ? e.attemptsLeft : null;
        msg =
          "인증번호가 일치하지 않습니다. 다시 입력해 주세요." +
          (left != null ? ` (남은 시도 ${left}회)` : "");
      }
      setError(msg);
      setInput(""); // 다시 입력할 수 있도록 6자리 비움 (code 화면은 그대로 유지)
      verifyingRef.current = false;
      setSubmitting(false);
      return;
    }

    // 2) 검증 성공 = 인증 완료. 아래 계정통합은 부가작업이므로
    //    실패해도 게이트 통과를 막지 않는다. (예전엔 통합 예외가 verify 성공을 덮어써 못 넘어감)
    track("phone_verify_success"); // 본인인증 완료 — 온보딩 퍼널
    const e164 = toE164Kr(phoneDigits);
    const uid = firebaseUser?.uid;
    const provider = userDoc?.provider || "";
    try {
      const existingUid = await getPrimaryUidByPhone(e164);
      if (existingUid && uid && existingUid !== uid) {
        // 같은 번호로 이미 가입된 기존 계정 → 현재 소셜 계정을 그 계정에 연결
        await linkSocialToExistingUser({ existingUid, socialUid: uid, provider });
      } else if (uid) {
        // 신규: 이 번호를 현재 계정에 연결(primaryUid) + phoneVerified=true
        await linkPhoneToUid({ uid, phoneE164: e164, provider });
      }
    } catch (e) {
      console.warn("[PhoneVerify] account link failed (non-critical):", e?.message);
    }

    // 3) 게이트가 읽는 실제 프로필 문서에 phoneVerified=true 보장(안전망).
    //    통합 경로(문서 병합/삭제)나 트랜잭션 실패와 무관하게 반드시 통과되도록.
    try {
      const profile = await getUserProfileByUid(uid);
      const targetId = profile?.id || uid;
      if (targetId) {
        await setDoc(
          doc(db, "users", targetId),
          { phoneVerified: true, phoneE164: e164, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    } catch (e) {
      console.warn("[PhoneVerify] ensure phoneVerified failed:", e?.message);
    }

    // 4) userDoc 갱신 → RequirePhone 게이트 재평가되어 통과 → 컴포넌트 언마운트.
    //    언마운트가 안 되는 경우(예외 등)를 대비해 submitting은 반드시 해제.
    try {
      await refreshUser();
    } catch (e) {
      console.warn("[PhoneVerify] refreshUser failed:", e?.message);
    }
    // 성공 시엔 상위 RequirePhone 게이트가 통과되며 이 컴포넌트가 언마운트된다.
    // (언마운트되지 않는 예외 상황을 대비해 가드/상태는 반드시 해제)
    verifyingRef.current = false;
    setSubmitting(false);
  };

  // 6자리가 모두 채워지면 자동으로 1회 검증.
  // ⚠️ 예전엔 setInput 업데이터 안에서 doVerify를 호출했는데, React 상태 업데이터는
  //    StrictMode에서 2번 실행되어 doVerify가 같은 코드로 두 번 발사됐다.
  //    → 두번째 호출이 서버에서 '인증번호 없음' 에러를 받아 방금의 성공을 덮어쓰고 입력을 비워
  //      "인증했는데 안 넘어가고 다시 입력" 버그가 났다. verifyingRef로 정확히 1회만 실행한다.
  useEffect(() => {
    if (step !== "code") return;
    if (input.length === CODE_LEN && !verifyingRef.current) {
      doVerify(input);
    }
  }, [input, step]);

  const press = (n) => {
    if (submitting || expired) return;
    setError("");
    setInput((prev) => (prev.length >= CODE_LEN ? prev : prev + String(n)));
  };
  const back = () => {
    if (submitting) return;
    setError("");
    setInput((p) => p.slice(0, -1));
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Overlay>
      {step === "phone" ? (
        <>
          <Body>
            <Title>
              전화번호를<br />입력해 주세요
            </Title>
            <Desc>안전한 이용을 위해 인증번호를 문자로 보내드려요.</Desc>

            <PhoneInput
              type="tel"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={13}
              autoFocus
              $error={!!error}
              onKeyDown={(e) => {
                if (e.key === "Enter" && phoneValid) sendCode();
              }}
            />
            <HelpLine>
              {error ? <ErrorText>{error}</ErrorText> : <MutedText>국내 휴대폰 번호만 지원해요</MutedText>}
            </HelpLine>
          </Body>

          <Footer>
            <PrimaryBtn onClick={sendCode} disabled={!phoneValid || sending}>
              {sending ? "발송 중…" : "인증번호 받기"}
            </PrimaryBtn>
            <LinkBtn onClick={signOut}>다른 계정으로 로그인</LinkBtn>
          </Footer>
        </>
      ) : (
        <>
          <Body>
            <Title>
              인증번호를<br />입력해 주세요
            </Title>
            <Desc>
              <b>{formatPhone(phone)}</b> 로 6자리 번호를 보냈어요.
            </Desc>

            <Dots>
              {Array.from({ length: CODE_LEN }).map((_, i) => (
                <Dot key={i} $filled={i < input.length} />
              ))}
            </Dots>

            <HelpLine>
              {error ? (
                <ErrorText>{error}</ErrorText>
              ) : notice ? (
                <NoticeText>{notice}</NoticeText>
              ) : expired ? (
                <ErrorText>인증번호가 만료되었어요. 재전송해 주세요.</ErrorText>
              ) : (
                <MutedText>남은 시간 {mm}:{ss}</MutedText>
              )}
            </HelpLine>

            <BottomRow>
              <LinkBtn onClick={resend} disabled={sending}>
                {sending ? "재전송 중…" : "인증번호 재전송"}
              </LinkBtn>
              <Dividerdot>·</Dividerdot>
              <LinkBtn
                onClick={() => {
                  setStep("phone");
                  setInput("");
                  setError("");
                  setNotice("");
                }}
              >
                번호 변경
              </LinkBtn>
            </BottomRow>
          </Body>

          <Pad>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Key key={n} onClick={() => press(n)} disabled={submitting || expired}>
                {n}
              </Key>
            ))}
            <KeySpacer />
            <Key onClick={() => press(0)} disabled={submitting || expired}>
              0
            </Key>
            <Key $sub onClick={back} disabled={submitting}>
              ⌫
            </Key>
          </Pad>
        </>
      )}
    </Overlay>
  );
}

/* ───────── styles ─────────
 * 토스식 인증 화면: 순백 배경 · 좌측 정렬 큰 타이틀 · 하단 고정 CTA/키패드.
 * 인증 게이트는 항상 라이트로 고정한다(다크 대응 없음).
 * 색: brand #4f46e5(theme.colors.primary) / 텍스트 #191f28 · #8b95a1 / 경고 #f04452
 */
const BRAND = "#4f46e5";
const INK = "#191f28";
const MUTED = "#8b95a1";
const LINE = "#e5e8eb";
const RED = "#f04452";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: #ffffff;
  color: ${INK};
  display: flex;
  flex-direction: column;
  padding: max(env(safe-area-inset-top), 8px) 0 max(env(safe-area-inset-bottom), 16px);
  font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont,
    'Segoe UI', 'Malgun Gothic', sans-serif;
  -webkit-tap-highlight-color: transparent;
`;
// 위쪽 콘텐츠 영역 — 타이틀·입력·상태. 남는 공간을 먹어 CTA/키패드를 아래로 민다.
const Body = styled.div`
  flex: 1;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: 40px 24px 0;
  display: flex;
  flex-direction: column;
`;
const Title = styled.h1`
  margin: 0;
  font-size: 26px;
  line-height: 1.38;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: ${INK};
`;
const Desc = styled.p`
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 1.6;
  color: ${MUTED};
  b {
    color: #4e5968;
    font-weight: 600;
  }
`;
const PhoneInput = styled.input`
  width: 100%;
  margin-top: 40px;
  padding: 0 0 12px;
  border: none;
  border-bottom: 2px solid ${({ $error }) => ($error ? RED : LINE)};
  border-radius: 0;
  background: transparent;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: ${INK};
  outline: none;
  transition: border-color 0.15s;
  &:focus {
    border-bottom-color: ${({ $error }) => ($error ? RED : BRAND)};
  }
  &::placeholder {
    color: #c9cfd6;
    font-weight: 600;
  }
`;
// 입력/코드 아래 한 줄 — 안내·타이머·에러가 같은 자리에서 교체된다(레이아웃 점프 방지)
const HelpLine = styled.div`
  min-height: 22px;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.6;
`;
const MutedText = styled.span`
  color: ${MUTED};
`;
const NoticeText = styled.span`
  color: ${BRAND};
  font-weight: 600;
`;
const ErrorText = styled.span`
  color: ${RED};
  font-weight: 600;
`;
const Dots = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 44px;
`;
const Dot = styled.div`
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: ${({ $filled }) => ($filled ? BRAND : "#eaecef")};
  transition: background 0.12s, transform 0.12s;
  transform: ${({ $filled }) => ($filled ? "scale(1.08)" : "scale(1)")};
`;
const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 20px;
`;
const Dividerdot = styled.span`
  color: #c9cfd6;
  font-size: 13px;
`;
// 하단 고정 CTA 영역 (전화번호 단계)
const Footer = styled.div`
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;
const PrimaryBtn = styled.button`
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 14px;
  background: ${BRAND};
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s, background 0.15s;
  &:active {
    transform: scale(0.99);
  }
  &:disabled {
    background: #f2f4f6;
    color: #b0b8c1;
    cursor: default;
    transform: none;
  }
`;
// 하단 고정 숫자패드 (인증번호 단계) — 토스처럼 키 배경 없이 눌렀을 때만 음영
const Pad = styled.div`
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: 8px 12px 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
`;
const Key = styled.button`
  height: 62px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: ${INK};
  font-size: ${({ $sub }) => ($sub ? "22px" : "26px")};
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.1s;
  &:active {
    background: #f2f4f6;
  }
  &:disabled {
    color: #c9cfd6;
    cursor: default;
    background: transparent;
  }
`;
const KeySpacer = styled.div``;
const LinkBtn = styled.button`
  padding: 10px 6px;
  background: transparent;
  border: none;
  color: ${MUTED};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    color: #4e5968;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
