/* eslint-disable */
// src/pages/admin/AdminPresencePage.jsx
// 어드민 - 접속 현황. 지금 몇 명이 켜 두고 있고, 누가, 어느 화면에 있는지.
//
// 판정 기준은 services/presenceService.js 의 ONLINE_WINDOW_MS — 그 시간 안에 하트비트가
// 있었으면 접속중이다. 앱을 강제 종료해도 그 시간이 지나면 자동으로 빠지므로,
// "접속중" 수치는 실시간보다 최대 ONLINE_WINDOW_MS 만큼 늦게 줄어든다.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import AdminFilterSummaryBar from "../../components/admin/AdminFilterSummaryBar";
import { listPresence, ONLINE_WINDOW_MS } from "../../services/presenceService";

// 화면을 열어 둔 채로도 수치가 따라오도록 주기적으로 다시 읽는다.
const REFRESH_MS = 30 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function AdminPresencePage() {
  const [tab, setTab] = useState("online"); // online | today | all
  const [keyword, setKeyword] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  const pageSize = 25;
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const r = await listPresence({ limitCount: 500 });
      setData(r);
      setFetchedAt(new Date());
      setErr("");
    } catch (e) {
      console.error("[AdminPresencePage] load failed", e);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const rows = data?.rows || [];

  const counts = useMemo(() => {
    const now = Date.now();
    const online = rows.filter((r) => r.online).length;
    const today = rows.filter(
      (r) => r.lastActiveAt && now - r.lastActiveAt.getTime() <= DAY_MS
    ).length;
    return { online, today, all: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let arr = rows;
    if (tab === "online") arr = arr.filter((r) => r.online);
    else if (tab === "today") {
      arr = arr.filter((r) => r.lastActiveAt && now - r.lastActiveAt.getTime() <= DAY_MS);
    }

    const kw = String(submittedKeyword || "").trim().toLowerCase();
    if (kw) {
      arr = arr.filter(
        (r) =>
          r.nickname.toLowerCase().includes(kw) ||
          r.uid.toLowerCase().includes(kw) ||
          r.route.toLowerCase().includes(kw)
      );
    }
    return arr;
  }, [rows, tab, submittedKeyword]);

  useEffect(() => {
    setPage(1);
  }, [tab, submittedKeyword]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const viewRows = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, (safePage - 1) * pageSize + pageSize),
    [filtered, safePage]
  );

  return (
    <Page>
      <AdminFilterSummaryBar
        title="접속 현황"
        subtitle={`${Math.round(ONLINE_WINDOW_MS / 1000)}초 안에 활동 기록이 있으면 접속중으로 봅니다. ${Math.round(
          REFRESH_MS / 1000
        )}초마다 자동 갱신${fetchedAt ? ` · 기준 ${fmtHms(fetchedAt)}` : ""}`}
        keyword={keyword}
        onChangeKeyword={setKeyword}
        onSubmit={() => setSubmittedKeyword(keyword)}
        onReset={() => {
          setKeyword("");
          setSubmittedKeyword("");
        }}
        summaries={[
          { label: "접속중", value: counts.online, tone: "good", onClick: () => setTab("online") },
          { label: "24시간 내", value: counts.today, onClick: () => setTab("today") },
          { label: "전체 기록", value: counts.all, onClick: () => setTab("all") },
        ]}
      />

      <Tabs>
        <TabBtn type="button" $active={tab === "online"} onClick={() => setTab("online")}>
          접속중 {counts.online}
        </TabBtn>
        <TabBtn type="button" $active={tab === "today"} onClick={() => setTab("today")}>
          24시간 내
        </TabBtn>
        <TabBtn type="button" $active={tab === "all"} onClick={() => setTab("all")}>
          전체
        </TabBtn>
      </Tabs>

      {data?.truncated ? (
        <Warn>
          기록이 조회 상한(500건)에 닿았습니다. 오래된 접속 기록은 이 목록에서 빠져 있습니다.
        </Warn>
      ) : null}

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
                <div>회원</div>
                <div>상태</div>
                <div>보고 있는 화면</div>
                <div>접속 환경</div>
                <div>머문 시간</div>
                <div>마지막 활동</div>
              </Head>

              {viewRows.map((r) => (
                <Row key={r.uid}>
                  <Cell>
                    <Stack>
                      <NameLine title={r.nickname}>{r.nickname}</NameLine>
                      <Mono title={r.uid}>{r.uid}</Mono>
                    </Stack>
                  </Cell>
                  <Cell>{r.online ? <Pill $tone="on">접속중</Pill> : <Pill>오프라인</Pill>}</Cell>
                  <Cell>
                    <Trunc title={r.route}>{r.route || "-"}</Trunc>
                  </Cell>
                  <Cell>
                    <Pill $tone="soft">{r.platform === "app" ? "앱" : "웹"}</Pill>
                  </Cell>
                  <Cell>
                    <Mono>{r.stayMs == null ? "-" : fmtDuration(r.stayMs)}</Mono>
                  </Cell>
                  <Cell>
                    <Mono>{r.lastActiveAt ? fmtAgo(r.lastActiveAt) : "-"}</Mono>
                  </Cell>
                </Row>
              ))}

              {!viewRows.length && (
                <EmptyText>
                  {tab === "online"
                    ? "지금 접속중인 회원이 없습니다."
                    : tab === "today"
                    ? "24시간 안에 접속한 회원이 없습니다."
                    : "접속 기록이 없습니다."}
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

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtHms(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 체류 시간 — "1시간 12분" / "12분" / "40초" */
function fmtDuration(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

/** 마지막 활동 — 오늘 안이면 상대시각, 그보다 오래되면 날짜 */
function fmtAgo(d) {
  const ms = Date.now() - d.getTime();
  if (ms < 60 * 1000) return "방금";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

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
  color: ${({ $active, theme }) => ($active ? "#ffffff" : theme?.colors?.textStrong || "#111827")};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  overflow: hidden;
`;

const Warn = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  background: ${({ theme }) => (theme?.mode === "dark" ? "rgba(245,158,11,0.16)" : "#fffbeb")};
  color: ${({ theme }) => (theme?.mode === "dark" ? "#fbbf24" : "#92400e")};
  border: 1px solid ${({ theme }) => (theme?.mode === "dark" ? "rgba(245,158,11,0.45)" : "#fde68a")};
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 1020px;
`;

const COLS = "280px 110px 1fr 100px 120px 160px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  background: ${({ theme }) => (theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc")};
  border-bottom: 1px solid
    ${({ theme }) => (theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7")};
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: nowrap;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid
    ${({ theme }) => (theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6")};
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  align-items: center;
`;

const Cell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const NameLine = styled.div`
  font-size: 13px;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  ${({ $tone, theme }) => {
    if ($tone === "on") {
      return theme?.mode === "dark"
        ? `background: rgba(16,185,129,0.16); color: #6ee7b7;`
        : `background: #ecfdf5; color: #047857;`;
    }
    if ($tone === "soft") {
      return theme?.mode === "dark"
        ? `background: rgba(99,102,241,0.16); color: #a5b4fc;`
        : `background: #eef2ff; color: #4338ca;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(148,163,184,0.16); color: #cbd5e1;`
      : `background: #f1f5f9; color: #475569;`;
  }}
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
