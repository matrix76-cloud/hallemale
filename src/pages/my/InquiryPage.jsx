/* eslint-disable */
// src/pages/my/InquiryPage.jsx
// ✅ 1:1 문의 — 작성 폼 + 내 문의 내역
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";
import { createInquiry, getMyInquiries } from "../../services/inquiryService";

const CATEGORIES = [
  { value: "account", label: "계정/로그인" },
  { value: "match", label: "매칭/경기" },
  { value: "team", label: "팀" },
  { value: "report", label: "신고/이용제재" },
  { value: "bug", label: "오류/버그" },
  { value: "etc", label: "기타" },
];

const CATEGORY_LABEL = CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label;
  return acc;
}, {});

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtDate(v) {
  const d = toDateSafe(v);
  if (!d) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function InquiryPage() {
  const { userDoc } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";
  const nickname = userDoc?.nickname || "";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("etc");
  const [content, setContent] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState("");

  const loadList = useCallback(async () => {
    if (!uid) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListErr("");
    try {
      const rows = await getMyInquiries(uid);
      setList(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setListErr(String(e?.message || "문의 내역을 불러올 수 없습니다."));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const canSubmit = useMemo(() => {
    return !!uid && title.trim().length > 0 && content.trim().length > 0 && !submitting;
  }, [uid, title, content, submitting]);

  const handleSubmit = async () => {
    setFormErr("");
    if (!uid) {
      setFormErr("로그인이 필요합니다.");
      return;
    }
    if (!title.trim()) {
      setFormErr("제목을 입력해 주세요.");
      return;
    }
    if (!content.trim()) {
      setFormErr("문의 내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await createInquiry({ uid, title, content, category, nickname });
      setTitle("");
      setContent("");
      setCategory("etc");
      await loadList();
    } catch (e) {
      setFormErr(String(e?.message || "문의 등록에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageWrap>
      <Title>1:1 문의</Title>
      <Desc>궁금하거나 불편한 점을 남겨주시면 확인 후 답변드릴게요.</Desc>

      <FormCard>
        <Field>
          <Label>분류</Label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={submitting}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label>제목</Label>
          <Input
            type="text"
            value={title}
            maxLength={60}
            placeholder="제목을 입력해 주세요"
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field>
          <Label>내용</Label>
          <Textarea
            value={content}
            maxLength={1000}
            placeholder="문의 내용을 자세히 적어주세요"
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
          />
        </Field>

        {formErr ? <FormError>{formErr}</FormError> : null}

        <SubmitBtn type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "등록 중..." : "문의 등록"}
        </SubmitBtn>
      </FormCard>

      <ListTitle>내 문의 내역</ListTitle>

      {loading ? (
        <CenterBox>
          <Spinner fullscreen={false} />
        </CenterBox>
      ) : listErr ? (
        <CenterBox>
          <EmptyText>{listErr}</EmptyText>
        </CenterBox>
      ) : list.length === 0 ? (
        <CenterBox>
          <EmptyText>아직 등록한 문의가 없어요.</EmptyText>
        </CenterBox>
      ) : (
        <List>
          {list.map((item) => {
            const answered =
              item.status === "answered" || !!String(item.answer || "").trim();
            return (
              <InquiryItem key={item.id}>
                <ItemTop>
                  <ItemCategory>{CATEGORY_LABEL[item.category] || "기타"}</ItemCategory>
                  <StatusBadge $answered={answered}>
                    {answered ? "답변완료" : "답변대기"}
                  </StatusBadge>
                </ItemTop>

                <ItemTitle>{item.title}</ItemTitle>
                <ItemContent>{item.content}</ItemContent>
                <ItemDate>{fmtDate(item.createdAt)}</ItemDate>

                {answered && String(item.answer || "").trim() ? (
                  <AnswerBox>
                    <AnswerLabel>답변</AnswerLabel>
                    <AnswerText>{item.answer}</AnswerText>
                    {item.answeredAt ? (
                      <AnswerDate>{fmtDate(item.answeredAt)}</AnswerDate>
                    ) : null}
                  </AnswerBox>
                ) : null}
              </InquiryItem>
            );
          })}
        </List>
      )}
    </PageWrap>
  );
}

/* ===================== styled ===================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  padding: 16px 16px 60px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Desc = styled.p`
  margin: 6px 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const FormCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const baseInput = `
  width: 100%;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  box-sizing: border-box;
`;

const Input = styled.input`
  ${baseInput}
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const Select = styled.select`
  ${baseInput}
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const Textarea = styled.textarea`
  ${baseInput}
  min-height: 120px;
  resize: vertical;
  line-height: 1.5;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const FormError = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.danger};
`;

const SubmitBtn = styled.button`
  height: 46px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ListTitle = styled.h2`
  margin: 26px 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CenterBox = styled.div`
  padding: 30px 0;
  display: grid;
  place-items: center;
`;

const EmptyText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const InquiryItem = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ItemTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const ItemCategory = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatusBadge = styled.span`
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: ${({ $answered, theme }) =>
    $answered ? theme.colors.primary : theme.colors.textWeak};
`;

const ItemTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ItemContent = styled.div`
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const ItemDate = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AnswerBox = styled.div`
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.14)" : "#f4f5ff"};
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AnswerLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const AnswerText = styled.div`
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const AnswerDate = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
