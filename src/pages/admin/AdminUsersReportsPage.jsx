/* eslint-disable */
// src/pages/admin/AdminUsersReportsPage.jsx
// 사용자 신고 목록 - 관리자가 보고 차단/무시 처리
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import {
  listUserReports,
  updateReportStatus,
} from "../../services/userReportService";
import { blockUser } from "../../services/adminUserBlockService";

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
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
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
  min-width: 1200px;
`;

const COLS = "180px 180px 1fr 100px 160px 200px";

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
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
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

const NameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  ${({ $status, theme }) => {
    if ($status === "pending") {
      return theme?.mode === "dark"
        ? `background: rgba(245,158,11,0.16); color: #fbbf24;`
        : `background: #fffbeb; color: #92400e;`;
    }
    if ($status === "resolved") {
      return theme?.mode === "dark"
        ? `background: rgba(248,113,113,0.16); color: #fca5a5;`
        : `background: #fef2f2; color: #b91c1c;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(255,255,255,0.06); color: #9ca3af;`
      : `background: #f3f4f6; color: #6b7280;`;
  }}
`;

const ActionRow = styled.div`
  display: flex;
  gap: 6px;
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
    if ($variant === "block") {
      return theme?.mode === "dark"
        ? "rgba(248,113,113,0.16)"
        : "#fef2f2";
    }
    if ($variant === "reject") {
      return theme?.colors?.card || "#ffffff";
    }
    return theme?.colors?.card || "#ffffff";
  }};
  color: ${({ $variant, theme }) => {
    if ($variant === "block") {
      return theme?.mode === "dark" ? "#fca5a5" : "#b91c1c";
    }
    return theme?.colors?.textStrong || "#111827";
  }};
  ${({ $variant, theme }) => {
    if ($variant === "block") {
      const c =
        theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca";
      return `border-color: ${c};`;
    }
    return "";
  }}

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

// 모달
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
`;

const Modal = styled.div`
  width: min(560px, 92vw);
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  padding: 16px 16px 18px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
`;

const ModalTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 8px;
`;

const ModalLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  margin-bottom: 6px;
`;

const ReasonTextarea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
`;

const ModalActions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

function statusLabel(s) {
  if (s === "pending") return "대기";
  if (s === "resolved") return "차단됨";
  if (s === "rejected") return "기각";
  return s || "-";
}

