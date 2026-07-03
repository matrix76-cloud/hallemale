/* eslint-disable */
// src/pages/my/MyProfileIntroEditPage.jsx
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { showAlert } from "../../utils/appDialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";

export default function MyProfileIntroEditPage() {
  const nav = useNavigate();
  const { userDoc, loading, refreshUser } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [intro, setIntro] = useState("");
  const [careers, setCareers] = useState([]);
  const [careerInput, setCareerInput] = useState("");
  const [didInit, setDidInit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!uid || loading || didInit) return;
    setIntro(userDoc?.intro || "");
    setCareers(Array.isArray(userDoc?.careers) ? userDoc.careers : []);
    setDidInit(true);
  }, [uid, loading, didInit, userDoc]);

  const handleAddCareer = () => {
    const v = careerInput.trim();
    if (!v) return;
    setCareers((prev) => [...prev, v]);
    setCareerInput("");
  };

  const handleRemoveCareer = (idx) => {
    setCareers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!uid || isSaving) return;
    setIsSaving(true);
    try {
      await updateUserProfile({
        uid,
        intro: intro.trim(),
        careers,
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
          <Title>소개 · 경력</Title>
        </Header>

        <FieldGroup>
          <Label htmlFor="intro">한 줄 소개</Label>
          <TextArea
            id="intro"
            placeholder="예) 185cm 센터, 주말 경기 위주로 열심히 뛰고 싶습니다."
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </FieldGroup>

        <FieldGroup>
          <Label>경력 사항</Label>
          <LabelSub>한 줄씩 추가해 주세요.</LabelSub>
          <CareerInputRow>
            <Input
              placeholder="예) 대학 농구 동아리 리그 우승 1회"
              value={careerInput}
              onChange={(e) => setCareerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCareer();
                }
              }}
            />
            <SmallButton type="button" onClick={handleAddCareer}>
              + 추가
            </SmallButton>
          </CareerInputRow>

          {careers.length > 0 && (
            <CareerList>
              {careers.map((c, idx) => (
                <CareerItemRow key={`${c}-${idx}`}>
                  <CareerBullet>•</CareerBullet>
                  <span style={{ flex: 1 }}>{c}</span>
                  <CareerRemove type="button" onClick={() => handleRemoveCareer(idx)}>
                    ×
                  </CareerRemove>
                </CareerItemRow>
              ))}
            </CareerList>
          )}
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
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.card};
  padding: 16px 14px 32px;
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 520px;
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

const LabelSub = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-top: -4px;
`;

const TextArea = styled.textarea`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 12px;
  font-size: 13px;
  outline: none;
  min-height: 96px;
  resize: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }
`;

const Input = styled.input`
  flex: 1;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 11px 12px;
  font-size: 13px;
  outline: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }
`;

const CareerInputRow = styled.div`
  display: flex;
  gap: 8px;
`;

const SmallButton = styled.button`
  align-self: stretch;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
  white-space: nowrap;
`;

const CareerList = styled.ul`
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CareerItemRow = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const CareerBullet = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CareerRemove = styled.button`
  border: none;
  background: none;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
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
