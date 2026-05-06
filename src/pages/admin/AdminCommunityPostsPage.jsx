/* eslint-disable */
// src/pages/admin/AdminCommunityPostsPage.jsx
// 어드민 - 커뮤니티 게시글 관리
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import AdminFilterSummaryBar from "../../components/admin/AdminFilterSummaryBar";
import {
  listAdminCommunityPosts,
  setCommunityPostHidden,
  setCommunityPostPinned,
  deleteCommunityPostByAdmin,
} from "../../services/adminCommunityService";

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

const COLS = "1fr 200px 70px 70px 70px 130px 110px 230px";

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

const TitleCell = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  font-weight: 600;

  &:hover {
    color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const TitleText = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Mono = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const NameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
`;

const NameTrunc = styled.div`
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
    if ($tone === "pin") {
      return theme?.mode === "dark"
        ? `background: rgba(99,102,241,0.18); color: #c7d2fe;`
        : `background: #eef2ff; color: #4338ca;`;
    }
    if ($tone === "hide") {
      return theme?.mode === "dark"
        ? `background: rgba(148,163,184,0.16); color: #cbd5e1;`
        : `background: #f1f5f9; color: #64748b;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(16,185,129,0.16); color: #6ee7b7;`
      : `background: #ecfdf5; color: #047857;`;
  }}
`;

const PillStack = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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
    if ($variant === "primary") {
      return theme?.colors?.primary || "#4f46e5";
    }
    return theme?.colors?.card || "#ffffff";
  }};
  color: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "#fca5a5" : "#b91c1c";
    }
    if ($variant === "primary") return "#ffffff";
    return theme?.colors?.textStrong || "#111827";
  }};
  ${({ $variant, theme }) => {
    if ($variant === "danger") {
      const c = theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca";
      return `border-color: ${c};`;
    }
    if ($variant === "primary") return `border-color: transparent;`;
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

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function ymd(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function AdminCommunityPostsPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("all"); // all | visible | hidden | pinned
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
      const list = await listAdminCommunityPosts();
      setRows(Array.isArray(list) ? list : []);
      setPage(1);
    } catch (e) {
      console.error("[AdminCommunityPostsPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 필터링 (탭/검색/기간)
  const filtered = useMemo(() => {
    let arr = rows;

    if (tab === "visible") arr = arr.filter((r) => !r.hidden);
    else if (tab === "hidden") arr = arr.filter((r) => r.hidden);
    else if (tab === "pinned") arr = arr.filter((r) => r.pinned);

    const kw = String(submittedKeyword || "").trim().toLowerCase();
    if (kw) {
      arr = arr.filter((r) => {
        const title = String(r.title || "").toLowerCase();
        const author = String(r.authorName || "").toLowerCase();
        return title.includes(kw) || author.includes(kw);
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

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    setPage(1);
  }, [tab, submittedKeyword, dateFrom, dateTo]);

  const viewRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  // summary 카운터
  const counts = useMemo(() => {
    const total = rows.length;
    const visible = rows.filter((r) => !r.hidden).length;
    const hidden = rows.filter((r) => r.hidden).length;
    const pinned = rows.filter((r) => r.pinned).length;
    return { total, visible, hidden, pinned };
  }, [rows]);

  const togglePin = async (r) => {
    if (!r?.id || busyId) return;
    setBusyId(r.id);
    try {
      await setCommunityPostPinned({ postId: r.id, pinned: !r.pinned });
      await load();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  const toggleHide = async (r) => {
    if (!r?.id || busyId) return;
    setBusyId(r.id);
    try {
      await setCommunityPostHidden({ postId: r.id, hidden: !r.hidden });
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
    if (!window.confirm(`이 게시글을 삭제하시겠습니까?\n\n"${r.title}"\n\n삭제하면 댓글/좋아요까지 함께 사라지고 복구할 수 없습니다.`)) {
      return;
    }
    setBusyId(r.id);
    try {
      await deleteCommunityPostByAdmin({ postId: r.id });
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
        title="게시글"
        subtitle="커뮤니티에 작성된 게시글을 관리합니다."
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
          { label: "공개", value: counts.visible, tone: "good", onClick: () => setTab("visible") },
          { label: "숨김", value: counts.hidden, tone: "warn", onClick: () => setTab("hidden") },
          { label: "공지", value: counts.pinned, tone: "primary", onClick: () => setTab("pinned") },
        ]}
      />

      <Tabs>
        <TabBtn type="button" $active={tab === "all"} onClick={() => setTab("all")}>전체</TabBtn>
        <TabBtn type="button" $active={tab === "visible"} onClick={() => setTab("visible")}>공개</TabBtn>
        <TabBtn type="button" $active={tab === "hidden"} onClick={() => setTab("hidden")}>숨김</TabBtn>
        <TabBtn type="button" $active={tab === "pinned"} onClick={() => setTab("pinned")}>공지</TabBtn>
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
                <div>제목</div>
                <div>작성자</div>
                <div>댓글</div>
                <div>좋아요</div>
                <div>조회</div>
                <div>작성일</div>
                <div>상태</div>
                <div>관리</div>
              </Head>

              {viewRows.map((r) => (
                <Row key={r.id}>
                  <Cell>
                    <TitleCell
                      type="button"
                      onClick={() => navigate(`/admin/community/posts/${r.id}`)}
                      title={r.title}
                    >
                      {r.pinned && <Pill $tone="pin">공지</Pill>}
                      <TitleText>{r.title || "(제목없음)"}</TitleText>
                    </TitleCell>
                  </Cell>

                  <Cell>
                    <NameStack>
                      <NameTrunc>{r.authorName || "(이름없음)"}</NameTrunc>
                      <Mono>
                        <NameTrunc>{r.authorUid || "-"}</NameTrunc>
                      </Mono>
                    </NameStack>
                  </Cell>

                  <Cell>{r.commentsCount}</Cell>
                  <Cell>{r.likes}</Cell>
                  <Cell>{r.views}</Cell>

                  <Cell>
                    <Mono>{fmtYmdHm(r.createdAt)}</Mono>
                  </Cell>

                  <Cell>
                    <PillStack>
                      {r.hidden ? (
                        <Pill $tone="hide">숨김</Pill>
                      ) : (
                        <Pill>공개</Pill>
                      )}
                    </PillStack>
                  </Cell>

                  <Cell>
                    <ActionRow>
                      <SmallBtn
                        type="button"
                        $variant={r.pinned ? "primary" : undefined}
                        onClick={() => togglePin(r)}
                        disabled={busyId === r.id}
                      >
                        {r.pinned ? "공지해제" : "공지"}
                      </SmallBtn>
                      <SmallBtn
                        type="button"
                        onClick={() => toggleHide(r)}
                        disabled={busyId === r.id}
                      >
                        {r.hidden ? "숨김해제" : "숨김"}
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
              ))}

              {!viewRows.length && (
                <EmptyText>
                  {tab === "hidden"
                    ? "숨김 처리된 게시글이 없습니다."
                    : tab === "pinned"
                    ? "공지로 고정된 게시글이 없습니다."
                    : tab === "visible"
                    ? "공개된 게시글이 없습니다."
                    : "게시글이 없습니다."}
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
