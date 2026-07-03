/* eslint-disable */
// src/pages/admin/AdminCommunityReportsPage.jsx
// 어드민 - 게시글 신고 목록 (검토 후 게시글 숨김/삭제 또는 신고 기각)
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import {
  listPostReports,
  updatePostReportStatus,
} from "../../services/postReportService";
import {
  setCommunityPostHidden,
  deleteCommunityPostByAdmin,
} from "../../services/adminCommunityService";

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
  min-width: 1240px;
`;

const COLS = "260px 180px 1fr 100px 160px 250px";

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
`;

const Trunc = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TitleBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};

  & .name {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover .name {
    color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
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

function statusLabel(s) {
  if (s === "pending") return "대기";
  if (s === "resolved") return "처리됨";
  if (s === "rejected") return "기각";
  return s || "-";
}

export default function AdminCommunityReportsPage() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState("");

  const pageSize = 25;
  const [page, setPage] = useState(1);

  const load = async (sf = statusFilter) => {
    setLoading(true);
    setErr("");
    try {
      const list = await listPostReports({ statusFilter: sf });
      setRows(Array.isArray(list) ? list : []);
      setPage(1);
    } catch (e) {
      console.error("[AdminCommunityReportsPage] load failed", e);
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

  const handleHidePost = async (r) => {
    if (!r?.postId || busyId) return;
    if (!await showConfirm(`이 게시글을 숨김 처리하고 신고를 종결할까요?\n\n"${r.postTitle}"\n\n사용자 측 목록에서 사라집니다. (해제 가능)`)) {
      return;
    }
    setBusyId(r.id);
    try {
      await setCommunityPostHidden({ postId: r.postId, hidden: true });
      await updatePostReportStatus({ reportId: r.id, status: "resolved", byAdmin: "admin" });
      await load(statusFilter);
    } catch (e) {
      console.error(e);
      showAlert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  const handleDeletePost = async (r) => {
    if (!r?.postId || busyId) return;
    if (!await showConfirm(`이 게시글을 영구 삭제하고 신고를 종결할까요?\n\n"${r.postTitle}"\n\n댓글/좋아요까지 모두 사라지고 복구할 수 없습니다.`)) {
      return;
    }
    setBusyId(r.id);
    try {
      await deleteCommunityPostByAdmin({ postId: r.postId });
      await updatePostReportStatus({ reportId: r.id, status: "resolved", byAdmin: "admin" });
      await load(statusFilter);
    } catch (e) {
      console.error(e);
      showAlert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  const handleReject = async (r) => {
    if (!r?.id || busyId) return;
    if (!await showConfirm("이 신고를 기각하시겠습니까?")) return;
    setBusyId(r.id);
    try {
      await updatePostReportStatus({ reportId: r.id, status: "rejected", byAdmin: "admin" });
      await load(statusFilter);
    } catch (e) {
      console.error(e);
      showAlert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>신고글</Title>
          <Sub style={{ marginTop: 4 }}>
            사용자가 신고한 게시글을 검토하고 숨김/삭제 또는 기각할 수 있습니다.
          </Sub>
        </div>

        <Tabs>
          <TabBtn type="button" $active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>대기</TabBtn>
          <TabBtn type="button" $active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>처리됨</TabBtn>
          <TabBtn type="button" $active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")}>기각</TabBtn>
          <TabBtn type="button" $active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>전체</TabBtn>
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
                <div>대상 게시글</div>
                <div>신고자</div>
                <div>신고 사유</div>
                <div>상태</div>
                <div>신고일</div>
                <div>관리</div>
              </Head>

              {viewRows.map((r) => (
                <Row key={r.id}>
                  <Cell>
                    <TitleBtn
                      type="button"
                      onClick={() => r.postId && navigate(`/admin/community/posts/${r.postId}`)}
                      title={r.postTitle}
                    >
                      <div className="name">{r.postTitle || "(제목없음)"}</div>
                      <Mono>
                        <Trunc>작성자: {r.postAuthorNickname || r.postAuthorUid || "-"}</Trunc>
                      </Mono>
                    </TitleBtn>
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
                          $variant="warn"
                          onClick={() => handleHidePost(r)}
                          disabled={busyId === r.id}
                        >
                          숨김
                        </SmallBtn>
                        <SmallBtn
                          type="button"
                          $variant="danger"
                          onClick={() => handleDeletePost(r)}
                          disabled={busyId === r.id}
                        >
                          삭제
                        </SmallBtn>
                        <SmallBtn
                          type="button"
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
                    ? "처리된 신고가 없습니다."
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
    </Page>
  );
}
