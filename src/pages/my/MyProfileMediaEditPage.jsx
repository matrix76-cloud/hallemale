/* eslint-disable */
// src/pages/my/MyProfileMediaEditPage.jsx
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import { updateUserProfile } from "../../services/userService";
import {
  uploadCompressedImageMedia,
  createYoutubeMediaItem,
  deleteMediaItem,
} from "../../services/mediaService";

export default function MyProfileMediaEditPage() {
  const nav = useNavigate();
  const { userDoc, loading, refreshUser } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [mediaItems, setMediaItems] = useState([]);
  const mediaFileRef = useRef(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [didInit, setDidInit] = useState(false);

  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytCaption, setYtCaption] = useState("");
  const [ytError, setYtError] = useState("");

  const [capOpen, setCapOpen] = useState(false);

  // 안드로이드 뒤로가기 → 열린 시트/모달부터 닫기
  useBackInterceptor(addPickerOpen || ytOpen || capOpen, () => {
    if (ytOpen) setYtOpen(false);
    else if (capOpen) setCapOpen(false);
    else if (addPickerOpen) setAddPickerOpen(false);
  });
  const [capText, setCapText] = useState("");
  const [capTargetId, setCapTargetId] = useState("");

  useEffect(() => {
    if (!uid || loading || didInit) return;
    setMediaItems(Array.isArray(userDoc?.media) ? userDoc.media : []);
    setDidInit(true);
  }, [uid, loading, didInit, userDoc]);

  const getYoutubeThumb = (youtubeId) =>
    youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : "";

  const syncMediaToUser = async (next) => {
    if (!uid) return;
    try {
      await updateUserProfile({ uid, media: next });
      try { await refreshUser?.(); } catch (e) {}
    } catch (e) {
      console.warn("[MyProfileMediaEdit] media sync failed:", e?.message || e);
    }
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
      showAlert("로그인 정보가 없습니다.");
      return;
    }
    if (mediaBusy) return;
    if ((mediaItems?.length || 0) >= 10) {
      showAlert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
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
      showAlert("로그인 정보가 없습니다.");
      return;
    }
    if ((mediaItems?.length || 0) >= 10) {
      showAlert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
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
      console.warn("[MyProfileMediaEdit] media upload failed:", e2?.message || e2);
      showAlert("사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  const handleRemoveMedia = async (item) => {
    if (!item?.id || mediaBusy) return;
    const ok = await showConfirm("삭제할까요?");
    if (!ok) return;
    setMediaBusy(true);
    try {
      await deleteMediaItem({ item });
      const next = (mediaItems || []).filter((x) => x.id !== item.id);
      setMediaItems(next);
      await syncMediaToUser(next);
    } catch (e) {
      console.warn("[MyProfileMediaEdit] media delete failed:", e?.message || e);
      showAlert("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  return (
    <Page>
      <Card>
        <Header>
          <BackBtn type="button" onClick={() => nav(-1)} aria-label="뒤로">‹</BackBtn>
          <Title>경기 소개 · 사진/동영상</Title>
        </Header>

        <Desc>
          사진은 즉시 업로드(압축)되고, 동영상은 유튜브 링크로 추가해요. (최대 10개)
        </Desc>

        <MediaGrid>
          {(mediaItems || []).map((m) => {
            const isYoutube = m.type === "youtube";
            const thumb = isYoutube ? getYoutubeThumb(m.youtubeId) : m.url;
            const caption = String(m.caption || "").trim();

            return (
              <MediaCard key={m.id}>
                <MediaThumb type="button" onClick={() => window.open(m.url, "_blank")}>
                  <MediaImg src={thumb || ""} alt="media" />
                  {isYoutube ? <MediaPlayBadge>▶</MediaPlayBadge> : null}
                  {caption ? <MediaCaption>{caption}</MediaCaption> : null}
                </MediaThumb>
                <MediaRemove type="button" onClick={() => handleRemoveMedia(m)} disabled={mediaBusy}>
                  ×
                </MediaRemove>
              </MediaCard>
            );
          })}

          <MediaAddTile type="button" onClick={handleAddMediaClick} disabled={mediaBusy}>
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

        <ActionsRow>
          <GhostButton type="button" onClick={() => nav(-1)}>닫기</GhostButton>
        </ActionsRow>
      </Card>

      {addPickerOpen ? (
        <ModalOverlay onClick={closeAddPicker}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>추가하기</ModalTitle>
              <ModalClose type="button" onClick={closeAddPicker}>×</ModalClose>
            </ModalTop>
            <ModalSub>추가할 항목을 선택해 주세요.</ModalSub>
            <ModalActionsCol>
              <ChoiceCard type="button" onClick={handleChooseAddPhoto} disabled={mediaBusy}>
                <ChoiceTitle>사진 추가</ChoiceTitle>
                <ChoiceArrow>›</ChoiceArrow>
              </ChoiceCard>
              <ChoiceCard type="button" onClick={handleChooseAddYoutube} disabled={mediaBusy}>
                <ChoiceTitle>유튜브 추가</ChoiceTitle>
                <ChoiceArrow>›</ChoiceArrow>
              </ChoiceCard>
            </ModalActionsCol>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      {ytOpen ? (
        <ModalOverlay onClick={closeYoutubeModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>유튜브 추가</ModalTitle>
              <ModalClose type="button" onClick={closeYoutubeModal}>×</ModalClose>
            </ModalTop>
            <ModalInput
              value={ytUrl}
              onChange={(e) => { setYtUrl(e.target.value); setYtError(""); }}
              placeholder="예) https://youtu.be/VIDEO_ID"
            />
            <ModalInput
              value={ytCaption}
              onChange={(e) => setYtCaption(e.target.value)}
              placeholder="설명 (예: 12/3 vs 리버울브즈 · 4쿼터 하이라이트)"
            />
            {ytError ? <ModalError>{ytError}</ModalError> : null}
            <ModalRow>
              <ModalGhost type="button" onClick={closeYoutubeModal}>취소</ModalGhost>
              <ModalPrimary type="button" onClick={handleSubmitYoutube} disabled={!ytUrl.trim()}>
                추가
              </ModalPrimary>
            </ModalRow>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      {capOpen ? (
        <ModalOverlay onClick={closeCaptionModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>설명 추가</ModalTitle>
              <ModalClose type="button" onClick={closeCaptionModal}>×</ModalClose>
            </ModalTop>
            <ModalSub>어떤 경기/장면인지 한 줄로 적어 주세요.</ModalSub>
            <ModalInput
              value={capText}
              onChange={(e) => setCapText(e.target.value)}
              placeholder="예) 12/3 vs 리버울브즈 · 4쿼터 리바운드"
            />
            <ModalRow>
              <ModalGhost type="button" onClick={closeCaptionModal}>건너뛰기</ModalGhost>
              <ModalPrimary type="button" onClick={handleSaveCaption}>저장</ModalPrimary>
            </ModalRow>
          </ModalCard>
        </ModalOverlay>
      ) : null}
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
  gap: 18px;
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

const Desc = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`;

const MediaCard = styled.div`
  position: relative;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const MediaAddTile = styled.button`
  height: 140px;
  border-radius: 8px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#fafafa"};
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
  border-radius: 8px;
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
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) => theme.colors.primary};
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 900;
`;

const MediaAddText = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
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

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 16px;
`;

const ModalCard = styled.div`
  width: min(520px, 92vw);
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px 24px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModalTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ModalClose = styled.button`
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ModalSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
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
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
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
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`;

const ModalInput = styled.input`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 10px 12px;
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

const ModalError = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.danger};
`;

const ChoiceCard = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  min-height: 64px;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ChoiceTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ChoiceArrow = styled.div`
  font-size: 22px;
  color: ${({ theme }) => theme.colors.textWeak};
  flex-shrink: 0;
`;
