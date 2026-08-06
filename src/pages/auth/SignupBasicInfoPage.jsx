/* eslint-disable */
// src/pages/auth/SignupBasicInfoPage.jsx
// 전화번호 인증까지 마친 신규 가입자에게 1회 노출되는 "기본 정보 입력" 화면.
// 이름·생년월일·성별·활동지역을 받아 users 문서에 저장하고 basicInfoDone=true 로 게이트를 통과시킨다.
// (RequirePhone 통과 후 진입 · RequireWelcome 완료 화면 앞 단계)
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";
import RegionPickerSheet from "../../components/common/RegionPickerSheet";
import { showAlert } from "../../utils/appDialog";
import { track } from "../../utils/analytics";
import { FiChevronRight } from "react-icons/fi";
import { WizardTopProgress } from "../../components/wizard/SignupWizard";

// 오늘 날짜(YYYY-MM-DD) — 미래 생년월일 입력 방지용 max
function todayYmd() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function SignupBasicInfoPage() {
  const { firebaseUser, userDoc, refreshUser } = useAuth();
  // 전화인증에서 기존 계정과 병합되면 게이트가 읽는 문서는 userDoc.id(병합된 실제 문서)다.
  const uid = userDoc?.id || userDoc?.uid || firebaseUser?.uid || "";

  const [realName, setRealName] = useState(String(userDoc?.realName || "").trim());
  const [birthDate, setBirthDate] = useState(String(userDoc?.birthDate || ""));
  const [gender, setGender] = useState(String(userDoc?.gender || ""));
  const [regionSido, setRegionSido] = useState(String(userDoc?.regionSido || ""));
  const [regionGu, setRegionGu] = useState(String(userDoc?.regionGu || ""));
  const [regionOpen, setRegionOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const regionText = useMemo(
    () => (regionSido && regionGu ? `${regionSido} ${regionGu}` : ""),
    [regionSido, regionGu]
  );

  const canSubmit =
    !!uid &&
    realName.trim().length >= 2 &&
    !!birthDate &&
    (gender === "male" || gender === "female") &&
    !!regionText &&
    !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const birthYear = Number(String(birthDate).slice(0, 4)) || null;
      await updateUserProfile({
        uid,
        realName: realName.trim(),
        birthDate,
        birthYear,
        gender,
        regionSido,
        regionGu,
        region: regionText,
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
            type="date"
            value={birthDate}
            max={todayYmd()}
            min="1920-01-01"
            onChange={(e) => setBirthDate(e.target.value)}
            disabled={busy}
          />
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

        <FieldGroup>
          <Label>활동 지역</Label>
          <RegionBtn type="button" $muted={!regionText} onClick={() => setRegionOpen(true)} disabled={busy}>
            <span>{regionText || "활동 지역 선택"}</span>
            <FiChevronRight size={16} />
          </RegionBtn>
          <RegionPickerSheet
            open={regionOpen}
            onClose={() => setRegionOpen(false)}
            value={{ sido: regionSido, gu: regionGu }}
            onPick={({ sido, gu }) => {
              setRegionSido(sido);
              setRegionGu(gu);
            }}
            title="활동 지역 선택"
          />
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
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 14px 14px;
  font-size: 15px;
  outline: none;
  background: ${({ theme }) => (theme.mode === "dark" ? theme.colors.surface : "#f6f7f9")};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }
  &:disabled {
    opacity: 0.6;
  }
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

const RegionBtn = styled.button`
  width: 100%;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 14px 14px;
  font-size: 15px;
  background: ${({ theme }) => (theme.mode === "dark" ? theme.colors.surface : "#f6f7f9")};
  color: ${({ $muted, theme }) => ($muted ? theme.colors.textWeak : theme.colors.textStrong)};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &:disabled {
    opacity: 0.6;
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
