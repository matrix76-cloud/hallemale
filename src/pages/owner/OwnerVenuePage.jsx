/* eslint-disable */
// src/pages/owner/OwnerVenuePage.jsx
// 구장정보 — 코트별 기본정보/운영시간/요금(3단계)/공지/주의 + 편의시설·노출모드 (명세서 4,5,6)
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  LuPlus, LuTrash2, LuPin, LuMegaphone, LuTriangleAlert, LuCoins, LuClock, LuLayoutGrid, LuBuilding2, LuLogOut,
  LuImage, LuPhone, LuFileText, LuReceipt, LuInfo, LuEye, LuMapPin,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useOwner } from "../../context/OwnerContext";
import { updateMyVenue, defaultCourtHours, FACILITY_OPTIONS, SURFACE_OPTIONS, DAY_KEYS, DAY_LABELS } from "../../services/ownerVenueService";
import { uploadVenueImage } from "../../services/venuesService";
import CourtHoursEditor from "./components/CourtHoursEditor";
import VenueMapPicker from "./components/VenueMapPicker";
import PriceBandsEditor from "./components/PriceBandsEditor";
import BusinessSection from "./components/BusinessSection";
import VenuePreviewSheet from "./components/VenuePreviewSheet";
import { FacilityIcon } from "../venue/facilityIcons";
import {
  Page, Card, ScreenTitle, SecTitle, Caption, Input, Chip, PrimaryBtn, GhostBtn, DangerBtn, C,
} from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";

const VName = styled.div`font-size:18px;font-weight:800;color:${C.slate800};`;
const VAddr = styled.div`font-size:13px;color:${C.slate500};`;
const AutoAddr = styled.div`min-height:44px;padding:12px 14px;border-radius:12px;border:1px solid ${C.slate200};background:${C.slate100};color:${C.slate800};font-size:14px;line-height:1.4;display:flex;align-items:center;`;
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
const PhotoStrip = styled.div`display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;&::-webkit-scrollbar{display:none;}`;
const PhotoBox = styled.div`position:relative;flex:0 0 auto;width:110px;height:84px;border-radius:10px;overflow:hidden;background:${C.slate100};border:1px solid ${C.slate200};`;
const PhotoImg = styled.img`width:100%;height:100%;object-fit:cover;`;
const RemovePhoto = styled.button`position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:999px;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:13px;cursor:pointer;line-height:1;`;
const AddPhoto = styled.button`flex:0 0 auto;width:110px;height:84px;border-radius:10px;border:1.5px dashed ${C.slate200};background:${C.slate100};color:${C.slate500};font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;`;
const HiddenFile = styled.input`display:none;`;

