/* eslint-disable */
// src/pages/owner/OwnerVenuePage.jsx
// 구장정보 — 코트별 기본정보/운영시간/요금(3단계)/공지/주의 + 편의시설·노출모드 (명세서 4,5,6)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  LuPlus, LuTrash2, LuPin, LuMegaphone, LuTriangleAlert, LuCoins, LuClock, LuLayoutGrid, LuBuilding2, LuLogOut,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useOwner } from "../../context/OwnerContext";
import { updateMyVenue, defaultCourtHours, FACILITY_OPTIONS, DAY_KEYS, DAY_LABELS } from "../../services/ownerVenueService";
import CourtHoursEditor from "./components/CourtHoursEditor";
import PriceBandsEditor from "./components/PriceBandsEditor";
import BusinessSection from "./components/BusinessSection";
import { FacilityIcon } from "../venue/facilityIcons";
import {
  Page, Card, ScreenTitle, SecTitle, Caption, Input, Chip, PrimaryBtn, GhostBtn, DangerBtn, C,
} from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";

const Cover = styled.div`width:100%;height:150px;border-radius:16px;overflow:hidden;background:${C.slate100};`;
const CoverImg = styled.img`width:100%;height:100%;object-fit:cover;`;
const VName = styled.div`font-size:18px;font-weight:800;color:${C.slate800};`;
const VAddr = styled.div`font-size:13px;color:${C.slate500};`;
const ChipRow = styled.div`display:flex;gap:8px;overflow-x:auto;&::-webkit-scrollbar{display:none;}`;
const Row = styled.div`display:flex;gap:10px;& > *{flex:1;min-width:0;}`;
const Field = styled.label`display:flex;flex-direction:column;gap:6px;flex:1;`;
const Lbl = styled.span`font-size:12.5px;font-weight:700;color:${C.slate500};`;
const Sel = styled.select`border:1px solid ${C.slate200};border-radius:12px;padding:11px 10px;font-size:14px;color:${C.slate800};background:#fff;`;
const Seg = styled.div`display:flex;gap:8px;`;
const SegBtn = styled.button`flex:1;border:1px solid ${({$on})=>$on?C.violet600:C.slate200};background:${({$on})=>$on?C.violet50:"#fff"};color:${({$on})=>$on?C.violet600:C.slate500};border-radius:12px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;`;
const DowChips = styled.div`display:flex;gap:6px;flex-wrap:wrap;`;
const DowChip = styled.button`width:36px;height:36px;border-radius:10px;border:1px solid ${({$on})=>$on?C.violet600:C.slate200};background:${({$on})=>$on?C.violet600:"#fff"};color:${({$on})=>$on?"#fff":C.slate500};font-size:13px;font-weight:700;cursor:pointer;`;
const ListItem = styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;`;
const ItemHead = styled.div`display:flex;align-items:center;justify-content:space-between;gap:8px;`;
const ItemTitle = styled.div`font-size:13.5px;font-weight:700;color:${C.slate800};display:flex;align-items:center;gap:5px;`;
const ItemBody = styled.div`font-size:12.5px;color:${C.slate500};white-space:pre-wrap;line-height:1.5;`;
const IconBtn = styled.button`border:none;background:transparent;color:${({$tone})=>$tone==="danger"?C.red500:$tone==="on"?C.violet600:C.slate400};cursor:pointer;display:flex;padding:3px;`;
const Textarea = styled.textarea`border:1px solid ${C.slate200};border-radius:12px;padding:10px 12px;font-size:14px;color:${C.slate800};font-family:inherit;resize:vertical;min-height:60px;&:focus{outline:none;border-color:${C.violet300};}`;
const FacWrap = styled.div`display:flex;flex-wrap:wrap;gap:8px;`;
const Fac = styled.button`display:inline-flex;align-items:center;gap:5px;border:1px solid ${({$on})=>$on?C.violet600:C.slate200};color:${({$on})=>$on?C.violet600:C.slate500};background:${({$on})=>$on?C.violet50:"#fff"};border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;& > svg{color:${({$on})=>$on?C.violet600:C.slate400};}`;
const Dates = styled.div`display:flex;gap:6px;flex-wrap:wrap;`;
const DateTag = styled.button`border:1px solid ${({$on})=>$on?C.violet600:C.slate200};background:${({$on})=>$on?C.violet50:"#fff"};color:${({$on})=>$on?C.violet600:C.slate500};border-radius:999px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;`;
const LogoutRow = styled.button`display:flex;align-items:center;justify-content:center;gap:6px;width:100%;border:1px solid ${C.slate200};background:#fff;border-radius:12px;padding:12px;color:${C.red500};font-size:13.5px;font-weight:700;cursor:pointer;`;

