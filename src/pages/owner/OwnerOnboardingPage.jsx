/* eslint-disable */
// src/pages/owner/OwnerOnboardingPage.jsx
// 구장 등록 온보딩 — 에어비앤비식 단계별 위저드.
// 페이지마다 한 주제씩(종목→이름→위치→사진→편의/주차→코트→안내→키워드→연락처→검토).
// 네이버 플레이스 상세정보(종목·주차·찾아오는길·바닥재질·대표키워드) 반영.
import { showAlert } from "../../utils/appDialog";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import { track } from "../../utils/analytics";
import { uploadVenueImage } from "../../services/venuesService";
import {
  registerVenue,
  updateMyVenue,
  resubmitVenue,
  defaultCourtHours,
  FACILITY_OPTIONS,
  SURFACE_OPTIONS,
  isValidBizNo,
} from "../../services/ownerVenueService";
import {
  Field, Label, Input, Textarea, Select, Row, Chip, ChipWrap, GhostBtn,
} from "./components/ownerUi";
import OwnerSpinner from "./components/OwnerSpinner";
import CourtHoursEditor from "./components/CourtHoursEditor";
import VenueMapPicker from "./components/VenueMapPicker";

const DEFAULT_REFUND =
  "• 이용 1일 전까지 취소해 주세요.\n• 당일 취소·노쇼는 삼가주세요. 반복 시 예약이 제한될 수 있어요.\n• 우천/천재지변 시 협의 후 일정 변경 가능";

function makeCourt(idx) {
  return { name: `${idx + 1}코트`, type: "indoor", surface: "", pricePerHour: "", slotMinutes: 60, hours: defaultCourtHours() };
}

// 단계 정의 (intro 제외한 본문 단계 순서) — 농구 전용이라 종목 선택 단계 없음
const STEPS = ["intro", "name", "location", "photos", "facilities", "courts", "notice", "keywords", "contact", "review"];
const CONTENT_TOTAL = STEPS.length - 1; // intro 제외

