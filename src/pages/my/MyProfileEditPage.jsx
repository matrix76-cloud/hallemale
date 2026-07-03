/* eslint-disable */
// src/pages/my/MyProfileEditPage.jsx
// ✅ 기본 정보(아바타/닉네임/지역)만 본 페이지에서 처리
// ✅ 포지션·실력 / 키·몸무게 / 소개·경력 / 사진·동영상 / 팀 가입 신청은 별도 페이지로 분리

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { images, playerAvatars } from "../../utils/imageAssets";
import { KR_AREAS } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile, isNicknameTaken } from "../../services/userService";
import { uploadUserAvatar } from "../../services/mediaService";
import { getNameChangeStatus } from "../../utils/nameChange";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import RegionPickerSheet from "../../components/common/RegionPickerSheet";
import { FiChevronRight } from "react-icons/fi";

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
  // 닉네임 중복 확인 상태: "idle" | "checking" | "available" | "taken" | "error"
  const [nickStatus, setNickStatus] = useState("idle");
  const [regionSido, setRegionSido] = useState("");
  const [regionGu, setRegionGu] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);

  const regionText = useMemo(() => {
    if (!regionSido || !regionGu) return "";
    return `${regionSido} ${regionGu}`;
  }, [regionSido, regionGu]);

  const originalNick = String(userDoc?.nickname || "").trim();
  const nickChanged = nickname.trim() !== originalNick;
  const nickLock = getNameChangeStatus(userDoc?.nicknameUpdatedAt);

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

  // ✅ 닉네임 중복 확인 (수동: 중복체크 버튼)
  const handleCheckNick = async () => {
    const trimmed = nickname.trim();
    if (!trimmed || nickStatus === "checking") return;

    setNickStatus("checking");
    try {
      const taken = await isNicknameTaken(trimmed, uid);
      setNickStatus(taken ? "taken" : "available");
    } catch (e) {
      setNickStatus("error");
    }
  };

  const canSave =
    nickname.trim().length > 0 &&
    !!uid &&
    // 닉네임을 바꾼 경우에만: 쿨다운 해제 + 중복체크 통과 필요
    (!nickChanged || (!nickLock.locked && nickStatus === "available"));

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
      window.alert(e?.message || "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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

  // 값이 "아직 안 채움" 상태인지 → 메뉴 값 색으로 한눈에 구분
  const isEmptyValue = (v) =>
    v === "선택 안 함" || v === "등록 안 됨" || v === "신청 안 함";

  const detailMenus = [
    { key: "skills", label: "포지션 · 실력", value: skillsPreview, to: "/my/profile/edit/skills" },
    { key: "body", label: "키 · 몸무게", value: bodyPreview, to: "/my/profile/edit/body" },
    { key: "intro", label: "소개 · 경력", value: introPreview, to: "/my/profile/edit/intro" },
    { key: "media", label: "경기 소개 · 사진/동영상", value: mediaPreview, to: "/my/profile/edit/media" },
    { key: "team", label: "팀 가입 신청", value: teamJoinPreview, to: "/my/profile/edit/team-join" },
  ];

  return (
    <Page>
      {/* ── 기본 정보 ── */}
      <Card>
        <SectionHead>
          <SectionIcon src={images.emoji3dIdCard} alt="" />
          <SectionHeadText>
            <SectionTitle>기본 정보</SectionTitle>
            <SectionSub>매칭·팀 가입 신청에 쓰이는 기본 정보예요.</SectionSub>
          </SectionHeadText>
        </SectionHead>

        <AvatarBlock>
          <AvatarCircle type="button" onClick={handleAvatarClick} disabled={isSaving}>
            {avatarPreview ? (
              <AvatarImg src={avatarPreview} alt={nickname || "avatar"} />
            ) : (
              <AvatarPlaceholder size={104} />
            )}
            <CameraBadge aria-hidden>📷</CameraBadge>
          </AvatarCircle>
          <AvatarHint>탭해서 프로필 사진 변경</AvatarHint>
          {!uid ? (
            <ErrorText>로그인 정보가 없습니다. 다시 로그인해 주세요.</ErrorText>
          ) : null}

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
        </AvatarBlock>

        <FieldGroup>
          <Label htmlFor="nickname">닉네임</Label>
          <InputRow>
            <Input
              id="nickname"
              style={{ flex: 1 }}
              placeholder="예) 한주성"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNickStatus("idle"); // 변경 시 다시 확인 필요
              }}
              disabled={isSaving || nickLock.locked}
            />
            <CheckButton
              type="button"
              onClick={handleCheckNick}
              disabled={
                isSaving ||
                nickLock.locked ||
                !nickname.trim() ||
                !nickChanged ||
                nickStatus === "checking"
              }
            >
              {nickStatus === "checking" ? "확인 중..." : "중복체크"}
            </CheckButton>
          </InputRow>

          {nickLock.locked ? (
            <NameStatus>
              닉네임은 {nickLock.remainingDays}일 후에 변경할 수 있어요.
            </NameStatus>
          ) : (
            <>
              {nickChanged && nickStatus === "idle" && (
                <NameStatus>중복체크 버튼을 눌러 사용 가능한지 확인해 주세요.</NameStatus>
              )}
              {nickStatus === "available" && (
                <NameStatus $tone="ok">사용할 수 있는 닉네임이에요.</NameStatus>
              )}
              {nickStatus === "taken" && (
                <NameStatus $tone="error">이미 사용 중인 닉네임이에요.</NameStatus>
              )}
              {nickStatus === "error" && (
                <NameStatus $tone="error">중복 확인에 실패했어요. 잠시 후 다시 시도해 주세요.</NameStatus>
              )}
              <NameStatus>닉네임은 한번 정하면 90일 후에 변경할 수 있어요.</NameStatus>
            </>
          )}
        </FieldGroup>

        <FieldGroup>
          <Label>지역</Label>
          <RegionSelectBtn type="button" onClick={() => setRegionOpen(true)} $muted={!regionText}>
            <span>{regionText || "활동 지역 선택"}</span>
            <FiChevronRight size={16} />
          </RegionSelectBtn>

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
      </Card>

      {/* ── 상세 프로필 ── */}
      <Card>
        <SectionHead>
          <SectionIcon src={images.emoji3dBasketball} alt="" />
          <SectionHeadText>
            <SectionTitle>상세 프로필</SectionTitle>
            <SectionSub>항목을 눌러 채울수록 매칭이 잘 돼요.</SectionSub>
          </SectionHeadText>
        </SectionHead>

        <MenuList>
          {detailMenus.map((m) => (
            <MenuRow key={m.key} type="button" onClick={() => nav(m.to)}>
              <MenuLabel>{m.label}</MenuLabel>
              <MenuRight>
                <MenuValue $empty={isEmptyValue(m.value)}>{m.value}</MenuValue>
                <MenuChevron>›</MenuChevron>
              </MenuRight>
            </MenuRow>
          ))}
        </MenuList>
      </Card>

      {/* ── 미리보기 (전체 화면으로 이동) ── */}
      {uid ? (
        <Card>
          <PreviewButton type="button" onClick={() => nav(`/player/${uid}`)}>
            👁 내 프로필 미리보기
          </PreviewButton>
          <PreviewHint>다른 사람에게 보이는 내 프로필을 전체 화면으로 볼 수 있어요. (저장된 정보 기준)</PreviewHint>
        </Card>
      ) : null}

      {/* ── 하단 고정 저장 바 ── */}
      <SaveBar>
        <GhostButton type="button" onClick={() => nav("/my")}>취소</GhostButton>
        <PrimaryButton type="button" disabled={!canSave || isSaving} onClick={handleSave}>
          {isSaving ? "저장 중..." : "프로필 저장"}
        </PrimaryButton>
      </SaveBar>
    </Page>
  );
}

