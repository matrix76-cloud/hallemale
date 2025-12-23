/* eslint-disable */
// src/pages/my/MyProfileEditPage.jsx
// ✅ 실데이터 + 아바타 업로드(압축→Storage→avatarUrl 저장) 적용 버전
// ✅ 지역 2단계 선택(시/도 → 구/군) 추가: regionSido / regionGu / region(합본) 저장
// ✅ 경기 소개 · 사진/동영상(사진 즉시 업로드/압축 + 유튜브 링크) 추가 (최대 10개)
// ✅ 팀 가입 신청: 실데이터(clubs) 기반 TeamSelectModal 사용
//    - 신청(pending) 상태면 팀 선택 버튼 숨김 + 신청한 팀 카드(로고/팀명/지역/신청일시) 표시
//    - 거절(rejected) 등은 다시 팀 선택 가능

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { images, playerAvatars } from "../../utils/imageAssets";
import { KR_AREAS } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/userService";
import {
  uploadUserAvatar,
  uploadCompressedImageMedia,
  createYoutubeMediaItem,
  deleteMediaItem,
} from "../../services/mediaService";
import { getClubForPickerRow } from "../../services/teamService";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import TeamSelectModal from "../../components/team/TeamSelectModal";

/* ===== 레이아웃 ===== */

const Page = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 16px 14px 32px;
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 520px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  padding: 18px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/* ===== 섹션 공통 ===== */

const Section = styled.section`
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 14px;

  &:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: "GmarketSans";
`;

const SectionSub = styled.p`
  margin: 0;
  font-size: 12px;
  color: #6b7280;
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
  padding: 8px 10px;
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
  min-height: 80px;
  resize: none;
  background: #f9fafb;

  &:focus {
    border-color: #4f46e5;
    background: #ffffff;
  }
`;

/* ===== 아바타 ===== */

const AvatarWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AvatarCircle = styled.button`
  width: 72px;
  height: 72px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
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
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 500;
  color: #111827;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

/* ===== 칩(포지션, 실력) ===== */

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.button`
  border-radius: 999px;
  border: 1px solid ${({ $active }) => ($active ? "#4f46e5" : "#e5e7eb")};
  background: ${({ $active }) => ($active ? "#eef2ff" : "#ffffff")};
  padding: 6px 10px;
  font-size: 12px;
  color: ${({ $active }) => ($active ? "#4f46e5" : "#374151")};
  cursor: pointer;
`;

/* ===== 키 / 몸무게 콤보 ===== */

const TwoColRow = styled.div`
  display: flex;
  gap: 8px;
`;

const Select = styled.select`
  flex: 1;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 7px 9px;
  font-size: 13px;
  background: #f9fafb;
  outline: none;

  &:focus {
    border-color: #4f46e5;
    background: #ffffff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

/* ===== 경력 리스트 ===== */

const CareerList = styled.ul`
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CareerItemRow = styled.li`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #374151;
`;

const CareerBullet = styled.span`
  font-size: 10px;
  color: #9ca3af;
`;

const CareerRemove = styled.button`
  border: none;
  background: none;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
`;

/* ===== 팀 신청 표시 ===== */

const TeamSummaryRow = styled.div`
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TeamSummaryText = styled.div`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamNameStrong = styled.span`
  font-weight: 600;
`;

const TeamSelectButton = styled.button`
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 500;
  color: #111827;
  cursor: pointer;
`;

const JoinStatusText = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: #4f46e5;
`;

/* ===== 하단 버튼 ===== */

const ActionsRow = styled.div`
  margin-top: 10px;
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
    opacity: 0.4;
    cursor: default;
  }
`;

/* ===== 미디어(경기 소개 · 사진/동영상) ===== */

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`;

const MediaCard = styled.div`
  position: relative;
  height: 140px;
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
`;

const MediaAddTile = styled.button`
  height: 140px;
  border-radius: 14px;
  border: 1px dashed #d1d5db;
  background: #fafafa;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const MediaThumb = styled.button`
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
`;

const MediaImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const MediaPlayBadge = styled.div`
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
`;

const MediaCaption = styled.div`
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.55);
  color: #ffffff;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MediaRemove = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MediaPlus = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 900;
