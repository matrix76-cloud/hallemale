/* eslint-disable */
// src/pages/my/MyProfileEditPage.jsx
// ✅ 기본 정보(아바타/닉네임/지역)만 본 페이지에서 처리
// ✅ 포지션·실력 / 키·몸무게 / 소개·경력 / 사진·동영상 / 팀 가입 신청은 별도 페이지로 분리

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { playerAvatars } from "../../utils/imageAssets";
import { KR_AREAS } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";
import { uploadUserAvatar } from "../../services/mediaService";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";

const POSITION_LABEL = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로",
};

export default function MyProfileEditPage() {
  const nav = useNavigate();
  const { userDoc, loading, refreshUser } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const avatarInputRef = useRef(null);

  const [nickname, setNickname] = useState("");
  const [regionSido, setRegionSido] = useState("");
  const [regionGu, setRegionGu] = useState("");

  const [didInit, setDidInit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sidoOptions = useMemo(
    () => (Array.isArray(KR_AREAS) ? KR_AREAS.map((a) => a.sido) : []),
    []
  );

  const guOptions = useMemo(() => {
    if (!regionSido) return [];
    const found = Array.isArray(KR_AREAS)
      ? KR_AREAS.find((a) => a.sido === regionSido)
      : null;
    return found?.guList || [];
  }, [regionSido]);

  const parseRegion = (regionText) => {
    if (!regionText || typeof regionText !== "string") return { sido: "", gu: "" };
    const text = regionText.trim().replace(/\s+/g, " ");
    const parts = text.split(" ");
    if (parts.length >= 2) return { sido: parts[0], gu: parts.slice(1).join(" ") };
    return { sido: parts[0] || "", gu: "" };
  };

  useEffect(() => {
    if (!uid || loading || didInit) return;

    setNickname(userDoc?.nickname || "");

    const baseSido = userDoc?.regionSido || "";
    const baseGu = userDoc?.regionGu || "";
    if (baseSido) {
      setRegionSido(baseSido);
      setRegionGu(baseGu || "");
    } else {
      const parsed = parseRegion(userDoc?.region);
      setRegionSido(parsed.sido || "");
      setRegionGu(parsed.gu || "");
    }

    const baseAvatar =
      userDoc?.avatarUrl || (uid ? playerAvatars[uid] : "") || "";
    setAvatarPreview(baseAvatar);

    setDidInit(true);
  }, [uid, loading, didInit, userDoc]);

  const handleAvatarClick = () => {
    if (avatarInputRef.current) avatarInputRef.current.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert("이미지는 최대 5MB까지 업로드할 수 있어요.");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const canSave = nickname.trim().length > 0 && !!uid;

  const handleSave = async () => {
    if (!canSave) {
      window.alert("닉네임을 입력해주세요.");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      let nextAvatarUrl = userDoc?.avatarUrl || null;
      if (avatarFile) {
        const uploaded = await uploadUserAvatar({ uid, file: avatarFile });
        nextAvatarUrl = uploaded.url;
      }
      const regionText = (
        regionSido && regionGu
          ? `${regionSido} ${regionGu}`
          : regionSido || regionGu || ""
      ).trim();

      await updateUserProfile({
        uid,
        nickname: nickname.trim(),
        onboardingDone: true,
        avatarUrl: nextAvatarUrl,
        regionSido: regionSido || null,
        regionGu: regionGu || null,
        region: regionText || null,
      });
      try { await refreshUser?.(); } catch (e) {}
      window.alert("프로필이 저장되었습니다.");
      nav("/my");
    } catch (e) {
      console.warn("[MyProfileEdit] save failed:", e?.message || e);
      window.alert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const skillsPreview = (() => {
    const pos = POSITION_LABEL[userDoc?.mainPosition] || "";
    const skill = SKILL_LABEL[userDoc?.skillLevel] || "";
    if (pos && skill) return `${pos} · ${skill}`;
    return pos || skill || "선택 안 함";
  })();

  const bodyPreview = (() => {
    const h = userDoc?.heightCm ? `${userDoc.heightCm}cm` : "";
    const w = userDoc?.weightKg ? `${userDoc.weightKg}kg` : "";
    if (h && w) return `${h} · ${w}`;
    return h || w || "선택 안 함";
  })();

  const introPreview = (() => {
    const hasIntro = !!String(userDoc?.intro || "").trim();
    const careersCount = Array.isArray(userDoc?.careers) ? userDoc.careers.length : 0;
    if (!hasIntro && careersCount === 0) return "등록 안 됨";
    const parts = [];
    if (hasIntro) parts.push("한 줄 소개 등록됨");
    if (careersCount > 0) parts.push(`경력 ${careersCount}건`);
    return parts.join(" · ");
  })();

  const mediaPreview = (() => {
    const count = Array.isArray(userDoc?.media) ? userDoc.media.length : 0;
    return count > 0 ? `${count}개 등록됨` : "등록 안 됨";
  })();

  const teamJoinPreview = (() => {
    const hasTeam = !!(userDoc?.activeTeamId || userDoc?.clubId);
    if (hasTeam) return "이미 소속 팀 있음";
    const status = String(userDoc?.joinRequest?.status || "").trim();
    if (status === "pending") return "신청 중";
    if (status === "rejected") return "이전 신청 거절됨";
    return "신청 안 함";
  })();

  return (
    <Page>
      <Card>
        <Section>
          <SectionHeader>
            <SectionTitle>프로필 기본 정보</SectionTitle>
            <SectionSub>매칭과 팀 가입 신청에 사용되는 기본 정보입니다.</SectionSub>
          </SectionHeader>

          <AvatarWrap>
            <AvatarCircle type="button" onClick={handleAvatarClick} disabled={isSaving}>
              {avatarPreview ? (
                <AvatarImg src={avatarPreview} alt={nickname || "avatar"} />
              ) : (
                <AvatarPlaceholder size={72} />
              )}
            </AvatarCircle>

            <AvatarTextCol>
              <SmallButton type="button" onClick={handleAvatarClick} disabled={isSaving}>
                프로필 사진 변경
              </SmallButton>
              {!uid ? (
                <ErrorText>로그인 정보가 없습니다. 다시 로그인해 주세요.</ErrorText>
              ) : null}
            </AvatarTextCol>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </AvatarWrap>

          <FieldGroup>
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              placeholder="예) 한주성"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </FieldGroup>

          <FieldGroup>
            <Label>지역</Label>
            <TwoColRow>
              <Select value={regionSido || ""} onChange={(e) => setRegionSido(e.target.value)}>
                <option value="">시/도 선택</option>
                {sidoOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>

              <Select
                value={regionGu || ""}
                onChange={(e) => setRegionGu(e.target.value)}
                disabled={!regionSido}
              >
                <option value="">{regionSido ? "구/군 선택" : "시/도 먼저 선택"}</option>
                {guOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </TwoColRow>
          </FieldGroup>
        </Section>

        <MenuList>
          <MenuRow type="button" onClick={() => nav("/my/profile/edit/skills")}>
            <MenuLabel>포지션 · 실력</MenuLabel>
            <MenuRight>
              <MenuValue>{skillsPreview}</MenuValue>
              <MenuChevron>›</MenuChevron>
            </MenuRight>
          </MenuRow>

          <MenuRow type="button" onClick={() => nav("/my/profile/edit/body")}>
            <MenuLabel>키 · 몸무게</MenuLabel>
            <MenuRight>
              <MenuValue>{bodyPreview}</MenuValue>
              <MenuChevron>›</MenuChevron>
            </MenuRight>
          </MenuRow>

          <MenuRow type="button" onClick={() => nav("/my/profile/edit/intro")}>
            <MenuLabel>소개 · 경력</MenuLabel>
            <MenuRight>
              <MenuValue>{introPreview}</MenuValue>
              <MenuChevron>›</MenuChevron>
            </MenuRight>
          </MenuRow>

          <MenuRow type="button" onClick={() => nav("/my/profile/edit/media")}>
            <MenuLabel>경기 소개 · 사진/동영상</MenuLabel>
            <MenuRight>
              <MenuValue>{mediaPreview}</MenuValue>
              <MenuChevron>›</MenuChevron>
            </MenuRight>
          </MenuRow>

          <MenuRow type="button" onClick={() => nav("/my/profile/edit/team-join")}>
            <MenuLabel>팀 가입 신청</MenuLabel>
            <MenuRight>
              <MenuValue>{teamJoinPreview}</MenuValue>
              <MenuChevron>›</MenuChevron>
            </MenuRight>
          </MenuRow>
        </MenuList>

        <ActionsRow>
          <GhostButton type="button" onClick={() => nav("/my")}>취소</GhostButton>
          <PrimaryButton type="button" disabled={!canSave || isSaving} onClick={handleSave}>
            {isSaving ? "저장 중..." : "프로필 저장"}
          </PrimaryButton>
        </ActionsRow>
      </Card>
    </Page>
  );
}

const Page = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  padding: 16px 14px 32px;
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 520px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 24px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 28px;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: 24px;
`;

const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionSub = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ErrorText = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.danger};
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

const Input = styled.input`
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

const TwoColRow = styled.div`
  display: flex;
  gap: 10px;
`;

const Select = styled.select`
  flex: 1;
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

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const AvatarWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const AvatarCircle = styled.button`
  width: 72px;
  height: 72px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
  cursor: pointer;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarTextCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SmallButton = styled.button`
  align-self: flex-start;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const MenuList = styled.div`
  display: flex;
  flex-direction: column;
`;

const MenuRow = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  padding: 16px 4px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  }
`;

const MenuLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  flex-shrink: 0;
`;

const MenuRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const MenuValue = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
`;

const MenuChevron = styled.div`
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textWeak};
  flex-shrink: 0;
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
