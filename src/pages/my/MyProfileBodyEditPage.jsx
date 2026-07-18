/* eslint-disable */
// src/pages/my/MyProfileBodyEditPage.jsx
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { showAlert } from "../../utils/appDialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";

const HEIGHT_OPTIONS = Array.from({ length: 61 }).map((_, idx) => 150 + idx);
const WEIGHT_OPTIONS = Array.from({ length: 56 }).map((_, idx) => 45 + idx);

// 출생연도: 만 14세 이상만 가입 가능(약관 제8조)하므로 상한을 올해-14 로 둔다.
// 최근 연도가 위로 오도록 내림차순.
const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEAR_MAX = CURRENT_YEAR - 14;
const BIRTH_YEAR_MIN = CURRENT_YEAR - 80;
const BIRTH_YEAR_OPTIONS = Array.from({ length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 }).map(
  (_, idx) => BIRTH_YEAR_MAX - idx
);

export default function MyProfileBodyEditPage() {
  const nav = useNavigate();
  const { userDoc, loading, refreshUser } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [didInit, setDidInit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!uid || loading || didInit) return;
    setHeightCm(
      userDoc?.heightCm === 0 || userDoc?.heightCm ? String(userDoc.heightCm) : ""
    );
    setWeightKg(
      userDoc?.weightKg === 0 || userDoc?.weightKg ? String(userDoc.weightKg) : ""
    );
    setBirthYear(userDoc?.birthYear ? String(userDoc.birthYear) : "");
    setDidInit(true);
  }, [uid, loading, didInit, userDoc]);

  const handleSave = async () => {
    if (!uid || isSaving) return;
    setIsSaving(true);
    try {
      await updateUserProfile({
        uid,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        birthYear: birthYear ? Number(birthYear) : null,
      });
      try { await refreshUser?.(); } catch (e) {}
      nav(-1);
    } catch (e) {
      showAlert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Page>
      <Card>
        <Header>
          <BackBtn type="button" onClick={() => nav(-1)} aria-label="뒤로">‹</BackBtn>
          <Title>키 · 몸무게 · 출생연도</Title>
        </Header>

        <FieldGroup>
          <Label>키</Label>
          <Select value={heightCm || ""} onChange={(e) => setHeightCm(e.target.value)}>
            <option value="">선택 안 함</option>
            {HEIGHT_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}cm
              </option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label>몸무게</Label>
          <Select value={weightKg || ""} onChange={(e) => setWeightKg(e.target.value)}>
            <option value="">선택 안 함</option>
            {WEIGHT_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}kg
              </option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label>출생연도</Label>
          <Select value={birthYear || ""} onChange={(e) => setBirthYear(e.target.value)}>
            <option value="">선택 안 함</option>
            {BIRTH_YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </Select>
          <FieldHint>능력치 계산과 프로필 나이 표시에 쓰여요. 다른 이용자에게는 나이로만 보여요.</FieldHint>
        </FieldGroup>

        <ActionsRow>
          <GhostButton type="button" onClick={() => nav(-1)}>취소</GhostButton>
          <PrimaryButton type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </PrimaryButton>
        </ActionsRow>
      </Card>
    </Page>
  );
}

const Page = styled.div`
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.card};
  padding: calc(16px + env(safe-area-inset-top)) 14px calc(32px + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 480px;
  padding-left: 8px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Header = styled.div`
  margin-left: -8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BackBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Select = styled.select`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 11px 12px;
  font-size: 13px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors.textStrong};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }
`;

const FieldHint = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ActionsRow = styled.div`
  margin-top: 8px;
  display: flex;
  gap: 10px;
`;

const GhostButton = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
`;

const PrimaryButton = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;
