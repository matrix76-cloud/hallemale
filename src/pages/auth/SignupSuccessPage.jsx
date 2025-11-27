// src/pages/auth/SignupSuccessPage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import BrandHeader from "../../components/auth/BrandHeader";
import Button from "../../components/common/Button";
import { images } from "../../utils/imageAssets"; // ✅ 여기서 이미지 경로만 맞춰주면 됨

/**
 * Figma: 회원가입 완료 화면
 * - 상단: BrandHeader (로고)
 * - 중앙: 일러스트 이미지
 * - 그 아래: "회원가입 완료!" 텍스트
 * - 하단: 파란색 풀 너비 로그인 버튼
 */

const Wrap = styled.div`
  min-height: 100vh;
  padding: 32px 24px 32px;
  display: flex;
  flex-direction: column;
`;

const HeaderTop = styled.div`
  margin-bottom: 40px;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Illustration = styled.img`
  width: 210px;
  height: auto;
  display: block;
  margin-top: 32px;
`;

const Title = styled.h2`
  margin: 32px 0 0;
  font-size: ${({ theme }) => theme.fontSizes.titleXl || 28}px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Bottom = styled.div`
  margin-top: 32px;
`;

export default function SignupSuccessPage() {
  const navigate = useNavigate();

  const handleGoLogin = () => {
    navigate("/login", { replace: true });
  };

  return (
    <Wrap>
      <HeaderTop>
        <BrandHeader />
      </HeaderTop>

      <Content>
        {/* ✅ 여기 이미지 경로만 imageAssets에서 맞춰주면 됨 */}
        <Illustration
          src={images.signupSuccess}
          alt="회원가입 완료 일러스트"
        />
        <Title>회원가입 완료!</Title>
      </Content>

      <Bottom>
        <Button fullWidth onClick={handleGoLogin}>
          로그인
        </Button>
      </Bottom>
    </Wrap>
  );
}
