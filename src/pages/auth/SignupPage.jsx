// src/pages/auth/SignupPage.jsx
/* eslint-disable */
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import BrandHeader from "../../components/auth/BrandHeader";
import { useAuth } from "../../hooks/useAuth";

/**
 * 피그마 구조 기반 회원가입 화면
 * - 상단 BrandHeader
 * - 섹션 타이틀 "회원가입" + 구분선
 * - 아이디 / 닉네임 / 비밀번호 / 비밀번호 확인
 *   (성별 필드는 형 요청으로 제거)
 * - 약관동의:
 *   - 전체 동의
 *   - 개인정보 수집·이용 동의
 *   - 서비스 약관 동의
 *   - 마케팅 정보 수신 동의
 * - 하단 "회원가입" 버튼
 * - 맨 아래 "이미 아이디가 있으신가요? 로그인"
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
  gap: 4px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RequiredMark = styled.span`
  color: #ff4b4b;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
`;

const Input = styled.input`
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border || "#e0e0e0"};
  padding: 8px 0;
  font-size: ${({ theme }) => theme.fontSizes.bodyLg}px;
  outline: none;

  &::placeholder {
    color: ${({ theme }) => theme.colors.muted || "#b3b3b3"};
  }

  &:focus {
    border-bottom-color: ${({ theme }) => theme.colors.primary};
  }
`;

const HelperText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.muted || "#999"};
`;

const TermsBlock = styled.div`
  margin-top: 8px;
  padding-top: 8px;

`;

const TermsTitle = styled.p`
  margin: 0 0 8px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TermsItem = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.text || "#333"};
  margin-bottom: 6px;

  input {
    width: 14px;
    height: 14px;
  }
`;

const TermsText = styled.span``;

const BadgeRequired = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.caption}px;
  color: ${({ theme }) => theme.colors.primary};
  margin-left: 4px;
`;

const BadgeOptional = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.caption}px;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  margin-left: 4px;
`;

const PrimaryButtonWrap = styled.div`
  margin-top: 24px;
`;

const BottomTextRow = styled.div`
  margin-top: 16px;
  font-size: ${({ theme }) => theme.fontSizes.small}px;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  display: flex;
  justify-content: center;
  gap: 4px;
`;

const LinkButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
`;

export default function SignupPage() {
  const navigate = useNavigate();
  const { loginAsMock } = useAuth(); // TODO: 실제 회원가입 API로 교체

  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [agreeAll, setAgreeAll] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false); // 개인정보
  const [agreeTerms, setAgreeTerms] = useState(false); // 서비스 약관
  const [agreeMarketing, setAgreeMarketing] = useState(false); // 마케팅 정보 수신

  const handleChangeAll = (checked) => {
    setAgreeAll(checked);
    setAgreePrivacy(checked);
    setAgreeTerms(checked);
    setAgreeMarketing(checked);
  };

  const handleToggleItem = (key, checked) => {
    if (key === "privacy") setAgreePrivacy(checked);
    if (key === "terms") setAgreeTerms(checked);
    if (key === "marketing") setAgreeMarketing(checked);

    const nextAll =
      (key === "privacy" ? checked : agreePrivacy) &&
      (key === "terms" ? checked : agreeTerms) &&
      (key === "marketing" ? checked : agreeMarketing);

    setAgreeAll(nextAll);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userId.trim() || !nickname.trim() || !password || !passwordConfirm) {
      window.alert("아이디, 닉네임, 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      window.alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    // 필수 약관: 개인정보, 서비스 약관
    if (!agreePrivacy || !agreeTerms) {
      window.alert("필수 약관에 모두 동의해주세요.");
      return;
    }

    // TODO: 실제 회원가입 API 연동
    await loginAsMock();

    // 가입 완료 후 홈으로 이동 (혹은 온보딩 경로)
    navigate("/sigunupsuccess", { replace: true });
  };

  const handleGoLogin = () => {
    navigate("/login");
  };

  return (
    <Wrap>
      <HeaderTop>
        <BrandHeader />
      </HeaderTop>

      <SectionTitle>회원가입</SectionTitle>
      <SectionDivider />

      <Form onSubmit={handleSubmit}>
        <Field>
          <LabelRow>
            <Label htmlFor="signup-id">아이디</Label>
            <RequiredMark>*</RequiredMark>
          </LabelRow>
          <Input
            id="signup-id"
            type="text"
            placeholder="아이디를 입력해주세요"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <HelperText>5~11자로 입력해주세요. (한글, 특수문자 사용불가)</HelperText>
        </Field>

        <Field>
          <LabelRow>
            <Label htmlFor="signup-nickname">닉네임</Label>
            <RequiredMark>*</RequiredMark>
          </LabelRow>
          <Input
            id="signup-nickname"
            type="text"
            placeholder="닉네임을 입력해주세요"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <HelperText>2~15자로 입력해주세요. 가입 후에도 수정 가능합니다.</HelperText>
        </Field>

        <Field>
          <LabelRow>
            <Label htmlFor="signup-pw">비밀번호</Label>
            <RequiredMark>*</RequiredMark>
          </LabelRow>
          <Input
            id="signup-pw"
            type="password"
            placeholder="비밀번호를 입력해주세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <HelperText>
            영문, 숫자, 특수문자 조합 최소 8자로 입력해주세요.
          </HelperText>
        </Field>

        <Field>
          <LabelRow>
            <Label htmlFor="signup-pw-confirm">비밀번호 확인</Label>
            <RequiredMark>*</RequiredMark>
          </LabelRow>
          <Input
            id="signup-pw-confirm"
            type="password"
            placeholder="비밀번호를 다시 입력해주세요"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        </Field>

        {/* 약관 동의 영역 */}
        <TermsBlock>
          <TermsTitle>약관동의</TermsTitle>

          <TermsItem>
            <input
              type="checkbox"
              checked={agreeAll}
              onChange={(e) => handleChangeAll(e.target.checked)}
            />
            <TermsText>전체 동의</TermsText>
          </TermsItem>

          <TermsItem>
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) =>
                handleToggleItem("privacy", e.target.checked)
              }
            />
            <TermsText>
              개인정보 수집·이용 동의
              <BadgeRequired>[필수]</BadgeRequired>
            </TermsText>
          </TermsItem>

          <TermsItem>
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => handleToggleItem("terms", e.target.checked)}
            />
            <TermsText>
              서비스 약관 동의
              <BadgeRequired>[필수]</BadgeRequired>
            </TermsText>
          </TermsItem>

          <TermsItem>
            <input
              type="checkbox"
              checked={agreeMarketing}
              onChange={(e) =>
                handleToggleItem("marketing", e.target.checked)
              }
            />
            <TermsText>
              마케팅 정보 수신 동의
              <BadgeOptional>[선택]</BadgeOptional>
            </TermsText>
          </TermsItem>
        </TermsBlock>

        <PrimaryButtonWrap>
          <Button fullWidth type="submit">
            회원가입
          </Button>
        </PrimaryButtonWrap>
      </Form>

      <BottomTextRow>
        <span>이미 아이디가 있으신가요?</span>
        <LinkButton type="button" onClick={handleGoLogin}>
          로그인
        </LinkButton>
      </BottomTextRow>
    </Wrap>
  );
}
