/* eslint-disable */
// src/pages/auth/KakaoCallbackPage.jsx
// 카카오 웹 로그인 콜백 — Redirect URI(/oauth/kakao)
// ?code 받아 → kakaoCustomToken 함수 → Firebase 커스텀 토큰 로그인 → /home
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeWebKakaoLogin } from "../../services/authService";
import { completeOwnerWebKakaoLogin, LS_OWNER_KAKAO_FLOW } from "../../services/ownerAuthService";

export default function KakaoCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    const code = params.get("code");
    const kakaoError = params.get("error");

    if (kakaoError) {
      setError("카카오 로그인이 취소되었어요.");
      return;
    }
    if (!code) {
      setError("카카오 인증 코드를 받지 못했어요.");
      return;
    }

    (async () => {
      try {
        // 구장주 카카오 로그인 흐름이면 ownerAuth로 로그인 후 /owner 로
        let ownerFlow = false;
        try { ownerFlow = localStorage.getItem(LS_OWNER_KAKAO_FLOW) === "1"; } catch {}

        // 커스텀 토큰 발급이 도는 동안 도착지 청크를 병렬로 받아둔다.
        // 실패해도 무시 — 라우팅 시 Suspense가 다시 받는다.
        if (ownerFlow) {
          import("../../layouts/OwnerLayout").catch(() => {});
          import("../owner/OwnerEntry").catch(() => {});
        } else {
          import("../home/HomePage").catch(() => {});
        }

        if (ownerFlow) {
          const res = await completeOwnerWebKakaoLogin(code);
          if (res?.success) {
            navigate("/owner", { replace: true });
          } else {
            console.error("[KakaoCallback owner] 실패:", res);
            setError("카카오 로그인에 실패했어요. 다시 시도해 주세요.");
          }
          return;
        }

        const res = await completeWebKakaoLogin(code);
        if (res?.success) {
          navigate("/home", { replace: true });
        } else {
          console.error("[KakaoCallback] 실패:", res);
          setError("카카오 로그인에 실패했어요. 다시 시도해 주세요.");
        }
      } catch (e) {
        // setPersistence/토큰 발급 등에서 throw 시 영구 스피너 방지
        console.error("[KakaoCallback] error:", e?.message || e);
        setError("카카오 로그인에 실패했어요. 다시 시도해 주세요.");
      }
    })();
  }, [params, navigate]);

  return (
    <Wrap>
      {error ? (
        <>
          <ErrText>{error}</ErrText>
          <RetryBtn type="button" onClick={() => navigate("/login", { replace: true })}>
            로그인으로 돌아가기
          </RetryBtn>
        </>
      ) : (
        <>
          <Spinner />
          <Msg>카카오 로그인 중…</Msg>
        </>
      )}
    </Wrap>
  );
}

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
  justify-content: center;
  gap: 16px;
  padding: 24px;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99, 102, 241, 0.2)" : "rgba(79, 70, 229, 0.15)"};
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`;

const Msg = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ErrText = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
`;

const RetryBtn = styled.button`
  height: 46px;
  padding: 0 22px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;
