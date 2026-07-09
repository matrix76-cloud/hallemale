/* eslint-disable */
// src/pages/owner/OwnerWithdrawPage.jsx
// 구장주 자격 해지("회원탈퇴") — 오너 데이터 영구 삭제. 계정(로그인)은 유지.
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { showAlert, showConfirm } from "../../utils/appDialog";
import { useOwner } from "../../context/OwnerContext";
import { resignOwner } from "../../services/ownerWithdrawService";
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

const CONFIRM_TEXT = "해지합니다";

export default function OwnerWithdrawPage() {
  const navigate = useNavigate();
  const { venue } = useOwner();
  const [agree, setAgree] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = agree && confirmInput.trim() === CONFIRM_TEXT && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!(await showConfirm("정말 구장주 자격을 해지하시겠습니까?\n등록한 구장과 예약 내역은 영구 삭제되며 복구할 수 없습니다."))) return;
    setBusy(true);
    try {
      await resignOwner();
      showAlert("구장주 자격 해지가 완료되었습니다.\n그동안 이용해주셔서 감사합니다.");
      navigate("/owner/login", { replace: true });
    } catch (e) {
      showAlert(e?.message || "해지 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  return (
    <Page>
      <Card>
        <SectionTitle>구장주 자격 해지</SectionTitle>
        <Notice>
          해지 시 아래 데이터가 <b>영구 삭제</b>됩니다 (복구 불가).
          <Bullet>
            <li>등록한 구장 정보{venue?.name ? ` (${venue.name})` : ""}·코트</li>
            <li>모든 예약 내역 (승인대기·확정 예약 포함)</li>
            <li>막아둔 시간, 정산 계좌 등 구장 설정</li>
          </Bullet>
          <div style={{ marginTop: 10, fontSize: 12, color: "#7f1d1d" }}>
            ※ 승인대기·확정된 예약이 남아있다면 먼저 예약자에게 안내한 뒤 해지해주세요. 해지 시 예약도 함께 삭제됩니다.
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#7f1d1d" }}>
            ※ 로그인 계정 자체는 삭제되지 않습니다. 같은 계정의 선수(사용자) 앱 이용에는 영향이 없습니다.
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
          위 내용을 확인했으며, 구장주 자격 해지에 동의합니다.
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
            {busy ? "해지 처리중…" : "구장주 해지"}
          </DangerBtn>
        </Actions>
      </Card>
    </Page>
  );
}
