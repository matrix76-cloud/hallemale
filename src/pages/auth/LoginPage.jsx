// src/pages/auth/LoginPage.jsx
/* eslint-disable */
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import BrandHeader from "../../components/auth/BrandHeader";

/**
 * 피그마 구조
 * 1) 상단 BrandHeader (로고)
 * 2) 섹션 타이틀 "로그인" + 구분선
 * 3) 아이디 / 비밀번호 인풋
 * 4) 체크박스 2개 (로그인 유지 / 아이디 저장)
 * 5) 로그인 버튼
 * 6) 아이디 찾기 | 비밀번호 찾기
 * 7) (하단 구글/아이디 버튼은 제거 – 형 피그마 코멘트 반영)
 * 8) Dev용(?) 텍스트 버튼은 회원가입 진입용으로 사용
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
  margin: 0 0 12px;
  font-size: ${({ theme }) => theme.fontSizes.title}px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
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

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginAsMock } = useAuth();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [keepLogin, setKeepLogin] = useState(false);
  const [saveId, setSaveId] = useState(false);

  // ✅ 로그인 버튼: 로그인 처리 후 "홈"으로 이동
  const handleSubmit = async (e) => {
    e.preventDefault();

    // TODO: 실제 로그인 API 연동 시 여기 교체
    await loginAsMock();
    navigate("/home", { replace: true }); // 홈 라우트가 다르면 여기만 바꿔줘
  };

  // ✅ 회원가입 텍스트 버튼: 로그인 없이 "회원가입"으로 이동
  const handleGoSignup = () => {
    navigate("/signup");
  };

  const handleHelpClick = (type) => {
    // TODO: 아이디/비밀번호 찾기 라우트 생기면 여기 연결
    window.alert(`${type} 기능은 준비 중입니다.`);
  };

  return (
    <Wrap>
      <HeaderTop>
        <BrandHeader />
      </HeaderTop>

      <SectionTitle>로그인</SectionTitle>
      <SectionDivider />

      <Form onSubmit={handleSubmit}>
        <Field>
          <Label htmlFor="login-id">아이디</Label>
          <Input
            id="login-id"
            type="text"
            placeholder="아이디를 입력하세요"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
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
          />
        </Field>

        <CheckboxRow>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={keepLogin}
              onChange={(e) => setKeepLogin(e.target.checked)}
            />
            로그인 유지
          </CheckboxLabel>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={saveId}
              onChange={(e) => setSaveId(e.target.checked)}
            />
            아이디 저장
          </CheckboxLabel>
        </CheckboxRow>

        <PrimaryButtonWrap>
          <Button fullWidth type="submit">
            로그인
          </Button>
        </PrimaryButtonWrap>

        <HelperLinks>
          <LinkText type="button" onClick={() => handleHelpClick("아이디 찾기")}>
            아이디 찾기
          </LinkText>
          <span>|</span>
          <LinkText
            type="button"
            onClick={() => handleHelpClick("비밀번호 찾기")}
          >
            비밀번호 찾기
          </LinkText>
        </HelperLinks>
      </Form>

      <DevLoginWrap>
        <DevLoginButton type="button" onClick={handleGoSignup}>
          처음이신가여? 회원가입 해주세여
        </DevLoginButton>
      </DevLoginWrap>
    </Wrap>
  );
}