function courtForm(c, i) {
  return {
    id: c?.id, name: c?.name || `${i + 1}코트`, type: c?.type || "indoor",
    pricePerHour: String(c?.pricePerHour ?? ""), slotMinutes: c?.slotMinutes || 60,
    hours: c?.hours || defaultCourtHours(),
    priceBands: c?.priceBands || {}, priceOverrides: c?.priceOverrides || {},
    notices: c?.notices || [], cautions: c?.cautions || [],
  };
}
function makeCourt(i) { return courtForm({ name: `${i + 1}코트` }, i); }

export default function OwnerVenuePage() {
  const navigate = useNavigate();
  const { venue, loading, refresh, signOut } = useOwner();
  const [courts, setCourts] = useState([]);
  const [sel, setSel] = useState(0);
  const [facilities, setFacilities] = useState([]);
  const [displayMode, setDisplayMode] = useState("grouped");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [priceTab, setPriceTab] = useState("base"); // base | weekday | date
  const [dow, setDow] = useState("mon");
  const [pdate, setPdate] = useState("");

  useEffect(() => {
    if (!venue) return;
    setCourts((venue.courts || []).map(courtForm));
    setFacilities(venue.facilities || []);
    setDisplayMode(venue.displayMode || "grouped");
    setDisplayName(venue.displayName || venue.name || "");
  }, [venue?.id]); // eslint-disable-line

  if (loading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue) return <Page><VenueGateNotice venue={null} refresh={refresh} /></Page>;

  const court = courts[sel] || courts[0];
  const setCourt = (patch) => setCourts((cs) => cs.map((c, i) => (i === sel ? { ...c, ...patch } : c)));
  const addCourt = () => { setCourts((cs) => [...cs, makeCourt(cs.length)]); setSel(courts.length); };
  const removeCourt = () => { if (courts.length <= 1) return; setCourts((cs) => cs.filter((_, i) => i !== sel)); setSel(0); };
  const toggleFac = (f) => setFacilities((fs) => fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]);

  // 공지
  const addNotice = () => setCourt({ notices: [...(court.notices || []), { id: "nt_" + Date.now().toString(36), title: "", body: "", pinned: false }] });
  const setNotice = (id, patch) => setCourt({ notices: court.notices.map((n) => n.id === id ? { ...n, ...patch } : n) });
  const delNotice = (id) => setCourt({ notices: court.notices.filter((n) => n.id !== id) });
  // 주의
  const addCaution = () => setCourt({ cautions: [...(court.cautions || []), ""] });
  const setCaution = (i, v) => setCourt({ cautions: court.cautions.map((c, idx) => idx === i ? v : c) });
  const delCaution = (i) => setCourt({ cautions: court.cautions.filter((_, idx) => idx !== i) });

  const save = async () => {
    if (courts.some((c) => !c.name.trim())) return window.alert && null;
    setSaving(true);
    try {
      await updateMyVenue(venue.id, { courts, facilities, displayMode, displayName });
      await refresh();
    } catch (e) {
      // 토스트 대신 조용히
    } finally { setSaving(false); }
  };

  const handleLogout = async () => { if (!window.confirm("로그아웃 하시겠어요?")) return; await signOut(); navigate("/owner/login", { replace: true }); };

  const configuredDates = Object.keys(court?.priceOverrides || {}).sort();

  return (
    <Page>
      <ScreenTitle>구장정보</ScreenTitle>

      {venue.imageUrl && <Cover><CoverImg src={venue.imageUrl} alt={venue.name} /></Cover>}
      <Card>
        <VName>{venue.name}</VName>
        <VAddr>{venue.address} {venue.addressDetail}</VAddr>
        {venue.description && <Caption style={{ whiteSpace: "pre-wrap" }}>{venue.description}</Caption>}
      </Card>

      {/* 코트 전환 */}
      <ChipRow>
        {courts.map((c, i) => <Chip key={c.id || i} $on={i === sel} onClick={() => setSel(i)}>{c.name || `${i + 1}코트`}</Chip>)}
        <Chip onClick={addCourt} style={{ borderStyle: "dashed" }}><LuPlus size={14} /></Chip>
      </ChipRow>

      {court && (
        <>
          {/* 기본 */}
          <Card>
            <SecTitle><LuBuilding2 size={16} /> 코트 기본</SecTitle>
            <Field><Lbl>코트 이름</Lbl><Input value={court.name} onChange={(e) => setCourt({ name: e.target.value })} placeholder="A코트" /></Field>
            <Row>
              <Field><Lbl>종류</Lbl><Sel value={court.type} onChange={(e) => setCourt({ type: e.target.value })}><option value="indoor">실내</option><option value="outdoor">실외</option></Sel></Field>
              <Field><Lbl>예약 시간 단위</Lbl><Sel value={court.slotMinutes} onChange={(e) => setCourt({ slotMinutes: Number(e.target.value) })}><option value={60}>60분</option><option value={90}>90분</option><option value={120}>120분</option></Sel></Field>
            </Row>
            {courts.length > 1 && <GhostBtn type="button" onClick={removeCourt} style={{ color: C.red500, borderColor: C.red200 }}>이 코트 삭제</GhostBtn>}
          </Card>

          {/* 운영시간 */}
          <Card>
            <SecTitle><LuClock size={16} /> 운영시간 (요일별)</SecTitle>
            <CourtHoursEditor hours={court.hours} onChange={(hours) => setCourt({ hours })} />
          </Card>

          {/* 요금 3단계 */}
          <Card>
            <SecTitle><LuCoins size={16} /> 이용 요금</SecTitle>
            <Caption>적용 우선순위: 특정 날짜 &gt; 요일별 구간 &gt; 기본요금</Caption>
            <Seg>
              <SegBtn $on={priceTab === "base"} onClick={() => setPriceTab("base")}>기본</SegBtn>
              <SegBtn $on={priceTab === "weekday"} onClick={() => setPriceTab("weekday")}>요일별</SegBtn>
              <SegBtn $on={priceTab === "date"} onClick={() => setPriceTab("date")}>특정날짜</SegBtn>
            </Seg>

            {priceTab === "base" && (
              <Field><Lbl>기본 요금 (시간당)</Lbl><Input type="number" value={court.pricePerHour} onChange={(e) => setCourt({ pricePerHour: e.target.value })} placeholder="40000" /></Field>
            )}

            {priceTab === "weekday" && (
              <>
                <DowChips>{DAY_KEYS.map((k) => <DowChip key={k} $on={dow === k} onClick={() => setDow(k)}>{DAY_LABELS[k]}</DowChip>)}</DowChips>
                <Lbl>{DAY_LABELS[dow]}요일 시간대별 요금</Lbl>
                <PriceBandsEditor bands={court.priceBands?.[dow] || []} basePrice={Number(court.pricePerHour) || 0}
                  onChange={(bands) => setCourt({ priceBands: { ...court.priceBands, [dow]: bands } })} />
                <GhostBtn type="button" onClick={() => { const b = court.priceBands?.[dow] || []; const next = {}; DAY_KEYS.forEach((k) => next[k] = b.map((x) => ({ ...x }))); setCourt({ priceBands: next }); }}>
                  {DAY_LABELS[dow]} 구간을 모든 요일에 복사
                </GhostBtn>
              </>
            )}

            {priceTab === "date" && (
              <>
                <Field><Lbl>날짜 선택</Lbl><Input type="date" value={pdate} onChange={(e) => setPdate(e.target.value)} /></Field>
                {configuredDates.length > 0 && (
                  <Dates>{configuredDates.map((d) => <DateTag key={d} $on={d === pdate} onClick={() => setPdate(d)}>{d.slice(5)}</DateTag>)}</Dates>
                )}
                {pdate && (
                  <PriceBandsEditor bands={court.priceOverrides?.[pdate] || []} basePrice={Number(court.pricePerHour) || 0}
                    onChange={(bands) => { const ov = { ...court.priceOverrides }; if (bands.length) ov[pdate] = bands; else delete ov[pdate]; setCourt({ priceOverrides: ov }); }} />
                )}
              </>
            )}
          </Card>

          {/* 공지사항 */}
          <Card>
            <SecTitle><LuMegaphone size={16} /> 공지사항</SecTitle>
            <Caption>휴무·이벤트 등 시간성 알림. 핀하면 사용자 화면 상단 고정.</Caption>
            {(court.notices || []).map((n) => (
              <ListItem key={n.id}>
                <ItemHead>
                  <Input value={n.title} onChange={(e) => setNotice(n.id, { title: e.target.value })} placeholder="공지 제목" style={{ flex: 1 }} />
                  <IconBtn $tone={n.pinned ? "on" : ""} onClick={() => setNotice(n.id, { pinned: !n.pinned })}><LuPin size={17} /></IconBtn>
                  <IconBtn $tone="danger" onClick={() => delNotice(n.id)}><LuTrash2 size={16} /></IconBtn>
                </ItemHead>
                <Textarea value={n.body} onChange={(e) => setNotice(n.id, { body: e.target.value })} placeholder="공지 내용" />
              </ListItem>
            ))}
            <GhostBtn type="button" onClick={addNotice}><LuPlus size={14} /> 공지 추가</GhostBtn>
          </Card>

          {/* 주의사항 */}
          <Card>
            <SecTitle><LuTriangleAlert size={16} /> 주의사항</SecTitle>
            <Caption>상시 이용 규칙 (예: 농구화 지참, 음식물 금지).</Caption>
            {(court.cautions || []).map((c, i) => (
              <Row key={i}>
                <Input value={c} onChange={(e) => setCaution(i, e.target.value)} placeholder="주의사항 항목" />
                <IconBtn $tone="danger" onClick={() => delCaution(i)} style={{ flex: "0 0 auto" }}><LuTrash2 size={16} /></IconBtn>
              </Row>
            ))}
            <GhostBtn type="button" onClick={addCaution}><LuPlus size={14} /> 주의사항 추가</GhostBtn>
          </Card>
        </>
      )}

      {/* 편의시설 (구장 공통) */}
      <Card>
        <SecTitle>편의시설</SecTitle>
        <FacWrap>{FACILITY_OPTIONS.map((f) => <Fac key={f} $on={facilities.includes(f)} onClick={() => toggleFac(f)}><FacilityIcon name={f} size={15} /> {f}</Fac>)}</FacWrap>
      </Card>

      {/* 노출 모드 */}
      <Card>
        <SecTitle><LuLayoutGrid size={16} /> 사용자 노출 방식</SecTitle>
        <Seg>
          <SegBtn $on={displayMode === "grouped"} onClick={() => setDisplayMode("grouped")}>한 장소로 묶기</SegBtn>
          <SegBtn $on={displayMode === "separate"} onClick={() => setDisplayMode("separate")}>각각 독립</SegBtn>
        </Seg>
        {displayMode === "grouped" ? (
          <Field><Lbl>대표 장소명</Lbl><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="예: 용산 더베이스" /></Field>
        ) : (
          <Caption>코트별로 검색·목록에 개별 노출돼요. (종목·위치가 다를 때 권장)</Caption>
        )}
      </Card>

      <PrimaryBtn type="button" onClick={save} disabled={saving}>{saving ? "저장 중…" : "구장정보 저장"}</PrimaryBtn>

      {/* 사업자 인증 / 통신판매업 / 정산 계좌 (명세서 2) */}
      <BusinessSection venue={venue} refresh={refresh} />

      <LogoutRow type="button" onClick={handleLogout}><LuLogOut size={16} /> 로그아웃</LogoutRow>
      <div style={{ height: 8 }} />
    </Page>
  );
}
