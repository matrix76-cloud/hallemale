// src/pages/system/SplashPage.jsx
import React, { useEffect } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import Rive from "@rive-app/react-canvas";
import splashRiv from "../../assets/rive/splash.riv"; // 경로/이름만 맞게

// src/pages/system/SplashPage.jsx 중에서

const Wrap = styled.div`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  /* 리브 배경 톤이랑 맞춘 다크 그레이 */
  background: #333437;
`;

const FullRive = styled(Rive)`
  width: 100%;
  height: 100%;
  display: block;
`;

export default function SplashPage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();

  useEffect(() => {
    if (authLoading || clubLoading) return;

    const timer = setTimeout(() => {
      if (!isLoggedIn) {
        navigate("/welcome", { replace: true });
      } else if (!club) {
        navigate("/onboarding/club", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [authLoading, clubLoading, isLoggedIn, club, navigate]);

  return (
    <Wrap>
      <FullRive src={splashRiv} autoplay />
    </Wrap>
  );
}
