/* eslint-disable */
// src/pages/admin/AdminReservationsPage.jsx
// 예약 현황 — 전 구장의 예약을 기간·구장·상태로 확인(읽기 전용).
// 승인/취소는 구장주 워크스페이스, 환불은 '환불 관리'가 담당한다.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { listAllReservations, STATUS_LABEL } from "../../services/adminReservationsService";

const PAGE_SIZE = 10;
const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function periodRange(key) {
  const now = new Date();
  if (key === "today") {
    const t = ymd(now);
    return { from: t, to: t };
  }
  if (key === "week") {
    // 월요일 시작
    const day = (now.getDay() + 6) % 7;
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return { from: ymd(mon), to: ymd(sun) };
  }
  if (key === "month") {
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  return { from: "", to: "" };
}
const PERIODS = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "all", label: "전체" },
];

// 탭 = 상태 묶음. 매출로 잡히는 확정/이용완료와 무산된 건을 갈라서 본다.
const TABS = [
  { key: "all", label: "전체", match: null },
  { key: "waiting", label: "대기", match: ["requested", "pending"] },
  { key: "confirmed", label: "확정", match: ["confirmed"] },
  { key: "done", label: "이용완료", match: ["done"] },
  { key: "void", label: "취소·반려·노쇼", match: ["cancelled", "rejected", "noshow"] },
];

