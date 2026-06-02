/* eslint-disable */
// src/pages/auth/LoginPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { signInWithEmail } from "../../services/authService";
import { upsertUsersByPhoneOnLogin } from "../../services/recoveryService";
import { images } from "../../utils/imageAssets";
import { isInWebView } from "../../bridge/webviewBridge";

import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useHomeData } from "../../hooks/useHomeData";
import { useMatchingData } from "../../hooks/useMatchingData";

const LS_KEEP_LOGIN = "hm.auth.keepLogin";
const LS_SAVE_ID = "hm.auth.saveId";
const LS_SAVED_EMAIL = "hm.auth.savedEmail";

// App Store 리뷰어 데모 계정 — 전화번호 인증(/link-phone) 스킵
const REVIEWER_EMAILS = ["appreview@hallamalle.com"];
function isReviewerEmail(e) {
  return REVIEWER_EMAILS.includes(String(e || "").trim().toLowerCase());
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function readLS(key) {
  try {
    return safeStr(window.localStorage.getItem(key));
  } catch {
    return "";
  }
}

function writeLS(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {}
}

function removeLS(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function readBool(key, defaultValue = false) {
  const v = readLS(key);
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return defaultValue;
}

export default function LoginPage() {
  const navigate = useNavigate();

  const { firebaseUser, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const { preloadHomeData } = useHomeData();
  const { preloadMatchingHomeData } = useMatchingData();

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const activeTeamId = String(club?.id || "").trim();

  const phoneE164 = String(userDoc?.phoneE164 || "").trim();
  const userEmail = String(firebaseUser?.email || userDoc?.email || "").trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [keepLogin, setKeepLogin] = useState(false);
  const [saveId, setSaveId] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [postLoginPreload, setPostLoginPreload] = useState(false);
  const [preloading, setPreloading] = useState(false);

  const preloadOnceRef = useRef(false);
  const upsertOnceRef = useRef(false);
  const formRef = useRef(null);

  // 이미 로그인 상태면 적절한 페이지로 이동 (소셜 로그인 후 WebView 리로드 대응)
  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn && !postLoginPreload) {
      const dest =
        phoneE164 || isReviewerEmail(userEmail) ? "/home" : "/link-phone";
      navigate(dest, { replace: true });
    }
  }, [authLoading, isLoggedIn, postLoginPreload, phoneE164, navigate]);

  useEffect(() => {
    const savedKeep = readBool(LS_KEEP_LOGIN, false);
    const savedSaveId = readBool(LS_SAVE_ID, false);
    const savedEmail = readLS(LS_SAVED_EMAIL);

    setKeepLogin(savedKeep);
    setSaveId(savedSaveId);

    if (savedSaveId && savedEmail) {
      setEmail(savedEmail);
    } else if (process.env.NODE_ENV !== "production") {
      setEmail("p04@naver.com");
      setPassword("halletest");
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!uid) return;
    if (!phoneE164) return;
    if (upsertOnceRef.current) return;

    upsertOnceRef.current = true;

    (async () => {
      try {
        await upsertUsersByPhoneOnLogin({
          phoneE164,
          uid,
          email: userEmail,
          phoneVerified: true,
        });
      } catch (e) {
        console.error("[LoginPage] users_by_phone upsert failed:", e);
      }
    })();
  }, [isLoggedIn, uid, phoneE164, userEmail]);

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
          // 폰번호 미인증 시 /link-phone으로 이동 (리뷰어 데모 계정은 스킵)
          const dest =
            phoneE164 || isReviewerEmail(email) || isReviewerEmail(userEmail)
              ? "/home"
              : "/link-phone";
          navigate(dest, { replace: true });
        }, wait);
      }
    })();
  }, [canRunPreload, preloadHomeData, preloadMatchingHomeData, uid, activeTeamId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!email.trim() || !password) {
      window.alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    // signInWithEmail 중 auth state 변경으로 인한 premature navigation 방지
    setPostLoginPreload(true);
    try {
      await signInWithEmail({
        email: email.trim(),
        password,
        keepLogin,
      });

      writeLS(LS_KEEP_LOGIN, keepLogin ? "1" : "0");
      writeLS(LS_SAVE_ID, saveId ? "1" : "0");

      if (saveId) writeLS(LS_SAVED_EMAIL, email.trim());
      else removeLS(LS_SAVED_EMAIL);

      preloadOnceRef.current = false;
      upsertOnceRef.current = false;

      setPreloading(true);
    } catch (err) {
      setPostLoginPreload(false);
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

  const onToggleKeepLogin = (checked) => {
    setKeepLogin(checked);
    writeLS(LS_KEEP_LOGIN, checked ? "1" : "0");
  };

  const onToggleSaveId = (checked) => {
    setSaveId(checked);
    writeLS(LS_SAVE_ID, checked ? "1" : "0");

    if (!checked) {
      removeLS(LS_SAVED_EMAIL);
    } else {
      const current = safeStr(email);
      if (current) writeLS(LS_SAVED_EMAIL, current);
    }
  };

  const onEmailChange = (v) => {
    setEmail(v);
    if (saveId) writeLS(LS_SAVED_EMAIL, safeStr(v));
  };

  const inApp = isInWebView();

  const scrollToForm = useCallback(() => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  const busy = isSubmitting || preloading || postLoginPreload;

  return (
    <Wrap>
      {busy && (
        <Overlay>
          <OverlayInner>
            <MiniSpinner />
            <OverlayText>{preloading ? "데이터 불러오는 중…" : "로그인 중…"}</OverlayText>
          </OverlayInner>
        </Overlay>
      )}

      <Hero>
        <HeroLogo
          src={images.logo}
          alt="할래말래 로고"
          loading="eager"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <HeroTitle>할래말래</HeroTitle>
        <HeroSub>생활체육 팀 매칭의 시작</HeroSub>
      </Hero>

      <Content>
        <FormSection ref={formRef} onSubmit={handleSubmit}>
          <Input
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="이메일"
            inputMode="email"
            autoComplete="email"
            onFocus={scrollToForm}
            disabled={busy}
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            type="password"
            autoComplete="current-password"
            onFocus={scrollToForm}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit(e);
            }}
            disabled={busy}
          />

          <CheckboxRow>
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={keepLogin}
                onChange={(e) => onToggleKeepLogin(e.target.checked)}
                disabled={busy}
              />
              로그인 유지
            </CheckboxLabel>

            <CheckboxLabel>
              <input
                type="checkbox"
                checked={saveId}
                onChange={(e) => onToggleSaveId(e.target.checked)}
                disabled={busy}
              />
              아이디 저장
            </CheckboxLabel>
          </CheckboxRow>

          <LoginBtn type="button" onClick={handleSubmit} disabled={busy}>
            {isSubmitting ? "로그인 중..." : "로그인"}
          </LoginBtn>
        </FormSection>

        <FindAccountRow>
          <FindAccountLink type="button" onClick={() => navigate("/signup")} disabled={busy}>
            회원가입
          </FindAccountLink>
        </FindAccountRow>
      </Content>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const Hero = styled.div`
  width: 100%;
  padding: 52px 24px 40px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const HeroLogo = styled.img`
  width: 120px;
  height: 120px;
  object-fit: contain;
`;

const HeroTitle = styled.div`
  margin-top: 14px;
  font-weight: 700 !important;
  font-size: 34px !important;
  font-weight: 800 !important;
  color: ${({ theme }) => theme.colors.textStrong};
  letter-spacing: -0.03em;
`;

const HeroSub = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
  letter-spacing: -0.02em;
`;

const Content = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 28px 20px 40px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: ${fadeIn} 0.45s ease-out both;
  animation-delay: 0.1s;
`;

const FormSection = styled.form`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Input = styled.input`
  width: 100%;
  height: 50px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.02em;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
    font-weight: 400;
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 3px ${({ theme }) =>
      theme.mode === "dark" ? "rgba(99, 102, 241, 0.25)" : "rgba(79, 70, 229, 0.1)"};
    background: ${({ theme }) => theme.colors.card};
  }

  &:disabled {
    opacity: 0.6;
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
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    accent-color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
  }
`;

const LoginBtn = styled.button`
  width: 100%;
  height: 50px;
  margin-top: 4px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryWeak};
  }

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FindAccountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 6px;
`;

const FindAccountLink = styled.button`
  border: none;
  background: none;
  padding: 4px 0;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
  cursor: pointer;
  letter-spacing: -0.02em;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FindAccountDivider = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.border};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(11, 18, 32, 0.85)" : "rgba(255, 255, 255, 0.85)"};
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const OverlayInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const OverlayText = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MiniSpinner = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99, 102, 241, 0.20)" : "rgba(79, 70, 229, 0.15)"};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`;
