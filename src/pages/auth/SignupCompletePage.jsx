/* eslint-disable */
// src/pages/auth/SignupCompletePage.jsx
// 전화번호 인증까지 마친 신규 가입자에게 최초 1회 노출되는 "회원가입 완료" 화면.
// "시작하기"를 누르면 welcomeSeen 플래그를 저장 → 상위 RequireWelcome 게이트 통과 → 홈 진입.
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { markWelcomeSeen } from "../../services/userService";
import { images } from "../../utils/imageAssets";
import { showAlert } from "../../utils/appDialog";
import { track } from "../../utils/analytics";

export default function SignupCompletePage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, refreshUser } = useAuth();
  // ⚠️ 전화인증에서 같은 번호의 기존 계정과 병합되면 게이트가 읽는 문서는 userDoc.id(병합된 실제 문서)다.
  //    firebaseUser.uid(소셜 uid)에 쓰면 엉뚱한 문서에 저장돼 완료 화면이 안 넘어간다.
  const uid = userDoc?.id || userDoc?.uid || firebaseUser?.uid || "";
  const [busy, setBusy] = useState(false);

  const nickname = String(userDoc?.nickname || userDoc?.displayName || "").trim();

  const handleStart = async () => {
    if (busy) return;
    if (!uid) {
      showAlert("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await markWelcomeSeen({ uid });
      track("signup_complete"); // 온보딩 완료(활성화) — 핵심 퍼널
      await refreshUser();
      // refreshUser 후 welcomeSeen=true가 반영되면 상위 RequireWelcome가 통과시킨다.
      navigate("/home", { replace: true });
    } catch (e) {
      showAlert(e?.message || "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Inner>
        <Hero>
          <HeroImg
            src={images.welcomeHero}
            alt=""
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </Hero>

        <Badge>🎉</Badge>
        <Title>회원가입 완료!</Title>
        <Sub>
          {nickname ? `${nickname}님, ` : ""}할래말래 가입을 환영합니다.{"\n"}
          이제 팀을 만들고 매칭을 시작해 보세요.
        </Sub>

        <Spacer />

        <StartBtn type="button" disabled={busy} onClick={handleStart}>
          {busy ? "처리중…" : "시작하기"}
        </StartBtn>
      </Inner>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const Wrap = styled.div`
  height: 100dvh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  justify-content: center;
  padding: 0 16px calc(28px + env(safe-area-inset-bottom));
  overflow: hidden;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  padding-top: 72px;
`;

const Hero = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
`;

const HeroImg = styled.img`
  width: 200px;
  max-width: 60%;
  height: auto;
  object-fit: contain;
`;

const Badge = styled.div`
  font-size: 40px;
  line-height: 1;
  margin-bottom: 12px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
`;

const Sub = styled.p`
  margin: 12px 0 0;
  font-size: 14.5px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
  white-space: pre-line;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-height: 24px;
`;

const StartBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
  transition: transform 0.1s;

  &:active { transform: translateY(1px); }
  &:disabled { cursor: not-allowed; opacity: 0.7; }
`;