// 상태 뱃지 톤
const TONE = {
  requested: { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  pending: { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  confirmed: { bg: "#eef2ff", fg: "#4338ca", bd: "#c7d2fe" },
  done: { bg: "#f0fdf4", fg: "#15803d", bd: "#bbf7d0" },
  rejected: { bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
  cancelled: { bg: "#f8fafc", fg: "#64748b", bd: "#e2e8f0" },
  noshow: { bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
};

function bookerOf(r) {
  if (r.matchId) {
    const a = r.teamAName || "팀A";
    const b = r.teamBName || "팀B";
    return { name: `${a} vs ${b}`, sub: "매칭 예약" };
  }
  return { name: r.userName || "-", sub: r.teamName || (r.source === "owner" ? "구장 직접등록" : "") };
}

export default function AdminReservationsPage() {
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("all");
  const [venueId, setVenueId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [tab, period, venueId, q]);

  // 예약번호 조회는 기간을 모르고 들어오는 경우가 대부분(문의 응대) — 검색 중엔 기간 제한을 푼다.
  const searching = q.trim().length > 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listAllReservations(searching ? {} : periodRange(period));
        if (alive) setRows(data);
      } catch (e) {
        console.error("[AdminReservations] load failed", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [period, searching]);

  // 구장 필터 옵션 — 조회된 기간에 예약이 있는 구장만
  const venueOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => { if (r.venueId && !map.has(r.venueId)) map.set(r.venueId, r.venueName || "(이름 없음)"); });
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [rows]);

  // 구장·검색까지만 적용한 집합 — 탭 건수는 이걸 기준으로 세야 탭을 옮겨도 숫자가 안 흔들린다.
  const scoped = useMemo(() => {
    let list = venueId ? rows.filter((r) => r.venueId === venueId) : rows;
    const kw = q.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) => {
        const bk = bookerOf(r);
        return [r.reservationCode, r.venueName, bk.name, r.phone]
          .some((v) => String(v || "").toLowerCase().includes(kw));
      });
    }
    return list;
  }, [rows, venueId, q]);

  const tabCount = useMemo(() => {
    const c = {};
    TABS.forEach((t) => {
      c[t.key] = t.match ? scoped.filter((r) => t.match.includes(r.status)).length : scoped.length;
    });
    return c;
  }, [scoped]);

  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    return t?.match ? scoped.filter((r) => t.match.includes(r.status)) : scoped;
  }, [scoped, tab]);

  const summary = useMemo(() => {
    const waiting = scoped.filter((r) => r.status === "requested" || r.status === "pending").length;
    // 매출로 잡히는 건만 — 취소·반려·노쇼는 뺀다
    const live = scoped.filter((r) => r.status === "confirmed" || r.status === "done");
    return {
      total: scoped.length,
      waiting,
      live: live.length,
      amount: live.reduce((s, r) => s + r.price, 0),
    };
  }, [scoped]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>예약 현황</Title>
          <Sub>전 구장의 예약을 기간·구장·상태별로 확인합니다. 승인/취소는 구장주가, 환불은 '환불 관리'에서 처리합니다.</Sub>
        </div>
        <FilterRow>
          <Search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예약번호 · 구장 · 예약자 검색"
          />
          <Select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">전체 구장</option>
            {venueOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
          {PERIODS.map((p) => (
            <Chip key={p.key} $on={!searching && period === p.key} $off={searching} onClick={() => setPeriod(p.key)}>
              {p.label}
            </Chip>
          ))}
        </FilterRow>
      </HeaderRow>

      {searching ? <Hint>검색 중에는 기간 필터를 무시하고 전체 기간에서 찾습니다.</Hint> : null}

      <Cards>
        <StatCard><CardLabel>전체 예약</CardLabel><CardVal>{summary.total}건</CardVal></StatCard>
        <StatCard><CardLabel>승인·결제 대기</CardLabel><CardVal $warn={summary.waiting > 0}>{summary.waiting}건</CardVal></StatCard>
        <StatCard><CardLabel>확정·이용완료</CardLabel><CardVal>{summary.live}건</CardVal></StatCard>
        <StatCard><CardLabel>확정 금액</CardLabel><CardVal>{won(summary.amount)}</CardVal></StatCard>
      </Cards>

      <Tabs>
        {TABS.map((t) => (
          <Tab key={t.key} $on={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}<Cnt>{tabCount[t.key] ?? 0}</Cnt>
          </Tab>
        ))}
      </Tabs>

      <Card>
        {loading ? (
          <AdminLoading />
        ) : filtered.length === 0 ? (
          <EmptyText>{searching ? `"${q.trim()}" 로 찾은 예약이 없습니다.` : "해당 조건의 예약이 없습니다."}</EmptyText>
        ) : (
          <Table>
            <HeadRow>
              <span>예약번호</span>
              <span>구장 / 코트</span>
              <span>예약일시</span>
              <Hide>예약자</Hide>
              <span>금액</span>
              <span>상태</span>
            </HeadRow>
            {pagedRows.map((r) => {
              const bk = bookerOf(r);
              const tone = TONE[r.status] || TONE.cancelled;
              return (
                <Rowi key={r.id}>
                  {/* 예약번호는 유저·구장주와 공유되는 유일한 식별자다 — 문의 응대의 조회 키 */}
                  {r.reservationCode ? <Code>{r.reservationCode}</Code> : <NoCode>미발급</NoCode>}
                  <NameCell>
                    <Nm>{r.venueName || "(이름 없음)"}</Nm>
                    <Sub2>{r.courtName}</Sub2>
                  </NameCell>
                  <span>{r.date || "-"}<TimeS>{r.startTime ? ` ${r.startTime}~${r.endTime}` : ""}</TimeS></span>
                  <Hide>
                    <div>{bk.name}</div>
                    {bk.sub ? <Sub2>{bk.sub}</Sub2> : null}
                  </Hide>
                  <Strong>
                    {won(r.price)}
                    {r.refunded ? <RefundS>환불됨</RefundS> : null}
                  </Strong>
                  <Badge $bg={tone.bg} $fg={tone.fg} $bd={tone.bd}>{STATUS_LABEL[r.status] || r.status}</Badge>
                </Rowi>
              );
            })}
          </Table>
        )}

        {!loading && filtered.length > 0 && (
          <Pager>
            <PageNum onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</PageNum>
            {Array.from({ length: pageCount }, (_, i) => (
              <PageNum key={i} $on={i === page} onClick={() => setPage(i)}>{i + 1}</PageNum>
            ))}
            <PageNum onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>›</PageNum>
          </Pager>
        )}
      </Card>
    </Page>
  );
}

