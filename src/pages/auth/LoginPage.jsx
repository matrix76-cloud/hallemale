/* eslint-disable */
// src/pages/auth/LoginPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import BrandHeader from "../../components/auth/BrandHeader";
import Spinner from "../../components/common/Spinner";
import { signInWithEmail, sendPasswordReset } from "../../services/authService";

import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

/**
 * 피그마 구조
 * 1) 상단 BrandHeader (로고)
 * 2) 섹션 타이틀 "로그인" + 구분선
 * 3) 이메일 / 비밀번호 인풋
 * 4) 체크박스 2개 (로그인 유지 / 아이디 저장)
 * 5) 로그인 버튼
 * 6) 아이디 찾기 | 비밀번호 찾기
 * 7) 하단 회원가입 진입
 */

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
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: "GmarketSans";
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
  gap: 6px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.muted || "#777"};
`;

const Input = styled.input`
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border || "#e0e0e0"};
  padding: 8px 0;
  font-size: ${({ theme }) => theme.fontSizes.bodyLg}px;
  outline: none;

  &:focus {
    border-bottom-color: ${({ theme }) => theme.colors.primary};
  }
`;

const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.text || "#333"};

  input {
    width: 14px;
    height: 14px;
  }
`;

const PrimaryButtonWrap = styled.div`
  margin-top: 24px;
`;

const HelperLinks = styled.div`
  margin-top: 16px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  display: flex;
  justify-content: center;
  gap: 12px;
`;

const LinkText = styled.button`
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  cursor: pointer;
`;

const DevLoginWrap = styled.div`
  margin-top: 24px;
  display: flex;
  justify-content: center;
`;

const DevLoginButton = styled.button`
  border: none;
  background: none;
  padding: 4px 8px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  text-decoration: underline;
  cursor: pointer;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.72);
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

export default function LoginPage() {
  const navigate = useNavigate();

  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const { preloadHomeData } = useHomeData();
  const { preloadMatchingHomeData } = useMatchingData();

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const activeTeamId = String(club?.id || "").trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [keepLogin, setKeepLogin] = useState(false);
  const [saveId, setSaveId] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [postLoginPreload, setPostLoginPreload] = useState(false);
  const [preloading, setPreloading] = useState(false);

  const preloadOnceRef = useRef(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("savedEmail") || "";
      if (savedEmail) {
        setEmail(savedEmail);
        setSaveId(true);
      }
    } catch (e) {}
  }, []);

  const canRunPreload = useMemo(() => {
    if (!postLoginPreload) return false;
    if (authLoading || clubLoading) return false;
    if (!isLoggedIn) return false;
    if (!uid) return false;
    return true;
  }, [postLoginPreload, authLoading, clubLoading, isLoggedIn, uid]);

  useEffect(() => {
    if (!canRunPreload) return;
    if (preloadOnceRef.current) return;

    preloadOnceRef.current = true;

    (async () => {
      const startedAt = Date.now();
      const MIN_MS = 700;

      setPreloading(true);
      try {
        const tasks = [];
        tasks.push(preloadHomeData(uid));
        if (activeTeamId) tasks.push(preloadMatchingHomeData(activeTeamId));
        await Promise.all(tasks);
      } catch (e) {
        console.error("[LoginPage] preload failed:", e);
      } finally {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, MIN_MS - elapsed);

        setTimeout(() => {
          setPreloading(false);
          setPostLoginPreload(false);
          navigate("/home", { replace: true });
        }, wait);
      }
    })();
  }, [canRunPreload, preloadHomeData, preloadMatchingHomeData, uid, activeTeamId, navigate]);

  // ✅ 로그인 버튼: Firebase Auth 실제 로그인 + persistence 적용
  // ✅ 로그인 성공 후: 스피너 + 프리로드 완료되면 /home
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!email.trim() || !password) {
      window.alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmail({
        email: email.trim(),
        password,
        keepLogin,
      });

      try {
        if (saveId) localStorage.setItem("savedEmail", email.trim());
        else localStorage.removeItem("savedEmail");
      } catch (e) {}

      preloadOnceRef.current = false;
      setPostLoginPreload(true);
      setPreloading(true);
    } catch (err) {
      const msg = (err && err.message) || "";

      if (msg.includes("auth/invalid-email")) {
        window.alert("이메일 형식이 올바르지 않습니다.");
        return;
      }
      if (msg.includes("auth/user-not-found")) {
        window.alert("가입된 계정을 찾을 수 없습니다. 회원가입을 진행해 주세요.");
        return;
      }
      if (msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential")) {
        window.alert("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      if (msg.includes("auth/too-many-requests")) {
        window.alert("시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      window.alert("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoSignup = () => {
    navigate("/signup");
  };

  const handleHelpClick = async (type) => {
    if (type === "아이디 찾기") {
      window.alert("아이디 찾기 기능은 준비 중입니다.");
      return;
    }

    if (!email.trim()) {
      window.alert("비밀번호 재설정을 위해 이메일을 먼저 입력해주세요.");
      return;
    }

    try {
      await sendPasswordReset({ email: email.trim() });
      window.alert("비밀번호 재설정 메일을 보냈어요. 이메일을 확인해 주세요.");
    } catch (e) {
      window.alert("메일 발송에 실패했습니다. 이메일을 확인 후 다시 시도해 주세요.");
    }
  };

  return (
    <>
      {(preloading || postLoginPreload) && (
        <Overlay>
          <OverlayInner>
            <Spinner />
            <OverlayText>데이터 불러오는 중…</OverlayText>
          </OverlayInner>
        </Overlay>
      )}

      <Wrap>
        <HeaderTop>
          <BrandHeader />
        </HeaderTop>

        <SectionTitle>로그인</SectionTitle>
        <SectionDivider />

        <Form onSubmit={handleSubmit}>
          <Field>
            <Label htmlFor="login-email">이메일</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="이메일을 입력하세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={preloading || postLoginPreload}
            />
          </Field>

          <Field>
            <Label htmlFor="login-pw">비밀번호</Label>
            <Input
              id="login-pw"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={preloading || postLoginPreload}
            />
          </Field>

          <CheckboxRow>
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={keepLogin}
                onChange={(e) => setKeepLogin(e.target.checked)}
                disabled={preloading || postLoginPreload}
              />
              로그인 유지
            </CheckboxLabel>
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={saveId}
                onChange={(e) => setSaveId(e.target.checked)}
                disabled={preloading || postLoginPreload}
              />
              아이디 저장
            </CheckboxLabel>
          </CheckboxRow>

          <PrimaryButtonWrap>
            <Button fullWidth type="submit" disabled={isSubmitting || preloading || postLoginPreload}>
              {isSubmitting ? "로그인 중..." : "로그인"}
            </Button>
          </PrimaryButtonWrap>

          <HelperLinks>
            <LinkText type="button" onClick={() => handleHelpClick("아이디 찾기")} disabled={preloading || postLoginPreload}>
              아이디 찾기
            </LinkText>
            <span>|</span>
            <LinkText type="button" onClick={() => handleHelpClick("비밀번호 찾기")} disabled={preloading || postLoginPreload}>
              비밀번호 찾기
            </LinkText>
          </HelperLinks>
        </Form>

        <DevLoginWrap>
          <DevLoginButton type="button" onClick={handleGoSignup} disabled={preloading || postLoginPreload}>
            처음이신가요? 회원가입 해주세요
          </DevLoginButton>
        </DevLoginWrap>
      </Wrap>
    </>
  );
}
