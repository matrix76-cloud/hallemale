/* eslint-disable */
// src/pages/owner/OwnerRegisterPage.jsx
// 구장 등록(심사 신청) 폼 — 플랩 구장정보 참고 필드 + 예약 대상(코트) 여러 개
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import { uploadVenueImage } from "../../services/venuesService";
import {
  registerVenue,
  updateMyVenue,
  resubmitVenue,
  defaultCourtHours,
  FACILITY_OPTIONS,
} from "../../services/ownerVenueService";
import {
  Page, Card, SectionTitle, SectionDesc, Field, Label, Input, Textarea,
  Select, Row, PrimaryBtn, GhostBtn, Chip, ChipWrap,
} from "./components/ownerUi";
import OwnerSpinner from "./components/OwnerSpinner";
import CourtHoursEditor from "./components/CourtHoursEditor";
import { openDaumPostcode } from "./components/addressSearch";

const DEFAULT_REFUND =
  "• 이용 7일 전: 100% 환불\n• 이용 3일 전: 50% 환불\n• 이용 1일 전 ~ 당일: 환불 불가\n• 우천/천재지변 시 협의 후 일정 변경 가능";

function makeCourt(idx) {
  return {
    name: `${idx + 1}코트`,
    type: "indoor",
    pricePerHour: "",
    slotMinutes: 60,
    hours: defaultCourtHours(),
  };
}

const PhotoStrip = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
`;

const PhotoBox = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: 110px;
  height: 84px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const PhotoImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;

const RemovePhoto = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: none;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
`;

const AddPhoto = styled.button`
  flex: 0 0 auto;
  width: 110px;
  height: 84px;
  border-radius: 10px;
  border: 1.5px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DelLink = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.danger};
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
`;

const HiddenFile = styled.input`display: none;`;

const AddressBtn = styled.button`
  height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ $filled, theme }) => ($filled ? theme.colors.textStrong : theme.colors.textWeak)};
  font-size: 14px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  &:active { transform: translateY(1px); }
  & .search { color: ${({ theme }) => theme.colors.primary}; font-weight: 700; font-size: 13px; flex-shrink: 0; }
`;

