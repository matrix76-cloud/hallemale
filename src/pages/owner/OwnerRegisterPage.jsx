/* eslint-disable */
// src/pages/owner/OwnerRegisterPage.jsx
// 구장 등록(심사 신청) 폼 — 플랩 구장정보 참고 필드 + 예약 대상(코트) 여러 개
import { showAlert, showConfirm } from "../../utils/appDialog";
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
  Select, Row, PrimaryBtn, GhostBtn, Chip, ChipWrap, FieldHint,
} from "./components/ownerUi";
import { payoutHint } from "../../constants/payments";
import OwnerSpinner from "./components/OwnerSpinner";
import CourtHoursEditor from "./components/CourtHoursEditor";
import { openDaumPostcode } from "./components/addressSearch";
import { ownerTypeOption, resolveOwnerType } from "../../constants/ownerType";

// 환불 비율은 플랫폼 공통 기준(constants/cancelPolicy.js)이라 여기 적지 않는다.
// 이 필드는 구장 고유 안내(우천·일정변경·노쇼 당부)만 담는다.
const DEFAULT_REFUND =
  "• 당일 취소·노쇼는 삼가주세요. 반복 시 예약이 제한될 수 있어요.\n• 우천/천재지변 시 협의 후 일정 변경 가능";

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

// ── 단계 정의 ────────────────────────────────────────────────
// 한 화면에 다 넣으면 스크롤이 길어 이탈한다. 한 단계 = 한 가지 질문만 묻는다.
const STEPS = [
  { key: "basic",   title: "구장 기본 정보",  desc: "구장 이름과 위치를 알려주세요." },
  { key: "photo",   title: "구장 사진",       desc: "전경·코트·시설 사진을 올려주세요." },
  { key: "facility",title: "편의시설",        desc: "제공하는 시설을 골라주세요." },
  { key: "court",   title: "예약 대상 코트",  desc: "예약받을 코트와 요금을 정해주세요." },
  { key: "hours",   title: "운영 시간",       desc: "코트별로 예약을 받을 요일과 시간이에요." },
  { key: "notice",  title: "이용 안내",       desc: "예약자에게 보여줄 안내문이에요." },
  { key: "biz",     title: "사업자 정보",     desc: "심사 확인용이라 사용자에게는 안 보여요." },
  { key: "confirm", title: "입력 내용 확인",  desc: "제출 전에 한 번만 확인해 주세요." },
];

const Progress = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 18px;
`;
const ProgressBar = styled.div`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  transition: background 0.2s;
`;
const StepCount = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 6px;
`;
const StepTitle = styled.h2`
  margin: 0 0 6px;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const StepDesc = styled.p`
  margin: 0 0 20px;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;
// 하단 고정 버튼 — 스크롤과 무관하게 항상 같은 자리(토스식)
const BottomBar = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 8px;
  padding: 12px 0 max(12px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors.bg};
`;
const BackBtn = styled(GhostBtn)`
  flex: 0 0 92px;
`;
// 확인 단계 요약 줄
const SumRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13.5px;
  &:last-child { border-bottom: none; }
`;
const SumKey = styled.span`
  flex: 0 0 96px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const SumVal = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
  word-break: break-all;
  white-space: pre-line;
`;

