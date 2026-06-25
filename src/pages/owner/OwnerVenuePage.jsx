/* eslint-disable */
// src/pages/owner/OwnerVenuePage.jsx
// 내 구장 — 구장 정보 요약 + 코트별 운영시간/가격 관리(추가/삭제/수정)
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import { updateMyVenue, defaultCourtHours } from "../../services/ownerVenueService";
import CourtHoursEditor from "./components/CourtHoursEditor";
import {
  Page, Card, SectionTitle, SectionDesc, Field, Label, Input, Select, Row,
  PrimaryBtn, GhostBtn, Badge, Chip, ChipWrap,
} from "./components/ownerUi";
import OwnerSpinner from "./components/OwnerSpinner";
import VenueGateNotice from "./components/VenueGateNotice";

const Cover = styled.div`
  width: 100%;
  height: 170px;
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  position: relative;
`;
const CoverImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const NoCover = styled.div`
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 13px;
`;
const VName = styled.div`
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const VAddr = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const CourtCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const CourtHead = styled.div`
  display: flex; align-items: center; justify-content: space-between;
`;
const DelLink = styled.button`
  border: none; background: transparent;
  color: ${({ theme }) => theme.colors.danger};
  font-size: 12.5px; font-weight: 600; cursor: pointer;
`;
const FacTag = styled.span`
  display: inline-block;
  padding: 5px 11px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textNormal};
`;
const Gallery = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;
const GImg = styled.img`
  width: 140px;
  height: 100px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
`;
const InfoLine = styled.div`
  display: flex;
  gap: 10px;
  font-size: 13px;
  & > b { width: 76px; flex-shrink: 0; color: ${({ theme }) => theme.colors.textWeak}; font-weight: 600; }
  & > span { color: ${({ theme }) => theme.colors.textStrong}; flex: 1; }
