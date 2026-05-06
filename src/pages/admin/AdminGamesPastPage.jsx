/* eslint-disable */
// src/pages/admin/AdminGamesPastPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminPager from "../../components/admin/AdminPager";
import AdminLoading from "../../components/admin/AdminLoading";
import { fetchAdminPastGames } from "../../services/adminGamesService";

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
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
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
    border-color: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
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
  min-width: 980px;
`;

const Head = styled.div`
  display: grid;
  grid-template-columns: 120px 1.1fr 1.1fr 120px 1fr 120px;
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
  grid-template-columns: 120px 1.1fr 1.1fr 120px 1fr 120px;
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

const TeamName = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Score = styled.div`
  font-weight: 800;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
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

const Done = styled.div`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(34,197,94,0.18)" : "rgba(16, 185, 129, 0.1)"};
  color: ${({ theme }) => (theme?.mode === "dark" ? "#86efac" : "#047857")};
`;

const SIDO_OPTIONS = [
  "서울","경기","인천","부산","대구","대전","광주","울산","세종",
  "강원","충북","충남","전북","전남","경북","경남","제주",
];

function TeamView({ team }) {
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
      <TeamName title={team?.name}>{team?.name || "팀"}</TeamName>
    </TeamCell>
  );
}

export default function AdminGamesPastPage() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetchAdminPastGames({
        keyword: q,
        regionSido: region,
      });
      setRows(res.rows || []);
      setFiltered(res.filtered || []);
    } catch (e) {
      console.error("[AdminGamesPastPage] load failed", e);
      setRows([]);
      setFiltered([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, region, pageSize]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const onSubmit = () => load();

  return (
    <Page>
      <TitleRow>
        <div>
          <H1>지난 경기</H1>
          <Sub>완료된 경기 목록 (match_requests · status=finished)</Sub>
        </div>
        <Sub>{filtered.length}건</Sub>
      </TitleRow>

      <Card>
        <CardBody>
          <FilterRow>
            <Input
              placeholder="팀명/장소/스코어 검색"
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
                <div>기간</div>
                <div>홈</div>
                <div>원정</div>
                <div>스코어</div>
                <div>장소</div>
                <div>상태</div>
              </Head>

              {pagedRows.map((r) => (
                <Row key={r.id}>
                  <div>{r.when}</div>
                  <TeamView team={r.home} />
                  <TeamView team={r.away} />
                  <Score>{r.score}</Score>
                  <Place title={r.place}>{r.place || "-"}</Place>
                  <div>
                    <Done>완료</Done>
                  </div>
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