/* ───────────── styles ───────────── */
const Page = styled.div`display: flex; flex-direction: column; gap: 16px;`;
const HeaderRow = styled.div`display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap;`;
const Title = styled.h1`margin: 0; font-size: 18px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Sub = styled.div`font-size: 12px; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"}; margin-top: 4px;`;
const FilterRow = styled.div`display: flex; gap: 8px; flex-wrap: wrap; align-items: center;`;
const Select = styled.select`
  height: 32px; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  max-width: 200px; color: #374151; background: #fff;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;
const Search = styled.input`
  height: 32px; width: 220px; padding: 0 12px; border-radius: 8px; font-size: 13px;
  color: #374151; background: #fff;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  &::placeholder { color: #9ca3af; }
  &:focus { outline: none; border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"}; }
`;
const Chip = styled.button`
  height: 32px; padding: 0 14px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : "#4b5563")};
  opacity: ${({ $off }) => ($off ? 0.45 : 1)};
`;
const Hint = styled.div`
  font-size: 12px; font-weight: 600; color: #b45309;
  background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px;
`;
const Tabs = styled.div`display: flex; gap: 6px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; flex-wrap: wrap;`;
const Tab = styled.button`
  height: 40px; padding: 0 16px; border: none; background: transparent; cursor: pointer;
  font-size: 14px; font-weight: 700; position: relative;
  color: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.textWeak || "#9ca3af"))};
  &::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
    background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")}; }
`;
const Cnt = styled.span`margin-left: 6px; font-size: 12px; font-weight: 700; opacity: 0.7;`;
const Cards = styled.div`display: grid; grid-template-columns: repeat(4, minmax(0, 200px)); gap: 12px;
  @media (max-width: 860px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }`;
const StatCard = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 10px; padding: 14px 16px;
`;
const CardLabel = styled.div`font-size: 12px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; margin-bottom: 6px;`;
const CardVal = styled.div`font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${({ $warn }) => ($warn ? "#b45309" : "#111827")};`;
const Card = styled.section`background: ${({ theme }) => theme?.colors?.card || "#fff"}; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 10px; padding: 14px;`;
const EmptyText = styled.div`padding: 28px 0; text-align: center; font-size: 13px; color: #4b5563;`;
const Pager = styled.div`display: flex; justify-content: center; gap: 6px; margin-top: 14px;`;
const PageNum = styled.button`
  min-width: 32px; height: 32px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 600;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : "#4b5563")};
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Table = styled.div`width: 100%; display: flex; flex-direction: column;`;
const COLS = "132px 1fr 170px 150px 110px 90px";
const MOBILE_COLS = "112px 1fr 110px 100px 84px"; // 예약자 열만 숨는다
const HeadRow = styled.div`
  display: grid; grid-template-columns: ${COLS}; gap: 10px; align-items: center;
  padding: 0 8px 10px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 11.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  @media (max-width: 860px) { grid-template-columns: ${MOBILE_COLS}; }
`;
const Rowi = styled.div`
  display: grid; grid-template-columns: ${COLS}; gap: 10px; align-items: center;
  padding: 11px 8px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.divider || "#f1f5f9"}; font-size: 13px;
  @media (max-width: 860px) { grid-template-columns: ${MOBILE_COLS}; }
`;
const NameCell = styled.div`min-width: 0;`;
// 예약번호는 유저 화면(내 예약)과 같은 등폭 표기 — 눈으로 대조하기 쉬우라고
const Code = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px; font-weight: 700; letter-spacing: -0.2px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  user-select: all; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const NoCode = styled.span`font-size: 12px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};`;
const Nm = styled.div`font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Sub2 = styled.div`font-size: 11.5px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const TimeS = styled.span`color: #9ca3af; font-size: 11.5px;`;
const Strong = styled.div`font-weight: 800; color: #111827;`;
const RefundS = styled.div`font-size: 11px; font-weight: 700; color: #b91c1c;`;
const Hide = styled.span`min-width: 0; @media (max-width: 860px) { display: none; }`;
const Badge = styled.span`
  justify-self: start; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
  background: ${({ $bg }) => $bg}; color: ${({ $fg }) => $fg}; border: 1px solid ${({ $bd }) => $bd};
`;