/* ============================ styled ============================ */

const Page = styled.div`
  min-height: 100%;
  background: ${({ theme }) => theme.colors.bg};
  padding: 14px 14px calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Card = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

/* 섹션 헤더: 3D 아이콘 + 타이틀 (앱 공통 신스킨) */
const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SectionIcon = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.16));
`;

const SectionHeadText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: 700;
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

/* ── 아바타: 중앙 큰 원 + 카메라 배지 ── */
const AvatarBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const AvatarCircle = styled.button`
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 999px;
  overflow: visible;
  background: transparent;
  flex-shrink: 0;
  border: none;
  padding: 0;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
`;

const AvatarImg = styled.img`
  width: 104px;
  height: 104px;
  border-radius: 999px;
  object-fit: cover;
  background: ${({ theme }) => theme.colors.border};
`;

const CameraBadge = styled.span`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.card};
  border: 2px solid ${({ theme }) => theme.colors.card};
  box-shadow: 0 3px 8px rgba(15, 23, 42, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
`;

const AvatarHint = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ── 입력 필드 ── */
const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  padding: 13px 14px;
  font-size: 14px;
  outline: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const InputRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
`;

const CheckButton = styled.button`
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  padding: 0 14px;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
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

const TwoColRow = styled.div`
  display: flex;
  gap: 10px;
`;

const Select = styled.select`
  flex: 1;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 13px 12px;
  font-size: 14px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
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

/* 지역 선택 버튼 — 팀 생성(RegionPickerSheet)과 동일한 방식으로 통일 */
const RegionSelectBtn = styled.button`
  width: 100%;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 13px 12px;
  font-size: 14px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  color: ${({ $muted, theme }) =>
    $muted ? theme.colors.textWeak : theme.colors.textStrong};
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }
`;

/* ── 상세 프로필 메뉴 ── */
const MenuList = styled.div`
  display: flex;
  flex-direction: column;
`;

const MenuRow = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  padding: 15px 2px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;

  &:first-child {
    padding-top: 4px;
  }
  &:last-child {
    border-bottom: none;
    padding-bottom: 2px;
  }

  &:active {
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  }
`;

const MenuLabel = styled.div`
  font-size: 14.5px;
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

/* 아직 안 채운 값은 흐리게, 채운 값은 진하게 → 한눈에 진행도 파악 */
const MenuValue = styled.div`
  font-size: 12.5px;
  font-weight: ${({ $empty }) => ($empty ? 500 : 700)};
  color: ${({ $empty, theme }) =>
    $empty ? theme.colors.textWeak : theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 210px;
`;

const MenuChevron = styled.div`
  font-size: 20px;
  color: ${({ theme }) => theme.colors.textWeak};
  flex-shrink: 0;
`;

/* ── 미리보기 ── */
const PreviewButton = styled.button`
  width: 100%;
  height: 46px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:active {
    transform: translateY(1px);
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  }
`;

const PreviewHint = styled.p`
  margin: 0;
  text-align: center;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ── 하단 고정 저장 바 ── */
const SaveBar = styled.div`
  position: sticky;
  bottom: 0;
  margin: 4px -14px 0;
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
  display: flex;
  gap: 10px;
  background: ${({ theme }) => theme.colors.bg};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const GhostButton = styled.button`
  flex: 0 0 34%;
  height: 50px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const PrimaryButton = styled.button`
  flex: 1;
  height: 50px;
  border-radius: 14px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 8px 18px -8px ${({ theme }) => theme.colors.primary};

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
    box-shadow: none;
  }
`;
