/* eslint-disable */
// src/pages/admin/AdminChatListPage.jsx
// 어드민 - 채팅방 목록 (모니터링/잠금/삭제)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import AdminFilterSummaryBar from "../../components/admin/AdminFilterSummaryBar";
import {
  listAdminChatRooms,
  setChatRoomLocked,
  deleteChatRoomByAdmin,
} from "../../services/adminChatService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const TabBtn = styled.button`
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  overflow: hidden;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 1180px;
`;

const COLS = "260px 1fr 160px 130px 110px 220px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: nowrap;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6"};
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  align-items: center;

  &:hover {
    background: ${({ theme }) =>
      theme?.mode === "dark" ? "rgba(99,102,241,0.08)" : "#fafbff"};
  }
`;

const Cell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
`;

const Mono = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Trunc = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ParticipantsRow = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};

  &:hover .name {
    color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const NameLine = styled.div.attrs({ className: "name" })`
  font-size: 13px;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  ${({ $tone, theme }) => {
    if ($tone === "lock") {
      return theme?.mode === "dark"
        ? `background: rgba(248,113,113,0.16); color: #fca5a5;`
        : `background: #fef2f2; color: #b91c1c;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(16,185,129,0.16); color: #6ee7b7;`
      : `background: #ecfdf5; color: #047857;`;
  }}
`;

const ActionRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const SmallBtn = styled.button`
  height: 30px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2";
    }
    if ($variant === "warn") {
      return theme?.mode === "dark" ? "rgba(245,158,11,0.16)" : "#fffbeb";
    }
    return theme?.colors?.card || "#ffffff";
  }};
  color: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "#fca5a5" : "#b91c1c";
    }
    if ($variant === "warn") {
      return theme?.mode === "dark" ? "#fbbf24" : "#92400e";
    }
    return theme?.colors?.textStrong || "#111827";
  }};
  ${({ $variant, theme }) => {
    if ($variant === "danger") {
      const c = theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca";
      return `border-color: ${c};`;
    }
    if ($variant === "warn") {
      const c = theme?.mode === "dark" ? "rgba(245,158,11,0.45)" : "#fde68a";
      return `border-color: ${c};`;
    }
    return "";
  }}

  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const EmptyText = styled.div`
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const ErrorText = styled.div`
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: #b91c1c;
`;

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminChatListPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("all"); // all | active | locked
  const [keyword, setKeyword] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState("");

  const pageSize = 25;
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await listAdminChatRooms();
      setRows(Array.isArray(list) ? list : []);
      setPage(1);
    } catch (e) {
      console.error("[AdminChatListPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let arr = rows;
    if (tab === "active") arr = arr.filter((r) => !r.locked);
    else if (tab === "locked") arr = arr.filter((r) => r.locked);

    const kw = String(submittedKeyword || "").trim().toLowerCase();
    if (kw) {
      arr = arr.filter((r) => {
        const names = (r.participants || [])
          .map((p) => `${p.name} ${p.uid}`)
          .join(" ")
          .toLowerCase();
        const last = String(r.lastMessageText || "").toLowerCase();
        return names.includes(kw) || last.includes(kw);
      });
    }

    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`).getTime();
      arr = arr.filter((r) => (r.createdAt?.getTime() || 0) >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59`).getTime();
      arr = arr.filter((r) => (r.createdAt?.getTime() || 0) <= to);
    }

    return arr;
  }, [rows, tab, submittedKeyword, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [tab, submittedKeyword, dateFrom, dateTo]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const viewRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  const counts = useMemo(() => {
    const total = rows.length;
    const locked = rows.filter((r) => r.locked).length;
    const active = total - locked;
    return { total, active, locked };
  }, [rows]);

  const toggleLock = async (r) => {
    if (!r?.id || busyId) return;
    let reason = "";
    if (!r.locked) {
      reason = window.prompt("잠금 사유를 입력해주세요. (사용자가 사유는 보지 않지만 어드민 기록용)", "");
      if (reason === null) return;
    }
    setBusyId(r.id);
    try {
      await setChatRoomLocked({
        chatId: r.id,
        locked: !r.locked,
        reason: String(reason || ""),
      });
      await load();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (r) => {
    if (!r?.id || busyId) return;
    const names = (r.participants || []).map((p) => p.name).join(", ");
    if (!window.confirm(`이 채팅방을 삭제하시겠습니까?\n\n참여자: ${names}\n\n메시지까지 모두 사라지고 복구할 수 없습니다.`)) {
      return;
    }
    setBusyId(r.id);
    try {
      await deleteChatRoomByAdmin({ chatId: r.id });
      await load();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Page>
      <AdminFilterSummaryBar
        title="채팅 관리"
        subtitle="채팅방을 모니터링하고 잠금/삭제할 수 있습니다."
        dateFrom={dateFrom}
        dateTo={dateTo}
        onChangeDateFrom={setDateFrom}
        onChangeDateTo={setDateTo}
        keyword={keyword}
        onChangeKeyword={setKeyword}
        onSubmit={() => setSubmittedKeyword(keyword)}
        onReset={() => {
          setDateFrom("");
          setDateTo("");
          setKeyword("");
          setSubmittedKeyword("");
        }}
        summaries={[
          { label: "전체", value: counts.total, onClick: () => setTab("all") },
          { label: "활성", value: counts.active, tone: "good", onClick: () => setTab("active") },
          { label: "잠금", value: counts.locked, tone: "danger", onClick: () => setTab("locked") },
        ]}
      />

      <Tabs>
        <TabBtn type="button" $active={tab === "all"} onClick={() => setTab("all")}>전체</TabBtn>
        <TabBtn type="button" $active={tab === "active"} onClick={() => setTab("active")}>활성</TabBtn>
        <TabBtn type="button" $active={tab === "locked"} onClick={() => setTab("locked")}>잠금</TabBtn>
      </Tabs>

      {loading ? (
        <Card>
          <AdminLoading />
        </Card>
      ) : err ? (
        <Card>
          <ErrorText>{err}</ErrorText>
        </Card>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <Head>
                <div>참여자</div>
                <div>마지막 메시지</div>
                <div>마지막 메시지 시각</div>
                <div>생성일</div>
                <div>상태</div>
                <div>관리</div>
              </Head>

              {viewRows.map((r) => {
                const names = (r.participants || []).map((p) => p.name).join(" ↔ ");
                const uids = (r.participantUids || []).join(" ↔ ");
                return (
                  <Row key={r.id}>
                    <Cell>
                      <ParticipantsRow
                        type="button"
                        onClick={() => navigate(`/admin/chat/list/${r.id}`)}
                        title={names}
                      >
                        <NameLine>{names || "(참여자 없음)"}</NameLine>
                        <Mono>{uids}</Mono>
                      </ParticipantsRow>
                    </Cell>

                    <Cell>
                      <Trunc title={r.lastMessageText}>
                        {r.lastMessageText || "(메시지 없음)"}
                      </Trunc>
                    </Cell>

                    <Cell>
                      <Mono>{fmtYmdHm(r.lastMessageAt)}</Mono>
                    </Cell>

                    <Cell>
                      <Mono>{fmtYmdHm(r.createdAt)}</Mono>
                    </Cell>

                    <Cell>
                      {r.locked ? <Pill $tone="lock">잠금</Pill> : <Pill>활성</Pill>}
                    </Cell>

                    <Cell>
                      <ActionRow>
                        <SmallBtn
                          type="button"
                          onClick={() => navigate(`/admin/chat/list/${r.id}`)}
                        >
                          보기
                        </SmallBtn>
                        <SmallBtn
                          type="button"
                          $variant="warn"
                          onClick={() => toggleLock(r)}
                          disabled={busyId === r.id}
                        >
                          {r.locked ? "잠금해제" : "잠금"}
                        </SmallBtn>
                        <SmallBtn
                          type="button"
                          $variant="danger"
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id}
                        >
                          삭제
                        </SmallBtn>
                      </ActionRow>
                    </Cell>
                  </Row>
                );
              })}

              {!viewRows.length && (
                <EmptyText>
                  {tab === "locked"
                    ? "잠긴 채팅방이 없습니다."
                    : tab === "active"
                    ? "활성 채팅방이 없습니다."
                    : "채팅방이 없습니다."}
                </EmptyText>
              )}
            </Table>
          </TableWrap>
          <AdminPager
            totalCount={totalCount}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </Card>
      )}
    </Page>
  );
}
