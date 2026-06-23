/* eslint-disable */
// src/pages/admin/AdminNotifyNoticesPage.jsx
// 공지 작성 / 수정 / 삭제 (Firestore: notices)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listNoticesAdmin,
  createNotice,
  updateNotice,
  deleteNotice,
  queueNoticeBroadcastPush,
} from "../../services/noticesService";
import { useAuth } from "../../hooks/useAuth";

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

const CardTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 12px;
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  min-height: 160px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const TogglesRow = styled.div`
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
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

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const NoticeItem = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  padding: 12px 14px;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const NoticeTop = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const NoticeTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NoticeMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: ${({ $color }) =>
    $color === "warn"
      ? "rgba(245, 158, 11, 0.16)"
      : $color === "muted"
      ? "rgba(107, 114, 128, 0.16)"
      : "rgba(37, 99, 235, 0.12)"};
  color: ${({ $color }) =>
    $color === "warn" ? "#b45309" : $color === "muted" ? "#4b5563" : "#1d4ed8"};
`;

const NoticeBody = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: pre-line;
  line-height: 1.6;
  max-height: 80px;
  overflow: hidden;
  position: relative;
`;

const NoticeActions = styled.div`
  display: flex;
  gap: 6px;
  justify-content: flex-end;
`;

const SmallBtn = styled.button`
  height: 30px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const SmallDanger = styled(SmallBtn)`
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
`;

const Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  font-size: 13px;
`;

function fmtDateTime(v) {
  if (!v) return "-";
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminNotifyNoticesPage() {
  const { firebaseUser } = useAuth();
  const myUid = firebaseUser?.uid || "admin";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // 폼 상태 (작성/수정 공용)
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);
  const [pushOnCreate, setPushOnCreate] = useState(false);

  const formMode = editingId ? "수정" : "작성";

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await listNoticesAdmin({ limitCount: 200 });
      setRows(list);
    } catch (e) {
      console.error("[AdminNotifyNoticesPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setPinned(false);
    setPublished(true);
    setPushOnCreate(false);
  };

  const onEdit = (n) => {
    setEditingId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setPinned(!!n.pinned);
    setPublished(n.published !== false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSave = async () => {
    const t = title.trim();
    const c = content.trim();
    if (!t) {
      window.alert("제목을 입력해주세요.");
      return;
    }
    if (!c) {
      window.alert("내용을 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateNotice(editingId, { title: t, content: c, pinned, published });
      } else {
        const newId = await createNotice({
          title: t,
          content: c,
          pinned,
          published,
          createdBy: myUid,
        });

        // 푸시 발송 옵션 (발행된 공지만 전체 푸시)
        if (pushOnCreate && published) {
          const ok = window.confirm(
            "전체 사용자에게 앱 푸시 알림을 발송합니다. 계속할까요?"
          );
          if (ok) {
            try {
              await queueNoticeBroadcastPush({ noticeId: newId, title: t, content: c });
            } catch (e) {
              window.alert(
                "공지는 저장됐지만 푸시 발송 등록에 실패했습니다.\n" + (e?.message || "")
              );
            }
          }
        }
      }
      resetForm();
      await load();
    } catch (e) {
      console.error("[AdminNotifyNoticesPage] save failed", e);
      window.alert(e?.message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (n) => {
    if (!window.confirm(`"${n.title}" 공지를 삭제하시겠습니까?`)) return;
    setBusy(true);
    try {
      await deleteNotice(n.id);
      if (editingId === n.id) resetForm();
      await load();
    } catch (e) {
      console.error("[AdminNotifyNoticesPage] delete failed", e);
      window.alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const onTogglePublish = async (n) => {
    setBusy(true);
    try {
      await updateNotice(n.id, { published: !n.published });
      await load();
    } catch (e) {
      console.error("[AdminNotifyNoticesPage] toggle publish failed", e);
      window.alert(e?.message || "변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const onTogglePin = async (n) => {
    setBusy(true);
    try {
      await updateNotice(n.id, { pinned: !n.pinned });
      await load();
    } catch (e) {
      console.error("[AdminNotifyNoticesPage] toggle pin failed", e);
      window.alert(e?.message || "변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const total = rows.length;
  const publishedCount = useMemo(
    () => rows.filter((r) => r.published).length,
    [rows]
  );

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>공지 작성</Title>
          <Sub>
            전체 {total}건 · 발행 {publishedCount}건 · 사용자 공지사항 페이지에 노출됩니다.
          </Sub>
        </div>
      </HeaderRow>

      <Card>
        <CardTitle>{formMode}</CardTitle>
        <FormCol>
          <Field>
            <Label>제목</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 5월 정기 점검 안내"
              maxLength={120}
            />
          </Field>
          <Field>
            <Label>내용</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지 내용을 입력해주세요. 줄바꿈은 그대로 표시됩니다."
            />
          </Field>
          <TogglesRow>
            <ToggleRow>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              상단 고정
            </ToggleRow>
            <ToggleRow>
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              발행(사용자에게 노출)
            </ToggleRow>
            {!editingId ? (
              <ToggleRow>
                <input
                  type="checkbox"
                  checked={pushOnCreate}
                  disabled={!published}
                  onChange={(e) => setPushOnCreate(e.target.checked)}
                />
                푸시 발송(전체 사용자 앱 알림)
              </ToggleRow>
            ) : null}
          </TogglesRow>
          <Actions>
            {editingId ? (
              <Btn type="button" onClick={resetForm} disabled={busy}>
                취소
              </Btn>
            ) : null}
            <Btn type="button" onClick={onSave} disabled={busy} $primary>
              {busy ? "저장 중…" : editingId ? "수정 저장" : "공지 등록"}
            </Btn>
          </Actions>
        </FormCol>
      </Card>

      <Card>
        <CardTitle>공지 목록</CardTitle>
        {loading ? (
          <AdminLoading />
        ) : err ? (
          <Sub style={{ color: "#b91c1c" }}>{err}</Sub>
        ) : !rows.length ? (
          <Empty>등록된 공지가 없습니다.</Empty>
        ) : (
          <ListWrap>
            {rows.map((n) => (
              <NoticeItem key={n.id}>
                <NoticeTop>
                  <NoticeTitle title={n.title}>{n.title || "(제목 없음)"}</NoticeTitle>
                  {n.pinned ? <Badge $color="warn">고정</Badge> : null}
                  {n.published ? (
                    <Badge>발행</Badge>
                  ) : (
                    <Badge $color="muted">비공개</Badge>
                  )}
                </NoticeTop>
                <NoticeMeta>
                  <span>등록 {fmtDateTime(n.createdAt)}</span>
                  {n.updatedAt && n.updatedAt !== n.createdAt ? (
                    <span>· 수정 {fmtDateTime(n.updatedAt)}</span>
                  ) : null}
                </NoticeMeta>
                {n.content ? <NoticeBody>{n.content}</NoticeBody> : null}
                <NoticeActions>
                  <SmallBtn type="button" onClick={() => onTogglePin(n)} disabled={busy}>
                    {n.pinned ? "고정 해제" : "상단 고정"}
                  </SmallBtn>
                  <SmallBtn
                    type="button"
                    onClick={() => onTogglePublish(n)}
                    disabled={busy}
                  >
                    {n.published ? "비공개로" : "발행으로"}
                  </SmallBtn>
                  <SmallBtn type="button" onClick={() => onEdit(n)} disabled={busy}>
                    수정
                  </SmallBtn>
                  <SmallDanger
                    type="button"
                    onClick={() => onDelete(n)}
                    disabled={busy}
                  >
                    삭제
                  </SmallDanger>
                </NoticeActions>
              </NoticeItem>
            ))}
          </ListWrap>
        )}
      </Card>
    </Page>
  );
}
