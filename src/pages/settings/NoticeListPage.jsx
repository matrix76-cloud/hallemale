/* eslint-disable */
// src/pages/settings/NoticeListPage.jsx
// 사용자 공지사항 페이지 — Firestore: notices (published=true)
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import Spinner from "../../components/common/Spinner";
import { subscribePublishedNotices } from "../../services/noticesService";
import EmptyState from "../../components/common/EmptyState";

const Wrap = styled.div`
  padding: 16px 16px 32px;
  max-width: 720px;
  margin: 0 auto;
`;

const H2 = styled.h2`
  margin: 0 0 12px;
  font-size: 18px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Empty = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
`;

const ErrorBox = styled.div`
  font-size: 13px;
  color: #b91c1c;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Item = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 10px;
  overflow: hidden;
`;

const ItemHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
`;

const TitleCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const TitleText = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PinBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
  flex-shrink: 0;
`;

const Meta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
`;

const Chevron = styled.span`
  font-size: 18px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#9ca3af"};
  transform: ${({ $open }) => ($open ? "rotate(90deg)" : "rotate(0)")};
  transition: transform 0.18s ease;
`;

const Body = styled.div`
  padding: 0 14px 14px;
  font-size: 14px;
  line-height: 1.7;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: pre-line;
  border-top: 1px solid ${({ theme }) => theme?.colors?.divider || "#f3f4f6"};
  padding-top: 12px;
`;

const Loading = styled.div`
  padding: 40px 0;
  display: grid;
  place-items: center;
`;

function fmtDate(v) {
  if (!v) return "";
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

export default function NoticeListPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErr("");
    // 실시간 구독 — 관리자가 공지를 삭제/수정하면 즉시 반영
    const unsub = subscribePublishedNotices(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      { limitCount: 100 }
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const onToggle = (id) => {
    setOpenId((cur) => (cur === id ? null : id));
  };

  return (
    <Wrap>
      <H2>공지사항</H2>

      {loading ? (
        <Loading>
          <Spinner />
        </Loading>
      ) : err ? (
        <ErrorBox>{err}</ErrorBox>
      ) : !rows.length ? (
        <EmptyState text="아직 등록된 공지사항이 없습니다." />
      ) : (
        <List>
          {rows.map((n) => {
            const isOpen = openId === n.id;
            return (
              <Item key={n.id}>
                <ItemHeader onClick={() => onToggle(n.id)}>
                  <TitleCol>
                    <TitleRow>
                      {n.pinned ? <PinBadge>고정</PinBadge> : null}
                      <TitleText title={n.title}>{n.title || "(제목 없음)"}</TitleText>
                    </TitleRow>
                    <Meta>{fmtDate(n.createdAt)}</Meta>
                  </TitleCol>
                  <Chevron $open={isOpen}>›</Chevron>
                </ItemHeader>
                {isOpen && n.content ? <Body>{n.content}</Body> : null}
              </Item>
            );
          })}
        </List>
      )}
    </Wrap>
  );
}