export default function OwnerRegisterPage() {
  const navigate = useNavigate();
  const { uid, venue, userDoc, loading: ownerLoading, refresh } = useOwner();
  const fileRef = useRef(null);
  // ?step=<key> 로 특정 단계부터 열 수 있다 (리뷰 보드가 8단계를 각각 프레임으로 띄운다).
  const [step, setStep] = useState(() => {
    try {
      const k = new URLSearchParams(window.location.search).get("step");
      const i = STEPS.findIndex((s) => s.key === k);
      return i >= 0 ? i : 0;
    } catch (e) {
      return 0;
    }
  });

  // 이미 구장이 있으면(대기/승인/반려 무관) 새로 만들지 않고 기존 구장 수정 모드
  const editingId = venue ? venue.id : null;

  // 계정에 저장된 운영 주체(가입 직후 선택). 학교·기관은 사업자등록증이 없어서
  // 사업자번호를 필수로 들이대면 등록 자체가 막힌다 → 문구·필드가 이 값으로 갈린다.
  const ownerType = resolveOwnerType(userDoc, venue);
  const typeOpt = ownerTypeOption(ownerType);

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
      const { imageUrl, storagePath } = await uploadVenueImage(file, { asOwner: true });
      setPhotos((prev) => [...prev, { url: imageUrl, storagePath }]);
    } catch (err) {
      showAlert(err?.message || "사진 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  // 단계별 통과 조건 — 못 채운 채로 다음 단계로 넘어가지 않게 막는다.
  // (사진·편의시설·안내문은 선택이라 조건 없음)
  const stepError = () => {
    const k = STEPS[step].key;
    if (k === "basic") {
      if (!form.name.trim()) return "구장명을 입력해주세요.";
      if (!form.address.trim()) return "주소를 검색해 선택해주세요.";
    }
    if (k === "court") {
      if (!courts.length) return "예약 대상(코트)을 최소 1개 등록해주세요.";
      if (courts.some((c) => !c.name.trim())) return "코트 이름을 모두 입력해주세요.";
    }
    return "";
  };

  const goNext = () => {
    const err = stepError();
    if (err) return showAlert(err);
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    handleSubmit();
  };

  const goBack = () => {
    if (step === 0) return navigate(-1);
    setStep((s) => s - 1);
    window.scrollTo({ top: 0 });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return showAlert("구장명을 입력해주세요.");
    if (!form.address.trim()) return showAlert("주소를 입력해주세요.");
    if (!courts.length) return showAlert("예약 대상(코트)을 최소 1개 등록해주세요.");
    if (courts.some((c) => !c.name.trim())) return showAlert("코트 이름을 모두 입력해주세요.");

    setBusy(true);
    try {
      const payload = {
        ownerUid: uid,
        ...form,
        ownerType,
        // 주체에 해당하지 않는 값은 올리지 않는다(주체를 바꾼 뒤 재신청 시 잔여값 방지)
        bizNo: typeOpt.needsBizNo ? form.bizNo : "",
        photos: photos.map((p) => p.url),
        storagePaths: photos.map((p) => p.storagePath),
        facilities,
        courts,
      };
      if (editingId) {
        await updateMyVenue(editingId, payload, { asOwner: true });
        await resubmitVenue(editingId);
      } else {
        await registerVenue(payload);
      }
      await refresh();
      navigate("/owner/home", { replace: true });
    } catch (e) {
      showAlert(e?.message || "신청에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;

  const stepKey = STEPS[step].key;
  const isLast = step === STEPS.length - 1;
  const won = (v) => (v === "" || v == null ? "미입력" : Number(v).toLocaleString() + "원");

  return (
    <Page>
      {/* 진행률 + 이번 단계에서 묻는 것 */}
      <Progress>
        {STEPS.map((st, i) => (
          <ProgressBar key={st.key} $on={i <= step} />
        ))}
      </Progress>
      <StepCount>{step + 1} / {STEPS.length}</StepCount>
      <StepTitle>{stepKey === "biz" ? typeOpt.adminInfoTitle : STEPS[step].title}</StepTitle>
      <StepDesc>{STEPS[step].desc}</StepDesc>

      {stepKey === "basic" && (
        <Card>
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
      )}

      {stepKey === "photo" && (
        <Card>
          <SectionDesc>첫 번째 사진이 목록의 대표 이미지로 쓰여요. 나중에 바꿀 수 있어요.</SectionDesc>
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
      )}

      {stepKey === "facility" && (
        <Card>
          <ChipWrap>
            {FACILITY_OPTIONS.map((f) => (
              <Chip key={f} type="button" $on={facilities.includes(f)} onClick={() => toggleFacility(f)}>
                {f}
              </Chip>
            ))}
          </ChipWrap>
        </Card>
      )}

      {stepKey === "court" && (
        <>
          {courts.map((c, i) => (
            <Card key={i}>
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
                  <Label>시간당 가격(원) · 손님이 결제할 금액</Label>
                  <Input type="number" value={c.pricePerHour} onChange={(e) => setCourt(i, { pricePerHour: e.target.value })} placeholder="예: 40000" />
                  {payoutHint(c.pricePerHour) ? <FieldHint>{payoutHint(c.pricePerHour)}</FieldHint> : null}
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
            </Card>
          ))}
          <GhostBtn type="button" onClick={addCourt}>＋ 코트 추가</GhostBtn>
        </>
      )}

      {stepKey === "hours" && (
        <>
          {courts.map((c, i) => (
            <Card key={i}>
              <SectionTitle>{c.name || `코트 ${i + 1}`}</SectionTitle>
              <CourtHoursEditor hours={c.hours} onChange={(hours) => setCourt(i, { hours })} />
            </Card>
          ))}
        </>
      )}

      {stepKey === "notice" && (
        <Card>
          <Field>
            <Label>구장 소개</Label>
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="구장 특징, 바닥 재질, 주차 안내 등" />
          </Field>
          <Field>
            <Label>이용 규칙</Label>
            <Textarea value={form.rules} onChange={(e) => set({ rules: e.target.value })} placeholder="예: 실내화 필수, 음식물 반입 금지 등" />
          </Field>
          <Field>
            <Label>취소·노쇼 안내</Label>
            <Textarea value={form.refundPolicy} onChange={(e) => set({ refundPolicy: e.target.value })} />
          </Field>
        </Card>
      )}

      {stepKey === "biz" && (
        <Card>
          <Row>
            <Field>
              <Label>{typeOpt.personLabel}</Label>
              <Input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder={typeOpt.personPlaceholder} />
            </Field>
            <Field>
              <Label>관리자 연락처</Label>
              <Input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="예: 010-1234-5678" />
            </Field>
          </Row>
          <Row>
            <Field>
              <Label>{typeOpt.orgLabel}</Label>
              <Input value={form.bizName} onChange={(e) => set({ bizName: e.target.value })} placeholder={typeOpt.orgPlaceholder} />
            </Field>
            {typeOpt.needsBizNo && (
              <Field>
                <Label>사업자등록번호</Label>
                <Input value={form.bizNo} onChange={(e) => set({ bizNo: e.target.value })} placeholder="예: 123-45-67890" />
              </Field>
            )}
          </Row>
        </Card>
      )}

      {stepKey === "confirm" && (
        <>
          <Card>
            <SectionTitle>🏟️ 기본 정보</SectionTitle>
            <SumRow><SumKey>구장명</SumKey><SumVal>{form.name || "미입력"}</SumVal></SumRow>
            <SumRow><SumKey>주소</SumKey><SumVal>{[form.address, form.addressDetail].filter(Boolean).join(" ") || "미입력"}</SumVal></SumRow>
            <SumRow><SumKey>연락처</SumKey><SumVal>{form.phone || "미입력"}</SumVal></SumRow>
            <SumRow><SumKey>사진</SumKey><SumVal>{photos.length}장</SumVal></SumRow>
            <SumRow><SumKey>편의시설</SumKey><SumVal>{facilities.length ? facilities.join(", ") : "선택 안 함"}</SumVal></SumRow>
          </Card>
          <Card>
            <SectionTitle>🏀 코트 {courts.length}개</SectionTitle>
            {courts.map((c, i) => (
              <SumRow key={i}>
                <SumKey>{c.name || `코트 ${i + 1}`}</SumKey>
                <SumVal>{c.type === "outdoor" ? "실외" : "실내"} · {won(c.pricePerHour)}/시간 · {c.slotMinutes}분 단위</SumVal>
              </SumRow>
            ))}
          </Card>
          <Card>
            <SectionTitle>{typeOpt.contactHead}</SectionTitle>
            <SumRow><SumKey>운영 주체</SumKey><SumVal>{typeOpt.label}</SumVal></SumRow>
            <SumRow><SumKey>{typeOpt.personLabel}</SumKey><SumVal>{form.ownerName || "미입력"}</SumVal></SumRow>
            <SumRow><SumKey>{typeOpt.orgLabel}</SumKey><SumVal>{form.bizName || "미입력"}</SumVal></SumRow>
            {typeOpt.needsBizNo && (
              <SumRow><SumKey>사업자번호</SumKey><SumVal>{form.bizNo || "미입력"}</SumVal></SumRow>
            )}
            <SumRow><SumKey>관리자 연락처</SumKey><SumVal>{form.contactPhone || "미입력"}</SumVal></SumRow>
          </Card>
          <SectionDesc>
            제출하면 관리자 심사가 시작돼요. 보통 1~2 영업일 안에 결과를 알려드려요.
          </SectionDesc>
        </>
      )}

      <BottomBar>
        <BackBtn type="button" onClick={goBack} disabled={busy}>
          {step === 0 ? "취소" : "이전"}
        </BackBtn>
        <PrimaryBtn type="button" onClick={goNext} disabled={busy || uploading}>
          {busy ? "신청 중…" : isLast ? (editingId ? "수정하고 다시 신청" : "구장 등록 신청") : "다음"}
        </PrimaryBtn>
      </BottomBar>
    </Page>
  );
}
