/* eslint-disable */
// src/pages/admin/AdminMatchesIssuesPage.jsx
// 매칭 분쟁/신고 — 결과 이의제기와 매칭 예약 노쇼를 한 곳에서 본다.
//
// 별도 신고 컬렉션이 아니라 이미 쌓이는 기록을 모은 트리아지 화면이다.
//   · 이의제기: match_requests.disputeCount (disputeMatchResult 가 남긴다)
//   · 노쇼:     venueReservations.status === "noshow" 중 matchId 가 있는 건
// 조치(강제 결과 확정 등)는 넣지 않았다 — 경기 전적·평판까지 건드리는 일이라
// 운영 기준이 정해진 뒤에 붙이는 게 맞다. 지금은 "무엇이 막혀 있는지" 찾는 용도다.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { fetchMatchIssues } from "../../services/adminMatchesService";

const fmt = (d) =>
  d ? d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

export default function AdminMatchesIssuesPage() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dispute");
  const [onlyOpen, setOnlyOpen] = useState(false);

  useEffect(() => {
    fetchMatchIssues({ limitCount: 300 })
      .then(setData)
      .catch(() => setData({ disputes: [], noshows: [] }));
  }, []);

  const disputes = data?.disputes || [];
  const noshows = data?.noshows || [];
  const openCount = useMemo(() => disputes.filter((d) => !d.resolved).length, [disputes]);
  const rows = tab === "dispute" ? (onlyOpen ? disputes.filter((d) => !d.resolved) : disputes) : noshows;

  if (data === null) return <AdminLoading />;

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>분쟁/신고</Title>
          <Sub>결과 이의제기와 매칭 예약 노쇼를 모아 봅니다.</Sub>
        </div>
        {openCount > 0 && <Alert>재입력 대기 {openCount}건</Alert>}
      </HeaderRow>

      <Chips>
        <Chip $on={tab === "dispute"} onClick={() => setTab("dispute")}>결과 이의제기 {disputes.length}</Chip>
        <Chip $on={tab === "noshow"} onClick={() => setTab("noshow")}>노쇼 {noshows.length}</Chip>
        {tab === "dispute" && (
          <Toggle $on={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>
            {onlyOpen ? "✓ " : ""}미해결만
          </Toggle>
        )}
      </Chips>

      <Card>
        {rows.length === 0 ? (
          <Empty>
            {tab === "dispute"
              ? "결과 이의제기가 없어요. 양 팀이 입력한 결과가 그대로 확정되고 있다는 뜻이에요."
              : "매칭 예약 노쇼가 없어요."}
          </Empty>
        ) : tab === "dispute" ? (
          <Table>
            <thead>
              <tr><th>경기</th><th>일정</th><th>구장</th><th>이의</th><th>현재 결과</th><th>상태</th><th>최근 이의</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.teams}</b><Id>{r.id.slice(0, 12)}</Id></td>
                  <td>{fmt(r.scheduledAt)}</td>
                  <td>{r.place || "-"}</td>
                  <td><Count $hot={r.count >= 2}>{r.count}회</Count></td>
                  <td>{r.score}</td>
                  <td>
                    <Badge $s={r.resolved ? "ok" : "open"}>{r.resolved ? "재입력 완료" : "재입력 대기"}</Badge>
                  </td>
                  <td>{fmt(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead>
              <tr><th>팀/예약자</th><th>구장</th><th>이용 일시</th><th>예약번호</th><th>금액</th><th>처리 시각</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.teams}</b><Id>{r.matchId.slice(0, 12)}</Id></td>
                  <td>{r.place || "-"}</td>
                  <td>{r.when || "-"}</td>
                  <td>{r.reservationCode || "-"}</td>
                  <td>{r.price ? `${r.price.toLocaleString()}원` : "-"}</td>
                  <td>{fmt(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Note>
        이의제기가 <b>2회 이상</b>이면 두 팀이 결과에 합의하지 못하고 있다는 신호예요.
        운영정책의 경기 결과 기준에 따라 개별 연락으로 확인해 주세요.
      </Note>
    </Page>
  );
}

const Page = styled.div`display:flex;flex-direction:column;gap:16px;`;
const HeaderRow = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:12px;`;
const Title = styled.h1`margin:0;font-size:18px;font-weight:700;color:${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Sub = styled.div`margin-top:2px;font-size:12px;color:${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const Alert = styled.div`
  flex-shrink:0;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;
  border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;
`;
const Chips = styled.div`display:flex;flex-wrap:wrap;gap:6px;align-items:center;`;
const Chip = styled.button`
  border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;
  border:1px solid ${({ $on }) => ($on ? "#4f46e5" : "#e5e7eb")};
  background:${({ $on }) => ($on ? "#eef2ff" : "#fff")};
  color:${({ $on }) => ($on ? "#4f46e5" : "#6b7280")};
`;
const Toggle = styled(Chip)`margin-left:auto;`;
const Card = styled.section`
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius:8px;padding:12px 16px;overflow-x:auto;
`;
const Empty = styled.div`padding:28px 0;text-align:center;font-size:13px;color:#9ca3af;line-height:1.6;`;
const Table = styled.table`
  width:100%;border-collapse:collapse;font-size:12.5px;
  & th{text-align:left;color:#6b7280;font-weight:600;padding:7px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
  & td{padding:8px;border-bottom:1px solid #f3f4f6;color:#111827;vertical-align:top;}
`;
const Id = styled.div`font-size:11px;color:#9ca3af;font-family:ui-monospace,monospace;margin-top:2px;`;
const Count = styled.span`font-weight:800;color:${({ $hot }) => ($hot ? "#b91c1c" : "#374151")};`;
const Badge = styled.span`
  display:inline-block;border-radius:999px;padding:2px 8px;font-size:11.5px;font-weight:700;
  background:${({ $s }) => ($s === "ok" ? "#ecfdf5" : "#fef2f2")};
  color:${({ $s }) => ($s === "ok" ? "#047857" : "#b91c1c")};
`;
const Note = styled.div`
  font-size:12px;color:${({ theme }) => theme?.colors?.textWeak || "#6b7280"};line-height:1.6;
  background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:10px 12px;
`;
