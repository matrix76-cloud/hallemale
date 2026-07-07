/* eslint-disable */
// src/pages/CommunityWritePage.jsx
// ✅ 사진 여러 장(최대 4장) 첨부 + 미리보기 + 개별 삭제

import React, { useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { showAlert } from "../../utils/appDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { createCommunityPost, updateCommunityPost } from "../../services/communityService";
import { images } from "../../utils/imageAssets";
import { useUI } from "../../hooks/useUI";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import { goBackOrHome } from "../../utils/navigation";

// 프로필 사진(실제 업로드본) 보유 여부 — 기본 로고/기본아바타는 '없음'으로 처리
const hasProfilePhoto = (u) => {
  const a = String(u?.avatarUrl || "").trim();
  return !!a && a !== images.logo && a !== images.defaultAvatar;
};

/* =============== 레이아웃 =============== */

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors?.bg || "#ffffff"};
  padding: 12px 0 90px;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

const LabelSub = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
`;

const RequiredMark = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors?.danger || "#ef4444"};
`;

const TitleInput = styled.input`
  border-radius: 8px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.08)"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  padding: 8px 10px;
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  }
`;

const ContentTextarea = styled.textarea`
  border-radius: 8px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.08)"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  padding: 8px 10px;
  font-size: 13px;
  min-height: 160px;
  resize: vertical;
  outline: none;
  line-height: 1.7;

  &:focus {
    border-color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  }
`;

const ImageBox = styled.div`
  border-radius: 8px;
  border: 1px dashed ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.12)"};
  padding: 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#f9fafb"};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ImageInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ImageText = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
`;

const ImageSelectButton = styled.button`
  align-self: flex-start;
  border-radius: 999px;
  border: none;
  padding: 6px 10px;
  font-size: 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0, 0, 0, 0.04)"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  cursor: pointer;

  &:active {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const HiddenFile = styled.input`
  display: none;
`;

const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
`;

const PreviewItem = styled.div`
  position: relative;
  width: 100%;
  padding-top: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#e5e7eb"};
`;

const PreviewImg = styled.div`
  position: absolute;
  inset: 0;
  background-image: ${({ src }) => (src ? `url(${src})` : "none")};
  background-size: cover;
  background-position: center;
`;

const RemoveMini = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.08)"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255, 255, 255, 0.95)"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  font-size: 13px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

/* =============== 하단 등록 버튼 =============== */

const SubmitBar = styled.div`
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors?.card || "#ffffff"};
  border-top: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.04)"};
`;

const SubmitButton = styled.button`
  width: 100%;
  border-radius: 999px;
  border: none;
  padding: 16px 16px;
  font-size: 16px;
  font-weight: 600;
  background: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  color: #ffffff;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:active:not(:disabled) {
    opacity: 0.9;
  }
`;

/* =============== 컴포넌트 =============== */