`;

const MediaAddText = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: #111827;
`;

/* ===== 공용 모달 ===== */

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 16px;
`;

const ModalCard = styled.div`
  width: min(520px, 92vw);
  background: #ffffff;
  border-radius: 18px;
  padding: 14px 14px 32px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ModalTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.div`
  font-size: 15px;
  font-weight: 900;
  color: #111827;
`;

const ModalClose = styled.button`
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
`;

const ModalSub = styled.div`
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
`;

const ModalActionsCol = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 6px;
`;

const ModalRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 6px;
`;

const ModalPrimary = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: none;
  background: #4f46e5;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalGhost = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalInput = styled.input`
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  background: #f9fafb;

  &:focus {
    border-color: #4f46e5;
    background: #ffffff;
  }
`;

const ModalError = styled.div`
  font-size: 12px;
  color: #ef4444;
`;

/* ===== 상수 ===== */

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

const ChoiceCard = styled.button`
  width: 100%;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.06);
  min-height: 84px;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ChoiceLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const ChoiceText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const ChoiceTitle = styled.div`
  font-size: 15px;
  font-weight: 900;
  color: #111827;
`;

const ChoiceSub = styled.div`
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChoiceArrow = styled.div`
  font-size: 22px;
  color: #9ca3af;
  flex-shrink: 0;
