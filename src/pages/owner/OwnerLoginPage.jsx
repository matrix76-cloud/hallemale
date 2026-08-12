/* eslint-disable */
// src/pages/owner/OwnerLoginPage.jsx
// 구장 관리자 로그인 — 이메일/비밀번호 전용 (세션은 ownerAuth 로 사용자 앱과 분리)
// 소셜 로그인은 지원하지 않는다: 카카오 uid가 kakao:{회원번호}로 결정론적이라
// 같은 계정으로 사용자앱에 로그인하면 uid가 겹쳐 알림·탈퇴가 얽힌다.
// 로그인 / 비밀번호 찾기 2모드. 회원가입은 전용 페이지(/owner/signup).
//
// 색은 구장주 고정 팔레트(od.js)를 따른다 — 로그인 다음 화면(운영주체·동의 게이트)이
// 라이트 고정이라, 여기만 앱 다크 테마를 타면 가입 흐름 중간에 배경이 뒤집힌다.
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import {
  ownerSignInEmail,
  ownerSendPasswordReset,
} from "../../services/ownerAuthService";
import { useOwnerAuth } from "../../hooks/useOwnerAuth";
import { images } from "../../utils/imageAssets";
import { track } from "../../utils/analytics";
import { C } from "./components/od";

export default function OwnerLoginPage() {
  const navigate = useNavigate();
  // 사용자 앱과 분리된 구장주 전용 세션(ownerAuth) 기준
  const { isLoggedIn, uid } = useOwnerAuth();
  const [mode, setMode] = useState("login"); // login | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // 구장 사무실 PC를 여러 사람이 쓰는 곳도 있다 — 로그인 유지를 강제하지 않고 고를 수 있게 한다.
  const [keepLogin, setKeepLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  // 실패 사유는 알림창 대신 폼 안에서 보여준다(어느 화면에서 틀렸는지가 같이 보여야 한다).
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // 구장주 인증이 끝나면 즉시 /owner 로 이동한다.
  useEffect(() => {
    if (isLoggedIn && uid) {
      navigate("/owner", { replace: true });
    }
  }, [isLoggedIn, uid, navigate]);

  const switchMode = (m) => {
    setMode(m);
    setPassword("");
    setError("");
    setDone("");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setError("");
    setDone("");

    if (mode === "reset") {
      if (!email.trim()) { setError("가입한 이메일을 입력해주세요."); return; }
      setBusy(true);
      try {
        const res = await ownerSendPasswordReset(email);
        if (res.success) {
          setDone("재설정 메일을 보냈어요. 메일함(스팸함 포함)을 확인해주세요.");
        } else {
          setError(res.error_message || "메일 발송에 실패했어요.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) { setError("이메일과 비밀번호를 입력해주세요."); return; }
    setBusy(true);
    try {
      const res = await ownerSignInEmail({ email, password, keepLogin });
      if (!res || res.success !== true) {
        setError(res?.error_message || "요청을 처리하지 못했어요.");
        setBusy(false);
        return;
      }
      track("owner_login"); // 공급 퍼널 — 구장주 재방문 로그인
      // 성공 시 화면 전환은 위 useEffect(인증 상태 변화 감지)에 일임한다.
      // busy 는 유지한다 — 세션 반영 전에 버튼이 되살아나면 한 번 더 눌리게 된다.
    } catch (err) {
      setError(err?.message || "요청을 처리하지 못했어요.");
      setBusy(false);
    }
  };

  const isReset = mode === "reset";
  const title = isReset ? "비밀번호 찾기" : "구장 관리자 로그인";
  const sub = isReset
    ? "가입한 이메일로 재설정 링크를 보내드려요"
    : "구장 등록부터 예약 승인·정산까지 한 곳에서";
  const submitLabel = isReset ? "재설정 메일 보내기" : "로그인";

  return (
    <Wrap>
      {busy && (
        <Overlay>
          <Spinner />
          <OverlayText>{isReset ? "메일 보내는 중…" : "로그인 중…"}</OverlayText>
        </Overlay>
      )}

      <Inner>
        <Hero>
          <Logo src={images.logo} alt="할래말래 로고" />
          <Brand>할래말래 파트너</Brand>
          <Title>{title}</Title>
          <Sub>{sub}</Sub>
        </Hero>

        <Form onSubmit={handleSubmit}>
          <Field>
            <Label htmlFor="owner-email">이메일</Label>
            <Input
              id="owner-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              disabled={busy}
            />
          </Field>

          {!isReset && (
            <Field>
              <Label htmlFor="owner-pw">비밀번호</Label>
              <PwBox>
                <Input
                  id="owner-pw"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  disabled={busy}
                />
                <PwToggle type="button" onClick={() => setShowPw((v) => !v)} disabled={busy}>
                  {showPw ? "숨기기" : "보기"}
                </PwToggle>
              </PwBox>
            </Field>
          )}

          {!isReset && (
            <KeepRow onClick={() => !busy && setKeepLogin((v) => !v)} role="button" tabIndex={0}>
              <Check $on={keepLogin}>{keepLogin ? "✓" : ""}</Check>
              <KeepText>로그인 상태 유지</KeepText>
            </KeepRow>
          )}

          <StatusLine>
            {error ? <Bad>{error}</Bad> : done ? <Good>{done}</Good> : null}
          </StatusLine>

          <SubmitBtn type="submit" disabled={busy}>{submitLabel}</SubmitBtn>

          {isReset ? (
            <GhostBtn type="button" onClick={() => switchMode("login")}>로그인으로 돌아가기</GhostBtn>
          ) : (
            <>
              <LinkRow>
                <LinkBtn type="button" onClick={() => switchMode("reset")}>비밀번호를 잊으셨나요?</LinkBtn>
              </LinkRow>
              <Divider><span>아직 계정이 없으신가요?</span></Divider>
              <GhostBtn type="button" onClick={() => navigate("/owner/signup")}>구장 관리자 가입하기</GhostBtn>
            </>
          )}
        </Form>

        <Foot>
          <Notice>할래말래 사장님 전용 로그인입니다. 선수 계정과 별도예요.</Notice>
        </Foot>
      </Inner>
    </Wrap>
  );
}

const fadeIn = keyframes`from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}`;
const spin = keyframes`to{transform:rotate(360deg);}`;

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${C.white};
  display: flex;
  justify-content: center;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  padding-top: env(safe-area-inset-top);
`;

const Inner = styled.div`
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  padding-top: 48px;
`;

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-bottom: 26px;
`;

const Logo = styled.img`width: 72px; height: 72px; object-fit: contain; margin-bottom: 4px;`;

const Brand = styled.div`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${C.violet600};
`;

const Title = styled.h1`
  margin: 0;
  font-weight: 800;
  font-size: 23px;
  letter-spacing: -0.02em;
  color: ${C.slate800};
  text-align: center;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 13.5px;
  color: ${C.slate500};
  text-align: center;
  word-break: keep-all;
`;

const Form = styled.form`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeIn} 0.35s ease-out both;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12.5px;
  font-weight: 700;
  color: ${C.slate500};
`;

const Input = styled.input`
  width: 100%;
  height: 52px;
  padding: 0 16px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate800};
  font-size: 16px; /* 16px 미만이면 iOS 사파리가 포커스 시 화면을 확대한다 */
  font-family: inherit;
  &:focus { outline: none; border-color: ${C.violet300}; }
  &::placeholder { color: ${C.slate400}; }
  &:disabled { opacity: 0.6; }
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

const KeepRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 2px;
  align-self: flex-start;
`;

const Check = styled.span`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  border: 1.5px solid ${({ $on }) => ($on ? C.violet600 : C.slate200)};
  background: ${({ $on }) => ($on ? C.violet600 : C.white)};
`;

const KeepText = styled.span`
  font-size: 13.5px;
  color: ${C.slate500};
`;

/* 오류·완료 안내가 떠도 버튼 위치가 밀리지 않게 자리를 잡아둔다 */
const StatusLine = styled.div`
  min-height: 20px;
  font-size: 12.5px;
  line-height: 1.5;
`;
const Good = styled.span`color: ${C.violet600}; font-weight: 600;`;
const Bad = styled.span`color: ${C.red500}; font-weight: 600;`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  background: ${C.violet600};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: ${C.violet700}; }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const GhostBtn = styled.button`
  width: 100%;
  height: 50px;
  border-radius: 12px;
  border: 1px solid ${C.violet300};
  background: transparent;
  color: ${C.violet600};
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

const LinkRow = styled.div`
  display: flex;
  justify-content: center;
  padding: 2px 0;
`;

const LinkBtn = styled.button`
  background: none;
  border: none;
  color: ${C.slate500};
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 4px;
  text-decoration: underline;
  text-underline-offset: 3px;
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0 2px;
  color: ${C.slate400};
  font-size: 12px;

  &::before, &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${C.slate200};
  }
`;

const Foot = styled.div`
  margin-top: auto;
  padding-top: 28px;
`;

const Notice = styled.div`
  text-align: center;
  font-size: 12px;
  color: ${C.slate400};
  word-break: keep-all;
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