export default function CommunityWritePage() {
  const nav = useNavigate();
  const location = useLocation();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  // ✅ 수정 모드 (상세페이지에서 state로 넘어옴)
  const editState = location.state || {};
  const editPostId = String(editState.editPostId || "");
  const isEdit = !!editPostId;

  const fileRef = useRef(null);

  const [title, setTitle] = useState(editState.initTitle || "");
  const [content, setContent] = useState(editState.initContent || "");

  const [images, setImages] = useState([]); // [{ file, previewUrl }]
  const [busy, setBusy] = useState(false);

  // ✅ 새 글 작성은 프로필 사진 필수 (수정 모드는 제외)
  React.useEffect(() => {
    if (isEdit || !myUid) return;
    if (!hasProfilePhoto(userDoc)) {
      showAlert("커뮤니티 글 작성을 위해 먼저 프로필 사진을 등록해주세요.");
      nav("/my/profile/edit", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, myUid, userDoc]);

  const isValid = useMemo(() => {
    return String(title || "").trim().length > 0 && String(content || "").trim().length > 0;
  }, [title, content]);

  // 작성/수정 중 안드로이드 뒤로가기 → 내용 유실 방지 확인.
  const { showModal, hideModal } = useUI();
  const dirty =
    !busy &&
    (String(title || "").trim() !== String(editState.initTitle || "").trim() ||
      String(content || "").trim() !== String(editState.initContent || "").trim() ||
      images.length > 0);
  useBackInterceptor(dirty, () => {
    showModal({
      title: isEdit ? "수정 취소" : "작성 취소",
      message: "작성 중인 내용이 사라집니다. 나가시겠어요?",
      onConfirm: () => {
        hideModal();
        goBackOrHome(nav);
      },
      onCancel: () => hideModal(),
    });
  });

  const handlePickImages = () => {
    if (busy) return;
    if (!fileRef.current) return;
    fileRef.current.value = "";
    fileRef.current.click();
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const onlyImages = files.filter((f) => String(f?.type || "").startsWith("image/"));
    if (!onlyImages.length) {
      showAlert("이미지 파일만 선택할 수 있어요.");
      return;
    }

    const remain = Math.max(0, 4 - images.length);
    if (remain <= 0) {
      showAlert("사진은 최대 4장까지 첨부할 수 있어요.");
      return;
    }

    const picked = onlyImages.slice(0, remain);

    const next = [...images];

    picked.forEach((f) => {
      try {
        const url = URL.createObjectURL(f);
        next.push({ file: f, previewUrl: url });
      } catch (err) {
        next.push({ file: f, previewUrl: "" });
      }
    });

    setImages(next);
  };

  const removeAt = (idx) => {
    if (busy) return;
    setImages((prev) => {
      const arr = [...prev];
      const target = arr[idx];
      if (target?.previewUrl) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch (e) {}
      }
      arr.splice(idx, 1);
      return arr;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    if (!myUid) {
      showAlert("로그인이 필요합니다.");
      return;
    }

    if (busy) return;

    try {
      setBusy(true);

      if (isEdit) {
        // ✅ 수정 (분류 제거 — 기존 category 유지)
        await updateCommunityPost({ postId: editPostId, myUid, title, content });
        nav(`/communitypost/${editPostId}`, { replace: true });
        return;
      }

      const res = await createCommunityPost({
        myUid,
        title,
        content,
        imageFiles: images.map((x) => x.file), // ✅ 여러 장
      });

      nav(`/communitypost/${res.postId}`);
    } catch (err) {
      console.error("[CommunityWritePage] submit failed:", err?.code, err?.message, err);
      showAlert(err?.message || "작성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageWrap>
      <Inner>
        <Form id="community-write-form" onSubmit={handleSubmit}>
          <Field>
            <LabelRow>
              <Label htmlFor="title">제목</Label>
              <RequiredMark>*</RequiredMark>
            </LabelRow>
            <TitleInput
              id="title"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </Field>

          <Field>
            <LabelRow>
              <Label htmlFor="content">내용</Label>
              <RequiredMark>*</RequiredMark>
            </LabelRow>
            <ContentTextarea
              id="content"
              placeholder={"내용을 자유롭게 입력해주세요.\n(경기 후기, 게스트 모집 등)"}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={busy}
            />
          </Field>

          <Field>
            <LabelRow>
              <Label>사진 첨부</Label>
              <LabelSub>(선택, 최대 4장)</LabelSub>
            </LabelRow>

            <HiddenFile
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
            />

            <ImageBox>
              <ImageInfo>
                <ImageText>경기 사진이나 공지 이미지를 올려보세요.</ImageText>
                <ImageText>{images.length > 0 ? `${images.length}장 선택됨` : "선택 안됨"}</ImageText>
              </ImageInfo>

              {images.length > 0 && (
                <PreviewGrid>
                  {images.map((img, idx) => (
                    <PreviewItem key={`${idx}-${img?.previewUrl || "img"}`}>
                      <PreviewImg src={img.previewUrl} />
                      <RemoveMini type="button" onClick={() => removeAt(idx)} disabled={busy}>
                        ×
                      </RemoveMini>
                    </PreviewItem>
                  ))}
                </PreviewGrid>
              )}

              <ImageSelectButton
                type="button"
                onClick={handlePickImages}
                disabled={busy || images.length >= 4}
              >
                사진 선택
              </ImageSelectButton>
            </ImageBox>
          </Field>
        </Form>
      </Inner>

      <SubmitBar>
        <SubmitButton
          type="submit"
          form="community-write-form"
          disabled={!isValid || busy}
        >
          {busy ? "작성 중…" : "작성하기"}
        </SubmitButton>
      </SubmitBar>
    </PageWrap>
  );
}
