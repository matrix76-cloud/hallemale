/* eslint-disable */
// src/pages/admin/AdminInquiriesPage.jsx
// 1:1 문의 관리 — 목록(상태 필터) + 답변 작성/수정
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { listInquiriesAdmin, answerInquiry } from "../../services/adminInquiryService";
import { useAuth } from "../../hooks/useAuth";

const CATEGORY_LABEL = {
  account: "계정/로그인",
  match: "매칭/경기",
  team: "팀",
  report: "신고/이용제재",
  bug: "오류/버그",
  etc: "기타",
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "open", label: "답변대기" },
  { key: "answered", label: "답변완료" },
];

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

function isAnswered(item) {
  return item?.status === "answered" || !!String(item?.answer || "").trim();
}

export default function AdminInquiriesPage() {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid || "admin";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await listInquiriesAdmin({ limitCount: 300 });
      setRows(list);
    } catch (e) {
      console.error("[AdminInquiriesPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = rows.length;
  const openCount = useMemo(() => rows.filter((r) => !isAnswered(r)).length, [rows]);

  const filtered = useMemo(() => {
    if (filter === "open") return rows.filter((r) => !isAnswered(r));
    if (filter === "answered") return rows.filter((r) => isAnswered(r));
    return rows;
  }, [rows, filter]);

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>1:1 문의</Title>
          <Sub>
            전체 {total}건 · 답변대기 {openCount}건 · 답변 시 사용자에게 알림이 전송됩니다.
          </Sub>
        </div>
        <FilterRow>
          {FILTERS.map((f) => (
            <FilterBtn
              key={f.key}
              type="button"
              $active={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </FilterBtn>
          ))}
        </FilterRow>
      </HeaderRow>

      {loading ? (
        <AdminLoading />
      ) : err ? (
        <Card>
          <Sub style={{ color: "#b91c1c" }}>{err}</Sub>
        </Card>
      ) : !filtered.length ? (
        <Card>
          <Empty>해당하는 문의가 없습니다.</Empty>
        </Card>
      ) : (
        <ListWrap>
          {filtered.map((item) => (
            <InquiryRow key={item.id} item={item} adminUid={adminUid} onSaved={load} />
          ))}
        </ListWrap>
      )}
    </Page>
  );
}

function InquiryRow({ item, adminUid, onSaved }) {
  const answered = isAnswered(item);
  const [draft, setDraft] = useState(String(item.answer || ""));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!answered); // 답변대기면 기본 펼침

  const onSave = async () => {
    const ans = draft.trim();
    if (!ans) {
      showAlert("답변 내용을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await answerInquiry({
        inquiryId: item.id,
        uid: item.uid,
        title: item.title,
        answer: ans,
        adminUid,
      });
      await onSaved();
    } catch (e) {
      console.error("[AdminInquiriesPage] answer failed", e);
      showAlert(e?.message || "답변 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Item>
      <ItemTop>
        <Badge>{CATEGORY_LABEL[item.category] || "기타"}</Badge>
        <StatusBadge $answered={answered}>{answered ? "답변완료" : "답변대기"}</StatusBadge>
        <Spacer />
        <DateText>{fmtDateTime(item.createdAt)}</DateText>
      </ItemTop>

      <ItemTitle>{item.title || "(제목 없음)"}</ItemTitle>
      <ItemContent>{item.content}</ItemContent>
      <MetaText>
        작성자 {item.nickname ? `${item.nickname} · ` : ""}
        <Mono>{item.uid}</Mono>
      </MetaText>

      {answered && !open ? (
        <AnswerPreview>
          <AnswerLabel>등록된 답변</AnswerLabel>
          <AnswerText>{item.answer}</AnswerText>
          <AnswerMeta>
            {fmtDateTime(item.answeredAt)}
            <EditLink type="button" onClick={() => setOpen(true)}>
              수정
            </EditLink>
          </AnswerMeta>
        </AnswerPreview>
      ) : (
        <AnswerEditor>
          <AnswerLabel>{answered ? "답변 수정" : "답변 작성"}</AnswerLabel>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="사용자에게 전달할 답변을 입력해 주세요."
            disabled={busy}
          />
          <Actions>
            {answered ? (
              <Btn
                type="button"
                onClick={() => {
                  setDraft(String(item.answer || ""));
                  setOpen(false);
                }}
                disabled={busy}
              >
                취소
              </Btn>
            ) : null}
            <Btn type="button" $primary onClick={onSave} disabled={busy}>
              {busy ? "저장 중…" : answered ? "답변 수정" : "답변 등록"}
            </Btn>
          </Actions>
        </AnswerEditor>
      )}
    </Item>
  );
}

/* ===================== styled ===================== */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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
  margin-top: 2px;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 6px;
`;

const FilterBtn = styled.button`
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.border || "#e5e7eb"};
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme?.colors?.textStrong || "#111827"};

  &:active {
    transform: translateY(1px);
  }
`;

const Card = styled.section`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  padding: 16px;
`;

const Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  font-size: 13px;
`;

const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Item = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  padding: 14px;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ItemTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Spacer = styled.div`
  flex: 1;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: ${({ $answered, theme }) =>
    $answered ? theme?.colors?.primary || "#4f46e5" : "#9ca3af"};
`;

const DateText = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
`;

const ItemTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const ItemContent = styled.div`
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const MetaText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
`;

const Mono = styled.span`
  font-family: ui-monospace, monospace;
  opacity: 0.8;
`;

const AnswerPreview = styled.div`
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(79, 70, 229, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AnswerEditor = styled.div`
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const AnswerLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
`;

const AnswerText = styled.div`
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const AnswerMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
`;

const EditLink = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
`;

const Textarea = styled.textarea`
  min-height: 90px;
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

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Btn = styled.button`
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $primary, theme }) =>
    $primary ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $primary, theme }) => ($primary ? "#ffffff" : theme?.colors?.textStrong || "#111827")};
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