`;

const HEIGHT_OPTIONS = Array.from({ length: 61 }).map((_, idx) => 150 + idx);
const WEIGHT_OPTIONS = Array.from({ length: 56 }).map((_, idx) => 45 + idx);

export default function MyProfileEditPage() {
  const nav = useNavigate();
  const { userDoc, loading, refreshUser } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  // ✅ 아바타
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const avatarInputRef = useRef(null);

  // ✅ 프로필 상태
  const [nickname, setNickname] = useState("");
  const [mainPosition, setMainPosition] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [intro, setIntro] = useState("");
  const [careers, setCareers] = useState([]);
  const [careerInput, setCareerInput] = useState("");

  // ✅ 지역
  const [regionSido, setRegionSido] = useState("");
  const [regionGu, setRegionGu] = useState("");

  // ✅ 미디어
  const [mediaItems, setMediaItems] = useState([]);
  const mediaFileRef = useRef(null);
  const [mediaBusy, setMediaBusy] = useState(false);

  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytCaption, setYtCaption] = useState("");
  const [ytError, setYtError] = useState("");

  const [capOpen, setCapOpen] = useState(false);
  const [capText, setCapText] = useState("");
  const [capTargetId, setCapTargetId] = useState("");

  const [didInit, setDidInit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ 팀 신청 상태(SSOT: users/{uid}.joinRequest)
  const joinReq = userDoc?.joinRequest || null;
  const joinReqStatus = String(joinReq?.status || "").trim();
  const isJoinPending = joinReqStatus === "pending";

  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [pendingClubRow, setPendingClubRow] = useState(null);

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

  const getYoutubeThumb = (youtubeId) => {
    if (!youtubeId) return "";
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  };

  const syncMediaToUser = async (next) => {
    if (!uid) return;
    try {
      await updateUserProfile({ uid, media: next });
    } catch (e) {
      console.warn("[MyProfileEdit] media sync failed:", e?.message || e);
    }
  };

  // ✅ 초기 값 세팅(값이 다 비는 문제 방지)
  useEffect(() => {
    if (!uid) return;
    if (loading) return;
    if (didInit) return;

    setNickname(userDoc?.nickname || "");
    setMainPosition(userDoc?.mainPosition || "");
    setSkillLevel(userDoc?.skillLevel || "");
    setHeightCm(
      userDoc?.heightCm === 0 || userDoc?.heightCm ? String(userDoc.heightCm) : ""
    );
    setWeightKg(
      userDoc?.weightKg === 0 || userDoc?.weightKg ? String(userDoc.weightKg) : ""
    );
    setIntro(userDoc?.intro || "");
    setCareers(Array.isArray(userDoc?.careers) ? userDoc.careers : []);

    setMediaItems(Array.isArray(userDoc?.media) ? userDoc.media : []);

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

  // ✅ pending이면 신청한 팀 카드용 로드
  useEffect(() => {
    if (!uid) return;
    if (!isJoinPending) {
      setPendingClubRow(null);
      return;
    }
    const clubId = joinReq?.clubId || "";
    if (!clubId) return;

    let alive = true;
    (async () => {
      try {
        const row = await getClubForPickerRow(clubId);
        if (!alive) return;
        setPendingClubRow(row || null);
      } catch (e) {
        if (!alive) return;
        setPendingClubRow(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid, isJoinPending, joinReq?.clubId]);

  const formatJoinAt = (tsLike) => {
    try {
      if (!tsLike) return "";
      const d =
        typeof tsLike?.toDate === "function"
          ? tsLike.toDate()
          : tsLike instanceof Date
          ? tsLike
          : null;
      if (!d) return "";
      return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

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

  const handleAddCareer = () => {
    const v = careerInput.trim();
    if (!v) return;
    setCareers((prev) => [...prev, v]);
    setCareerInput("");
  };

  const handleRemoveCareer = (idx) => {
    setCareers((prev) => prev.filter((_, i) => i !== idx));
  };

  const openAddPicker = () => setAddPickerOpen(true);
  const closeAddPicker = () => setAddPickerOpen(false);

  const openYoutubeModal = () => {
    setYtUrl("");
    setYtCaption("");
    setYtError("");
    setYtOpen(true);
  };

  const closeYoutubeModal = () => setYtOpen(false);

  const openCaptionModalFor = (id) => {
    setCapTargetId(id || "");
    setCapText("");
    setCapOpen(true);
  };

  const closeCaptionModal = () => {
    setCapOpen(false);
    setCapTargetId("");
    setCapText("");
  };

  const handleAddMediaClick = () => {
    if (!uid) {
      window.alert("로그인 정보가 없습니다.");
      return;
    }
    if (mediaBusy) return;
    if ((mediaItems?.length || 0) >= 10) {
      window.alert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
      return;
    }
    openAddPicker();
  };

  const handleChooseAddPhoto = () => {
    closeAddPicker();
    mediaFileRef.current?.click();
  };

  const handleChooseAddYoutube = () => {
    closeAddPicker();
    openYoutubeModal();
  };

  const handleSubmitYoutube = async () => {
    const url = String(ytUrl || "").trim();
    if (!url) return;

    try {
      const base = createYoutubeMediaItem(url);
      const item = { ...base, caption: String(ytCaption || "").trim() };

      const next = [...(mediaItems || []), item];
      setMediaItems(next);
      await syncMediaToUser(next);
      closeYoutubeModal();
    } catch (e) {
      setYtError(e?.message || "유튜브 링크를 확인해 주세요.");
    }
  };

  const handleSaveCaption = async () => {
    const id = capTargetId;
    if (!id) return;

    const next = (mediaItems || []).map((m) => {
      if (m.id !== id) return m;
      return { ...m, caption: String(capText || "").trim() };
    });

    setMediaItems(next);
    await syncMediaToUser(next);
    closeCaptionModal();
  };

  const handlePickMediaFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!uid) {
      window.alert("로그인 정보가 없습니다.");
      return;
    }
    if ((mediaItems?.length || 0) >= 10) {
      window.alert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
      return;
    }

    setMediaBusy(true);
    try {
      const uploaded = await uploadCompressedImageMedia({
        scope: "users",
        ownerId: uid,
        file,
        kind: "highlight",
      });

      const itemWithCaption = { ...uploaded, caption: "" };
      const next = [...(mediaItems || []), itemWithCaption];

      setMediaItems(next);
      await syncMediaToUser(next);

      openCaptionModalFor(itemWithCaption.id);
    } catch (e2) {
      console.warn("[MyProfileEdit] media upload failed:", e2?.message || e2);
      window.alert("사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  const handleRemoveMedia = async (item) => {
    if (!item?.id) return;
    if (mediaBusy) return;

    const ok = window.confirm("삭제할까요?");
    if (!ok) return;

    setMediaBusy(true);
    try {
      await deleteMediaItem({ item });

      const next = (mediaItems || []).filter((x) => x.id !== item.id);
      setMediaItems(next);
      await syncMediaToUser(next);
    } catch (e) {
      console.warn("[MyProfileEdit] media delete failed:", e?.message || e);
      window.alert("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  const canSaveProfile = nickname.trim().length > 0 && !!uid;

  const handleSaveProfile = async () => {
    if (!canSaveProfile) {
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
        mainPosition: mainPosition || null,
        skillLevel: skillLevel || null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        intro: intro.trim(),
        careers,
        avatarUrl: nextAvatarUrl,

        regionSido: regionSido || null,
        regionGu: regionGu || null,
        region: regionText || null,

        media: Array.isArray(mediaItems) ? mediaItems : [],
      });

      try {
        await refreshUser?.();
      } catch (e) {}

      window.alert("프로필이 저장되었습니다.");
      nav("/my");
    } catch (e) {
      console.warn("[MyProfileEdit] save failed:", e?.message || e);
      window.alert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTeamModalSubmitted = async () => {
    setTeamPickerOpen(false);
    try {
      await refreshUser?.(); // ✅ users/{uid}.joinRequest 즉시 반영
    } catch (e) {}
    window.alert("팀에 가입 신청을 보냈습니다.");
  };


  const hasTeam = !!(userDoc?.activeTeamId || userDoc?.clubId);

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
                <span style={{ fontSize: 11, color: "#ef4444" }}>
                  로그인 정보가 없습니다. 다시 로그인해 주세요.
                </span>
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
            <LabelRow>
              <Label htmlFor="nickname">닉네임</Label>
              <LabelSub>팀원과 다른 사용자에게 보이는 이름입니다.</LabelSub>
            </LabelRow>
            <Input
              id="nickname"
              placeholder="예) 한주성"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </FieldGroup>

          <FieldGroup>
            <LabelRow>
              <Label>지역</Label>
              <LabelSub>시/도와 구/군을 순서대로 선택해 주세요.</LabelSub>
            </LabelRow>

            <TwoColRow>
              <Select value={regionSido || ""} onChange={(e) => setRegionSido(e.target.value)}>
                <option value="">시/도 선택</option>
                {sidoOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>

              <Select
                value={regionGu || ""}
                onChange={(e) => setRegionGu(e.target.value)}
                disabled={!regionSido}
              >
                <option value="">{regionSido ? "구/군 선택" : "시/도 먼저 선택"}</option>
                {guOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </TwoColRow>

            {(regionSido || regionGu) && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                현재 선택:{" "}
                <span style={{ fontWeight: 600, color: "#111827" }}>
                  {`${regionSido || ""}${regionSido && regionGu ? " " : ""}${regionGu || ""}`.trim() || "-"}
                </span>
              </div>
            )}
          </FieldGroup>
        </Section>

        <Section>
          <SectionHeader>
            <SectionTitle>포지션 · 실력</SectionTitle>
            <SectionSub>대략적인 포지션과 실력을 선택해 주세요.</SectionSub>
          </SectionHeader>

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
        </Section>

        <Section>
          <SectionHeader>
            <SectionTitle>키 · 몸무게</SectionTitle>
            <SectionSub>콤보박스에서 대략적인 값을 선택해 주세요.</SectionSub>
          </SectionHeader>

          <TwoColRow>
            <FieldGroup>
              <Label htmlFor="height">키</Label>
              <Select id="height" value={heightCm || ""} onChange={(e) => setHeightCm(e.target.value)}>
                <option value="">선택 안 함</option>
                {HEIGHT_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}cm
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="weight">몸무게</Label>
              <Select id="weight" value={weightKg || ""} onChange={(e) => setWeightKg(e.target.value)}>
                <option value="">선택 안 함</option>
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}kg
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </TwoColRow>
        </Section>

        <Section>
          <SectionHeader>
            <SectionTitle>소개 · 경력</SectionTitle>
            <SectionSub>팀장과 다른 팀이 참고할 수 있는 정보입니다.</SectionSub>
          </SectionHeader>

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
            <TwoColRow>
              <Input
                placeholder="예) 대학 농구 동아리 리그 우승 1회"
                value={careerInput}
                style={{ width: "70%" }}
                onChange={(e) => setCareerInput(e.target.value)}
              />
              <SmallButton type="button" onClick={handleAddCareer}>
                + 추가
              </SmallButton>
            </TwoColRow>

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
        </Section>

        <Section>
          <SectionHeader>
            <SectionTitle>경기 소개 · 사진/동영상</SectionTitle>
            <SectionSub>사진은 즉시 업로드(압축)되고, 동영상은 유튜브 링크로 추가해요. (최대 10개)</SectionSub>
          </SectionHeader>

          <MediaGrid>
            {(mediaItems || []).map((m) => {
              const isYoutube = m.type === "youtube";
              const thumb = isYoutube ? getYoutubeThumb(m.youtubeId) : m.url;
              const caption = String(m.caption || "").trim();

              return (
                <MediaCard key={m.id}>
                  <MediaThumb type="button" onClick={() => window.open(m.url, "_blank")} title="새 창에서 보기">
                    <MediaImg src={thumb || ""} alt="media" />
                    {isYoutube ? <MediaPlayBadge>▶</MediaPlayBadge> : null}
                    {caption ? <MediaCaption>{caption}</MediaCaption> : null}
                  </MediaThumb>

                  <MediaRemove type="button" onClick={() => handleRemoveMedia(m)} disabled={mediaBusy} title="삭제">
                    ×
                  </MediaRemove>
                </MediaCard>
              );
            })}

            <MediaAddTile type="button" onClick={handleAddMediaClick} disabled={mediaBusy} title="추가">
              <MediaPlus>+</MediaPlus>
              <MediaAddText>{mediaBusy ? "처리 중..." : "추가"}</MediaAddText>
            </MediaAddTile>
          </MediaGrid>

          <input
            ref={mediaFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePickMediaFile}
          />
        </Section>

          {!hasTeam ? (
          <Section>
            <SectionHeader>
              <SectionTitle>팀 가입 신청</SectionTitle>
              <SectionSub>관심 있는 팀에 가입 신청을 할 수 있어요.</SectionSub>
            </SectionHeader>

            <FieldGroup>
              <LabelRow>
                <Label>지원할 팀</Label>
                <LabelSub>한 번에 한 팀만 선택할 수 있습니다.</LabelSub>
              </LabelRow>

              {isJoinPending ? (
                <>
                  <TeamSummaryRow style={{ alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 999, overflow: "hidden", background: "#e5e7eb", flexShrink: 0 }}>
                        <img
                          src={pendingClubRow?.logoUrl || images.logo}
                          alt="team"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = images.logo;
                          }}
                        />
                      </div>

                      <TeamSummaryText style={{ whiteSpace: "nowrap" }}>
                        <TeamNameStrong>{pendingClubRow?.name || "팀"}</TeamNameStrong>
                        {" · "}
                        {pendingClubRow?.regionLabel || "지역 미지정"}
                        {" · "}
                        {(pendingClubRow?.totalMatches ?? 0)}경기 · 승률 {(pendingClubRow?.winRatePercent ?? 0)}%
                      </TeamSummaryText>
                    </div>

                    <div style={{ fontSize: 11, color: "#4f46e5", flexShrink: 0 }}>
                      신청 중
                    </div>
                  </TeamSummaryRow>

                  <JoinStatusText style={{ color: "#4f46e5" }}>
                    {formatJoinAt(joinReq?.createdAt) ? (
                      <>신청일시: {formatJoinAt(joinReq?.createdAt)}</>
                    ) : (
                      <>팀에 가입 신청 중입니다.</>
                    )}
                  </JoinStatusText>
                </>
              ) : (
                <>
                  <TeamSummaryRow>
                    <TeamSummaryText>
                      선택된 팀이 없습니다. 팀을 선택해 주세요.
                    </TeamSummaryText>
                    <TeamSelectButton type="button" onClick={() => setTeamPickerOpen(true)}>
                      팀 선택
                    </TeamSelectButton>
                  </TeamSummaryRow>

                  {joinReqStatus === "rejected" ? (
                    <JoinStatusText style={{ color: "#ef4444" }}>
                      이전 신청이 거절되었습니다. 다른 팀을 선택해 다시 신청할 수 있어요.
                    </JoinStatusText>
                  ) : null}
                </>
              )}
            </FieldGroup>
          </Section>
        ) : null}


        <ActionsRow>
          <GhostButton type="button" onClick={() => nav("/my")}>
            취소
          </GhostButton>
          <PrimaryButton type="button" disabled={!canSaveProfile || isSaving} onClick={handleSaveProfile}>
            {isSaving ? "저장 중..." : "프로필 저장"}
          </PrimaryButton>
        </ActionsRow>
      </Card>

      {/* ✅ 팀 선택 모달: pending일 땐 열리지 않게 */}
      <TeamSelectModal
        open={teamPickerOpen && !isJoinPending}
        onClose={() => setTeamPickerOpen(false)}
        onSubmitted={handleTeamModalSubmitted}
      />

      {/* ✅ 추가 방식 선택 팝업 */}
      {addPickerOpen ? (
        <ModalOverlay onClick={closeAddPicker}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>추가하기</ModalTitle>
              <ModalClose type="button" onClick={closeAddPicker}>
                ×
              </ModalClose>
            </ModalTop>

            <ModalSub>추가할 항목을 선택해 주세요.</ModalSub>

            <ModalActionsCol>
              <ChoiceCard type="button" onClick={handleChooseAddPhoto} disabled={mediaBusy}>
                <ChoiceLeft>
                  <ChoiceText>
                    <ChoiceTitle>사진 추가</ChoiceTitle>
             
                  </ChoiceText>
                </ChoiceLeft>
                <ChoiceArrow>›</ChoiceArrow>
              </ChoiceCard>

              <ChoiceCard type="button" onClick={handleChooseAddYoutube} disabled={mediaBusy}>
                <ChoiceLeft>
                  <ChoiceText>
                    <ChoiceTitle>유튜브 추가</ChoiceTitle>

                  </ChoiceText>
                </ChoiceLeft>
                <ChoiceArrow>›</ChoiceArrow>
              </ChoiceCard>
            </ModalActionsCol>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      {/* ✅ 유튜브 링크 입력 팝업 */}
      {ytOpen ? (
        <ModalOverlay onClick={closeYoutubeModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>유튜브 추가</ModalTitle>
              <ModalClose type="button" onClick={closeYoutubeModal}>
                ×
              </ModalClose>
            </ModalTop>



            <ModalInput
              value={ytUrl}
              onChange={(e) => {
                setYtUrl(e.target.value);
                setYtError("");
              }}
              placeholder="예) https://youtu.be/VIDEO_ID"
            />

            <ModalInput
              value={ytCaption}
              onChange={(e) => setYtCaption(e.target.value)}
              placeholder="설명 (예: 12/3 vs 리버울브즈 · 4쿼터 하이라이트)"
            />

            {ytError ? <ModalError>{ytError}</ModalError> : null}

            <ModalRow>
              <ModalGhost type="button" onClick={closeYoutubeModal}>
                취소
              </ModalGhost>
              <ModalPrimary type="button" onClick={handleSubmitYoutube} disabled={!ytUrl.trim()}>
                추가
              </ModalPrimary>
            </ModalRow>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      {/* ✅ 사진 업로드 직후 캡션 팝업 */}
      {capOpen ? (
        <ModalOverlay onClick={closeCaptionModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>설명 추가</ModalTitle>
              <ModalClose type="button" onClick={closeCaptionModal}>
                ×
              </ModalClose>
            </ModalTop>

            <ModalSub>어떤 경기/장면인지 한 줄로 적어 주세요.</ModalSub>

            <ModalInput
              value={capText}
              onChange={(e) => setCapText(e.target.value)}
              placeholder="예) 12/3 vs 리버울브즈 · 4쿼터 리바운드"
            />

            <ModalRow>
              <ModalGhost type="button" onClick={closeCaptionModal}>
                건너뛰기
              </ModalGhost>
              <ModalPrimary type="button" onClick={handleSaveCaption}>
                저장
              </ModalPrimary>
            </ModalRow>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </Page>
  );
}
