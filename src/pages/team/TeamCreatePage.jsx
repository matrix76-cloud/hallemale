/* eslint-disable */
// src/pages/team/TeamCreatePage.jsx
// 팀 구성하기 (온보딩 스타일)
// - STEP 1: 팀 로고 이미지
// - STEP 2: 팀 기본 정보 + 홍보 문구
// - STEP 3: 확인 & 생성 (실제 생성: Firestore + Storage)
// ✅ 중복 생성 방지: submitLockRef + isSubmitting 이중 방어

import React, { useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";

import TeamAvatarPlaceholder from "../../components/common/TeamAvatarPlaceholder";
import { useAuth } from "../../hooks/useAuth";
import { createClub, isClubNameTaken } from "../../services/teamService";
import RegionPickerSheet from "../../components/common/RegionPickerSheet";
import { TEAM_TAG_PRESETS } from "../../utils/constants";

/* ===== 레이아웃 ===== */

const Page = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  justify-content: center;
  padding: 20px 12px 32px;
`;

const Card = styled.div`
  width: 100%;
  max-width: 480px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 20px 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/* ===== 헤더 / 단계 표시 ===== */

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const StepIndicatorRow = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;
`;

const StepDot = styled.div`
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.border};
`;

/* ===== 폼 공통 ===== */

const Section = styled.section`
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const LabelColumn = styled.div`
  display: flex;
  align-items: baseline;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LabelSub = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const NameStatus = styled.div`
  font-size: 12px;
  margin-top: 2px;
  color: ${({ $tone, theme }) =>
    $tone === "ok"
      ? theme.colors.primary
      : $tone === "error"
      ? "#ef4444"
      : theme.colors.textWeak};
`;

const InputRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
`;

const CheckButton = styled.button`
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : theme.colors.primary};
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Input = styled.input`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 9px 10px;
  font-size: 13px;
  outline: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const TextArea = styled.textarea`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 9px 10px;
  font-size: 13px;
  outline: none;
  min-height: 120px;
  resize: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const SelectBtn = styled.button`
  height: 50px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "rgba(255, 255, 255, 0.92)"};
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${({ $muted, theme }) =>
    $muted ? theme.colors.textWeak : theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.12);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TagChip = styled.button`
  border-radius: 999px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.border};
  background: ${({ $selected, theme }) =>
    $selected
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "#eef2ff"
      : theme.colors.card};
  padding: 4px 9px;
  font-size: 11px;
  color: ${({ $selected, theme }) =>
    $selected
      ? theme.mode === "dark"
        ? "#a5b4fc"
        : theme.colors.primary
      : theme.colors.textNormal};
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

/* ===== 로고 업로드 (STEP 1 전용, 크게) ===== */

const LogoStepWrap = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
`;

const LogoBigPreview = styled.div`
  width: 140px;
  height: 140px;
  border-radius: 32px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/* 로고 미등록 시 기본 그룹 placeholder — 컨테이너(원형/사각)에 맞게 채움 */
const LogoPlaceholderFill = styled(TeamAvatarPlaceholder)`
  width: 100% !important;
  height: 100% !important;
  border-radius: 0;
`;

const LogoHelpText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: left;
  line-height: 1.5;
`;

const LogoButton = styled.button`
  border-radius: 999px;
  border: none;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ededed"};
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

/* ===== 홍보 문구 ===== */

const PromoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PromoCheckbox = styled.input`
  width: 14px;
  height: 14px;
`;

/* ===== 요약 ===== */

const SummaryBox = styled.div`
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 10px 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SummaryLogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SummaryLogoThumb = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#e5e7eb"};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* ===== 하단 버튼 ===== */

const ActionsRow = styled.div`
  margin-top: 8px;
  display: flex;
  gap: 8px;
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

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
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
    opacity: 0.5;
    cursor: default;
  }
`;

const SummaryBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const SummaryText = styled.div`
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* ===== 상수 ===== */

const TAG_PRESETS = TEAM_TAG_PRESETS;

/* ===== 컴포넌트 ===== */

export default function TeamCreatePage() {
  const theme = useTheme();
  const nav = useNavigate();
  const { userDoc } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  const [step, setStep] = useState(1);

  // STEP 2: 팀 기본 정보 + 홍보 문구
  const [teamName, setTeamName] = useState("");
  // 팀명 중복 확인 상태: "idle" | "checking" | "available" | "taken" | "error"
  const [nameStatus, setNameStatus] = useState("idle");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);

  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSido, setRegionSido] = useState("");
  const [regionGu, setRegionGu] = useState("");

  const region = useMemo(() => {
    if (!regionSido || !regionGu) return "";
    return `${regionSido} ${regionGu}`;
  }, [regionSido, regionGu]);

  // ✅ 팀명 중복 확인 (수동: 중복체크 버튼)
  const handleCheckName = async () => {
    const trimmed = teamName.trim();
    if (!trimmed || nameStatus === "checking") return;

    setNameStatus("checking");
    try {
      const taken = await isClubNameTaken(trimmed);
      setNameStatus(taken ? "taken" : "available");
    } catch (e) {
      setNameStatus("error");
    }
  };

  const [usePromoText, setUsePromoText] = useState(false);
  const [promoText, setPromoText] = useState("");

  // 로고 상태 (STEP 1)
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ 렌더 업데이트 전에 연타를 막는 즉시 락
  const submitLockRef = useRef(false);

  const toggleTag = (tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleLogoClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      window.alert("로고 이미지는 최대 6MB까지 업로드할 수 있어요.");
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const canGoNextStep2 =
    teamName.trim().length > 0 &&
    teamName.trim().length <= 6 &&
    region.trim().length > 0 &&
    nameStatus === "available";
  const canSubmit = canGoNextStep2 && !!uid;

  const handleNext = () => {
    if (isSubmitting) return;

    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canGoNextStep2) return;
      setStep(3);
    }
  };

  const handlePrev = () => {
    if (isSubmitting) return;
    if (step === 1) return;
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (!uid) window.alert("로그인이 필요합니다.");
      return;
    }

    // ✅ 즉시 락(연타/더블클릭 방지)
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { clubId } = await createClub({
        ownerUid: uid,
        name: teamName.trim(),

        region: region.trim(),
        regionSido: regionSido || null,
        regionGu: regionGu || null,

        description: description.trim(),
        tags,
        promo: {
          usePromoText,
          promoText: usePromoText ? promoText.trim() : "",
        },
        logoFile,
      });

      window.alert("팀이 생성되었습니다.");
      nav(`/my`);
    } catch (e) {
      console.warn("[TeamCreate] create failed:", e?.message || e);
      window.alert(e?.message || "팀 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      // ✅ 실패 시에만 재시도 허용
      submitLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Page>
      <Card>
        <Header>
          <Title>팀 구성하기</Title>
          <Subtitle>팀을 만들고 매칭에 사용할 팀 프로필을 설정할 수 있어요.</Subtitle>
          <StepIndicatorRow>
            <StepDot $active={step >= 1} />
            <StepDot $active={step >= 2} />
            <StepDot $active={step >= 3} />
          </StepIndicatorRow>
        </Header>

        {/* STEP 1: 팀 로고 이미지 */}
        {step === 1 && (
          <Section>
            <LabelColumn>
              <Label>팀 로고 이미지</Label>
              <LabelSub>팀 리스트와 매칭 카드에 가장 크게 노출되는 대표 이미지예요.</LabelSub>
            </LabelColumn>

            <LogoHelpText>
              팀을 상징하는 엠블럼, 팀복 사진, 팀 마크
              <br />
              등을 등록해 주세요. 정사각형 이미지를 권장하며,
              <br />
              추후 팀 관리에서 언제든 변경할 수 있어요.
            </LogoHelpText>

            <LogoStepWrap>
              <LogoBigPreview>
                {logoPreview ? (
                  <LogoImg src={logoPreview} alt="팀 로고 미리보기" />
                ) : (
                  <LogoPlaceholderFill />
                )}
              </LogoBigPreview>

              <LogoButton type="button" onClick={handleLogoClick} disabled={isSubmitting}>
                로고 이미지 선택
              </LogoButton>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleLogoChange}
              />
            </LogoStepWrap>
          </Section>
        )}

        {/* STEP 2: 팀 기본 정보 + 홍보 문구 */}
        {step === 2 && (
          <Section>
            <FieldGroup>
              <LabelRow>
                <Label htmlFor="teamName">팀 이름</Label>
                <LabelSub>매칭/랭킹 등 모든 곳에 표시돼요.</LabelSub>
              </LabelRow>
              <InputRow>
                <Input
                  id="teamName"
                  style={{ flex: 1 }}
                  placeholder="예) 청춘호랑이"
                  value={teamName}
                  onChange={(e) => {
                    const next = String(e.target.value || "").slice(0, 6);
                    setTeamName(next);
                    setNameStatus("idle"); // 이름이 바뀌면 다시 확인 필요
                  }}
                  disabled={isSubmitting}
                />
                <CheckButton
                  type="button"
                  onClick={handleCheckName}
                  disabled={isSubmitting || !teamName.trim() || nameStatus === "checking"}
                >
                  {nameStatus === "checking" ? "확인 중..." : "중복체크"}
                </CheckButton>
              </InputRow>
              {nameStatus === "idle" && teamName.trim() && (
                <NameStatus>중복체크 버튼을 눌러 사용 가능한지 확인해 주세요.</NameStatus>
              )}
              {nameStatus === "available" && (
                <NameStatus $tone="ok">사용할 수 있는 팀 이름이에요.</NameStatus>
              )}
              {nameStatus === "taken" && (
                <NameStatus $tone="error">이미 사용 중인 팀 이름이에요.</NameStatus>
              )}
              {nameStatus === "error" && (
                <NameStatus $tone="error">중복 확인에 실패했어요. 잠시 후 다시 시도해 주세요.</NameStatus>
              )}
            </FieldGroup>

            <FieldGroup>
              <LabelRow>
                <Label>활동 지역</Label>
                <LabelSub>구 단위까지 적어주면 좋아요.</LabelSub>
              </LabelRow>

              <SelectBtn type="button" onClick={() => setRegionOpen(true)} $muted={!region} disabled={isSubmitting}>
                <span>{region || "활동 지역 선택"}</span>
                <FiChevronRight size={16} />
              </SelectBtn>

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

            <FieldGroup>
              <LabelRow>
                <Label htmlFor="description">한 줄 소개</Label>
                <LabelSub>팀 분위기나 목표를 짧게 적어주세요.</LabelSub>
              </LabelRow>
              <TextArea
                id="description"
                placeholder="예) 20대 위주의 주말 친선 경기를 자주 뛰는 팀입니다."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </FieldGroup>

            <FieldGroup>
              <LabelRow>
                <Label>태그 선택</Label>
                <LabelSub>비슷한 팀을 찾는 데 도움이 돼요.</LabelSub>
              </LabelRow>
              <TagRow>
                {TAG_PRESETS.map((tag) => (
                  <TagChip
                    key={tag}
                    type="button"
                    $selected={tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                    disabled={isSubmitting}
                  >
                    {tag}
                  </TagChip>
                ))}
              </TagRow>
            </FieldGroup>

            <FieldGroup>
              <LabelRow>
                <Label>홍보 문구</Label>
                <LabelSub>랭킹/추천 영역 등에서 팀을 소개할 때 사용돼요.</LabelSub>
              </LabelRow>
              <PromoRow>
                <PromoCheckbox
                  id="usePromoText"
                  type="checkbox"
                  checked={usePromoText}
                  onChange={(e) => setUsePromoText(e.target.checked)}
                  disabled={isSubmitting}
                />
                <label htmlFor="usePromoText" style={{ fontSize: 12, color: theme.colors.textNormal, cursor: "pointer" }}>
                  이 팀의 홍보 문구를 사용합니다.
                </label>
              </PromoRow>
              {usePromoText && (
                <TextArea
                  placeholder="예) 빠른 트랜지션과 팀워크로 승부하는 열정팀입니다."
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value)}
                  disabled={isSubmitting}
                />
              )}
            </FieldGroup>
          </Section>
        )}

        {/* STEP 3: 요약 */}
        {step === 3 && (
          <Section>
            <SummaryBox>
              <SummaryLogoRow>
                <SummaryLogoThumb>
                  {logoPreview ? (
                    <LogoImg src={logoPreview} alt="팀 로고" />
                  ) : (
                    <LogoPlaceholderFill />
                  )}
                </SummaryLogoThumb>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: theme.colors.textStrong }}>
                    {teamName || "-"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textWeak }}>
                    {region || "-"}
                  </div>
                </div>
              </SummaryLogoRow>

              {description && (
                <SummaryBlock>
                  <SummaryLabel>팀 소개</SummaryLabel>
                  <SummaryText>{description}</SummaryText>
                </SummaryBlock>
              )}

              {tags.length > 0 && (
                <SummaryBlock>
                  <SummaryLabel>태그</SummaryLabel>
                  <TagRow>
                    {tags.map((t) => (
                      <TagChip key={t} $selected>
                        {t}
                      </TagChip>
                    ))}
                  </TagRow>
                </SummaryBlock>
              )}

              {usePromoText && promoText.trim() && (
                <SummaryBlock>
                  <SummaryLabel>홍보 문구</SummaryLabel>
                  <SummaryText>{promoText}</SummaryText>
                </SummaryBlock>
              )}

              <div style={{ fontSize: 12, color: theme.colors.textWeak, marginTop: 6 }}>
                팀장은 현재 로그인 계정으로 자동 지정돼요.
              </div>
            </SummaryBox>
          </Section>
        )}

        {/* 하단 버튼 */}
        <ActionsRow>
          {step > 1 ? (
            <GhostButton type="button" onClick={handlePrev} disabled={isSubmitting}>
              이전
            </GhostButton>
          ) : (
            <GhostButton type="button" onClick={() => nav("/my")} disabled={isSubmitting}>
              취소
            </GhostButton>
          )}

          {step < 3 && (
            <PrimaryButton
              type="button"
              disabled={isSubmitting || (step === 2 ? !canGoNextStep2 : false)}
              onClick={handleNext}
            >
              다음
            </PrimaryButton>
          )}

          {step === 3 && (
            <PrimaryButton type="button" disabled={isSubmitting || !canSubmit} onClick={handleSubmit}>
              {isSubmitting ? "생성 중..." : "팀 생성 완료"}
            </PrimaryButton>
          )}
        </ActionsRow>
      </Card>
    </Page>
  );
}
