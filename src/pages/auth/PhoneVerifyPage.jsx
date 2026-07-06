/* eslint-disable */
// src/pages/auth/PhoneVerifyPage.jsx
// 소셜(카카오/구글) 최초 로그인 후 전화번호 인증 게이트.
// 1) 전화번호 입력 → 인증번호 발송(Solapi)
// 2) 숫자패드로 6자리 코드 입력 → 검증 → 전화번호 기반 계정 통합
//   - 코드 입력 UI는 plhouse DeviceApprovalGate(점 + 온스크린 숫자패드) 참고
import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { requestPhoneOtp, verifyPhoneOtp, toE164Kr } from "../../services/phoneOtpService";
import { getPrimaryUidByPhone, linkPhoneToUid } from "../../services/phoneService";
import { linkSocialToExistingUser, getUserProfileByUid } from "../../services/userService";
import { db } from "../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 11;
  const expired = step === "code" && secondsLeft <= 0;

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
      <Card>
        {step === "phone" ? (
          <>
            <Title>전화번호 인증</Title>
            <Desc>
              안전한 이용을 위해 전화번호 인증이 필요해요.<br />
              인증번호를 문자로 보내드립니다.
            </Desc>

            <PhoneInput
              type="tel"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={13}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && phoneValid) sendCode();
              }}
            />

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <PrimaryBtn onClick={sendCode} disabled={!phoneValid || sending}>
              {sending ? "발송 중…" : "인증번호 받기"}
            </PrimaryBtn>

            <LinkBtn onClick={signOut}>다른 계정으로 로그인</LinkBtn>
          </>
        ) : (
          <>
            <Title>인증번호 입력</Title>
            <Desc>
              <b>{formatPhone(phone)}</b> 로 보낸<br />
              6자리 인증번호를 입력해 주세요.
            </Desc>

            <Dots>
              {Array.from({ length: CODE_LEN }).map((_, i) => (
                <Dot key={i} $filled={i < input.length} />
              ))}
            </Dots>

            <StatusLine>
              {error ? (
                <ErrorText>{error}</ErrorText>
              ) : notice ? (
                <NoticeText>{notice}</NoticeText>
              ) : expired ? (
                <ErrorText>인증번호가 만료되었어요. 재전송해 주세요.</ErrorText>
              ) : (
                <TimerText>남은 시간 {mm}:{ss}</TimerText>
              )}
            </StatusLine>

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
          </>
        )}
      </Card>
    </Overlay>
  );
}

/* ───────── styles (라이트 기본 + 다크 대응) ───────── */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont,
    'Segoe UI', 'Malgun Gothic', sans-serif;
  @media (prefers-color-scheme: dark) {
    background: #111418;
  }
`;
const Card = styled.div`
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;
const Title = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: #16181d;
  margin-bottom: 12px;
  @media (prefers-color-scheme: dark) {
    color: #f4f5f7;
  }
`;
const Desc = styled.div`
  font-size: 14px;
  line-height: 1.7;
  color: #6b7280;
  text-align: center;
  margin-bottom: 26px;
  b {
    color: #16181d;
    font-weight: 700;
  }
  @media (prefers-color-scheme: dark) {
    color: #9aa1ac;
    b {
      color: #f4f5f7;
    }
  }
`;
const PhoneInput = styled.input`
  width: 100%;
  height: 54px;
  border: 1.5px solid #e3e6ea;
  border-radius: 12px;
  padding: 0 16px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #16181d;
  background: #fafbfc;
  outline: none;
  text-align: center;
  transition: border-color 0.15s;
  &:focus {
    border-color: #16181d;
    background: #fff;
  }
  &::placeholder {
    color: #b6bcc4;
    font-weight: 500;
  }
  @media (prefers-color-scheme: dark) {
    background: #1b1f25;
    border-color: #2c313a;
    color: #f4f5f7;
    &:focus {
      border-color: #6b7280;
      background: #1b1f25;
    }
  }
`;
const PrimaryBtn = styled.button`
  width: 100%;
  height: 54px;
  margin-top: 18px;
  border: none;
  border-radius: 12px;
  background: #16181d;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  &:active {
    opacity: 0.85;
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
  @media (prefers-color-scheme: dark) {
    background: #f4f5f7;
    color: #16181d;
  }
`;
const Dots = styled.div`
  display: flex;
  gap: 14px;
  margin-bottom: 14px;
`;
const Dot = styled.div`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${({ $filled }) => ($filled ? "#16181d" : "transparent")};
  border: 2px solid ${({ $filled }) => ($filled ? "#16181d" : "#d3d7dd")};
  transition: all 0.12s;
  @media (prefers-color-scheme: dark) {
    background: ${({ $filled }) => ($filled ? "#f4f5f7" : "transparent")};
    border-color: ${({ $filled }) => ($filled ? "#f4f5f7" : "#3a3f48")};
  }
`;
const StatusLine = styled.div`
  min-height: 20px;
  margin-bottom: 18px;
  font-size: 13px;
`;
const TimerText = styled.span`
  color: #9aa1ac;
`;
const NoticeText = styled.span`
  color: #2563eb;
  font-weight: 600;
`;
const ErrorText = styled.span`
  color: #ef4444;
  font-weight: 600;
`;
const ErrorMsg = styled.div`
  width: 100%;
  margin-top: 12px;
  font-size: 13px;
  color: #ef4444;
  font-weight: 600;
  text-align: center;
`;
const Pad = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 300px;
`;
const Key = styled.button`
  height: 60px;
  border: none;
  border-radius: 14px;
  background: ${({ $sub }) => ($sub ? "transparent" : "#f2f4f6")};
  color: #16181d;
  font-size: ${({ $sub }) => ($sub ? "22px" : "24px")};
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
  &:active {
    background: ${({ $sub }) => ($sub ? "rgba(0,0,0,0.06)" : "#e5e8ec")};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
  @media (prefers-color-scheme: dark) {
    background: ${({ $sub }) => ($sub ? "transparent" : "#1f242b")};
    color: #f4f5f7;
    &:active {
      background: ${({ $sub }) => ($sub ? "rgba(255,255,255,0.08)" : "#2a2f37")};
    }
  }
`;
const KeySpacer = styled.div``;
const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 26px;
`;
const Dividerdot = styled.span`
  color: #c4c9d0;
  font-size: 13px;
`;
const LinkBtn = styled.button`
  padding: 8px 6px;
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    color: #16181d;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  @media (prefers-color-scheme: dark) {
    color: #9aa1ac;
    &:hover {
      color: #f4f5f7;
    }
  }
`;
