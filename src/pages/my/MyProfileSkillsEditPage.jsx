/* eslint-disable */
// src/pages/my/MyProfileSkillsEditPage.jsx
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { showAlert } from "../../utils/appDialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";

const POSITION_OPTIONS = [
  { key: "guard", label: "가드" },
  { key: "forward", label: "포워드" },
  { key: "center", label: "센터" },
];

const SKILL_OPTIONS = [
  { key: "beginner", label: "입문" },
  { key: "amateur", label: "아마추어" },
  { key: "intermediate", label: "중급" },
  { key: "advanced", label: "상급" },
  { key: "pro", label: "프로" },
];

export default function MyProfileSkillsEditPage() {
  const nav = useNavigate();
  const { userDoc, loading, refreshUser } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [mainPosition, setMainPosition] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [didInit, setDidInit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!uid || loading || didInit) return;
    setMainPosition(userDoc?.mainPosition || "");
    setSkillLevel(userDoc?.skillLevel || "");
    setDidInit(true);
  }, [uid, loading, didInit, userDoc]);

  const handleSave = async () => {
    if (!uid || isSaving) return;
    setIsSaving(true);
    try {
      await updateUserProfile({
        uid,
        mainPosition: mainPosition || null,
        skillLevel: skillLevel || null,
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
          <Title>포지션 · 실력</Title>
        </Header>

        <FieldGroup>
          <Label>주 포지션</Label>
          <ChipRow>
            {POSITION_OPTIONS.map((opt) => (
              <Chip
                key={opt.key}
                type="button"
                $active={mainPosition === opt.key}
                onClick={() => setMainPosition(opt.key)}
              >
                {opt.label}
              </Chip>
            ))}
          </ChipRow>
        </FieldGroup>

        <FieldGroup>
          <Label>실력 수준</Label>
          <ChipRow>
            {SKILL_OPTIONS.map((opt) => (
              <Chip
                key={opt.key}
                type="button"
                $active={skillLevel === opt.key}
                onClick={() => setSkillLevel(opt.key)}
              >
                {opt.label}
              </Chip>
            ))}
          </ChipRow>
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

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.button`
  border-radius: 999px;
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.card};
  padding: 9px 14px;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme.colors.textNormal};
  cursor: pointer;
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
