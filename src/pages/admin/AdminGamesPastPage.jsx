/* eslint-disable */
// src/pages/admin/AdminGamesPastPage.jsx
import React, { useMemo, useState } from "react";
import styled from "styled-components";

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
  color: #111827;
`;

const Sub = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
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
  border-radius: 10px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
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
  border-radius: 10px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  font-size: 13px;
  outline: none;
  background: #fff;
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
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  font-size: 12px;
  color: #6b7280;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 120px 1.1fr 1.1fr 120px 1fr 120px;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  color: #111827;

  &:hover {
    background: #fafbff;
  }
`;

const Score = styled.div`
  font-weight: 800;
  color: #111827;
`;

const Done = styled.div`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(16, 185, 129, 0.1);
  color: #047857;
`;

export default function AdminGamesPastPage() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");

  const rows = useMemo(() => {
    // ✅ 더미: 지난 경기
    return [
      {
        id: "p1",
        when: "어제",
        home: "레드폭스",
        away: "네오팔콘",
        score: "72 : 68",
        place: "서울 강동 · 천호공원",
        region: "seoul",
      },
      {
        id: "p2",
        when: "3일 전",
        home: "블루호크",
        away: "타이거즈",
        score: "55 : 55",
        place: "서울 강남 · 삼성체육관",
        region: "seoul",
      },
      {
        id: "p3",
        when: "6일 전",
        home: "네오팔콘",
        away: "블랙팬서",
        score: "61 : 74",
        place: "경기 성남 · 탄천코트",
        region: "gyeonggi",
      },
    ];
  }, []);

  const filtered = useMemo(() => {
    const k = String(q || "").trim().toLowerCase();
    return rows.filter((r) => {
      const okRegion = region === "all" ? true : r.region === region;
      if (!okRegion) return false;
      if (!k) return true;
      const hay = `${r.when} ${r.home} ${r.away} ${r.score} ${r.place}`.toLowerCase();
      return hay.includes(k);
    });
  }, [rows, q, region]);

  return (
    <Page>
      <TitleRow>
        <div>
          <H1>지난 경기</H1>
          <Sub>최근 7일 완료 경기 목록 (더미)</Sub>
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
            />
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="all">전체</option>
              <option value="seoul">서울</option>
              <option value="gyeonggi">경기</option>
              <option value="incheon">인천</option>
              <option value="busan">부산</option>
            </Select>
          </FilterRow>
        </CardBody>
      </Card>

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

            {filtered.map((r) => (
              <Row key={r.id}>
                <div>{r.when}</div>
                <div>{r.home}</div>
                <div>{r.away}</div>
                <Score>{r.score}</Score>
                <div style={{ color: "#6b7280" }}>{r.place}</div>
                <div>
                  <Done>완료</Done>
                </div>
              </Row>
            ))}

            {!filtered.length ? (
              <Row style={{ gridTemplateColumns: "1fr" }}>
                <div style={{ color: "#6b7280" }}>결과가 없습니다.</div>
              </Row>
            ) : null}
          </Table>
        </TableWrap>
      </Card>
    </Page>
  );
}
