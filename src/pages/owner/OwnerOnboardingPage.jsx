/* eslint-disable */
// src/pages/owner/OwnerOnboardingPage.jsx
// 구장 등록 온보딩 — 에어비앤비식 단계별 위저드.
// 페이지마다 한 주제씩(종목→이름→위치→사진→편의/주차→코트→안내→키워드→연락처→검토).
// 네이버 플레이스 상세정보(종목·주차·찾아오는길·바닥재질·대표키워드) 반영.
import { showAlert } from "../../utils/appDialog";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  formatBizNo,
  searchSchools,
  submitBusinessVerification,
  verifyBusinessOnline,
  saveSettlementAccount,
  SETTLEMENT_BANKS,
} from "../../services/ownerVenueService";
import { ownerTypeOption, resolveOwnerType } from "../../constants/ownerType";
import {
  Field, Label, Input, Textarea, Select, Row, Chip, ChipWrap, GhostBtn, FieldHint,
} from "./components/ownerUi";
import { payoutHint, PLATFORM_FEE_LABEL } from "../../constants/payments";
import OwnerSpinner from "./components/OwnerSpinner";
import CourtHoursEditor from "./components/CourtHoursEditor";
import VenueMapPicker from "./components/VenueMapPicker";

// 환불 비율은 플랫폼 공통 기준(constants/cancelPolicy.js)이라 여기 적지 않는다.
// 이 필드는 구장 고유 안내(우천·일정변경·노쇼 당부)만 담는다.
const DEFAULT_REFUND =
  "• 당일 취소·노쇼는 삼가주세요. 반복 시 예약이 제한될 수 있어요.\n• 우천/천재지변 시 협의 후 일정 변경 가능";

function makeCourt(idx) {
  // photos 는 편집 중 {url, storagePath} 형태 — 제출할 때 photos/storagePaths 두 배열로 쪼갠다.
  return { name: `${idx + 1}코트`, type: "indoor", surface: "", pricePerHour: "", slotMinutes: 60, hours: defaultCourtHours(), photos: [] };
}

// 단계 정의 — 농구 전용이라 종목 선택 단계 없음.
// 운영 주체(개인·사업자/학교/기관)는 가입 직후 계정 단위로 이미 받았으므로(OwnerTypeGate)
// 여기서 다시 묻지 않고, 그 값에 맞춰 질문과 질문 자체를 바꾼다.
//  · contact = "사람" (담당자·연락처)
//  · verify  = "소속 증빙" — 주체별로 받는 것이 완전히 다르다.
//      사업자 → 상호·사업자등록번호·개업일자·과세유형 + 등록증 → 국세청 진위확인(자동)
//      학교   → NEIS 검색으로 실재 학교 확정(대표번호 서버 고정) + 확인 서류 → 담당자 확인(수동)
//      기관   → 기관명·고유번호(선택) + 위임 서류 → 담당자 확인(수동)
//  · payout = 정산 계좌 — 플랫폼이 집금해 이 계좌로 지급하므로 계좌가 없으면
//      결제는 되는데 구장주에게 돈을 보낼 방법이 없다(지급대행에 넘길 값이 없음).
const STEPS = ["intro", "name", "location", "photos", "facilities", "courts", "notice", "keywords", "contact", "verify", "payout", "review"];
const LEAD_STEPS = 1; // intro — 진행바에서 제외
const CONTENT_TOTAL = STEPS.length - LEAD_STEPS;