export default function AdminUsersReportsPage() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState("");

  const pageSize = 25;
  const [page, setPage] = useState(1);

  // 차단 모달
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState(null); // { reportId, uid, nickname, prefilledReason }
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);

  const load = async (sf = statusFilter) => {
    setLoading(true);
    setErr("");
    try {
      const list = await listUserReports({ statusFilter: sf });
      setRows(Array.isArray(list) ? list : []);
      setPage(1);
    } catch (e) {
      console.error("[AdminUsersReportsPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const viewRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage]);

  const openBlockFromReport = (report) => {
    setBlockTarget({
      reportId: report.id,
      uid: report.targetUid,
      nickname: report.targetNickname || report.targetUid,
    });
    setBlockReason(`(신고 사유: ${report.reason})`);
    setBlockOpen(true);
  };

  const closeBlock = () => {
    if (blockBusy) return;
    setBlockOpen(false);
    setBlockTarget(null);
    setBlockReason("");
  };

  const handleConfirmBlock = async () => {
    const t = blockTarget;
    const reason = String(blockReason || "").trim();
    if (!t?.uid) return;
    if (!reason) {
      showAlert("차단 사유를 입력해주세요.");
      return;
    }
    setBlockBusy(true);
    try {
      await blockUser({ uid: t.uid, reason, byAdmin: "admin" });
      // 신고 자체도 resolved 처리
      if (t.reportId) {
        await updateReportStatus({
          reportId: t.reportId,
          status: "resolved",
          byAdmin: "admin",
        });
      }
      setBlockOpen(false);
      setBlockTarget(null);
      setBlockReason("");
      navigate("/admin/users/blocks");
    } catch (e) {
      console.error("[AdminUsersReportsPage] block failed", e);
      showAlert(e?.message || "차단 처리에 실패했습니다.");
    } finally {
      setBlockBusy(false);
    }
  };

  const handleReject = async (report) => {
    if (!report?.id) return;
    if (!await showConfirm("이 신고를 기각하시겠습니까?")) return;
    setBusyId(report.id);
    try {
      await updateReportStatus({
        reportId: report.id,
        status: "rejected",
        byAdmin: "admin",
      });
      await load(statusFilter);
    } catch (e) {
      console.error("[AdminUsersReportsPage] reject failed", e);
      showAlert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>회원 신고</Title>
          <Sub style={{ marginTop: 4 }}>
            사용자가 신고한 회원 목록을 검토하고 차단 또는 기각할 수 있습니다.
          </Sub>
        </div>

        <Tabs>
          <TabBtn
            type="button"
            $active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          >
            대기
          </TabBtn>
          <TabBtn
            type="button"
            $active={statusFilter === "resolved"}
            onClick={() => setStatusFilter("resolved")}
          >
            차단됨
          </TabBtn>
          <TabBtn
            type="button"
            $active={statusFilter === "rejected"}
            onClick={() => setStatusFilter("rejected")}
          >
            기각
          </TabBtn>
          <TabBtn
            type="button"
            $active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            전체
          </TabBtn>
        </Tabs>
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
                <div>대상 회원</div>
                <div>신고자</div>
                <div>신고 사유</div>
                <div>상태</div>
                <div>신고일</div>
                <div>관리</div>
              </Head>

              {viewRows.map((r) => (
                <Row key={r.id}>
                  <Cell>
                    <NameStack>
                      <Trunc>{r.targetNickname || r.targetUid || "-"}</Trunc>
                      <Mono>
                        <Trunc>{r.targetUid}</Trunc>
                      </Mono>
                    </NameStack>
                  </Cell>

                  <Cell>
                    <NameStack>
                      <Trunc>{r.reporterNickname || r.reporterUid || "-"}</Trunc>
                      <Mono>
                        <Trunc>{r.reporterUid}</Trunc>
                      </Mono>
                    </NameStack>
                  </Cell>

                  <Cell>
                    <ReasonText>{r.reason || "-"}</ReasonText>
                  </Cell>

                  <Cell>
                    <StatusPill $status={r.status}>{statusLabel(r.status)}</StatusPill>
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmdHm(r.createdAt)}</Mono>
                  </Cell>

                  <Cell>
                    {r.status === "pending" ? (
                      <ActionRow>
                        <SmallBtn
                          type="button"
                          $variant="block"
                          onClick={() => openBlockFromReport(r)}
                        >
                          차단
                        </SmallBtn>
                        <SmallBtn
                          type="button"
                          $variant="reject"
                          onClick={() => handleReject(r)}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? "처리중…" : "기각"}
                        </SmallBtn>
                      </ActionRow>
                    ) : (
                      <Mono>
                        {r.resolvedAt ? fmtYmdHm(r.resolvedAt) : "-"}
                      </Mono>
                    )}
                  </Cell>
                </Row>
              ))}

              {!viewRows.length && (
                <EmptyText>
                  {statusFilter === "pending"
                    ? "대기 중인 신고가 없습니다."
                    : statusFilter === "resolved"
                    ? "차단 처리된 신고가 없습니다."
                    : statusFilter === "rejected"
                    ? "기각된 신고가 없습니다."
                    : "신고가 없습니다."}
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

      {blockOpen && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBlock();
          }}
        >
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>회원 차단</ModalTitle>
            <ModalLabel>
              대상: <strong>{blockTarget?.nickname}</strong> ({blockTarget?.uid})
            </ModalLabel>
            <ModalLabel>차단 사유 (필수)</ModalLabel>
            <ReasonTextarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="신고 내용을 검토하여 차단 사유를 명확히 작성하세요."
              disabled={blockBusy}
              autoFocus
            />
            <ModalActions>
              <SmallBtn type="button" onClick={closeBlock} disabled={blockBusy}>
                취소
              </SmallBtn>
              <SmallBtn
                type="button"
                $variant="block"
                onClick={handleConfirmBlock}
                disabled={blockBusy || !blockReason.trim()}
              >
                {blockBusy ? "처리중…" : "차단하기"}
              </SmallBtn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}
