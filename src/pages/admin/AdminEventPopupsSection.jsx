/* eslint-disable */
// src/pages/admin/AdminEventPopupsSection.jsx
// 이벤트 팝업 등록/수정/삭제 (광고 관리 페이지의 한 섹션)
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listAllEventPopups,
  createEventPopup,
  updateEventPopup,
  deleteEventPopup,
  uploadEventPopupImage,
} from "../../services/eventPopupsService";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SpecBox = styled.div`
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

const Card = styled.section`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 16px;
`;

const CreateRow = styled.div`
  display: flex;
  justify-content: flex-end;
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
  height: 280px;
  border-radius: 10px;
  border: 1.5px dashed ${({ theme }) => theme?.colors?.border || "#d1d5db"};
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
  overflow: hidden;
  cursor: pointer;
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
  min-height: 72px;
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

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Item = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: 14px;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 10px;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  align-items: center;
`;

const Thumb = styled.div`
  width: 120px;
  height: 150px;
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
`;

const ItemBody = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: pre-wrap;
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
    body: "",
    imageUrl: "",
    storagePath: "",
    linkUrl: "",
    linkLabel: "",
    order: 0,
    active: true,
    startAtStr: "",
    endAtStr: "",
  };
}

function fmtDateTimeLocalInput(d) {
  if (!d) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd}T${hh}:${mi}`;
}

