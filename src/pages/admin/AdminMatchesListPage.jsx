/* eslint-disable */
// src/pages/admin/AdminMatchesListPage.jsx
// 매칭 관리 — 매칭 신청서 라이프사이클 전체 (pending/accepted/rejected/cancelled/finished)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminPager from "../../components/admin/AdminPager";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  fetchAdminMatchRequests,
  STATUS_LABEL,
} from "../../services/adminMatchesService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const H1 = styled.h1`
  margin: 0;
  font-size: 18px;
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

const CardBody = styled.div`
  padding: 14px;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;

const Input = styled.input`
  height: 34px;
  border-radius: 8px;
  padding: 0 10px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 13px;
  outline: none;
  min-width: 220px;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
  }
`;

const Select = styled.select`
  height: 34px;
  border-radius: 8px;
  padding: 0 10px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 13px;
  outline: none;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#fff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 1240px;
`;

const COLS = "120px 110px 1.1fr 1.1fr 1fr 1fr 100px 100px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 8px;
  padding: 12px 14px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 8px;
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

const TeamCell = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const Logo = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  flex-shrink: 0;
`;

const LogoFallback = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  flex-shrink: 0;
`;

const TeamMain = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
`;

const TeamName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LineupName = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Place = styled.div`
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyText = styled.div`
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const StatusBadge = styled.span`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  ${({ $kind, theme }) => {
    if ($kind === "pending") {
      return `
        background: ${
          theme?.mode === "dark" ? "rgba(245,158,11,0.18)" : "rgba(245, 158, 11, 0.14)"
        };
        color: ${theme?.mode === "dark" ? "#fcd34d" : "#b45309"};
      `;
    }
    if ($kind === "accepted") {
      return `
        background: ${
          theme?.mode === "dark" ? "rgba(99,102,241,0.18)" : "rgba(37, 99, 235, 0.10)"
        };
        color: ${theme?.mode === "dark" ? "#a5b4fc" : "#1d4ed8"};
      `;
    }
    if ($kind === "rejected") {
      return `
        background: ${
          theme?.mode === "dark" ? "rgba(248,113,113,0.18)" : "#fef2f2"
        };
        color: ${theme?.mode === "dark" ? "#fca5a5" : "#b91c1c"};
      `;
    }
    if ($kind === "cancelled") {
      return `
        background: ${
          theme?.mode === "dark" ? "rgba(107,114,128,0.18)" : "rgba(107, 114, 128, 0.14)"
        };
        color: ${theme?.mode === "dark" ? "#d1d5db" : "#4b5563"};
      `;
    }
    if ($kind === "finished") {
      return `
        background: ${
          theme?.mode === "dark" ? "rgba(34,197,94,0.18)" : "rgba(16, 185, 129, 0.1)"
        };
        color: ${theme?.mode === "dark" ? "#86efac" : "#047857"};
      `;
    }
    return `
      background: rgba(107, 114, 128, 0.14);
      color: #4b5563;
    `;
  }}
`;

const Score = styled.div`
  font-weight: 800;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const SIDO_OPTIONS = [
  "서울","경기","인천","부산","대구","대전","광주","울산","세종",
  "강원","충북","충남","전북","전남","경북","경남","제주",
];

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "pending", label: "신청 대기" },
  { value: "accepted", label: "수락됨" },
  { value: "rejected", label: "거절됨" },
  { value: "cancelled", label: "취소됨" },
  { value: "finished", label: "완료" },
];

function TeamView({ team, lineup }) {
  return (
    <TeamCell>
      {team?.logoUrl ? (
        <Logo
          src={team.logoUrl}
          alt={team.name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <LogoFallback />
      )}
      <TeamMain>
        <TeamName title={team?.name}>{team?.name || "팀"}</TeamName>
        {lineup ? <LineupName title={lineup}>{lineup}</LineupName> : null}
      </TeamMain>
    </TeamCell>
  );
}

export default function AdminMatchesListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filtered, setFiltered] = useState([]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetchAdminMatchRequests({
        status,
        keyword: q,
        regionSido: region,
      });
      setFiltered(res.filtered || []);
    } catch (e) {
      console.error("[AdminMatchesListPage] load failed", e);
      setFiltered([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    setPage(1);
  }, [q, status, region, pageSize]);

  const onSubmit = () => load();

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <Page>
      <TitleRow>
        <div>
          <H1>매칭 목록</H1>
          <Sub>매칭 신청서 전체 (match_requests)</Sub>
        </div>
        <Sub>{filtered.length}건</Sub>
      </TitleRow>

      <Card>
        <CardBody>
          <FilterRow>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="팀명/라인업/장소/유형 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="all">전체 지역</option>
              {SIDO_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FilterRow>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <AdminLoading />
        </Card>
      ) : err ? (
        <Card>
          <CardBody>
            <Sub style={{ color: "#b91c1c" }}>{err}</Sub>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <Head>
                <div>신청일</div>
                <div>상태</div>
                <div>신청 팀</div>
                <div>상대 팀</div>
                <div>장소</div>
                <div>비고</div>
                <div>유형</div>
                <div>점수</div>
              </Head>

              {pagedRows.map((r) => (
                <Row key={r.id}>
                  <div>{r.when}</div>
                  <div>
                    <StatusBadge $kind={r.status}>
                      {STATUS_LABEL[r.status] || r.status}
                    </StatusBadge>
                  </div>
                  <TeamView team={r.actor} lineup={r.fromLineupName} />
                  <TeamView team={r.target} lineup={r.toLineupName} />
                  <Place title={r.place}>{r.place || "-"}</Place>
                  <Place title={r.cancelReason}>{r.cancelReason || "-"}</Place>
                  <div>{r.matchSize || "-"}</div>
                  <Score>{r.score}</Score>
                </Row>
              ))}

              {!filtered.length ? (
                <Row style={{ gridTemplateColumns: "1fr" }}>
                  <EmptyText>결과가 없습니다.</EmptyText>
                </Row>
              ) : null}
            </Table>
          </TableWrap>
          <AdminPager
            totalCount={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}
    </Page>
  );
}