export default function OwnerOnboardingPage() {
  const navigate = useNavigate();
  const { uid, venue, userDoc, loading: ownerLoading, refresh, setActiveVenue } = useOwner();
  const fileRef = useRef(null);
  const courtFileRef = useRef(null);
  const courtPhotoIdx = useRef(0);

  // ?new=1 → 다구장 "구장 추가"(신규 등록). 활성 구장이 있어도 편집이 아니라 새 구장 폼으로.
  const [searchParams] = useSearchParams();
  const isNewVenue = searchParams.get("new") === "1";
  const editingId = !isNewVenue && venue ? venue.id : null;

  // ?step=<key> 로 특정 단계부터 열 수 있다 (리뷰 보드가 단계별로 프레임을 띄운다).
  const [step, setStep] = useState(() => {
    const i = STEPS.indexOf(searchParams.get("step"));
    return i >= 0 ? i : 0;
  });
  const [form, setForm] = useState({
    name: "", address: "", addressDetail: "", region: "", lat: "", lng: "",
    phone: "", directions: "", description: "", rules: "", refundPolicy: DEFAULT_REFUND,
    bizName: "", bizNo: "", deptName: "", ownerName: "", contactPhone: "",
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

  // ── 주체 증빙(verify 단계) ──
  // 상호·담당자명은 form 에 있고, 여기엔 주체 확인에만 쓰는 값만 둔다.
  const [biz, setBiz] = useState({ openDate: "", taxType: "simple", licenseUrl: "" });
  const licRef = useRef(null);
  // 학교는 사업자등록번호가 없어 국세청 대조를 못 한다. 실재 학교를 골라 대표번호를
  // 서버가 준 값으로 고정하고, 심사자가 그 번호로 담당자인지 확인한다.
  // (자유 입력으로 두면 사칭자가 자기 번호를 적어 확인 절차가 무력화된다)
  const [schoolQ, setSchoolQ] = useState("");
  const [schoolHits, setSchoolHits] = useState(null); // null=검색 전, []=결과 없음
  const [pickedSchool, setPickedSchool] = useState(null);
  const [neisOff, setNeisOff] = useState(false); // 키 미설정/미배포 → 자유 입력 폴백
  const [searching, setSearching] = useState(false);

  // ── 정산 계좌(payout 단계) ── 지급대행에 넘길 값. 없으면 지급 자체가 불가능하다.
  const [acct, setAcct] = useState({ bank: "", account: "", holder: "" });

  // 재신청(반려 등): 기존 값 프리필
  useEffect(() => {
    if (!editingId) return;
    setForm({
      name: venue.name || "", address: venue.address || "", addressDetail: venue.addressDetail || "",
      region: venue.region || "", lat: venue.lat ?? "", lng: venue.lng ?? "",
      phone: venue.phone || "", directions: venue.directions || "",
      description: venue.description || "", rules: venue.rules || "", refundPolicy: venue.refundPolicy || DEFAULT_REFUND,
      bizName: venue.bizName || "", bizNo: venue.bizNo || "", deptName: venue.deptName || "",
      ownerName: venue.ownerName || "", contactPhone: venue.contactPhone || "",
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
    // 주체 증빙 — 반려 재신청 때 이미 낸 서류·번호를 다시 받지 않는다.
    const vb = venue.business || {};
    setBiz({ openDate: vb.openDate || "", taxType: vb.taxType === "general" ? "general" : "simple", licenseUrl: vb.licenseUrl || "" });
    setPickedSchool(vb.school || null);
    const vs = venue.settlement || {};
    setAcct({ bank: vs.bank || "", account: vs.account || "", holder: vs.holder || "" });
    setCourts(
      (venue.courts || []).length
        ? venue.courts.map((c) => ({
            ...c, // priceBands/priceOverrides/notices/cautions 등 고급 필드 보존 (반려 재신청 시 소실 방지)
            name: c.name, type: c.type, surface: c.surface || "",
            pricePerHour: String(c.pricePerHour ?? ""), slotMinutes: c.slotMinutes,
            hours: c.hours || defaultCourtHours(),
            photos: (c.photos || []).map((url, i) => ({ url, storagePath: c.storagePaths?.[i] || "" })),
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
      const { imageUrl, storagePath } = await uploadVenueImage(file, { asOwner: true });
      setPhotos((prev) => [...prev, { url: imageUrl, storagePath }]);
    } catch (err) {
      showAlert(err?.message || "사진 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };
  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  // 코트 사진 — 코트마다 따로. 업로드 중 다른 코트를 건드려도 처음 고른 코트에 붙도록 대상을 고정한다.
  const pickCourtPhoto = (i) => { if (uploading) return; courtPhotoIdx.current = i; courtFileRef.current?.click(); };
  const handleCourtFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadVenueImage(file, { asOwner: true });
      const target = courtPhotoIdx.current;
      setCourts((prev) => prev.map((c, idx) => (idx === target ? { ...c, photos: [...(c.photos || []), { url: imageUrl, storagePath }] } : c)));
    } catch (err) {
      showAlert(err?.message || "사진 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };
  const removeCourtPhoto = (ci, pi) =>
    setCourts((prev) => prev.map((c, idx) => (idx === ci ? { ...c, photos: (c.photos || []).filter((_, k) => k !== pi) } : c)));

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

  const doSearchSchool = async () => {
    setSearching(true);
    try {
      const r = await searchSchools(schoolQ);
      // 키 미설정/함수 미배포 → 학교명 자유 입력 + 서류 심사로 폴백(등록 자체를 막지 않는다)
      if (r?.configured === false) { setNeisOff(true); setSchoolHits(null); return; }
      setSchoolHits(Array.isArray(r?.schools) ? r.schools : []);
    } finally { setSearching(false); }
  };

  const pickSchool = (s) => {
    setPickedSchool(s);
    setSchoolHits(null);
    set({ bizName: s.name });
  };

  const uploadLicense = async (file) => {
    setUploading(true);
    try {
      const { imageUrl } = await uploadVenueImage(file, { asOwner: true });
      setBiz((p) => ({ ...p, licenseUrl: imageUrl }));
    } catch (e) {
      showAlert(e?.message || "서류 업로드에 실패했어요.");
    } finally { setUploading(false); }
  };

  const id = STEPS[step];
  // 계정에 저장된 운영 주체(가입 직후 선택). 계정 값이 없는 레거시 구장주는 구장 문서 값으로 폴백.
  const ownerType = resolveOwnerType(userDoc, venue);
  const typeOpt = ownerTypeOption(ownerType);
  const isSchool = ownerType === "school";
  // 주체별로 갈리는 단계 제목·안내 — 문구의 단일 출처는 constants/ownerType.js 표.
  const STEP_TITLE = { contact: typeOpt.contactTitle, verify: typeOpt.verifyTitle };
  const STEP_SUB = { contact: typeOpt.contactSub, verify: typeOpt.verifySub };

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
    // 심사는 담당자 연락으로 이뤄지므로 이름·연락처가 없으면 승인 자체가 불가능하다.
    if (id === "contact") return !!form.ownerName.trim() && !!form.contactPhone.trim();
    if (id === "verify") return !verifyError();
    if (id === "payout") return !payoutError();
    return true;
  })();

  // 정산 계좌 미비 사유 — 서버(saveSettlementAccount)와 같은 기준.
  function payoutError() {
    if (!acct.bank) return "은행을 선택해주세요.";
    const digits = acct.account.replace(/[^0-9]/g, "");
    if (digits.length < 10 || digits.length > 16) return "계좌번호를 정확히 입력해주세요.";
    if (!acct.holder.trim()) return "예금주를 입력해주세요.";
    return "";
  }

  // 주체별 증빙 미비 사유 — 서버(submitBusinessVerification)와 같은 기준으로 미리 막는다.
  function verifyError() {
    if (!form.bizName.trim()) return `${typeOpt.orgLabel}을 입력해주세요.`;
    if (typeOpt.needsBizNo) {
      if (!form.bizNo.trim()) return "사업자등록번호를 입력해주세요.";
      if (!isValidBizNo(form.bizNo)) return "올바른 사업자등록번호가 아니에요.\n번호를 다시 확인해주세요.";
      if (!biz.openDate) return "개업일자를 입력해주세요.";
      return "";
    }
    // 번호는 선택이지만 서류는 받는다 — 담당자 사칭을 서류 없이 통과시키지 않기 위해.
    if (isSchool && !neisOff && !pickedSchool) return "목록에서 학교를 찾아 선택해주세요.";
    if (!biz.licenseUrl) return `${typeOpt.docLabel}을 첨부해주세요.`;
    return "";
  }

  const goNext = () => {
    if (!canNext) {
      if (id === "name") return showAlert("구장명을 입력해주세요.");
      if (id === "location") return showAlert("지도에서 구장 위치에 핀을 맞춰주세요.");
      if (id === "photos") return showAlert("구장 사진을 최소 1장 등록해주세요.\n사진이 있으면 승인도 빠르고 예약도 잘 들어와요.");
      if (id === "courts") return showAlert("코트 이름과 운영시간(최소 1개 요일)을 확인해주세요.");
      if (id === "contact") return showAlert(`${typeOpt.personLabel}과 담당자 연락처를 입력해주세요.\n승인 심사 때 이 연락처로 확인 연락을 드려요.`);
      if (id === "verify") return showAlert(verifyError());
      if (id === "payout") return showAlert(payoutError());
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
    const vErr = verifyError();
    if (vErr) { setStep(STEPS.indexOf("verify")); return showAlert(vErr); }
    const pErr = payoutError();
    if (pErr) { setStep(STEPS.indexOf("payout")); return showAlert(pErr); }
    setBusy(true);
    try {
      const payload = {
        ownerUid: uid, ...form, ownerType,
        // 주체에 해당하지 않는 값은 올리지 않는다 — 계정 주체가 바뀐 뒤 재신청할 때
        // 예전 사업자등록번호(또는 담당 부서)가 심사에 남아 올라가는 것 방지.
        bizNo: typeOpt.needsBizNo ? form.bizNo : "",
        deptName: typeOpt.needsBizNo ? "" : form.deptName,
        sportTypes, parking, keywords, displayMode, displayName,
        photos: photos.map((p) => p.url), storagePaths: photos.map((p) => p.storagePath),
        facilities,
        courts: courts.map((c) => ({
          ...c,
          photos: (c.photos || []).map((p) => p.url),
          storagePaths: (c.photos || []).map((p) => p.storagePath),
        })),
      };
      let vid = editingId;
      if (editingId) {
        await updateMyVenue(editingId, payload, { asOwner: true });
        await resubmitVenue(editingId);
      } else {
        const created = await registerVenue(payload);
        vid = created?.id || "";
        // 새로 추가한 구장을 바로 활성 구장으로 전환 (다구장)
        if (vid && setActiveVenue) setActiveVenue(vid);
      }

      // 주체 증빙 — 구장 문서가 있어야 붙일 수 있어서 등록 직후에 이어 올린다.
      // 검증 기준은 서버 함수 한 곳에만 두고 여기서는 값만 넘긴다.
      if (vid) {
        await submitBusinessVerification(vid, {
          ownerType,
          bizNo: form.bizNo, bizName: form.bizName, ownerName: form.ownerName,
          openDate: biz.openDate, taxType: biz.taxType, licenseUrl: biz.licenseUrl,
          school: pickedSchool,
        });
        // 정산 계좌 — 앱내 결제는 플랫폼이 집금해 이 계좌로 지급한다(지급대행에 넘길 값).
        await saveSettlementAccount(vid, acct);
        // 사업자등록번호가 있는 주체만 국세청 대조 → 통과하면 승인까지 자동.
        // 학교·기관은 어드민이 담당자 연락으로 확인한다.
        if (typeOpt.needsBizNo) {
          try {
            await verifyBusinessOnline({
              venueId: vid, bizNo: form.bizNo, ownerName: form.ownerName,
              openDate: biz.openDate, bizName: form.bizName,
            });
          } catch (e) {
            // 진위확인 실패는 등록 자체를 되돌리지 않는다 — 어드민 수동 심사로 넘어간다.
          }
        }
      }

      track("owner_venue_register", { editing: !!editingId, courts: courts.length, photos: photos.length, ownerType }); // ★ 핵심 공급 생성
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
          {/* 가입 때 고른 주체를 다시 보여준다 — 잘못 고른 걸 여기서 알아차릴 수 있게. */}
          <TypeTag>{typeOpt.label}</TypeTag>
          <IntroTitle>{editingId ? "구장 정보를 다시 등록해요" : "구장 등록을 시작해요"}</IntroTitle>
          <IntroSub>
            몇 단계만 거치면 예약을 받을 수 있어요.{"\n"}
            {typeOpt.introSub}{"\n\n"}
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
      <Progress><Bar style={{ width: `${((step - LEAD_STEPS + 1) / CONTENT_TOTAL) * 100}%` }} /></Progress>

      <Scroll>
        <StepTitle>{STEP_TITLE[id] || TITLES[id]}</StepTitle>
        {(STEP_SUB[id] || SUBS[id]) && <StepSub>{STEP_SUB[id] || SUBS[id]}</StepSub>}

        {id === "name" && (
          <Field>
            <Label>구장명</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={typeOpt.venueNamePlaceholder} autoFocus />
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
                  <Field>
                    <Label>시간당 가격(원) · 손님이 결제할 금액</Label>
                    <Input type="number" value={c.pricePerHour} onChange={(e) => setCourt(i, { pricePerHour: e.target.value })} placeholder="예: 40000" />
                    {payoutHint(c.pricePerHour) ? <FieldHint>{payoutHint(c.pricePerHour)}</FieldHint> : null}
                  </Field>
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
                <Field>
                  <Label>코트 사진 <Opt>(선택)</Opt></Label>
                  <PhotoGrid>
                    {(c.photos || []).map((p, pi) => (
                      <PhotoBox key={pi}>
                        <PhotoImg src={p.url} alt={`${c.name} 사진 ${pi + 1}`} />
                        {pi === 0 && <MainTag>대표</MainTag>}
                        <RemovePhoto type="button" onClick={() => removeCourtPhoto(i, pi)}>×</RemovePhoto>
                      </PhotoBox>
                    ))}
                    <AddPhoto type="button" onClick={() => pickCourtPhoto(i)} disabled={uploading}>
                      {uploading ? "업로드 중…" : <><span style={{ fontSize: 22 }}>＋</span><span>사진 추가</span></>}
                    </AddPhoto>
                  </PhotoGrid>
                  <FieldHint>이 코트만 찍은 사진이에요. 회원이 코트를 고를 때 보여요.</FieldHint>
                </Field>
              </CourtCard>
            ))}
            <HiddenFile ref={courtFileRef} type="file" accept="image/*" onChange={handleCourtFile} />
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
            <SubHead>{typeOpt.contactHead} <Opt>(심사용 · 비공개)</Opt></SubHead>
            <Row>
              <Field><Label>{typeOpt.personLabel}</Label><Input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder={typeOpt.personPlaceholder} /></Field>
              <Field><Label>담당자 연락처</Label><Input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="예: 010-1234-5678" /></Field>
            </Row>
            {!typeOpt.needsBizNo && (
              <Field><Label>담당 부서 <Opt>(선택)</Opt></Label><Input value={form.deptName} onChange={(e) => set({ deptName: e.target.value })} placeholder={isSchool ? "예: 체육부" : "예: 시설운영팀"} /></Field>
            )}
            <StepHint>승인 심사 때 이 연락처로 확인 연락을 드려요.</StepHint>
          </>
        )}

        {id === "verify" && (
          <>
            {/* 사업자 — 국세청 진위확인으로 자동 승인까지 이어진다 */}
            {typeOpt.needsBizNo && (
              <>
                <Field><Label>{typeOpt.orgLabel}</Label>
                  <Input value={form.bizName} onChange={(e) => set({ bizName: e.target.value })} placeholder={typeOpt.orgPlaceholder} />
                </Field>
                <Field><Label>사업자등록번호</Label>
                  <Input value={form.bizNo} onChange={(e) => set({ bizNo: formatBizNo(e.target.value) })} placeholder="123-45-67890" inputMode="numeric" />
                  {form.bizNo.trim() && !isValidBizNo(form.bizNo) && (
                    <StepHint style={{ color: "#EF4444", fontWeight: 600 }}>사업자등록번호 10자리를 정확히 입력해주세요.</StepHint>
                  )}
                </Field>
                <Row>
                  <Field><Label>개업일자</Label>
                    <Input type="date" value={biz.openDate} onChange={(e) => setBiz({ ...biz, openDate: e.target.value })} />
                  </Field>
                  <Field><Label>과세유형</Label>
                    <Select value={biz.taxType} onChange={(e) => setBiz({ ...biz, taxType: e.target.value })}>
                      <option value="simple">간이과세자</option>
                      <option value="general">일반과세자</option>
                    </Select>
                  </Field>
                </Row>
                <StepHint>입력하신 정보를 국세청에 바로 대조해요. 일치하면 사업자 인증이 자동으로 끝나요.</StepHint>
              </>
            )}

            {/* 학교 — 실재하는 학교를 골라 대표번호를 서버 값으로 고정한다 */}
            {isSchool && !neisOff && (
              <Field><Label>{typeOpt.orgLabel}</Label>
                {pickedSchool ? (
                  <PickedBox>
                    <PickedName>{pickedSchool.name}</PickedName>
                    <PickedMeta>{[pickedSchool.kind, pickedSchool.foundKind].filter(Boolean).join(" · ")}</PickedMeta>
                    <PickedMeta>{pickedSchool.address}</PickedMeta>
                    <PickedMeta><b>대표번호 {pickedSchool.tel || "-"}</b></PickedMeta>
                    <GhostBtn type="button" style={{ alignSelf: "flex-start", marginTop: 6 }}
                      onClick={() => { setPickedSchool(null); setSchoolQ(""); }}>다시 찾기</GhostBtn>
                  </PickedBox>
                ) : (
                  <>
                    <KeywordRow>
                      <Input value={schoolQ} onChange={(e) => setSchoolQ(e.target.value)} placeholder={typeOpt.orgPlaceholder}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearchSchool(); } }} />
                      <AddKw type="button" disabled={searching || schoolQ.trim().length < 2} onClick={doSearchSchool}>
                        {searching ? "찾는 중…" : "찾기"}
                      </AddKw>
                    </KeywordRow>
                    {schoolHits && schoolHits.length === 0 && (
                      <StepHint>검색 결과가 없어요. 학교명을 다시 확인해 주세요.</StepHint>
                    )}
                    {schoolHits && schoolHits.length > 0 && (
                      <SchoolList>
                        {schoolHits.map((s) => (
                          <SchoolItem key={s.code} type="button" onClick={() => pickSchool(s)}>
                            <PickedName>{s.name}</PickedName>
                            <PickedMeta>{[s.kind, s.foundKind].filter(Boolean).join(" · ")} · {s.address}</PickedMeta>
                          </SchoolItem>
                        ))}
                      </SchoolList>
                    )}
                  </>
                )}
                <StepHint>목록에서 고른 학교의 대표번호로 담당자 확인 연락을 드려요.</StepHint>
              </Field>
            )}

            {/* 기관, 그리고 NEIS 를 못 쓸 때의 학교 폴백 */}
            {!typeOpt.needsBizNo && (!isSchool || neisOff) && (
              <Field><Label>{typeOpt.orgLabel}</Label>
                <Input value={form.bizName} onChange={(e) => set({ bizName: e.target.value })} placeholder={typeOpt.orgPlaceholder} />
              </Field>
            )}

            {/* 학교·기관 — 사업자등록증이 없으므로 번호는 선택, 서류는 필수 */}
            {!typeOpt.needsBizNo && (
              <Field><Label>고유번호 <Opt>(선택)</Opt></Label>
                <Input value={form.bizNo} onChange={(e) => set({ bizNo: e.target.value.replace(/[^0-9-]/g, "") })} placeholder="고유번호증에 적힌 번호" inputMode="numeric" />
              </Field>
            )}

            <Field><Label>{typeOpt.docLabel} {typeOpt.needsBizNo && <Opt>(선택)</Opt>}</Label>
              {biz.licenseUrl ? (
                <DocDone>
                  <span>✓ 첨부 완료</span>
                  <DelLink type="button" onClick={() => setBiz({ ...biz, licenseUrl: "" })}>삭제</DelLink>
                </DocDone>
              ) : (
                <DocUpload type="button" disabled={uploading} onClick={() => licRef.current?.click()}>
                  {uploading ? "올리는 중…" : "＋ 파일 첨부"}
                </DocUpload>
              )}
              <HiddenFile ref={licRef} type="file" accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadLicense(f); }} />
            </Field>

            {!typeOpt.needsBizNo && (
              <StepHint>사업자등록번호는 받지 않아요. 제출하신 서류와 담당자 연락으로 확인해요.</StepHint>
            )}
          </>
        )}

        {id === "payout" && (
          <>
            <Field><Label>은행</Label>
              <Select value={acct.bank} onChange={(e) => setAcct({ ...acct, bank: e.target.value })}>
                <option value="">은행 선택</option>
                {SETTLEMENT_BANKS.map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field><Label>계좌번호</Label>
              <Input value={acct.account} onChange={(e) => setAcct({ ...acct, account: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="'-' 없이 숫자만" inputMode="numeric" />
            </Field>
            <Field><Label>예금주</Label>
              <Input value={acct.holder} onChange={(e) => setAcct({ ...acct, holder: e.target.value })} placeholder={typeOpt.personPlaceholder} />
            </Field>
            {/* 명의가 다르면 지급이 보류될 수 있어 미리 알린다(법인·기관 계좌도 있어서 막지는 않는다) */}
            {!!acct.holder.trim() && !!form.ownerName.trim()
              && acct.holder.trim() !== form.ownerName.trim() && acct.holder.trim() !== form.bizName.trim() && (
              <StepHint>예금주가 {typeOpt.personLabel}({form.ownerName})·{typeOpt.orgLabel}과 달라요. 명의가 다르면 지급이 보류될 수 있어요.</StepHint>
            )}
            <StepHint>{typeOpt.accountHint}</StepHint>
            <StepHint>입점비·월정액은 없어요. 예약이 성사됐을 때만 결제액의 {PLATFORM_FEE_LABEL}를 이용료로 받아요.</StepHint>
          </>
        )}

        {id === "review" && (
          <ReviewList>
            <ReviewRow><b>운영 주체</b><span>{typeOpt.label}</span></ReviewRow>
            <ReviewRow><b>구장명</b><span>{form.name || "-"}</span></ReviewRow>
            <ReviewRow><b>주소</b><span>{form.address || "-"}{form.addressDetail ? ` ${form.addressDetail}` : ""}</span></ReviewRow>
            <ReviewRow><b>사진</b><span>{photos.length}장</span></ReviewRow>
            <ReviewRow><b>편의시설</b><span>{facilities.length ? facilities.join(", ") : "-"}</span></ReviewRow>
            <ReviewRow><b>주차</b><span>{parking.available ? (parking.fee === "paid" ? "유료" : "무료") : "불가"}</span></ReviewRow>
            <ReviewRow><b>코트</b><span>{courts.length}면</span></ReviewRow>
            <ReviewRow><b>대표키워드</b><span>{keywords.length ? keywords.map((k) => `#${k}`).join(" ") : "-"}</span></ReviewRow>
            <ReviewRow><b>{typeOpt.personLabel}</b><span>{form.ownerName || "-"} · {form.contactPhone || "-"}</span></ReviewRow>
            <ReviewRow><b>{typeOpt.orgLabel}</b><span>{form.bizName || "-"}</span></ReviewRow>
            {typeOpt.needsBizNo ? (
              <>
                <ReviewRow><b>사업자번호</b><span>{form.bizNo || "-"}</span></ReviewRow>
                <ReviewRow><b>개업일자</b><span>{biz.openDate || "-"} · {biz.taxType === "general" ? "일반과세자" : "간이과세자"}</span></ReviewRow>
              </>
            ) : isSchool && pickedSchool ? (
              <ReviewRow><b>학교 대표번호</b><span>{pickedSchool.tel || "-"}</span></ReviewRow>
            ) : null}
            <ReviewRow><b>{typeOpt.docLabel}</b><span>{biz.licenseUrl ? "첨부됨" : "없음"}</span></ReviewRow>
            <ReviewRow><b>정산 계좌</b><span>{acct.bank ? `${acct.bank} ${acct.account} (${acct.holder})` : "-"}</span></ReviewRow>
            <StepHint style={{ marginTop: 4 }}>
              {typeOpt.needsBizNo
                ? "제출하면 국세청 진위확인을 거쳐 관리자가 승인해요(보통 영업일 1~2일)."
                : "제출하면 서류 확인과 담당자 확인 연락을 거쳐 관리자가 승인해요(보통 영업일 1~2일)."}
            </StepHint>
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
  payout: "정산금을 받을 계좌를 알려주세요",
  review: "입력한 내용을 확인해요",
};
// 운영 주체별로 갈리는 문구(제목·안내·플레이스홀더)는 constants/ownerType.js 표에 모아뒀다.
const SUBS = {
  location: "지도를 움직여 핀을 맞추면 주소가 자동으로 입력돼요.",
  photos: "구장 전경, 코트, 시설 사진을 올려주세요. (여러 장 가능)",
  facilities: "이용자가 구장을 고를 때 참고해요.",
  courts: "코트마다 종류·바닥·가격·운영시간을 따로 설정해요.",
  notice: "이용자에게 보여지는 안내예요.",
  keywords: "이용자가 검색할 만한 단어를 넣어주세요.",
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

// 인트로에서 가입 때 고른 운영 주체를 되짚어 보여주는 태그
const TypeTag = styled.div`
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 12.5px;
  font-weight: 700;
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

/* 주체 증빙(verify) — 학교 검색 결과와 서류 첨부 */
const SchoolList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
`;
const SchoolItem = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  &:active { transform: translateY(1px); }
`;
const PickedBox = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;
const PickedName = styled.div`
  font-size: 13.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const PickedMeta = styled.div`
  font-size: 12px;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const DocUpload = styled.button`
  border: 1px dashed ${({ theme }) => theme.colors.primary};
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  border-radius: 12px;
  padding: 12px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const DocDone = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
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