function parseDateTimeLocal(s) {
  const v = String(s || "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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

export default function AdminEventPopupsSection() {
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
      const rows = await listAllEventPopups();
      setList(rows);
    } catch (e) {
      console.error("[AdminEventPopupsSection] load failed", e);
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
      const { imageUrl, storagePath } = await uploadEventPopupImage(file);
      updateForm({ imageUrl, storagePath });
    } catch (err) {
      console.error("[AdminEventPopupsSection] upload failed", err);
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
      body: row.body,
      imageUrl: row.imageUrl,
      storagePath: row.storagePath,
      linkUrl: row.linkUrl,
      linkLabel: row.linkLabel,
      order: row.order,
      active: row.active,
      startAtStr: fmtDateTimeLocalInput(row.startAt),
      endAtStr: fmtDateTimeLocalInput(row.endAt),
    });
    setFormOpen(true);
  };

  const handleCancelEdit = () => {
    setForm(makeEmptyForm());
    setFormOpen(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      window.alert("제목을 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        imageUrl: form.imageUrl,
        storagePath: form.storagePath,
        linkUrl: form.linkUrl,
        linkLabel: form.linkLabel,
        order: form.order,
        active: form.active,
        startAt: parseDateTimeLocal(form.startAtStr),
        endAt: parseDateTimeLocal(form.endAtStr),
      };
      if (isEditing) {
        await updateEventPopup(form.id, payload);
      } else {
        await createEventPopup(payload);
      }
      setForm(makeEmptyForm());
      setFormOpen(false);
      await load();
    } catch (e) {
      console.error("[AdminEventPopupsSection] save failed", e);
      window.alert(e?.message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`"${row.title || row.id}" 팝업을 삭제하시겠습니까?`)) return;
    setBusy(true);
    try {
      await deleteEventPopup({ id: row.id, storagePath: row.storagePath });
      if (form.id === row.id) {
        setForm(makeEmptyForm());
        setFormOpen(false);
      }
      await load();
    } catch (e) {
      console.error("[AdminEventPopupsSection] delete failed", e);
      window.alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (row) => {
    setBusy(true);
    try {
      await updateEventPopup(row.id, { active: !row.active });
      await load();
    } catch (e) {
      console.error("[AdminEventPopupsSection] toggle active failed", e);
      window.alert(e?.message || "상태 변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <SpecBox>
        📐 권장 이미지 규격: <strong>720 × 900 px (가로:세로 = 4:5)</strong> /
        PNG·JPG / 5MB 이하 (이미지 없이 텍스트만으로도 등록 가능)
        <br />
        ⏰ 시작/종료 일시를 비워두면 항상 노출, 채우면 해당 기간 동안만 노출됩니다.
        <br />
        🔁 사용자가 "오늘 하루 보지 않기"를 누르면 그 날 동안 다시 뜨지 않습니다.
      </SpecBox>

      <CreateRow>
        <PrimaryHeaderBtn type="button" onClick={handleOpenCreate}>
          + 새 이벤트 팝업 등록
        </PrimaryHeaderBtn>
      </CreateRow>

      {formOpen && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy && !uploading) handleCancelEdit();
          }}
        >
          <ModalBox onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <CardTitle style={{ margin: 0 }}>
                {isEditing ? "이벤트 팝업 수정" : "새 이벤트 팝업 등록"}
              </CardTitle>
              <CloseBtn type="button" onClick={handleCancelEdit} disabled={busy || uploading}>
                ×
              </CloseBtn>
            </ModalHead>

        <FormGrid>
          <ImageBox onClick={handlePickImage}>
            {form.imageUrl ? (
              <ImagePreview src={form.imageUrl} alt="popup preview" />
            ) : (
              <ImagePlaceholder>
                {uploading ? "업로드 중…" : "클릭해서\n이미지 선택\n(선택)"}
              </ImagePlaceholder>
            )}
          </ImageBox>

          <FormCol>
            <Field>
              <Label>제목</Label>
              <Input
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder="예: 신규 가입 이벤트 진행 중!"
              />
            </Field>

            <Field>
              <Label>본문 (선택)</Label>
              <Textarea
                value={form.body}
                onChange={(e) => updateForm({ body: e.target.value })}
                placeholder="팝업에 표시할 내용을 입력하세요."
              />
            </Field>

            <Row>
              <Field>
                <Label>버튼 라벨 (선택)</Label>
                <Input
                  value={form.linkLabel}
                  onChange={(e) => updateForm({ linkLabel: e.target.value })}
                  placeholder="예: 자세히 보기"
                />
              </Field>

              <Field>
                <Label>이동 URL (선택)</Label>
                <Input
                  value={form.linkUrl}
                  onChange={(e) => updateForm({ linkUrl: e.target.value })}
                  placeholder="https:// 또는 /home/banners 같은 내부 경로"
                />
              </Field>
            </Row>

            <Row>
              <Field>
                <Label>시작 일시 (비우면 항상)</Label>
                <Input
                  type="datetime-local"
                  value={form.startAtStr}
                  onChange={(e) => updateForm({ startAtStr: e.target.value })}
                />
              </Field>

              <Field>
                <Label>종료 일시 (비우면 항상)</Label>
                <Input
                  type="datetime-local"
                  value={form.endAtStr}
                  onChange={(e) => updateForm({ endAtStr: e.target.value })}
                />
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
                {busy ? "저장 중…" : isEditing ? "수정 저장" : "팝업 등록"}
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

      <Card>
        <CardTitle>등록된 이벤트 팝업 ({list.length})</CardTitle>

        {loading ? (
          <AdminLoading />
        ) : list.length === 0 ? (
          <EmptyText>등록된 팝업이 없습니다.</EmptyText>
        ) : (
          <ListWrap>
            {list.map((row) => (
              <Item key={row.id}>
                <Thumb>
                  {row.imageUrl ? <ThumbImg src={row.imageUrl} alt="" /> : null}
                </Thumb>

                <ItemMeta>
                  <ItemTitle>{row.title || "(제목 없음)"}</ItemTitle>
                  <ItemBody>{row.body || "-"}</ItemBody>
                  <ItemMetaRow>
                    <span>순서: {row.order}</span>
                    <span>기간: {row.startAt ? fmtYmdHm(row.startAt) : "—"} ~ {row.endAt ? fmtYmdHm(row.endAt) : "—"}</span>
                    {row.linkUrl ? <span>링크: {row.linkUrl}</span> : null}
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
    </Wrap>
  );
}
