// src/components/auth/WelcomeButtonGroup.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import Button from "../common/Button";
import { useNavigate } from "react-router-dom";
import { useUI } from "../../hooks/useUI";

const Wrap = styled.section`
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const GoogleButton = styled.button`
  width: 100%;
  padding: 12px 16px;
  border-radius: 999px;
  border: 1px solid #d9d9d9;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
`;

const GoogleIcon = styled.span`
  font-size: 16px;
`;

export default function WelcomeButtonGroup() {
  const navigate = useNavigate();
  const { showToast } = useUI();

  const onGoogleClick = () => {
    showToast({
      type: "info",
      message: "구글 로그인은 나중에 연결할게요 😊",
    });
  };

  const onIdLoginClick = () => {
    navigate("/login");
  };

  return (
    <Wrap>
      <GoogleButton onClick={onGoogleClick}>
        <GoogleIcon>G</GoogleIcon>
        <span>구글로 시작하기</span>
      </GoogleButton>
      <Button fullWidth onClick={onIdLoginClick}>
        아이디로 로그인
      </Button>
    </Wrap>
  );
}
