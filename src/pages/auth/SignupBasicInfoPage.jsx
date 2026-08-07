/* eslint-disable */
// src/pages/auth/SignupBasicInfoPage.jsx
// 전화번호 인증까지 마친 신규 가입자에게 1회 노출되는 "기본 정보 입력" 화면.
// 이름·생년월일·성별을 받아 users 문서에 저장하고 basicInfoDone=true 로 게이트를 통과시킨다.
// (RequirePhone 통과 후 진입 · RequireWelcome 완료 화면 앞 단계)
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";
import { showAlert } from "../../utils/appDialog";
import { track } from "../../utils/analytics";
import { WizardTopProgress } from "../../components/wizard/SignupWizard";

// "20030207" → "2003-02-07" (실재하지 않는 날짜·미래·1920년 이전이면 null)
function parseBirth8(s) {
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  if (y < 1920) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (dt.getTime() > Date.now()) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export default function SignupBasicInfoPage() {
  const { firebaseUser, userDoc, refreshUser } = useAuth();
  // 전화인증에서 기존 계정과 병합되면 게이트가 읽는 문서는 userDoc.id(병합된 실제 문서)다.
  const uid = userDoc?.id || userDoc?.uid || firebaseUser?.uid || "";

  const [realName, setRealName] = useState(String(userDoc?.realName || "").trim());
  // 화면 입력값은 숫자 8자리("20030207"), 저장은 기존과 동일한 YYYY-MM-DD
  const [birth8, setBirth8] = useState(String(userDoc?.birthDate || "").replace(/\D/g, "").slice(0, 8));
  const [gender, setGender] = useState(String(userDoc?.gender || ""));
  const [busy, setBusy] = useState(false);

  const birthDate = useMemo(() => parseBirth8(birth8), [birth8]);
  const birthInvalid = birth8.length === 8 && !birthDate;

  const canSubmit =
    !!uid &&
    realName.trim().length >= 2 &&
    !!birthDate &&
    (gender === "male" || gender === "female") &&
    !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const birthYear = Number(birthDate.slice(0, 4)) || null;
      await updateUserProfile({
        uid,
        realName: realName.trim(),
        birthDate,
        birthYear,
        gender,
        basicInfoDone: true,
      });
      track("basic_info_complete"); // 온보딩 기본정보 입력 완료 — 퍼널
      await refreshUser();
      // basicInfoDone=true 반영되면 상위 RequireBasicInfo 게이트가 통과되며 언마운트된다.
    } catch (e) {
      console.warn("[SignupBasicInfo] save failed:", e?.message || e);
      showAlert(e?.message || "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      {/* 가입 흐름 3/3 — 동의 → 전화인증 → 기본정보 */}
      <WizardTopProgress step={3} total={3} />
      <Inner>
        <Head>
          <Title>기본 정보 입력</Title>
          <Sub>매칭을 위해 몇 가지만 알려주세요.</Sub>
        </Head>

        <FieldGroup>
          <Label htmlFor="realName">이름</Label>
          <Input
            id="realName"
            placeholder="실명을 입력해 주세요"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            disabled={busy}
            maxLength={20}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="birthDate">생년월일</Label>
          <Input
            id="birthDate"
            type="text"
            inputMode="numeric"
            placeholder="20030207"
            value={birth8}
            maxLength={8}
            onChange={(e) => setBirth8(e.target.value.replace(/\D/g, "").slice(0, 8))}
            disabled={busy}
            $error={birthInvalid}
          />
          <Hint $error={birthInvalid}>
            {birthInvalid ? "생년월일을 다시 확인해 주세요." : "숫자 8자리로 입력해 주세요. (예: 20030207)"}
          </Hint>
        </FieldGroup>

        <FieldGroup>
          <Label>성별</Label>
          <GenderRow>
            <GenderBtn
              type="button"
              $on={gender === "male"}
              onClick={() => setGender("male")}
              disabled={busy}
            >
              남성
            </GenderBtn>
            <GenderBtn
              type="button"
              $on={gender === "female"}
              onClick={() => setGender("female")}
              disabled={busy}
            >
              여성
            </GenderBtn>
          </GenderRow>
        </FieldGroup>

        <Spacer />

        <SubmitBtn type="button" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? "저장 중…" : "완료"}
        </SubmitBtn>
      </Inner>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const Wrap = styled.div`
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  justify-content: center;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  padding-top: calc(56px + env(safe-area-inset-top));
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
`;

const Head = styled.div`
  margin-bottom: 26px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.p`
  margin: 8px 0 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Input = styled.input`
  min-width: 0;
  border-radius: 12px;
  border: 1px solid ${({ $error, theme }) => ($error ? theme.colors.danger : theme.colors.border)};
  padding: 14px 14px;
  font-size: 15px;
  outline: none;
  background: ${({ theme }) => (theme.mode === "dark" ? theme.colors.surface : "#f6f7f9")};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ $error, theme }) => ($error ? theme.colors.danger : theme.colors.primary)};
    background: ${({ theme }) => theme.colors.card};
  }
  &:disabled {
    opacity: 0.6;
  }
`;

const Hint = styled.span`
  font-size: 12px;
  color: ${({ $error, theme }) => ($error ? theme.colors.danger : theme.colors.textWeak)};
`;

const GenderRow = styled.div`
  display: flex;
  gap: 10px;
`;

const GenderBtn = styled.button`
  flex: 1;
  height: 50px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) =>
    $on ? theme.colors.primary : theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  color: ${({ $on, theme }) => ($on ? "#ffffff" : theme.colors.textStrong)};
  transition: transform 0.1s;

  &:active {
    transform: translateY(1px);
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-height: 28px;
`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  background: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: transform 0.1s;
  position: sticky;
  bottom: calc(16px + env(safe-area-inset-bottom));

  &:active {
    transform: translateY(1px);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
