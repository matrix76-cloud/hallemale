/* eslint-disable */
// src/pages/owner/OwnerInquiryPage.jsx
// 구장 관리자 1:1 문의 — 작성 + 내 문의 내역. 어드민 문의함(inquiries)으로 들어간다.
import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { showAlert } from "../../utils/appDialog";
import { useOwner } from "../../context/OwnerContext";
import { createInquiry, getMyInquiries } from "../../services/inquiryService";
import { Page, Card, SectionTitle, SectionDesc, Field, Label, Input, Textarea, Select, PrimaryBtn } from "./components/ownerUi";
import { C } from "./components/od";
import { OWNER_BUSINESS } from "./components/OwnerFooter";

const CATEGORIES = [
  { value: "account", label: "계정/로그인" },
  { value: "venue", label: "구장 등록/심사" },
  { value: "reservation", label: "예약/취소" },
  { value: "settlement", label: "정산/수수료" },
  { value: "bug", label: "오류/버그" },
  { value: "etc", label: "기타" },
];

const CATEGORY_LABEL = CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label;
  return acc;
}, {});

const STATUS_LABEL = { open: "접수됨", answered: "답변완료", closed: "종료" };

function fmt(v) {
  const d = typeof v?.toDate === "function" ? v.toDate() : v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const Item = styled.div`
  padding: 12px 0;
  border-top: 1px solid ${C.slate200};
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const ItemHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
const ItemTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${C.slate800};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const Status = styled.span`
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 700;
  color: ${({ $answered }) => ($answered ? C.green600 : C.slate400)};
`;
const ItemMeta = styled.div`
  font-size: 11.5px;
  color: ${C.slate400};
`;
const Answer = styled.div`
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${C.violet50};
  font-size: 13px;
  line-height: 1.6;
  color: ${C.slate800};
  white-space: pre-wrap;
`;
const Empty = styled.div`
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  color: ${C.slate400};
`;
const Contact = styled.div`
  font-size: 12.5px;
  line-height: 1.7;
  color: ${C.slate500};
  & a { color: ${C.violet600}; text-decoration: none; font-weight: 600; }
`;

export default function OwnerInquiryPage() {
  const { uid, userDoc, venue } = useOwner();
  const [category, setCategory] = useState("etc");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    try {
      setList(await getMyInquiries(uid));
    } catch (e) {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createInquiry({
        uid,
        title,
        content,
        category,
        nickname: venue?.name || userDoc?.email || "구장 관리자",
      });
      setTitle("");
      setContent("");
      setCategory("etc");
      showAlert("문의가 접수되었습니다. 확인 후 답변드리겠습니다.");
      await load();
    } catch (e) {
      showAlert(e?.message || "문의 접수에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Card>
        <SectionTitle>1:1 문의</SectionTitle>
        <SectionDesc>구장 운영 중 궁금한 점이나 문제를 남겨주세요. 영업일 기준 1~2일 내 답변드립니다.</SectionDesc>

        <Field>
          <Label>문의 유형</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label>제목</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요"
            maxLength={60}
            disabled={busy}
          />
        </Field>

        <Field>
          <Label>내용</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문의 내용을 자세히 적어주세요"
            maxLength={2000}
            disabled={busy}
          />
        </Field>

        <PrimaryBtn type="button" onClick={handleSubmit} disabled={busy || !title.trim() || !content.trim()}>
          {busy ? "접수 중…" : "문의 보내기"}
        </PrimaryBtn>
      </Card>

      <Card>
        <SectionTitle>고객센터</SectionTitle>
        <Contact>
          전화 <a href={`tel:${OWNER_BUSINESS.tel}`}>{OWNER_BUSINESS.tel}</a>
          <br />
          이메일 <a href={`mailto:${OWNER_BUSINESS.email}`}>{OWNER_BUSINESS.email}</a>
          <br />
          운영시간 평일 10:00 ~ 18:00 (주말·공휴일 휴무)
        </Contact>
      </Card>

      <Card>
        <SectionTitle>내 문의 내역</SectionTitle>
        {loading ? (
          <Empty>불러오는 중…</Empty>
        ) : list.length === 0 ? (
          <Empty>아직 문의 내역이 없어요.</Empty>
        ) : (
          list.map((it) => (
            <Item key={it.id}>
              <ItemHead>
                <ItemTitle>{it.title}</ItemTitle>
                <Status $answered={it.status === "answered"}>
                  {STATUS_LABEL[it.status] || "접수됨"}
                </Status>
              </ItemHead>
              <ItemMeta>
                {CATEGORY_LABEL[it.category] || "기타"} · {fmt(it.createdAt)}
              </ItemMeta>
              {it.answer ? <Answer>{it.answer}</Answer> : null}
            </Item>
          ))
        )}
      </Card>
    </Page>
  );
}