export default function OwnerOnboardingPage() {
  const navigate = useNavigate();
  const { uid, venue, loading: ownerLoading, refresh } = useOwner();
  const fileRef = useRef(null);

  const editingId = venue ? venue.id : null;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", address: "", addressDetail: "", region: "", lat: "", lng: "",
    phone: "", directions: "", description: "", rules: "", refundPolicy: DEFAULT_REFUND,
    bizName: "", bizNo: "", ownerName: "", contactPhone: "",
  });
  const [sportTypes, setSportTypes] = useState(["농구"]); // 농구 전용
  const [photos, setPhotos] = useState([]); // [{url, storagePath}]
  const [facilities, setFacilities] = useState([]);
  const [parking, setParking] = useState({ available: false, fee: "free", info: "" });
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [displayMode, setDisplayMode] = useState("grouped");
  const [displayName, setDisplayName] = useState("");
  const [courts, setCourts] = useState([makeCourt(0)]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  // 재신청(반려 등): 기존 값 프리필
  useEffect(() => {
    if (!editingId) return;
    setForm({
      name: venue.name || "", address: venue.address || "", addressDetail: venue.addressDetail || "",
      region: venue.region || "", lat: venue.lat ?? "", lng: venue.lng ?? "",
      phone: venue.phone || "", directions: venue.directions || "",
      description: venue.description || "", rules: venue.rules || "", refundPolicy: venue.refundPolicy || DEFAULT_REFUND,
      bizName: venue.bizName || "", bizNo: venue.bizNo || "", ownerName: venue.ownerName || "", contactPhone: venue.contactPhone || "",
    });
    setSportTypes(venue.sportTypes?.length ? venue.sportTypes : ["농구"]);
    setPhotos((venue.photos || []).map((url, i) => ({ url, storagePath: venue.storagePaths?.[i] || "" })));
    setFacilities(venue.facilities || []);
    setParking({
      available: venue.parking?.available === true,
      fee: venue.parking?.fee === "paid" ? "paid" : "free",
      info: venue.parking?.info || "",
    });
    setKeywords(venue.keywords || []);
    setDisplayMode(venue.displayMode || "grouped");
    setDisplayName(venue.displayName || venue.name || "");
    setCourts(
      (venue.courts || []).length
        ? venue.courts.map((c) => ({
            ...c, // priceBands/priceOverrides/notices/cautions 등 고급 필드 보존 (반려 재신청 시 소실 방지)
            name: c.name, type: c.type, surface: c.surface || "",
            pricePerHour: String(c.pricePerHour ?? ""), slotMinutes: c.slotMinutes,
            hours: c.hours || defaultCourtHours(),
          }))
        : [makeCourt(0)]
    );
  }, [editingId]); // eslint-disable-line

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  const toggle = (setter, val) =>
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));

  const setCourt = (i, patch) => setCourts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCourt = () => setCourts((prev) => [...prev, makeCourt(prev.length)]);
  const removeCourt = (i) => setCourts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

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
    } finally {
      setUploading(false);
    }
  };
  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const addKeyword = () => {
    const k = keywordInput.trim().replace(/^#/, "");
    if (!k) return;
    if (keywords.length >= 5) return showAlert("대표키워드는 최대 5개예요.");
    if (keywords.includes(k)) { setKeywordInput(""); return; }
    setKeywords((prev) => [...prev, k]);
    setKeywordInput("");
  };

  // 온보딩 진입 1회 기록 (공급 퍼널: 가입→온보딩 진입)
  useEffect(() => { track("owner_onboarding_view"); }, []);

  const id = STEPS[step];

  // 운영시간이 명시적으로 전부 휴무면 예약 불가한 유령 구장이 됨 → 최소 1개 요일 운영 필요.
  // (미설정 hours는 에디터 기본값이 적용되므로 통과)
  const hasAnyOpenDay = (hours) => {
    if (!hours || typeof hours !== "object") return true;
    const days = Object.values(hours);
    if (!days.length) return true;
    return days.some((d) => d && !d.closed);
  };

  // 단계별 다음 진행 가능 여부
  const canNext = (() => {
    if (id === "name") return !!form.name.trim();
    if (id === "location") return !!form.address.trim();
    if (id === "photos") return photos.length > 0;
    if (id === "courts") return courts.length > 0 && courts.every((c) => c.name.trim() && hasAnyOpenDay(c.hours));
    if (id === "contact") return !form.bizNo.trim() || isValidBizNo(form.bizNo);
    return true;
  })();

  const goNext = () => {
    if (!canNext) {
      if (id === "name") return showAlert("구장명을 입력해주세요.");
      if (id === "location") return showAlert("지도에서 구장 위치에 핀을 맞춰주세요.");
      if (id === "photos") return showAlert("구장 사진을 최소 1장 등록해주세요.\n사진이 있으면 승인도 빠르고 예약도 잘 들어와요.");
      if (id === "courts") return showAlert("코트 이름과 운영시간(최소 1개 요일)을 확인해주세요.");
      if (id === "contact") return showAlert("사업자등록번호 형식이 올바르지 않아요.\n번호를 다시 확인해주세요.");
      return;
    }
    track("owner_onboarding_step", { step: id }); // 어느 단계에서 이탈하는지 정량화
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goBack = () => (step === 0 ? navigate(-1) : setStep((s) => s - 1));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setStep(STEPS.indexOf("name")); return showAlert("구장명을 입력해주세요."); }
    if (!form.address.trim()) { setStep(STEPS.indexOf("location")); return showAlert("주소를 입력해주세요."); }
    if (photos.length === 0) { setStep(STEPS.indexOf("photos")); return showAlert("구장 사진을 최소 1장 등록해주세요."); }
    if (form.bizNo.trim() && !isValidBizNo(form.bizNo)) { setStep(STEPS.indexOf("contact")); return showAlert("사업자등록번호 형식이 올바르지 않아요. 다시 확인해주세요."); }
    setBusy(true);
    try {
      const payload = {
        ownerUid: uid, ...form,
        sportTypes, parking, keywords, displayMode, displayName,
        photos: photos.map((p) => p.url), storagePaths: photos.map((p) => p.storagePath),
        facilities, courts,
      };
      if (editingId) {
        await updateMyVenue(editingId, payload);
        await resubmitVenue(editingId);
      } else {
        await registerVenue(payload);
      }
      track("owner_venue_register", { editing: !!editingId, courts: courts.length, photos: photos.length }); // ★ 핵심 공급 생성
      await refresh();
      navigate("/owner/home", { replace: true });
    } catch (e) {
      showAlert(e?.message || "신청에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;

  // ── 인트로 ──
  if (id === "intro") {
    return (
      <Shell>
        <Intro>
          <IntroLogo>🏟️</IntroLogo>
          <IntroTitle>{editingId ? "구장 정보를 다시 등록해요" : "구장 등록을 시작해요"}</IntroTitle>
          <IntroSub>
            몇 단계만 거치면 예약을 받을 수 있어요.{"\n"}
            사진·위치·코트·이용요금을 차근차근 입력해 주세요.{"\n\n"}
            이용요금은 앱에서 결제되지 않아요.{"\n"}
            회원이 예약을 요청하면 승인하시고, 요금은 현장에서 직접 정산해요.
          </IntroSub>
        </Intro>
        <Footer>
          <NextBtn type="button" onClick={goNext}>시작하기</NextBtn>
        </Footer>
      </Shell>
    );
  }

  return (
    <Shell>
      <Progress><Bar style={{ width: `${(step / CONTENT_TOTAL) * 100}%` }} /></Progress>

      <Scroll>
        <StepTitle>{TITLES[id]}</StepTitle>
        {SUBS[id] && <StepSub>{SUBS[id]}</StepSub>}

        {id === "name" && (
          <Field>
            <Label>구장명</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: 용산 더베이스 농구장" autoFocus />
          </Field>
        )}

        {id === "location" && (
          <>
            <VenueMapPicker
              value={{ lat: form.lat, lng: form.lng, address: form.address, region: form.region }}
              onChange={({ lat, lng, address, region }) => set({ lat, lng, address, region })}
              height={240}
            />
            <Field>
              <Label>주소 <Opt>(핀 위치에서 자동 입력 · 직접 수정 가능)</Opt></Label>
              <Input
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="지도에서 핀을 맞추거나 주소를 직접 입력하세요"
              />
            </Field>
            <Field>
              <Label>상세 주소</Label>
              <Input value={form.addressDetail} onChange={(e) => set({ addressDetail: e.target.value })} placeholder="예: 지하 2층 / B동" />
            </Field>
            <Field>
              <Label>찾아오는 길 <Opt>(선택)</Opt></Label>
              <Textarea value={form.directions} onChange={(e) => set({ directions: e.target.value })} placeholder="예: 6호선 이태원역 3번 출구 도보 5분, 건물 뒤편 입구로 들어오세요" />
            </Field>
          </>
        )}

        {id === "photos" && (
          <>
            <PhotoGrid>
              {photos.map((p, i) => (
                <PhotoBox key={i}>
                  <PhotoImg src={p.url} alt={`구장 사진 ${i + 1}`} />
                  {i === 0 && <MainTag>대표</MainTag>}
                  <RemovePhoto type="button" onClick={() => removePhoto(i)}>×</RemovePhoto>
                </PhotoBox>
              ))}
              <AddPhoto type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "업로드 중…" : <><span style={{ fontSize: 26 }}>＋</span><span>사진 추가</span></>}
              </AddPhoto>
            </PhotoGrid>
            <HiddenFile ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
            <StepHint>첫 번째 사진이 대표 사진으로 사용돼요.</StepHint>
          </>
        )}

        {id === "facilities" && (
          <>
            <ChipWrap>
              {FACILITY_OPTIONS.map((f) => (
                <Chip key={f} type="button" $on={facilities.includes(f)} onClick={() => toggle(setFacilities, f)}>{f}</Chip>
              ))}
            </ChipWrap>
            <SubHead>🅿️ 주차</SubHead>
            <ChipWrap>
              <Chip type="button" $on={!parking.available} onClick={() => setParking((p) => ({ ...p, available: false }))}>주차 불가</Chip>
              <Chip type="button" $on={parking.available && parking.fee === "free"} onClick={() => setParking({ available: true, fee: "free", info: parking.info })}>무료 주차</Chip>
              <Chip type="button" $on={parking.available && parking.fee === "paid"} onClick={() => setParking({ available: true, fee: "paid", info: parking.info })}>유료 주차</Chip>
            </ChipWrap>
            {parking.available && (
              <Field>
                <Label>주차 안내 <Opt>(선택)</Opt></Label>
                <Input value={parking.info} onChange={(e) => setParking((p) => ({ ...p, info: e.target.value }))} placeholder="예: 건물 내 10대, 2시간 무료 / 이후 시간당 2,000원" />
              </Field>
            )}
          </>
        )}

        {id === "courts" && (
          <>
            {courts.map((c, i) => (
              <CourtCard key={i}>
                <CourtHead>
                  <Label>코트 {i + 1}</Label>
                  {courts.length > 1 && <DelLink type="button" onClick={() => removeCourt(i)}>삭제</DelLink>}
                </CourtHead>
                <Row>
                  <Field><Label>이름</Label><Input value={c.name} onChange={(e) => setCourt(i, { name: e.target.value })} placeholder="예: A코트" /></Field>
                  <Field>
                    <Label>실내/실외</Label>
                    <Select value={c.type} onChange={(e) => setCourt(i, { type: e.target.value })}>
                      <option value="indoor">실내</option>
                      <option value="outdoor">실외</option>
                    </Select>
                  </Field>
                </Row>
                <Field>
                  <Label>바닥재질</Label>
                  <Select value={c.surface} onChange={(e) => setCourt(i, { surface: e.target.value })}>
                    <option value="">선택 안 함</option>
                    {SURFACE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Row>
                  <Field><Label>시간당 가격(원)</Label><Input type="number" value={c.pricePerHour} onChange={(e) => setCourt(i, { pricePerHour: e.target.value })} placeholder="예: 40000" /></Field>
                  <Field>
                    <Label>슬롯 단위(분)</Label>
                    <Select value={c.slotMinutes} onChange={(e) => setCourt(i, { slotMinutes: Number(e.target.value) })}>
                      <option value={30}>30분</option><option value={60}>60분</option><option value={90}>90분</option><option value={120}>120분</option>
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

            {courts.length > 1 && (
              <>
                <SubHead>사용자 노출 방식</SubHead>
                <ChipWrap>
                  <Chip type="button" $on={displayMode === "grouped"} onClick={() => setDisplayMode("grouped")}>한 장소로 묶기</Chip>
                  <Chip type="button" $on={displayMode === "separate"} onClick={() => setDisplayMode("separate")}>코트별 독립</Chip>
                </ChipWrap>
                {displayMode === "grouped" ? (
                  <Field>
                    <Label>대표 장소명</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={form.name || "예: 용산 더베이스"} />
                  </Field>
                ) : (
                  <StepHint>코트별로 검색·목록에 개별 노출돼요.</StepHint>
                )}
              </>
            )}
          </>
        )}

        {id === "notice" && (
          <>
            <Field><Label>구장 소개 <Opt>(선택)</Opt></Label><Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="구장 특징, 규모, 바닥·시설 안내 등" /></Field>
            <Field><Label>이용 규칙 <Opt>(선택)</Opt></Label><Textarea value={form.rules} onChange={(e) => set({ rules: e.target.value })} placeholder="예: 실내화 필수, 음식물 반입 금지 등" /></Field>
            <Field><Label>취소·노쇼 안내</Label><Textarea value={form.refundPolicy} onChange={(e) => set({ refundPolicy: e.target.value })} /></Field>
          </>
        )}

        {id === "keywords" && (
          <>
            <KeywordRow>
              <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="예: 이태원 농구장" maxLength={20} />
              <AddKw type="button" onClick={addKeyword}>추가</AddKw>
            </KeywordRow>
            <ChipWrap>
              {keywords.map((k) => (
                <Chip key={k} type="button" $on onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))}>#{k} ×</Chip>
              ))}
            </ChipWrap>
            <StepHint>지역명 + 종목을 넣으면 검색에 잘 노출돼요. (최대 5개)</StepHint>
          </>
        )}

        {id === "contact" && (
          <>
            <Field><Label>구장 연락처</Label><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="예: 02-1234-5678" /></Field>
            <SubHead>🧾 사업자 / 관리자 정보 <Opt>(심사용 · 비공개)</Opt></SubHead>
            <Row>
              <Field><Label>대표자명</Label><Input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder="예: 홍길동" /></Field>
              <Field><Label>관리자 연락처</Label><Input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="예: 010-1234-5678" /></Field>
            </Row>
            <Row>
              <Field><Label>상호(사업자명)</Label><Input value={form.bizName} onChange={(e) => set({ bizName: e.target.value })} placeholder="예: ○○스포츠" /></Field>
              <Field><Label>사업자등록번호</Label><Input value={form.bizNo} onChange={(e) => set({ bizNo: e.target.value })} placeholder="예: 123-45-67890" /></Field>
            </Row>
          </>
        )}

        {id === "review" && (
          <ReviewList>
            <ReviewRow><b>구장명</b><span>{form.name || "-"}</span></ReviewRow>
            <ReviewRow><b>주소</b><span>{form.address || "-"}{form.addressDetail ? ` ${form.addressDetail}` : ""}</span></ReviewRow>
            <ReviewRow><b>사진</b><span>{photos.length}장</span></ReviewRow>
            <ReviewRow><b>편의시설</b><span>{facilities.length ? facilities.join(", ") : "-"}</span></ReviewRow>
            <ReviewRow><b>주차</b><span>{parking.available ? (parking.fee === "paid" ? "유료" : "무료") : "불가"}</span></ReviewRow>
            <ReviewRow><b>코트</b><span>{courts.length}면</span></ReviewRow>
            <ReviewRow><b>대표키워드</b><span>{keywords.length ? keywords.map((k) => `#${k}`).join(" ") : "-"}</span></ReviewRow>
            <StepHint style={{ marginTop: 4 }}>등록 신청 후 관리자 승인(보통 영업일 1~2일)을 거쳐 사용자에게 노출돼요.</StepHint>
            <StepHint>이용요금은 앱에서 결제되지 않고, 회원이 현장에서 직접 정산해요.</StepHint>
          </ReviewList>
        )}
      </Scroll>

      <Footer>
        <BackText type="button" onClick={goBack} disabled={busy}>뒤로</BackText>
        {id === "review" ? (
          <NextBtn type="button" onClick={handleSubmit} disabled={busy || uploading}>
            {busy ? "신청 중…" : editingId ? "수정하고 다시 신청" : "구장 등록 신청"}
          </NextBtn>
        ) : (
          <NextBtn type="button" onClick={goNext} disabled={uploading}>다음</NextBtn>
        )}
      </Footer>
    </Shell>
  );
}

const TITLES = {
  name: "구장 이름을 알려주세요",
  location: "구장이 어디에 있나요?",
  photos: "구장 사진을 올려주세요",
  facilities: "어떤 편의시설이 있나요?",
  courts: "예약받을 코트를 등록해요",
  notice: "이용 안내를 적어주세요",
  keywords: "검색에 뜰 키워드를 골라주세요",
  contact: "연락처와 사업자 정보를 입력해요",
  review: "입력한 내용을 확인해요",
};
const SUBS = {
  location: "지도를 움직여 핀을 맞추면 주소가 자동으로 입력돼요.",
  photos: "구장 전경, 코트, 시설 사진을 올려주세요. (여러 장 가능)",
  facilities: "이용자가 구장을 고를 때 참고해요.",
  courts: "코트마다 종류·바닥·가격·운영시간을 따로 설정해요.",
  notice: "이용자에게 보여지는 안내예요.",
  keywords: "이용자가 검색할 만한 단어를 넣어주세요.",
  contact: "사업자 정보는 심사 확인용이며 사용자에게 공개되지 않아요.",
};

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
`;
const Progress = styled.div`
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;
const Bar = styled.div`
  height: 100%;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 0 4px 4px 0;
  transition: width 0.3s ease;
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px max(18px, env(safe-area-inset-left)) 20px max(18px, env(safe-area-inset-right));
  display: flex;
  flex-direction: column;
  gap: 14px;
`;
const StepTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.35;
`;
const StepSub = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
  margin-top: -6px;
`;
const StepHint = styled.div`
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;
const SubHead = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  margin-top: 6px;
`;
const Opt = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px max(18px, env(safe-area-inset-left)) calc(14px + env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-right));
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
`;
const BackText = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 15px;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  padding: 8px 4px;
  &:disabled { opacity: 0.4; }
`;
const NextBtn = styled.button`
  flex: 1;
  height: 52px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Intro = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 14px;
  padding: 24px;
`;
const IntroLogo = styled.div`font-size: 84px; line-height: 1;`;
const IntroTitle = styled.div`
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const IntroSub = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.6;
  white-space: pre-line;
`;

const AutoAddr = styled.div`
  min-height: 48px;
  padding: 13px 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 14px;
  line-height: 1.4;
  display: flex;
  align-items: center;
`;

const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
`;
const PhotoBox = styled.div`
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;
const PhotoImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const MainTag = styled.span`
  position: absolute; left: 6px; bottom: 6px;
  padding: 2px 8px; border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary}; color: #fff;
  font-size: 11px; font-weight: 700;
`;
const RemovePhoto = styled.button`
  position: absolute; top: 6px; right: 6px;
  width: 24px; height: 24px; border-radius: 999px; border: none;
  background: rgba(0,0,0,0.6); color: #fff; font-size: 14px; cursor: pointer; line-height: 1;
`;
const AddPhoto = styled.button`
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  border: 1.5px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 13px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
`;
const HiddenFile = styled.input`display: none;`;

const CourtCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const CourtHead = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const DelLink = styled.button`
  border: none; background: transparent; color: ${({ theme }) => theme.colors.danger};
  font-size: 12.5px; font-weight: 600; cursor: pointer;
`;

const KeywordRow = styled.div`display: flex; gap: 8px; & > *:first-child { flex: 1; }`;
const AddKw = styled.button`
  flex-shrink: 0;
  height: 44px; padding: 0 18px; border-radius: 10px; border: none;
  background: ${({ theme }) => theme.colors.primary}; color: #fff;
  font-size: 14px; font-weight: 700; cursor: pointer;
`;

const ReviewList = styled.div`
  display: flex; flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
`;
const ReviewRow = styled.div`
  display: flex; justify-content: space-between; gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13.5px;
  &:last-of-type { border-bottom: none; }
  & b { color: ${({ theme }) => theme.colors.textWeak}; font-weight: 600; flex-shrink: 0; }
  & span { color: ${({ theme }) => theme.colors.textStrong}; font-weight: 600; text-align: right; word-break: break-all; }
`;
