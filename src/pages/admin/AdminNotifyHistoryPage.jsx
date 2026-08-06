/* eslint-disable */
// src/pages/admin/AdminNotifyHistoryPage.jsx
// 발송 로그 — notifications 컬렉션에 쌓인 알림/푸시 이력.
// push.status 는 서버 트리거(onNotificationCreated)가 sent/failed 로 바꾼다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { listRecentPushes } from "../../services/adminPushService";

const KIND_LABEL = {
  admin: "관리자 발송", notice: "공지", inquiry: "문의 답변",
  match: "매칭", chat: "채팅", venue: "구장",
};
const STATUS_LABEL = { sent: "발송완료", failed: "실패", queued: "대기" };

export default function AdminNotifyHistoryPage() {
  const [rows, setRows] = useState(null);
  const [kind, setKind] = useState("");

  useEffect(() => { listRecentPushes(100).then(setRows).catch(() => setRows([])); }, []);
  if (rows === null) return <AdminLoading />;

  const kinds = [...new Set(rows.map((r) => r.kind).filter(Boolean))];
  const view = kind ? rows.filter((r) => r.kind === kind) : rows;

  return (
    <Page>
      <HeaderRow>
        <Title>발송 로그</Title>
        <Sub>최근 {rows.length}건</Sub>
      </HeaderRow>

      <Chips>
        <Chip $on={!kind} onClick={() => setKind("")}>전체 {rows.length}</Chip>
        {kinds.map((k) => (
          <Chip key={k} $on={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k] || k} {rows.filter((r) => r.kind === k).length}
          </Chip>
        ))}
      </Chips>

      <Card>
        {view.length === 0 ? (
          <Empty>발송 이력이 없어요.</Empty>
        ) : (
          <Table>
            <thead>
              <tr><th>구분</th><th>제목</th><th>대상</th><th>상태</th><th>사유</th><th>시각</th></tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr key={r.id}>
                  <td>{KIND_LABEL[r.kind] || r.kind || "-"}</td>
                  <td>
                    <b>{r.title || "-"}</b>
                    {r.body ? <Body>{r.body.slice(0, 50)}</Body> : null}
                  </td>
                  <td>{r.targetType === "ALL" ? "전체" : `${r.targetCount}명`}</td>
                  <td><Badge $s={r.status}>{STATUS_LABEL[r.status] || r.status || "대기"}</Badge></td>
                  <td><Body>{r.failReason || "-"}</Body></td>
                  <td>{r.createdAt ? r.createdAt.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  );
}

const Page = styled.div`display:flex;flex-direction:column;gap:16px;`;
const HeaderRow = styled.div`display:flex;align-items:baseline;justify-content:space-between;gap:12px;`;
const Title = styled.h1`margin:0;font-size:18px;font-weight:700;color:${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Sub = styled.div`font-size:12px;color:${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const Chips = styled.div`display:flex;flex-wrap:wrap;gap:6px;`;
const Chip = styled.button`
  border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;
  border:1px solid ${({ $on }) => ($on ? "#4f46e5" : "#e5e7eb")};
  background:${({ $on }) => ($on ? "#eef2ff" : "#fff")};
  color:${({ $on }) => ($on ? "#4f46e5" : "#6b7280")};
`;
const Card = styled.section`
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius:8px;padding:12px 16px;overflow-x:auto;
`;
const Empty = styled.div`padding:28px 0;text-align:center;font-size:13px;color:#9ca3af;`;
const Table = styled.table`
  width:100%;border-collapse:collapse;font-size:12.5px;
  & th{text-align:left;color:#6b7280;font-weight:600;padding:7px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
  & td{padding:8px;border-bottom:1px solid #f3f4f6;color:#111827;vertical-align:top;}
`;
const Body = styled.div`font-size:11.5px;color:#6b7280;margin-top:2px;`;
const Badge = styled.span`
  display:inline-block;border-radius:999px;padding:2px 8px;font-size:11.5px;font-weight:700;
  background:${({ $s }) => ($s === "sent" ? "#ecfdf5" : $s === "failed" ? "#fef2f2" : "#f3f4f6")};
  color:${({ $s }) => ($s === "sent" ? "#047857" : $s === "failed" ? "#b91c1c" : "#6b7280")};
`;
