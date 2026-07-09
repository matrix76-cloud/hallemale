/* eslint-disable */
// src/pages/owner/OwnerWithdrawPage.jsx
// 구장주 회원탈퇴 — 계정·오너 데이터 영구 삭제 (복구 불가).
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { showAlert, showConfirm } from "../../utils/appDialog";
import { useOwner } from "../../context/OwnerContext";
import { withdrawOwnerAccount, countActiveReservations } from "../../services/ownerWithdrawService";
import { Page, Card, SectionTitle, Input, Field, Label, PrimaryBtn } from "./components/ownerUi";

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

const Block = styled.div`
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  & b { font-weight: 700; }
`;

const CONFIRM_TEXT = "탈퇴합니다";

export default function OwnerWithdrawPage() {
  const navigate = useNavigate();
  const { venue } = useOwner();
  const [agree, setAgree] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  // 진입 시 잔여 예약 확인 — 있으면 탈퇴를 막는다
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const n = await countActiveReservations();
        if (alive) setActiveCount(n);
      } catch (e) {
        // 확인 실패 시 안전하게 탈퇴 막지 않음(제출 시 서버 가드가 재검증)
        if (alive) setActiveCount(0);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const blocked = activeCount > 0;
  const canSubmit = agree && confirmInput.trim() === CONFIRM_TEXT && !busy && !checking && !blocked;

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
      if (code === "active_reservations") {
        // 제출 직전 새 예약이 들어온 경우 — 카운트 갱신 후 안내
        try { setActiveCount(await countActiveReservations()); } catch {}
        showAlert(e?.message || "처리하지 않은 예약이 있어 탈퇴할 수 없습니다.");
      } else if (code === "auth/requires-recent-login") {
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

      {blocked ? (
        <Card>
          <Block>
            처리하지 않은 예약이 <b>{activeCount}건</b> 남아있어 탈퇴할 수 없어요.
            <div style={{ marginTop: 8 }}>
              예정된 예약을 <b>완료 처리</b>하거나 <b>취소·거절</b>한 뒤 다시 시도해주세요.
              (탈퇴 시 예약이 함께 삭제되어 예약자에게 피해가 갈 수 있어요.)
            </div>
          </Block>
          <PrimaryBtn type="button" onClick={() => navigate("/owner/home")}>
            예약 관리로 가기
          </PrimaryBtn>
          <CancelBtn type="button" onClick={() => navigate(-1)}>
            취소
          </CancelBtn>
        </Card>
      ) : (
        <Card>
          <Check>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              disabled={checking}
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
              disabled={busy || checking}
            />
          </Field>
          <Actions>
            <CancelBtn type="button" onClick={() => navigate(-1)} disabled={busy}>
              취소
            </CancelBtn>
            <DangerBtn type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {busy ? "탈퇴 처리중…" : checking ? "확인 중…" : "회원탈퇴"}
            </DangerBtn>
          </Actions>
        </Card>
      )}
    </Page>
  );
}
