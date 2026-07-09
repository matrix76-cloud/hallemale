/* eslint-disable */
// src/pages/owner/OwnerAgreementGate.jsx
// 구장 관리자 최초 진입 시 1회 노출되는 동의 게이트.
// 필수: 만 14세 이상 / 구장 관리자 이용약관 / 개인정보처리방침. 선택: 마케팅 수신.
// 동의 내역은 users 문서(owner* 필드)에 기록된다.
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { showAlert } from "../../utils/appDialog";
import { useOwner } from "../../context/OwnerContext";
import { saveOwnerConsents } from "../../services/userService";
import { C } from "./components/od";

export default function OwnerAgreementGate() {
  const navigate = useNavigate();
  const { uid, refresh, signOut } = useOwner();

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
      await saveOwnerConsents({ uid, ownerTerms: terms, privacy, ageOver14: age, marketing });
      await refresh();
      // refresh 후 userDoc이 갱신되면 상위 게이트가 통과시켜 워크스페이스로 진입한다.
    } catch (e) {
      showAlert(e?.message || "동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
    navigate("/owner/login", { replace: true });
  };

  return (
    <Wrap>
      <Inner>
        <Hero>
          <Logo>🏟️</Logo>
          <Title>서비스 이용 동의</Title>
          <Sub>구장 관리자 서비스 이용을 위해 아래 약관에 동의해 주세요.</Sub>
        </Hero>

        <AllRow $on={allChecked} onClick={toggleAll} role="button" tabIndex={0}>
          <Check $on={allChecked}>{allChecked ? "✓" : ""}</Check>
          <AllText>전체 동의 (선택 항목 포함)</AllText>
        </AllRow>

        <Divider />

        <Item>
          <CheckArea onClick={() => setAge((v) => !v)} role="button" tabIndex={0}>
            <Check $on={age}>{age ? "✓" : ""}</Check>
            <ItemText><ReqTag>[필수]</ReqTag> 만 14세 이상입니다.</ItemText>
          </CheckArea>
        </Item>

        <Item>
          <CheckArea onClick={() => setTerms((v) => !v)} role="button" tabIndex={0}>
            <Check $on={terms}>{terms ? "✓" : ""}</Check>
            <ItemText><ReqTag>[필수]</ReqTag> 구장 관리자 이용약관에 동의</ItemText>
          </CheckArea>
          <ViewBtn type="button" onClick={() => navigate("/owner/terms")}>보기</ViewBtn>
        </Item>

        <Item>
          <CheckArea onClick={() => setPrivacy((v) => !v)} role="button" tabIndex={0}>
            <Check $on={privacy}>{privacy ? "✓" : ""}</Check>
            <ItemText><ReqTag>[필수]</ReqTag> 개인정보처리방침에 동의</ItemText>
          </CheckArea>
          <ViewBtn type="button" onClick={() => navigate("/owner/privacy")}>보기</ViewBtn>
        </Item>

        <Item>
          <CheckArea onClick={() => setMarketing((v) => !v)} role="button" tabIndex={0}>
            <Check $on={marketing}>{marketing ? "✓" : ""}</Check>
            <ItemText><OptTag>[선택]</OptTag> 마케팅 정보 수신에 동의</ItemText>
          </CheckArea>
        </Item>

        <Spacer />

        <SubmitBtn type="button" $on={requiredOk} disabled={!requiredOk || busy} onClick={handleSubmit}>
          {busy ? "처리중…" : "동의하고 시작하기"}
        </SubmitBtn>

        <SignOutBtn type="button" onClick={handleSignOut} disabled={busy}>
          동의하지 않고 로그아웃
        </SignOutBtn>
      </Inner>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${C.white};
  display: flex;
  justify-content: center;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
`;

const Inner = styled.div`
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  padding-top: 48px;
`;

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 28px;
`;

const Logo = styled.div`font-size: 56px; line-height: 1; margin-bottom: 6px;`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: ${C.slate800};
`;

const Sub = styled.p`
  margin: 0;
  font-size: 13.5px;
  color: ${C.slate500};
  text-align: center;
`;

const AllRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid ${({ $on }) => ($on ? C.violet600 : C.slate200)};
  background: ${({ $on }) => ($on ? C.violet50 : C.white)};
  &:active { transform: translateY(1px); }
`;

const AllText = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${C.slate800};
`;

const Divider = styled.div`
  height: 1px;
  background: ${C.slate200};
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
  color: #fff;
  border: 1.5px solid ${({ $on }) => ($on ? C.violet600 : C.slate200)};
  background: ${({ $on }) => ($on ? C.violet600 : C.white)};
`;

const ItemText = styled.span`
  font-size: 14px;
  color: ${C.slate800};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ReqTag = styled.span`font-weight: 700; color: ${C.violet600};`;
const OptTag = styled.span`font-weight: 700; color: ${C.slate400};`;

const ViewBtn = styled.button`
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-size: 12.5px;
  color: ${C.slate500};
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  padding: 4px 2px;
`;

const Spacer = styled.div`flex: 1 1 auto; min-height: 24px;`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
  background: ${({ $on }) => ($on ? C.violet600 : C.slate400)};
  transition: background 0.15s, transform 0.1s;
  &:active { transform: translateY(1px); }
  &:disabled { cursor: not-allowed; }
`;

const SignOutBtn = styled.button`
  width: 100%;
  margin-top: 10px;
  background: none;
  border: none;
  font-size: 12.5px;
  color: ${C.slate400};
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  padding: 6px 0;
`;
