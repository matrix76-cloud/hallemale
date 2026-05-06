/* eslint-disable */
// src/pages/admin/AdminBannersPage.jsx
// 홈 히어로 배너 등록/수정/삭제/순서 관리
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImage,
} from "../../services/bannersService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const SpecBox = styled.div`
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(99,102,241,0.10)" : "#eef2ff"};
  color: ${({ theme }) => theme?.colors?.textNormal || "#374151"};
  font-size: 12px;
  line-height: 1.6;

  strong {
    color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
`;

const Tab = styled.button`
  height: 34px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 14px;
  cursor: pointer;
  ${({ $active }) => ($active ? "border-color: transparent;" : "")}
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Card = styled.section`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 16px;
`;

const PrimaryHeaderBtn = styled.button`
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:active { transform: translateY(1px); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
  overflow-y: auto;
`;

const ModalBox = styled.div`
  width: min(820px, 96vw);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
  padding: 18px;
`;

const ModalHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const CloseBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
`;

const CardTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 12px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  align-items: start;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const ImageBox = styled.div`
  width: 220px;
  height: 140px;
  border-radius: 10px;
  border: 1.5px dashed ${({ theme }) => theme?.colors?.border || "#d1d5db"};
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
  overflow: hidden;
  cursor: pointer;
  position: relative;
`;

const ImagePreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ImagePlaceholder = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  text-align: center;
  padding: 12px;
  line-height: 1.5;
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 140px;
`;

const Label = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Input = styled.input`
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Textarea = styled.textarea`
  min-height: 60px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  font-family: inherit;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Select = styled.select`
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
`;

const ToggleRow = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  cursor: pointer;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
`;

const Btn = styled.button`
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $primary, theme }) =>
    $primary ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  ${({ $primary }) => ($primary ? "border-color: transparent;" : "")}
  font-size: 13px;
  font-weight: 600;
  padding: 0 14px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const DangerBtn = styled(Btn)`
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
`;

const HiddenInput = styled.input`
  display: none;
`;

/* ===== 목록 ===== */

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Item = styled.div`
  display: grid;
  grid-template-columns: 160px 1fr auto;
  gap: 14px;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 10px;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  align-items: center;
`;

const Thumb = styled.div`
  width: 160px;
  height: 92px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme?.colors?.surface || "#f3f4f6"};
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ItemMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const ItemTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: pre-line;
`;

const ItemDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const ItemMetaRow = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const InactiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const EmptyText = styled.div`
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

function makeEmptyForm() {
  return {
    id: null,
    title: "",
    desc: "",
    imageUrl: "",
    storagePath: "",
    side: "left",
    textAlign: "left",
    order: 0,
    active: true,
  };
}

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminBannersPage() {
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [form, setForm] = useState(makeEmptyForm());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const isEditing = !!form.id;

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAllBanners();
      setList(rows);
    } catch (e) {
      console.error("[AdminBannersPage] load failed", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handlePickImage = () => {
    if (busy || uploading) return;
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadBannerImage(file);
      updateForm({ imageUrl, storagePath });
    } catch (err) {
      console.error("[AdminBannersPage] upload failed", err);
      window.alert(err?.message || "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenCreate = () => {
    setForm(makeEmptyForm());
    setFormOpen(true);
  };

  const handleEdit = (row) => {
    setForm({
      id: row.id,
      title: row.title,
      desc: row.desc,
      imageUrl: row.imageUrl,
      storagePath: row.storagePath,
      side: row.side,
      textAlign: row.textAlign,
      order: row.order,
      active: row.active,
    });
    setFormOpen(true);
  };

  const handleCancelEdit = () => {
    setForm(makeEmptyForm());
    setFormOpen(false);
  };

  const handleSave = async () => {
    if (!form.imageUrl) {
      window.alert("이미지를 업로드해주세요.");
      return;
    }
    if (!form.title.trim()) {
      window.alert("제목을 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      if (isEditing) {
        await updateBanner(form.id, form);
      } else {
        await createBanner(form);
      }
      setForm(makeEmptyForm());
      setFormOpen(false);
      await load();
    } catch (e) {
      console.error("[AdminBannersPage] save failed", e);
      window.alert(e?.message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`"${row.title || row.id}" 배너를 삭제하시겠습니까?`)) return;
    setBusy(true);
    try {
      await deleteBanner({ id: row.id, storagePath: row.storagePath });
      if (form.id === row.id) {
        setForm(makeEmptyForm());
        setFormOpen(false);
      }
      await load();
    } catch (e) {
      console.error("[AdminBannersPage] delete failed", e);
      window.alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (row) => {
    setBusy(true);
    try {
      await updateBanner(row.id, { active: !row.active });
      await load();
    } catch (e) {
      console.error("[AdminBannersPage] toggle active failed", e);
      window.alert(e?.message || "상태 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>홈 배너</Title>
          <Sub style={{ marginTop: 4 }}>
            홈 상단 슬라이드 배너를 등록·수정·삭제합니다. 비활성 배너는 사용자에게 노출되지
            않습니다.
          </Sub>
        </div>
        <PrimaryHeaderBtn type="button" onClick={handleOpenCreate}>
          + 새 배너 등록
        </PrimaryHeaderBtn>
      </HeaderRow>

      <BannersSection
        form={form}
        updateForm={updateForm}
        fileRef={fileRef}
        handlePickImage={handlePickImage}
        handleFileChange={handleFileChange}
        handleSave={handleSave}
        handleCancelEdit={handleCancelEdit}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleToggleActive={handleToggleActive}
        isEditing={isEditing}
        uploading={uploading}
        busy={busy}
        loading={loading}
        list={list}
        formOpen={formOpen}
      />
    </Page>
  );
}

function BannersSection({
  form,
  updateForm,
  fileRef,
  handlePickImage,
  handleFileChange,
  handleSave,
  handleCancelEdit,
  handleEdit,
  handleDelete,
  handleToggleActive,
  isEditing,
  uploading,
  busy,
  loading,
  list,
  formOpen,
}) {
  return (
    <>
      <SpecBox>
        📐 권장 이미지 규격: <strong>1200 × 600 px (가로:세로 = 2:1)</strong>{" "}
        / PNG·JPG / 5MB 이하<br />
        업로드 시 자동으로 1080px로 압축됩니다. 텍스트(제목·설명)는 이미지 위에 따로 그려지므로
        텍스트가 들어간 이미지 대신 <strong>여백이 있는 일러스트/사진</strong>을 권장합니다.
        <br />이미지 위치(왼쪽/오른쪽)와 텍스트 정렬을 조합해 자연스럽게 맞춰주세요.
      </SpecBox>

      {/* 등록/수정 폼 (모달) */}
      {formOpen && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy && !uploading) handleCancelEdit();
          }}
        >
          <ModalBox onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <CardTitle style={{ margin: 0 }}>
                {isEditing ? "배너 수정" : "새 배너 등록"}
              </CardTitle>
              <CloseBtn type="button" onClick={handleCancelEdit} disabled={busy || uploading}>
                ×
              </CloseBtn>
            </ModalHead>

        <FormGrid>
          <ImageBox onClick={handlePickImage}>
            {form.imageUrl ? (
              <ImagePreview src={form.imageUrl} alt="banner preview" />
            ) : (
              <ImagePlaceholder>
                {uploading ? "업로드 중…" : "클릭해서\n이미지 선택"}
              </ImagePlaceholder>
            )}
          </ImageBox>

          <FormCol>
            <Field>
              <Label>제목 (줄바꿈은 \n 가능)</Label>
              <Textarea
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder="예: 팀 만들고\n오늘 한 판 어때?"
              />
            </Field>

            <Field>
              <Label>설명</Label>
              <Input
                value={form.desc}
                onChange={(e) => updateForm({ desc: e.target.value })}
                placeholder="예: 친구/동호회 팀 생성하고 바로 매칭"
              />
            </Field>

            <Row>
              <Field>
                <Label>이미지 위치</Label>
                <Select
                  value={form.side}
                  onChange={(e) => updateForm({ side: e.target.value })}
                >
                  <option value="left">왼쪽 (이미지 왼쪽 / 텍스트 오른쪽)</option>
                  <option value="right">오른쪽 (이미지 오른쪽 / 텍스트 왼쪽)</option>
                </Select>
              </Field>

              <Field>
                <Label>텍스트 정렬</Label>
                <Select
                  value={form.textAlign}
                  onChange={(e) => updateForm({ textAlign: e.target.value })}
                >
                  <option value="left">왼쪽 정렬</option>
                  <option value="right">오른쪽 정렬</option>
                </Select>
              </Field>

              <Field>
                <Label>표시 순서 (작을수록 앞)</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => updateForm({ order: e.target.value })}
                />
              </Field>
            </Row>

            <ToggleRow>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateForm({ active: e.target.checked })}
              />
              사용자에게 노출 (활성)
            </ToggleRow>

            <Actions>
              {isEditing && (
                <Btn type="button" onClick={handleCancelEdit} disabled={busy}>
                  취소
                </Btn>
              )}
              <Btn
                type="button"
                $primary
                onClick={handleSave}
                disabled={busy || uploading}
              >
                {busy ? "저장 중…" : isEditing ? "수정 저장" : "배너 등록"}
              </Btn>
            </Actions>
          </FormCol>
        </FormGrid>

        <HiddenInput
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
          </ModalBox>
        </Overlay>
      )}

      {/* 목록 */}
      <Card>
        <CardTitle>등록된 배너 ({list.length})</CardTitle>

        {loading ? (
          <AdminLoading />
        ) : list.length === 0 ? (
          <EmptyText>등록된 배너가 없습니다.</EmptyText>
        ) : (
          <ListWrap>
            {list.map((row) => (
              <Item key={row.id}>
                <Thumb>
                  {row.imageUrl ? <ThumbImg src={row.imageUrl} alt="" /> : null}
                </Thumb>

                <ItemMeta>
                  <ItemTitle>{row.title || "(제목 없음)"}</ItemTitle>
                  <ItemDesc>{row.desc || "-"}</ItemDesc>
                  <ItemMetaRow>
                    <span>이미지: {row.side === "right" ? "오른쪽" : "왼쪽"}</span>
                    <span>정렬: {row.textAlign === "right" ? "오른쪽" : "왼쪽"}</span>
                    <span>순서: {row.order}</span>
                    <span>{fmtYmdHm(row.createdAt)}</span>
                    {!row.active && <InactiveBadge>비활성</InactiveBadge>}
                  </ItemMetaRow>
                </ItemMeta>

                <ItemActions>
                  <Btn type="button" onClick={() => handleToggleActive(row)} disabled={busy}>
                    {row.active ? "비활성화" : "활성화"}
                  </Btn>
                  <Btn type="button" onClick={() => handleEdit(row)} disabled={busy}>
                    수정
                  </Btn>
                  <DangerBtn type="button" onClick={() => handleDelete(row)} disabled={busy}>
                    삭제
                  </DangerBtn>
                </ItemActions>
              </Item>
            ))}
          </ListWrap>
        )}
      </Card>
    </>
  );
}
