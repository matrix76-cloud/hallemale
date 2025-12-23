/* eslint-disable */
// src/components/media/MediaSection.jsx
// ✅ 공용 미디어 섹션 (사진 즉시 업로드/압축 + 유튜브 링크 추가)
// - 어디서든 재사용: 프로필/팀/매치/게시글
// - parent는 items/onChange만 주고, Firestore 반영은 parent에서 처리하면 됨.

import React, { useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { FiPlus, FiTrash2, FiX, FiPlay } from "react-icons/fi";
import { uploadCompressedImageMedia, createYoutubeMediaItem, deleteMediaItem } from "../../services/mediaService";

export default function MediaSection({
  scope = "users", // "users" | "teams" | "matches" | "posts" ...
  ownerId = "", // uid/teamId/matchId ...
  items = [],
  onChange,
  maxItems = 10,
  title = "경기 사진 / 영상",
  subtitle = "사진은 바로 업로드되고, 영상은 유튜브 링크로 추가할 수 있어요.",
  columns = 2, // 2 or 3
  imageKind = "highlight", // "highlight" | "avatar" (avatar는 다른 컴포넌트에서 써도 됨)
}) {
  const fileRef = useRef(null);
  const [busyIds, setBusyIds] = useState({});
  const [uploading, setUploading] = useState(false);

  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytError, setYtError] = useState("");

  const canAddMore = (items?.length || 0) < maxItems;

  const gridCols = useMemo(() => {
    const c = Number(columns);
    if (c === 3) return 3;
    return 2;
  }, [columns]);

  const openFilePicker = () => {
    if (!canAddMore) {
      window.alert(`최대 ${maxItems}장까지 추가할 수 있어요.`);
      return;
    }
    if (!ownerId) {
      window.alert("저장 대상 정보가 없습니다. (ownerId 누락)");
      return;
    }
    fileRef.current?.click();
  };

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 가능
    if (!file) return;

    if (!canAddMore) {
      window.alert(`최대 ${maxItems}장까지 추가할 수 있어요.`);
      return;
    }
    if (!ownerId) {
      window.alert("저장 대상 정보가 없습니다. (ownerId 누락)");
      return;
    }

    setUploading(true);
    try {
      const media = await uploadCompressedImageMedia({
        scope,
        ownerId,
        file,
        kind: imageKind,
      });

      const next = [...(items || []), media];
      onChange?.(next);
    } catch (err) {
      console.warn("[MediaSection] upload failed:", err?.message || err);
      window.alert("업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  };

  const openYoutubeModal = () => {
    if (!canAddMore) {
      window.alert(`최대 ${maxItems}장까지 추가할 수 있어요.`);
      return;
    }
    setYtError("");
    setYtUrl("");
    setYtOpen(true);
  };

  const closeYoutubeModal = () => setYtOpen(false);

  const addYoutube = () => {
    try {
      const item = createYoutubeMediaItem(ytUrl);
      const next = [...(items || []), item];
      onChange?.(next);
      closeYoutubeModal();
    } catch (e) {
      setYtError(e?.message || "유튜브 링크를 확인해 주세요.");
    }
  };

  const removeItem = async (item) => {
    if (!item?.id) return;
    const ok = window.confirm("삭제할까요?");
    if (!ok) return;

    setBusyIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      // ✅ 스토리지 파일이 있는 경우만 삭제 (youtube는 스킵)
      await deleteMediaItem({ item });
      const next = (items || []).filter((x) => x.id !== item.id);
      onChange?.(next);
    } catch (e) {
      console.warn("[MediaSection] delete failed:", e?.message || e);
      window.alert("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusyIds((prev) => {
        const c = { ...prev };
        delete c[item.id];
        return c;
      });
    }
  };

  const openMedia = (item) => {
    if (!item) return;
    if (item.type === "image") {
      window.open(item.url, "_blank");
      return;
    }
    if (item.type === "youtube") {
      // ✅ 유튜브는 원본 링크로 열기(추후 embed modal로 바꿔도 됨)
      window.open(item.url, "_blank");
    }
  };

  return (
    <Wrap>
      <HeaderRow>
        <TitleCol>
          <Title>{title}</Title>
          {subtitle ? <Sub>{subtitle}</Sub> : null}
        </TitleCol>

        <RightCol>
          <CountText>
            {items?.length || 0}/{maxItems}
          </CountText>
        </RightCol>
      </HeaderRow>

      <Grid $cols={gridCols}>
        {/* ✅ 사진 추가 타일 */}
        <AddTile
          type="button"
          onClick={openFilePicker}
          disabled={!canAddMore || uploading}
          title={!canAddMore ? `최대 ${maxItems}장` : "사진 추가"}
        >
          <AddIcon>
            <FiPlus size={18} />
          </AddIcon>
          <AddText>{uploading ? "업로드 중..." : "사진 추가"}</AddText>
          <AddHint>즉시 업로드(압축)</AddHint>
        </AddTile>

        {/* ✅ 유튜브 추가 타일 */}
        <AddTile
          type="button"
          onClick={openYoutubeModal}
          disabled={!canAddMore}
          title={!canAddMore ? `최대 ${maxItems}장` : "유튜브 링크 추가"}
        >
          <AddIcon>
            <FiPlay size={18} />
          </AddIcon>
          <AddText>유튜브 추가</AddText>
          <AddHint>링크 붙여넣기</AddHint>
        </AddTile>

        {/* ✅ 아이템 카드들 */}
        {(items || []).map((m) => {
          const busy = !!busyIds[m.id];
          const isYoutube = m.type === "youtube";
          const thumb =
            isYoutube && m.youtubeId
              ? `https://img.youtube.com/vi/${m.youtubeId}/hqdefault.jpg`
              : "";

          return (
            <MediaCard key={m.id}>
              <MediaBtn type="button" onClick={() => openMedia(m)} disabled={busy}>
                {m.type === "image" ? (
                  <ThumbImg src={m.url} alt="media" />
                ) : (
                  <ThumbWrap>
                    <ThumbImg src={thumb || ""} alt="youtube" />
                    <PlayBadge>
                      <FiPlay size={14} />
                    </PlayBadge>
                  </ThumbWrap>
                )}
              </MediaBtn>

              <TrashBtn type="button" onClick={() => removeItem(m)} disabled={busy} title="삭제">
                {busy ? "..." : <FiTrash2 size={14} />}
              </TrashBtn>
            </MediaCard>
          );
        })}
      </Grid>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePickFile}
      />

      {ytOpen ? (
        <ModalOverlay onClick={closeYoutubeModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>유튜브 추가</ModalTitle>
              <ModalClose type="button" onClick={closeYoutubeModal}>
                <FiX size={18} />
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

            {ytError ? <ErrorText>{ytError}</ErrorText> : null}

            <ModalActions>
              <ModalBtn type="button" onClick={closeYoutubeModal}>
                취소
              </ModalBtn>
              <ModalBtnPrimary type="button" onClick={addYoutube} disabled={!ytUrl.trim()}>
                추가
              </ModalBtnPrimary>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </Wrap>
  );
}

/* ================= styled ================= */

const Wrap = styled.section`
  background: #ffffff;
  border-radius: 18px;
  padding: 14px 14px 14px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const TitleCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: #111827;
`;

const Sub = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const RightCol = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CountText = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols}, minmax(0, 1fr));
  gap: 10px;
`;

const AddTile = styled.button`
  height: 120px;
  border-radius: 16px;
  border: 1px dashed #d1d5db;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const AddIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #eef2ff;
  color: #4f46e5;
`;

const AddText = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: #111827;
`;

const AddHint = styled.div`
  font-size: 11px;
  color: #6b7280;
`;

const MediaCard = styled.div`
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: #e5e7eb;
  height: 120px;
`;

const MediaBtn = styled.button`
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
`;

const ThumbWrap = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PlayBadge = styled.div`
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #ffffff;
  display: grid;
  place-items: center;
`;

const TrashBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  color: #ffffff;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

/* modal */

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
  padding: 14px 14px 12px;
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
  cursor: pointer;
  color: #6b7280;
`;

const ModalSub = styled.div`
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
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

const ErrorText = styled.div`
  font-size: 12px;
  color: #ef4444;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
`;

const ModalBtn = styled.button`
  flex: 1;
  height: 40px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
`;

const ModalBtnPrimary = styled.button`
  flex: 1;
  height: 40px;
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