function courtForm(c, i) {
  return {
    id: c?.id, name: c?.name || `${i + 1}코트`, type: c?.type || "indoor",
    surface: c?.surface || "",
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
  const fileRef = useRef(null);
  const [courts, setCourts] = useState([]);
  const [sel, setSel] = useState(0);
  const [facilities, setFacilities] = useState([]);
  const [sportTypes, setSportTypes] = useState([]);
  const [parking, setParking] = useState({ available: false, fee: "free", info: "" });
  const [directions, setDirections] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [region, setRegion] = useState("");
  const [latLng, setLatLng] = useState({ lat: "", lng: "" });
  const [displayMode, setDisplayMode] = useState("grouped");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [priceTab, setPriceTab] = useState("base"); // base | weekday | date
  const [dow, setDow] = useState("mon");
  const [pdate, setPdate] = useState("");
  // 사용자 화면 노출 정보 (사진/소개/연락처/이용안내/환불정책)
  const [photos, setPhotos] = useState([]); // [{url, storagePath}]
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [rules, setRules] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!venue) return;
    setCourts((venue.courts || []).map(courtForm));
    setFacilities(venue.facilities || []);
    setSportTypes(venue.sportTypes || []);
    setParking({
      available: venue.parking?.available === true,
      fee: venue.parking?.fee === "paid" ? "paid" : "free",
      info: venue.parking?.info || "",
    });
    setDirections(venue.directions || "");
    setKeywords(venue.keywords || []);
    setName(venue.name || "");
    setAddress(venue.address || "");
    setAddressDetail(venue.addressDetail || "");
    setRegion(venue.region || "");
    setLatLng({ lat: venue.lat ?? "", lng: venue.lng ?? "" });
    setDisplayMode(venue.displayMode || "grouped");
    setDisplayName(venue.displayName || venue.name || "");
    setPhotos((venue.photos || []).map((url, i) => ({ url, storagePath: venue.storagePaths?.[i] || "" })));
    setDescription(venue.description || "");
    setPhone(venue.phone || "");
    setRules(venue.rules || "");
    setRefundPolicy(venue.refundPolicy || "");
  }, [venue?.id]); // eslint-disable-line

  if (loading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue) return <Page><VenueGateNotice venue={null} refresh={refresh} /></Page>;

  const court = courts[sel] || courts[0];
  const setCourt = (patch) => setCourts((cs) => cs.map((c, i) => (i === sel ? { ...c, ...patch } : c)));
  const addCourt = () => { setCourts((cs) => [...cs, makeCourt(cs.length)]); setSel(courts.length); };
  const removeCourt = () => { if (courts.length <= 1) return; setCourts((cs) => cs.filter((_, i) => i !== sel)); setSel(0); };
  const toggleFac = (f) => setFacilities((fs) => fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]);
  const addKeyword = () => {
    const k = keywordInput.trim().replace(/^#/, "");
    if (!k) return;
    if (keywords.length >= 5) { showAlert("대표키워드는 최대 5개예요."); return; }
    if (keywords.includes(k)) { setKeywordInput(""); return; }
    setKeywords((prev) => [...prev, k]);
    setKeywordInput("");
  };

  // 공지
  const addNotice = () => setCourt({ notices: [...(court.notices || []), { id: "nt_" + Date.now().toString(36), title: "", body: "", pinned: false }] });
  const setNotice = (id, patch) => setCourt({ notices: court.notices.map((n) => n.id === id ? { ...n, ...patch } : n) });
  const delNotice = (id) => setCourt({ notices: court.notices.filter((n) => n.id !== id) });
  // 주의
  const addCaution = () => setCourt({ cautions: [...(court.cautions || []), ""] });
  const setCaution = (i, v) => setCourt({ cautions: court.cautions.map((c, idx) => idx === i ? v : c) });
  const delCaution = (i) => setCourt({ cautions: court.cautions.filter((_, idx) => idx !== i) });

  // 사진 업로드/삭제 (등록 페이지와 동일한 흐름 — uploadVenueImage 재사용)
  const pickPhoto = () => { if (!uploading && !saving) fileRef.current?.click(); };
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadVenueImage(file);
      setPhotos((prev) => [...prev, { url: imageUrl, storagePath }]);
    } catch (err) {
      showAlert(err?.message || "사진 업로드에 실패했어요.");
    } finally { setUploading(false); }
  };
  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) { showAlert("구장명을 입력해 주세요."); return; }
    if (courts.some((c) => !c.name.trim())) { showAlert("코트 이름을 입력해 주세요."); return; }
    setSaving(true);
    try {
      await updateMyVenue(venue.id, {
        name, courts, facilities, displayMode, displayName,
        sportTypes, parking, directions, keywords,
        address, addressDetail, region, lat: latLng.lat, lng: latLng.lng,
        photos: photos.map((p) => p.url),
        storagePaths: photos.map((p) => p.storagePath),
        description, phone, rules, refundPolicy,
      });
      await refresh();
    } catch (e) {
      // 토스트 대신 조용히
    } finally { setSaving(false); }
  };


  const configuredDates = Object.keys(court?.priceOverrides || {}).sort();

  // 미리보기용 — 저장 전 편집 내용까지 반영해 사용자 화면을 재현
  const previewVenue = {
    ...venue,
    name,
    photos: photos.map((p) => p.url).filter(Boolean),
    imageUrl: photos[0]?.url || venue.imageUrl,
    facilities, description, phone, rules, refundPolicy,
    sportTypes, parking, directions, keywords,
    address, addressDetail, region, lat: latLng.lat, lng: latLng.lng,
    displayMode, displayName,
    courts: courts.map((c) => ({ ...c, pricePerHour: Number(c.pricePerHour) || 0 })),
  };

  return (
    <Page>
      <ScreenTitle>구장정보</ScreenTitle>

      <GhostBtn type="button" onClick={() => setPreviewOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <LuEye size={16} /> 상세페이지 미리보기
      </GhostBtn>

      {/* 구장 사진 — 사용자 예약화면 상단 캐러셀/시설사진에 노출 */}
      <Card>
        <SecTitle><LuImage size={16} /> 구장 사진</SecTitle>
        <Caption>구장 전경·코트·시설 사진. 첫 사진이 대표 이미지로 쓰여요. (여러 장 가능)</Caption>
        <PhotoStrip>
          {photos.map((p, i) => (
            <PhotoBox key={i}>
              <PhotoImg src={p.url} alt={`구장 사진 ${i + 1}`} />
              <RemovePhoto type="button" onClick={() => removePhoto(i)}>×</RemovePhoto>
            </PhotoBox>
          ))}
          <AddPhoto type="button" onClick={pickPhoto} disabled={uploading}>
            {uploading ? "업로드 중…" : <><span style={{ fontSize: 20 }}>＋</span><span>사진 추가</span></>}
          </AddPhoto>
        </PhotoStrip>
        <HiddenFile ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
      </Card>

      <Card>
        <Field><Lbl>구장명</Lbl><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 용산 더베이스 농구장" /></Field>
        <SecTitle><LuMapPin size={16} /> 위치</SecTitle>
        <Caption>지도를 움직여 구장 위치에 핀을 맞추면 주소가 자동 입력돼요.</Caption>
        <VenueMapPicker
          value={{ lat: latLng.lat, lng: latLng.lng, address, region }}
          onChange={({ lat, lng, address: a, region: r }) => { setLatLng({ lat, lng }); setAddress(a); setRegion(r); }}
          height={200}
        />
        <AutoAddr>{address || "지도에서 위치를 선택해주세요"}</AutoAddr>
        <Field><Lbl>상세 주소</Lbl><Input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="예: 지하 2층 / B동" /></Field>
      </Card>


      {/* 구장 소개·연락처 — 사용자 예약화면 '코트 소개'/'호스트 정보'에 노출 */}
      <Card>
        <SecTitle><LuInfo size={16} /> 구장 소개</SecTitle>
        <Caption>사용자 예약화면에 그대로 노출돼요. (특징·바닥 재질·주차 안내 등)</Caption>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="구장 특징, 바닥 재질, 주차 안내 등" />
        <Field><Lbl><LuMapPin size={13} style={{ verticalAlign: -2, marginRight: 4 }} />찾아오는 길</Lbl><Textarea value={directions} onChange={(e) => setDirections(e.target.value)} placeholder="예: 6호선 이태원역 3번 출구 도보 5분, 건물 뒤편 입구" /></Field>
        <Field><Lbl><LuPhone size={13} style={{ verticalAlign: -2, marginRight: 4 }} />구장 연락처</Lbl><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: 02-1234-5678" /></Field>
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
              <Field><Lbl>바닥재질</Lbl><Sel value={court.surface} onChange={(e) => setCourt({ surface: e.target.value })}><option value="">선택 안 함</option>{SURFACE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</Sel></Field>
            </Row>
            <Field><Lbl>예약 시간 단위</Lbl><Sel value={court.slotMinutes} onChange={(e) => setCourt({ slotMinutes: Number(e.target.value) })}><option value={30}>30분</option><option value={60}>60분</option><option value={90}>90분</option><option value={120}>120분</option></Sel></Field>
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
        <Lbl style={{ marginTop: 4 }}>🅿️ 주차</Lbl>
        <FacWrap>
          <Fac $on={!parking.available} onClick={() => setParking((p) => ({ ...p, available: false }))}>주차 불가</Fac>
          <Fac $on={parking.available && parking.fee === "free"} onClick={() => setParking((p) => ({ ...p, available: true, fee: "free" }))}>무료 주차</Fac>
          <Fac $on={parking.available && parking.fee === "paid"} onClick={() => setParking((p) => ({ ...p, available: true, fee: "paid" }))}>유료 주차</Fac>
        </FacWrap>
        {parking.available && (
          <Input value={parking.info} onChange={(e) => setParking((p) => ({ ...p, info: e.target.value }))} placeholder="주차 안내 (예: 건물 내 10대, 2시간 무료)" />
        )}
      </Card>

      {/* 대표키워드 — 사용자 검색 노출 */}
      <Card>
        <SecTitle>대표키워드</SecTitle>
        <Caption>지역명+종목을 넣으면 검색에 잘 노출돼요. (최대 5개)</Caption>
        <Row>
          <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
            placeholder="예: 이태원 농구장" maxLength={20} style={{ flex: 1 }} />
          <GhostBtn type="button" onClick={addKeyword} style={{ flex: "0 0 auto" }}>추가</GhostBtn>
        </Row>
        {keywords.length > 0 && (
          <FacWrap>
            {keywords.map((k) => (
              <Fac key={k} $on onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))}>#{k} ×</Fac>
            ))}
          </FacWrap>
        )}
      </Card>

      {/* 이용 안내·취소 안내 — 사용자 예약화면 '이용 안내'/'취소·노쇼 안내'에 노출 */}
      <Card>
        <SecTitle><LuFileText size={16} /> 이용 안내</SecTitle>
        <Caption>상시 이용 규칙 (예: 실내화 필수, 음식물 반입 금지).</Caption>
        <Textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="예: 실내화 필수, 음식물 반입 금지 등" />
      </Card>
      <Card>
        <SecTitle><LuReceipt size={16} /> 취소·노쇼 안내</SecTitle>
        <Caption>예약 취소·노쇼 시 지켜야 할 안내 (현장 정산이라 별도 환불은 없어요).</Caption>
        <Textarea value={refundPolicy} onChange={(e) => setRefundPolicy(e.target.value)} placeholder={"• 이용 1일 전까지 취소해 주세요.\n• 당일 취소·노쇼는 삼가주세요."} />
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

      {/* 사업자 인증 (신뢰 배지) */}
      <BusinessSection venue={venue} refresh={refresh} />

      <div style={{ height: 8 }} />

      {previewOpen && <VenuePreviewSheet venue={previewVenue} onClose={() => setPreviewOpen(false)} />}
    </Page>
  );
}
