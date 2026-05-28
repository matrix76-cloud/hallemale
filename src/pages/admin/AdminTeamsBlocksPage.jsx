/* eslint-disable */
// src/pages/admin/AdminTeamsBlocksPage.jsx
// 차단된 팀 목록 + 해제 기능
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import {
  listBlockedTeams,
  unblockTeam,
} from "../../services/adminTeamBlockService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  min-width: 1100px;
`;

const COLS = "220px 220px 180px 1fr 160px 160px 120px";

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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Trunc = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ReasonText = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Logo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  background: ${({ theme }) => theme?.colors?.surface || "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
`;

const LogoFallback = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.surface || "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
`;

const UnblockBtn = styled.button`
  height: 32px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
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

export default function AdminTeamsBlocksPage() {
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
      const list = await listBlockedTeams();
      setRows(Array.isArray(list) ? list : []);
      setPage(1);
    } catch (e) {
      console.error("[AdminTeamsBlocksPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const viewRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage]);

  const handleUnblock = async (clubId, name) => {
    if (!clubId) return;
    if (busyId) return;
    if (!window.confirm(`${name || clubId} 팀의 차단을 해제하시겠습니까?`)) {
      return;
    }
    setBusyId(clubId);
    try {
      await unblockTeam({ clubId });
      await load();
    } catch (e) {
      console.error("[AdminTeamsBlocksPage] unblock failed", e);
      window.alert(e?.message || "차단 해제에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Page>
      <HeaderRow>
        <Title>차단 팀</Title>
        <Sub>차단된 팀 {totalCount.toLocaleString()}개</Sub>
      </HeaderRow>

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
                <div>팀 이름</div>
                <div>clubId</div>
                <div>지역</div>
                <div>차단 사유</div>
                <div>차단 일시</div>
                <div>차단자</div>
                <div>관리</div>
              </Head>

              {viewRows.map((r) => {
                const clubId = r.clubId;
                const name = r.name;

                return (
                  <Row key={clubId}>
                    <Cell>
                      <NameCell>
                        {r.logoUrl ? (
                          <Logo
                            src={r.logoUrl}
                            alt={name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <LogoFallback />
                        )}
                        <Trunc>{name}</Trunc>
                      </NameCell>
                    </Cell>

                    <Cell title={clubId}>
                      <Mono>
                        <Trunc>{clubId}</Trunc>
                      </Mono>
                    </Cell>

                    <Cell title={r.region}>
                      <Trunc>{r.region || "-"}</Trunc>
                    </Cell>

                    <Cell>
                      <ReasonText>{r.blockedReason || "-"}</ReasonText>
                    </Cell>

                    <Cell>
                      <Mono>{fmtYmdHm(r.blockedAt)}</Mono>
                    </Cell>

                    <Cell title={r.blockedBy}>
                      <Trunc>{r.blockedBy || "-"}</Trunc>
                    </Cell>

                    <Cell>
                      <UnblockBtn
                        type="button"
                        onClick={() => handleUnblock(clubId, name)}
                        disabled={busyId === clubId}
                      >
                        {busyId === clubId ? "처리중…" : "해제"}
                      </UnblockBtn>
                    </Cell>
                  </Row>
                );
              })}

              {!viewRows.length && (
                <EmptyText>차단된 팀이 없습니다.</EmptyText>
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