export default function OwnerRegisterPage() {
  const navigate = useNavigate();
  const { uid, venue, loading: ownerLoading, refresh } = useOwner();
  const fileRef = useRef(null);

  // 이미 구장이 있으면(대기/승인/반려 무관) 새로 만들지 않고 기존 구장 수정 모드
  const editingId = venue ? venue.id : null;

  const [form, setForm] = useState({
    name: "",
    address: "",
    addressDetail: "",
    region: "", // 주소검색에서 자동 추출 (화면 미표시)
    lat: "",
    lng: "",
    phone: "",
    description: "",
    rules: "",
    refundPolicy: DEFAULT_REFUND,
    bizName: "",
    bizNo: "",
    ownerName: "",
    contactPhone: "",
  });
  const [photos, setPhotos] = useState([]); // [{url, storagePath}]
  const [facilities, setFacilities] = useState([]);
  const [courts, setCourts] = useState([makeCourt(0)]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  // 재신청: 기존 값 프리필
  useEffect(() => {
    if (!editingId) return;
    setForm({
      name: venue.name || "",
      address: venue.address || "",
      addressDetail: venue.addressDetail || "",
      region: venue.region || "",
      lat: venue.lat ?? "",
      lng: venue.lng ?? "",
      phone: venue.phone || "",
      description: venue.description || "",
      rules: venue.rules || "",
      refundPolicy: venue.refundPolicy || DEFAULT_REFUND,
      bizName: venue.bizName || "",
      bizNo: venue.bizNo || "",
      ownerName: venue.ownerName || "",
      contactPhone: venue.contactPhone || "",
    });
    setPhotos((venue.photos || []).map((url, i) => ({ url, storagePath: venue.storagePaths?.[i] || "" })));
    setFacilities(venue.facilities || []);
    setCourts(
      (venue.courts || []).length
        ? venue.courts.map((c, i) => ({
            name: c.name, type: c.type, pricePerHour: String(c.pricePerHour ?? ""),
            slotMinutes: c.slotMinutes,
            hours: c.hours || defaultCourtHours(),
          }))
        : [makeCourt(0)]
    );
  }, [editingId]); // eslint-disable-line

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  const handleAddressSearch = () => {
    openDaumPostcode(({ address, region, lat, lng }) => {
      set({
        address,
        region,
        lat: lat ?? "",
        lng: lng ?? "",
      });
    });
  };

  const toggleFacility = (f) =>
    setFacilities((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const setCourt = (i, patch) =>
    setCourts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCourt = () => setCourts((prev) => [...prev, makeCourt(prev.length)]);
  const removeCourt = (i) =>
    setCourts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const handlePickPhoto = () => {
    if (uploading || busy) return;
    fileRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadVenueImage(file);
      setPhotos((prev) => [...prev, { url: imageUrl, storagePath }]);
    } catch (err) {
      window.alert(err?.message || "사진 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.name.trim()) return window.alert("구장명을 입력해주세요.");
    if (!form.address.trim()) return window.alert("주소를 입력해주세요.");
    if (!courts.length) return window.alert("예약 대상(코트)을 최소 1개 등록해주세요.");
    if (courts.some((c) => !c.name.trim())) return window.alert("코트 이름을 모두 입력해주세요.");

    setBusy(true);
    try {
      const payload = {
        ownerUid: uid,
        ...form,
        photos: photos.map((p) => p.url),
        storagePaths: photos.map((p) => p.storagePath),
        facilities,
        courts,
      };
      if (editingId) {
        await updateMyVenue(editingId, payload);
        await resubmitVenue(editingId);
      } else {
        await registerVenue(payload);
      }
      await refresh();
      navigate("/owner/home", { replace: true });
    } catch (e) {
      window.alert(e?.message || "신청에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;

  return (
    <Page>
      <Card>
        <SectionTitle>📸 구장 사진</SectionTitle>
        <SectionDesc>구장 전경, 코트, 시설 사진을 등록해주세요. (여러 장 가능)</SectionDesc>
        <PhotoStrip>
          {photos.map((p, i) => (
            <PhotoBox key={i}>
              <PhotoImg src={p.url} alt={`구장 사진 ${i + 1}`} />
              <RemovePhoto type="button" onClick={() => removePhoto(i)}>×</RemovePhoto>
            </PhotoBox>
          ))}
          <AddPhoto type="button" onClick={handlePickPhoto} disabled={uploading}>
            {uploading ? "업로드 중…" : <><span style={{ fontSize: 20 }}>＋</span><span>사진 추가</span></>}
          </AddPhoto>
        </PhotoStrip>
        <HiddenFile ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
      </Card>

      <Card>
        <SectionTitle>🏟️ 기본 정보</SectionTitle>
        <Field>
          <Label>구장명</Label>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: 용산 더베이스 농구장" />
        </Field>
        <Field>
          <Label>주소</Label>
          <AddressBtn type="button" onClick={handleAddressSearch} $filled={!!form.address}>
            <span>{form.address || "주소 검색하기"}</span>
            <span className="search">🔍 검색</span>
          </AddressBtn>
        </Field>
        <Field>
          <Label>상세 주소</Label>
          <Input value={form.addressDetail} onChange={(e) => set({ addressDetail: e.target.value })} placeholder="예: 지하 2층 / B코트" />
        </Field>
        <Field>
          <Label>구장 연락처</Label>
          <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="예: 02-1234-5678" />
        </Field>
      </Card>

      <Card>
        <SectionTitle>🚿 편의시설</SectionTitle>
        <SectionDesc>제공하는 시설을 모두 선택해주세요.</SectionDesc>
        <ChipWrap>
          {FACILITY_OPTIONS.map((f) => (
            <Chip key={f} type="button" $on={facilities.includes(f)} onClick={() => toggleFacility(f)}>
              {f}
            </Chip>
          ))}
        </ChipWrap>
      </Card>

      <Card>
        <SectionTitle>🏀 예약 대상 (코트)</SectionTitle>
        <SectionDesc>예약받을 코트/면을 추가하세요. 코트마다 운영시간·가격을 따로 설정합니다.</SectionDesc>
        {courts.map((c, i) => (
          <CourtCard key={i}>
            <CourtHead>
              <Label>코트 {i + 1}</Label>
              {courts.length > 1 && <DelLink type="button" onClick={() => removeCourt(i)}>삭제</DelLink>}
            </CourtHead>
            <Row>
              <Field>
                <Label>이름</Label>
                <Input value={c.name} onChange={(e) => setCourt(i, { name: e.target.value })} placeholder="예: A코트" />
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
                <Input type="number" value={c.pricePerHour} onChange={(e) => setCourt(i, { pricePerHour: e.target.value })} placeholder="예: 40000" />
              </Field>
              <Field>
                <Label>슬롯 단위(분)</Label>
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
      </Card>

      <Card>
        <SectionTitle>📝 안내</SectionTitle>
        <Field>
          <Label>구장 소개</Label>
          <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="구장 특징, 바닥 재질, 주차 안내 등" />
        </Field>
        <Field>
          <Label>이용 규칙</Label>
          <Textarea value={form.rules} onChange={(e) => set({ rules: e.target.value })} placeholder="예: 실내화 필수, 음식물 반입 금지 등" />
        </Field>
        <Field>
          <Label>환불 정책</Label>
          <Textarea value={form.refundPolicy} onChange={(e) => set({ refundPolicy: e.target.value })} />
        </Field>
      </Card>

      <Card>
        <SectionTitle>🧾 사업자 / 관리자 정보 (심사용)</SectionTitle>
        <SectionDesc>심사 확인용 정보로, 사용자에게 공개되지 않습니다.</SectionDesc>
        <Row>
          <Field>
            <Label>대표자명</Label>
            <Input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder="예: 홍길동" />
          </Field>
          <Field>
            <Label>관리자 연락처</Label>
            <Input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="예: 010-1234-5678" />
          </Field>
        </Row>
        <Row>
          <Field>
            <Label>상호(사업자명)</Label>
            <Input value={form.bizName} onChange={(e) => set({ bizName: e.target.value })} placeholder="예: ○○스포츠" />
          </Field>
          <Field>
            <Label>사업자등록번호</Label>
            <Input value={form.bizNo} onChange={(e) => set({ bizNo: e.target.value })} placeholder="예: 123-45-67890" />
          </Field>
        </Row>
      </Card>

      <PrimaryBtn type="button" onClick={handleSubmit} disabled={busy || uploading}>
        {busy ? "신청 중…" : editingId ? "수정하고 다시 신청" : "구장 등록 신청"}
      </PrimaryBtn>
      <div style={{ height: 12 }} />
    </Page>
  );
}
