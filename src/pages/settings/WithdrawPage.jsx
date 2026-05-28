/* eslint-disable */
// src/pages/settings/WithdrawPage.jsx
// 회원탈퇴 — Apple App Store Guideline 5.1.1(v) 대응
// 영구 삭제 (비활성화 아님). 확인 단계 포함.
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { withdrawAccount } from "../../services/withdrawService";
import { useAuth } from "../../hooks/useAuth";

const Wrap = styled.div`
  padding: 16px 16px 32px;
  max-width: 720px;
  margin: 0 auto;
`;

const H2 = styled.h2`
  margin: 0 0 12px;
  font-size: 18px;
  color: #111827;
`;

const Notice = styled.div`
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  margin: 8px 0 16px;
`;

const Bullet = styled.ul`
  margin: 6px 0 0 0;
  padding-left: 18px;
  & > li {
    margin: 2px 0;
  }
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #111827;
  padding: 12px 0;
`;

const Field = styled.div`
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  outline: none;
  &:focus {
    border-color: #2563eb;
  }
`;

const Help = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 20px;
`;

const CancelBtn = styled.button`
  flex: 1;
  padding: 14px;
  font-size: 15px;
  font-weight: 600;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  border-radius: 10px;
  cursor: pointer;
`;

const DangerBtn = styled.button`
  flex: 1;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  border: 0;
  background: #dc2626;
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CONFIRM_TEXT = "탈퇴합니다";

export default function WithdrawPage() {
  const nav = useNavigate();
  const { userDoc } = useAuth();
  const [agree, setAgree] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = agree && confirmInput.trim() === CONFIRM_TEXT && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!window.confirm("정말 탈퇴하시겠습니까?\n계정과 데이터는 영구 삭제되며 복구할 수 없습니다.")) return;
    setBusy(true);
    try {
      await withdrawAccount();
      alert("회원탈퇴가 완료되었습니다.\n그동안 할래말래를 이용해주셔서 감사합니다.");
      // Auth 삭제되면 watchAuthState가 감지해서 자동 로그아웃 처리됨
      nav("/welcome", { replace: true });
    } catch (e) {
      const code = String(e?.code || "");
      if (code === "auth/requires-recent-login") {
        alert(
          "보안을 위해 다시 로그인이 필요합니다.\n로그아웃 후 다시 로그인하시고 탈퇴를 진행해주세요."
        );
      } else {
        alert(e?.message || "회원탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <H2>회원탈퇴</H2>

      <Notice>
        회원탈퇴 시 아래 데이터가 <b>영구 삭제</b>됩니다 (복구 불가).
        <Bullet>
          <li>계정 정보 (이메일, 닉네임, 프로필, 전화번호 연동)</li>
          <li>차단/숨김 목록, 알림 토큰</li>
          <li>로그인 인증 정보</li>
        </Bullet>
        <div style={{ marginTop: 10, fontSize: 12, color: "#7f1d1d" }}>
          ※ 작성하신 게시글/댓글은 익명 처리되어 남을 수 있으며, 영구 삭제를 원하시면 탈퇴 전에 직접 삭제해주세요.
        </div>
      </Notice>

      <Label>
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        위 내용을 확인했으며, 회원탈퇴에 동의합니다.
      </Label>

      <Field>
        <Help>
          확인을 위해 아래에 <b>"{CONFIRM_TEXT}"</b>를 입력해주세요.
        </Help>
        <Input
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder={CONFIRM_TEXT}
          disabled={busy}
        />
      </Field>

      <Actions>
        <CancelBtn type="button" onClick={() => nav(-1)} disabled={busy}>
          취소
        </CancelBtn>
        <DangerBtn type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {busy ? "탈퇴 처리중…" : "회원탈퇴"}
        </DangerBtn>
      </Actions>
    </Wrap>
  );
}
