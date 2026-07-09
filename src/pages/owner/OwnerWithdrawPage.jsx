/* eslint-disable */
// src/pages/owner/OwnerWithdrawPage.jsx
// 구장주 회원탈퇴 — 계정·오너 데이터 영구 삭제 (복구 불가).
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { showAlert, showConfirm } from "../../utils/appDialog";
import { useOwner } from "../../context/OwnerContext";
import { withdrawOwnerAccount } from "../../services/ownerWithdrawService";
import { Page, Card, SectionTitle, Input, Field, Label } from "./components/ownerUi";

const Notice = styled.div`
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
`;
const Bullet = styled.ul`
  margin: 6px 0 0 0;
  padding-left: 18px;
  & > li { margin: 2px 0; }
`;
const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const Actions = styled.div`
  display: flex;
  gap: 8px;
`;
const CancelBtn = styled.button`
  flex: 1;
  height: 50px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;
const DangerBtn = styled.button`
  flex: 1;
  height: 50px;
  border-radius: 12px;
  border: 0;
  background: #dc2626;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CONFIRM_TEXT = "탈퇴합니다";

export default function OwnerWithdrawPage() {
  const navigate = useNavigate();
  const { venue } = useOwner();
  const [agree, setAgree] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = agree && confirmInput.trim() === CONFIRM_TEXT && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!(await showConfirm("정말 탈퇴하시겠습니까?\n계정과 등록한 구장·예약 내역은 영구 삭제되며 복구할 수 없습니다."))) return;
    setBusy(true);
    try {
      await withdrawOwnerAccount();
      showAlert("회원탈퇴가 완료되었습니다.\n그동안 이용해주셔서 감사합니다.");
      navigate("/owner/login", { replace: true });
    } catch (e) {
      const code = String(e?.code || "");
      if (code === "auth/requires-recent-login") {
        showAlert("보안을 위해 다시 로그인이 필요합니다.\n로그아웃 후 다시 로그인하시고 탈퇴를 진행해주세요.");
      } else {
        showAlert(e?.message || "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      setBusy(false);
    }
  };

  return (
    <Page>
      <Card>
        <SectionTitle>회원탈퇴</SectionTitle>
        <Notice>
          탈퇴 시 <b>계정과 아래 데이터가 영구 삭제</b>됩니다 (복구 불가).
          <Bullet>
            <li>구장 관리자 계정(로그인 정보)</li>
            <li>등록한 구장 정보{venue?.name ? ` (${venue.name})` : ""}·코트</li>
            <li>모든 예약 내역 (승인대기·확정 예약 포함)</li>
            <li>막아둔 시간, 정산 계좌 등 구장 설정</li>
          </Bullet>
          <div style={{ marginTop: 10, fontSize: 12, color: "#7f1d1d" }}>
            ※ 승인대기·확정된 예약이 남아있다면 먼저 예약자에게 안내한 뒤 탈퇴해주세요. 탈퇴 시 예약도 함께 삭제됩니다.
          </div>
        </Notice>
      </Card>

      <Card>
        <Check>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          위 내용을 확인했으며, 회원탈퇴에 동의합니다.
        </Check>
        <Field>
          <Label>
            확인을 위해 아래에 "{CONFIRM_TEXT}"를 입력해주세요.
          </Label>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={CONFIRM_TEXT}
            disabled={busy}
          />
        </Field>
        <Actions>
          <CancelBtn type="button" onClick={() => navigate(-1)} disabled={busy}>
            취소
          </CancelBtn>
          <DangerBtn type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? "탈퇴 처리중…" : "회원탈퇴"}
          </DangerBtn>
        </Actions>
      </Card>
    </Page>
  );
}
