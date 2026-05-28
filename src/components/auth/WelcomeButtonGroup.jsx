// src/components/auth/WelcomeButtonGroup.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import Button from "../common/Button";
import { useNavigate } from "react-router-dom";

const Wrap = styled.section`
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export default function WelcomeButtonGroup() {
  const navigate = useNavigate();

  const onIdLoginClick = () => {
    navigate("/login");
  };

  return (
    <Wrap>
      <Button fullWidth onClick={onIdLoginClick}>
        아이디로 로그인
      </Button>
    </Wrap>
  );
}
