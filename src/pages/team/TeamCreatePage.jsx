/* eslint-disable */
// src/pages/team/TeamCreatePage.jsx
// 팀 구성하기 (온보딩 스타일)
// - STEP 1: 팀 로고 이미지
// - STEP 2: 팀 기본 정보 + 홍보 문구
// - STEP 3: 확인 & 생성 (실제 생성: Firestore + Storage)
// ✅ 중복 생성 방지: submitLockRef + isSubmitting 이중 방어

import React, { useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";

import { images } from "../../utils/imageAssets";
import { useAuth } from "../../hooks/useAuth";
import { createClub } from "../../services/teamService";
import RegionPickerSheet from "../../components/common/RegionPickerSheet";

/* ===== 레이아웃 ===== */

const Page = styled.div`
  min-height: 100vh;
  background: #f3f4f6;
  display: flex;
  justify-content: center;
  padding: 20px 12px 32px;
`;

const Card = styled.div`
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
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
  color: #111827;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: #6b7280;
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
  background: ${({ $active }) => ($active ? "#4f46e5" : "#e5e7eb")};
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
  color: #111827;
`;

const LabelSub = styled.span`
  font-size: 11px;
  color: #9ca3af;
`;

const Input = styled.input`
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 9px 10px;
  font-size: 13px;
  outline: none;
  background: #f9fafb;

  &:focus {
    border-color: #4f46e5;
    background: #ffffff;
  }
`;

const TextArea = styled.textarea`
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 9px 10px;
  font-size: 13px;
  outline: none;
  min-height: 120px;
  resize: none;
  background: #f9fafb;

  &:focus {
    border-color: #4f46e5;
    background: #ffffff;
  }
`;

const SelectBtn = styled.button`
  height: 50px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${({ $muted }) => ($muted ? "#9ca3af" : "#111827")};

  &:focus {
    border-color: rgba(79, 70, 229, 0.55);
    box-shadow: 0 0 0 5px rgba(79, 70, 229, 0.12);
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
  border: 1px solid ${({ $selected }) => ($selected ? "#4f46e5" : "#e5e7eb")};
  background: ${({ $selected }) => ($selected ? "#eef2ff" : "#ffffff")};
  padding: 4px 9px;
  font-size: 11px;
  color: ${({ $selected }) => ($selected ? "#4f46e5" : "#4b5563")};
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
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const LogoEmpty = styled.div`
  font-size: 12px;
  color: #9ca3af;
`;

const LogoHelpText = styled.div`
  font-size: 12px;
  color: #6b7280;
  text-align: left;
  line-height: 1.5;
`;

const LogoButton = styled.button`
  border-radius: 999px;
  border: none;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #111;
  background: #ededed;
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
  border-radius: 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 12px;
  color: #374151;
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
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
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
  border: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
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
  background: #4f46e5;
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
  color: #374151;
`;

const SummaryText = styled.div`
  font-size: 13px;
  line-height: 1.6;
  color: #111827;
`;

/* ===== 상수 ===== */

const TAG_PRESETS = ["#20대", "#30대", "#직장인팀", "#대학생팀", "#주말모임", "#야간연습"];

/* ===== 컴포넌트 ===== */

export default function TeamCreatePage() {
  const nav = useNavigate();
  const { userDoc } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  const [step, setStep] = useState(1);

  // STEP 2: 팀 기본 정보 + 홍보 문구
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);

  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSido, setRegionSido] = useState("");
  const [regionGu, setRegionGu] = useState("");

  const region = useMemo(() => {
    if (!regionSido || !regionGu) return "";
    return `${regionSido} ${regionGu}`;
  }, [regionSido, regionGu]);

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

  const canGoNextStep2 = teamName.trim().length > 0 && teamName.trim().length <= 6 && region.trim().length > 0;
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

  const logoDefault = images.teamDefaultLogo || images.logo || "";

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
                ) : logoDefault ? (
                  <LogoImg src={logoDefault} alt="기본 팀 로고" />
                ) : (
                  <LogoEmpty>로고 이미지 없음</LogoEmpty>
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
              <Input
                id="teamName"
                placeholder="예) 청춘호랑이"
                value={teamName}
                onChange={(e) => {
                  const next = String(e.target.value || "").slice(0, 6);
                  setTeamName(next);
                }}
                disabled={isSubmitting}
              />
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
                <label htmlFor="usePromoText" style={{ fontSize: 12, color: "#4b5563", cursor: "pointer" }}>
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
                  ) : logoDefault ? (
                    <LogoImg src={logoDefault} alt="기본 팀 로고" />
                  ) : (
                    <LogoEmpty>로고</LogoEmpty>
                  )}
                </SummaryLogoThumb>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
                    {teamName || "-"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
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

              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
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