`;

function courtToForm(c, i) {
  return {
    id: c.id,
    name: c.name || `${i + 1}코트`,
    type: c.type || "indoor",
    pricePerHour: String(c.pricePerHour ?? ""),
    slotMinutes: c.slotMinutes || 60,
    hours: c.hours || defaultCourtHours(),
  };
}
function makeCourt(i) {
  return { name: `${i + 1}코트`, type: "indoor", pricePerHour: "", slotMinutes: 60, hours: defaultCourtHours() };
}

export default function OwnerVenuePage() {
  const { venue, loading, refresh } = useOwner();
  const [courts, setCourts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (venue?.courts) setCourts(venue.courts.map(courtToForm));
  }, [venue?.id]); // eslint-disable-line

  if (loading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue) return <Page><VenueGateNotice venue={null} refresh={refresh} /></Page>;

  const setCourt = (i, patch) => setCourts((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCourt = () => setCourts((p) => [...p, makeCourt(p.length)]);
  const removeCourt = (i) => setCourts((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const saveCourts = async () => {
    if (courts.some((c) => !c.name.trim())) return window.alert("코트 이름을 모두 입력해주세요.");
    setSaving(true);
    try {
      await updateMyVenue(venue.id, { courts });
      await refresh();
      window.alert("코트 정보가 저장됐어요.");
    } catch (e) {
      window.alert(e?.message || "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Cover>
        {venue.imageUrl ? <CoverImg src={venue.imageUrl} alt={venue.name} /> : <NoCover>등록된 사진 없음</NoCover>}
      </Cover>

      {venue.photos?.length > 1 && (
        <Gallery>
          {venue.photos.map((u, i) => <GImg key={i} src={u} alt={`구장 사진 ${i + 1}`} />)}
        </Gallery>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <VName>{venue.name}</VName>
            <VAddr>{venue.address} {venue.addressDetail}</VAddr>
          </div>
          <Badge $tone={venue.status}>
            {venue.status === "approved" ? "승인됨" : venue.status === "pending" ? "심사중" : "반려"}
          </Badge>
        </div>
        {venue.rejectReason && (
          <SectionDesc style={{ color: "#dc2626" }}>반려 사유: {venue.rejectReason}</SectionDesc>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
          {venue.region && <InfoLine><b>지역</b><span>{venue.region}</span></InfoLine>}
          {venue.phone && <InfoLine><b>연락처</b><span>{venue.phone}</span></InfoLine>}
          <InfoLine><b>유형 / 비용</b><span>{venue.type === "outdoor" ? "실외" : "실내"} · {venue.cost === "paid" ? "유료" : "무료"}</span></InfoLine>
          <InfoLine><b>예약 코트</b><span>{venue.courts?.length || 0}개</span></InfoLine>
        </div>
        {venue.facilities?.length > 0 && (
          <ChipWrap style={{ marginTop: 4 }}>
            {venue.facilities.map((f) => <FacTag key={f}>{f}</FacTag>)}
          </ChipWrap>
        )}
      </Card>

      <Card>
        <SectionTitle>🏀 코트 운영 설정</SectionTitle>
        <SectionDesc>코트별 운영시간·가격·슬롯 단위를 관리해요. 변경 후 저장하세요.</SectionDesc>
        {courts.map((c, i) => (
          <CourtCard key={c.id || i}>
            <CourtHead>
              <Label>코트 {i + 1}</Label>
              {courts.length > 1 && <DelLink type="button" onClick={() => removeCourt(i)}>삭제</DelLink>}
            </CourtHead>
            <Row>
              <Field>
                <Label>이름</Label>
                <Input value={c.name} onChange={(e) => setCourt(i, { name: e.target.value })} placeholder="A코트" />
              </Field>
              <Field>
                <Label>종류</Label>
                <Select value={c.type} onChange={(e) => setCourt(i, { type: e.target.value })}>
                  <option value="indoor">실내</option>
                  <option value="outdoor">실외</option>
                </Select>
              </Field>
            </Row>
            <Row>
              <Field>
                <Label>시간당 가격(원)</Label>
                <Input type="number" value={c.pricePerHour} onChange={(e) => setCourt(i, { pricePerHour: e.target.value })} placeholder="40000" />
              </Field>
              <Field>
                <Label>슬롯 단위</Label>
                <Select value={c.slotMinutes} onChange={(e) => setCourt(i, { slotMinutes: Number(e.target.value) })}>
                  <option value={30}>30분</option>
                  <option value={60}>60분</option>
                  <option value={90}>90분</option>
                  <option value={120}>120분</option>
                </Select>
              </Field>
            </Row>
            <Field>
              <Label>요일별 운영시간</Label>
              <CourtHoursEditor hours={c.hours} onChange={(hours) => setCourt(i, { hours })} />
            </Field>
          </CourtCard>
        ))}
        <GhostBtn type="button" onClick={addCourt}>＋ 코트 추가</GhostBtn>
        <PrimaryBtn type="button" onClick={saveCourts} disabled={saving}>
          {saving ? "저장 중…" : "코트 설정 저장"}
        </PrimaryBtn>
      </Card>

      {venue.description && (
        <Card>
          <SectionTitle>구장 소개</SectionTitle>
          <SectionDesc style={{ whiteSpace: "pre-wrap" }}>{venue.description}</SectionDesc>
        </Card>
      )}
      {venue.rules && (
        <Card>
          <SectionTitle>이용 규칙</SectionTitle>
          <SectionDesc style={{ whiteSpace: "pre-wrap" }}>{venue.rules}</SectionDesc>
        </Card>
      )}
      {venue.refundPolicy && (
        <Card>
          <SectionTitle>환불 정책</SectionTitle>
          <SectionDesc style={{ whiteSpace: "pre-wrap" }}>{venue.refundPolicy}</SectionDesc>
        </Card>
      )}

      {(venue.ownerName || venue.contactPhone || venue.bizName || venue.bizNo) && (
        <Card>
          <SectionTitle>사업자 / 관리자 정보</SectionTitle>
          <SectionDesc>심사 확인용 정보로, 사용자에게는 공개되지 않아요.</SectionDesc>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {venue.ownerName && <InfoLine><b>대표자</b><span>{venue.ownerName}</span></InfoLine>}
            {venue.contactPhone && <InfoLine><b>연락처</b><span>{venue.contactPhone}</span></InfoLine>}
            {venue.bizName && <InfoLine><b>상호</b><span>{venue.bizName}</span></InfoLine>}
            {venue.bizNo && <InfoLine><b>사업자번호</b><span>{venue.bizNo}</span></InfoLine>}
          </div>
        </Card>
      )}
    </Page>
  );
}
