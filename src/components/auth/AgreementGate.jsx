/* eslint-disable */
// src/components/auth/AgreementGate.jsx
// 최초 로그인 후 1회 노출되는 약관·개인정보·연령(만 14세 이상) 동의 게이트.
// 필수 3항목에 동의해야 서비스 진입이 가능하며, 동의 내역은 users 문서에 기록된다.
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { saveUserConsents } from "../../services/userService";
import { images } from "../../utils/imageAssets";

export default function AgreementGate() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, refreshUser } = useAuth();
  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);

  const allChecked = age && terms && privacy && marketing;
  const requiredOk = age && terms && privacy;

  const toggleAll = () => {
    const next = !allChecked;
    setAge(next);
    setTerms(next);
    setPrivacy(next);
    setMarketing(next);
  };

  const handleSubmit = async () => {
    if (!requiredOk || busy) return;
    if (!uid) {
      showAlert("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await saveUserConsents({ uid, terms, privacy, ageOver14: age, marketing });
      await refreshUser();
      // refreshUser 후 userDoc이 갱신되면 상위 RequireConsent가 통과시켜 서비스로 진입한다.
    } catch (e) {
      showAlert(e?.message || "동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Inner>
        <Hero>
          <Logo
            src={images.logo}
            alt="할래말래"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <Title>서비스 이용 동의</Title>
          <Sub>할래말래 이용을 위해 아래 약관에 동의해 주세요.</Sub>
        </Hero>

        <AllRow $on={allChecked} onClick={toggleAll} role="button" tabIndex={0}>
          <Check $on={allChecked}>{allChecked ? "✓" : ""}</Check>
          <AllText>전체 동의 (선택 항목 포함)</AllText>
        </AllRow>

        <Divider />

        <Item>
          <CheckArea onClick={() => setAge((v) => !v)} role="button" tabIndex={0}>
            <Check $on={age}>{age ? "✓" : ""}</Check>
            <ItemText>
              <ReqTag>[필수]</ReqTag> 만 14세 이상입니다.
            </ItemText>
          </CheckArea>
        </Item>

        <Item>
          <CheckArea onClick={() => setTerms((v) => !v)} role="button" tabIndex={0}>
            <Check $on={terms}>{terms ? "✓" : ""}</Check>
            <ItemText>
              <ReqTag>[필수]</ReqTag> 서비스 이용약관에 동의
            </ItemText>
          </CheckArea>
          <ViewBtn type="button" onClick={() => navigate("/terms")}>보기</ViewBtn>
        </Item>

        <Item>
          <CheckArea onClick={() => setPrivacy((v) => !v)} role="button" tabIndex={0}>
            <Check $on={privacy}>{privacy ? "✓" : ""}</Check>
            <ItemText>
              <ReqTag>[필수]</ReqTag> 개인정보처리방침에 동의
            </ItemText>
          </CheckArea>
          <ViewBtn type="button" onClick={() => navigate("/privacy")}>보기</ViewBtn>
        </Item>

        <Item>
          <CheckArea onClick={() => setMarketing((v) => !v)} role="button" tabIndex={0}>
            <Check $on={marketing}>{marketing ? "✓" : ""}</Check>
            <ItemText>
              <OptTag>[선택]</OptTag> 마케팅 정보 수신에 동의
            </ItemText>
          </CheckArea>
        </Item>

        <Spacer />

        <SubmitBtn type="button" $on={requiredOk} disabled={!requiredOk || busy} onClick={handleSubmit}>
          {busy ? "처리중…" : "동의하고 시작하기"}
        </SubmitBtn>
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
  max-width: 460px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: 56px;
`;

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 28px;
`;

const Logo = styled.img`
  width: 76px;
  height: 76px;
  object-fit: contain;
  margin-bottom: 6px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.p`
  margin: 0;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const AllRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid
    ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) =>
    $on
      ? theme.mode === "dark"
        ? "rgba(124,92,255,0.16)"
        : "#eef2ff"
      : theme.colors.card};

  &:active { transform: translateY(1px); }
`;

const AllText = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
  margin: 16px 4px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 4px;
`;

const CheckArea = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
  min-width: 0;

  &:active { transform: translateY(1px); }
`;

const Check = styled.span`
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #ffffff;
  border: 1.5px solid
    ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) =>
    $on ? theme.colors.primary : theme.colors.card};
`;

const ItemText = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ReqTag = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const OptTag = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ViewBtn = styled.button`
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  padding: 4px 2px;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-height: 24px;
`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  color: #ffffff;
  background: ${({ $on, theme }) =>
    $on ? theme.colors.primary : theme.mode === "dark" ? theme.colors.surface : "#c7cbd1"};
  transition: background 0.15s, transform 0.1s;

  &:active { transform: translateY(1px); }
  &:disabled { cursor: not-allowed; }
`;
