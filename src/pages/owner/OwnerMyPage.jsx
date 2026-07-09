/* eslint-disable */
// src/pages/owner/OwnerMyPage.jsx
// 내정보 — 계정 정보 + 고객지원 + 약관/정책 + 로그아웃
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import { Page, Card, SectionTitle, SectionDesc, GhostBtn, PrimaryBtn, Badge } from "./components/ownerUi";

// 스토어 배포 버전과 함께 올린다.
const APP_VERSION = "1.0.0";

const ProfRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;
const Avatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
`;
const Info = styled.div`display: flex; flex-direction: column; gap: 4px;`;
const Name = styled.div`
  font-size: 16px; font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const Email = styled.div`
  font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};
`;
const MenuItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  padding: 4px 0;
  & b { color: ${({ theme }) => theme.colors.textStrong}; font-weight: 600; }
`;
const Logout = styled.button`
  width: 100%;
  height: 48px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.danger};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;
const NavRow = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 14px;
  cursor: pointer;
  padding: 12px 2px;
  & + & { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
  &:active { opacity: 0.7; }
  & > span { color: ${({ theme }) => theme.colors.textWeak}; }
`;
const VersionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  padding: 12px 2px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  & > span { color: ${({ theme }) => theme.colors.textWeak}; }
`;
const WithdrawRow = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.danger};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  padding: 14px 2px 4px;
  margin-top: 4px;
  &:active { opacity: 0.7; }
  & > span { color: ${({ theme }) => theme.colors.textWeak}; font-weight: 400; }
`;

export default function OwnerMyPage() {
  const navigate = useNavigate();
  const { userDoc, firebaseUser, signOut, venue } = useOwner();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    if (!await showConfirm("로그아웃 하시겠어요?")) return;
    setBusy(true);
    try {
      await signOut();
    } catch (e) {}
    navigate("/owner/login", { replace: true });
  };

  const name = userDoc?.nickname || venue?.ownerName || "사장님";
  const email = userDoc?.email || firebaseUser?.email || "";

  return (
    <Page>
      <Card>
        <ProfRow>
          <Avatar>🧑‍💼</Avatar>
          <Info>
            <Name>{name}</Name>
            {email && <Email>{email}</Email>}
          </Info>
        </ProfRow>
      </Card>

      {!venue && (
        <Card>
          <SectionTitle>내 구장</SectionTitle>
          <SectionDesc>아직 등록한 구장이 없어요. 구장을 등록하면 예약을 받을 수 있어요.</SectionDesc>
          <PrimaryBtn type="button" onClick={() => navigate("/owner/onboarding")}>구장 등록하기</PrimaryBtn>
        </Card>
      )}

      {venue && (
        <Card>
          <SectionTitle>내 구장</SectionTitle>
          <MenuItem><span>구장명</span><b>{venue.name}</b></MenuItem>
          <MenuItem><span>코트 수</span><b>{venue.courts?.length || 0}개</b></MenuItem>
          <MenuItem>
            <span>심사 상태</span>
            <Badge $tone={venue.status}>
              {venue.status === "approved" ? "승인됨" : venue.status === "pending" ? "심사중" : "반려"}
            </Badge>
          </MenuItem>
          <GhostBtn type="button" onClick={() => navigate("/owner/venue")}>구장 정보 관리</GhostBtn>
        </Card>
      )}

      <Card>
        <SectionTitle>고객지원</SectionTitle>
        <NavRow type="button" onClick={() => navigate("/owner/inquiry")}>
          1:1 문의 <span>›</span>
        </NavRow>
      </Card>

      <Card>
        <SectionTitle>약관 및 정책</SectionTitle>
        <NavRow type="button" onClick={() => navigate("/owner/terms")}>
          구장 관리자 이용약관 <span>›</span>
        </NavRow>
        <NavRow type="button" onClick={() => navigate("/owner/privacy")}>
          개인정보처리방침 <span>›</span>
        </NavRow>
        <VersionRow>
          앱 버전 <span>{APP_VERSION}</span>
        </VersionRow>
      </Card>

      <Card>
        <SectionTitle>계정</SectionTitle>
        <Logout type="button" onClick={handleLogout} disabled={busy}>로그아웃</Logout>
        <WithdrawRow type="button" onClick={() => navigate("/owner/withdraw")}>
          회원탈퇴 <span>›</span>
        </WithdrawRow>
      </Card>
    </Page>
  );
}
