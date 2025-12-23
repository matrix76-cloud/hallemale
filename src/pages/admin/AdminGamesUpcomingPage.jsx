/* eslint-disable */
// src/pages/admin/AdminGamesUpcomingPage.jsx
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
  min-width: 920px;
`;

const Head = styled.div`
  display: grid;
  grid-template-columns: 120px 1.2fr 1.2fr 1fr 120px 120px;
  gap: 8px;
  padding: 12px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  font-size: 12px;
  color: #6b7280;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 120px 1.2fr 1.2fr 1fr 120px 120px;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  color: #111827;

  &:hover {
    background: #fafbff;
  }
`;

const Status = styled.div`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
`;

const Btn = styled.button`
  height: 30px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #111827;

  &:active {
    transform: translateY(1px);
  }
`;

export default function AdminGamesUpcomingPage() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");

  const rows = useMemo(() => {
    // ✅ 더미: 예정 경기
    return [
      {
        id: "g1",
        when: "오늘 19:00",
        home: "블루호크",
        away: "레드폭스",
        place: "서울 강남 · 잠실체육관",
        type: "5v5",
        status: "예정",
        region: "seoul",
      },
      {
        id: "g2",
        when: "오늘 21:00",
        home: "네오팔콘",
        away: "타이거즈",
        place: "서울 송파 · 올림픽공원",
        type: "3v3",
        status: "예정",
        region: "seoul",
      },
      {
        id: "g3",
        when: "내일 20:00",
        home: "블랙팬서",
        away: "레드폭스",
        place: "인천 · 문학코트",
        type: "3v3",
        status: "예정",
        region: "incheon",
      },
    ];
  }, []);

  const filtered = useMemo(() => {
    const k = String(q || "").trim().toLowerCase();
    return rows.filter((r) => {
      const okRegion = region === "all" ? true : r.region === region;
      if (!okRegion) return false;
      if (!k) return true;
      const hay = `${r.when} ${r.home} ${r.away} ${r.place} ${r.type}`.toLowerCase();
      return hay.includes(k);
    });
  }, [rows, q, region]);

  return (
    <Page>
      <TitleRow>
        <div>
          <H1>예정된 경기</H1>
          <Sub>오늘~앞으로 예정된 경기 목록 (더미)</Sub>
        </div>
        <Sub>{filtered.length}건</Sub>
      </TitleRow>

      <Card>
        <CardBody>
          <FilterRow>
            <Input
              placeholder="팀명/장소/시간 검색"
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
              <div>일시</div>
              <div>홈</div>
              <div>원정</div>
              <div>장소</div>
              <div>유형</div>
              <div>상태</div>
            </Head>

            {filtered.map((r) => (
              <Row key={r.id}>
                <div>{r.when}</div>
                <div>{r.home}</div>
                <div>{r.away}</div>
                <div style={{ color: "#6b7280" }}>{r.place}</div>
                <div>{r.type}</div>
                <div>
                  <Status>{r.status}</Status>
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
