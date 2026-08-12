/* eslint-disable */
// src/pages/owner/OwnerOnboardingPage.jsx
// 구장 등록 온보딩 — 단계별 위저드.
// 페이지마다 한 주제씩(이름→위치→사진→코트→담당자→자격확인→검토).
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
  SURFACE_OPTIONS,
  isValidBizNo,
  formatBizNo,
  searchSchools,
  submitBusinessVerification,
  verifyBusinessOnline,
} from "../../services/ownerVenueService";
import { ownerTypeOption, resolveOwnerType, registerFlow } from "../../constants/ownerType";
import {
  Field, Label, Input, Textarea, Select, Row, Chip, ChipWrap, GhostBtn, FieldHint, C,
} from "./components/ownerUi";
import { payoutHint, PLATFORM_FEE_LABEL } from "../../constants/payments";
import OwnerSpinner from "./components/OwnerSpinner";
import CourtHoursEditor from "./components/CourtHoursEditor";
import VenueMapPicker from "./components/VenueMapPicker";
import { images } from "../../utils/imageAssets";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import { useExitConfirm } from "../../hooks/useExitConfirm";

// 환불 비율은 플랫폼 공통 기준(constants/cancelPolicy.js)이라 여기 적지 않는다.
// 이 필드는 구장 고유 안내(우천·일정변경·노쇼 당부)만 담는다.
const DEFAULT_REFUND =
  "• 당일 취소·노쇼는 삼가주세요. 반복 시 예약이 제한될 수 있어요.\n• 우천/천재지변 시 협의 후 일정 변경 가능";

const PHOTO_RECOMMEND = 3; // 권장 장수(막지는 않는다) — 승인·예약 전환이 눈에 띄게 갈린다

function makeCourt(idx) {
  // photos 는 편집 중 {url, storagePath} 형태 — 제출할 때 photos/storagePaths 두 배열로 쪼갠다.
  return {
    name: `${idx + 1}코트`, type: "indoor", surface: "", description: "", pricePerHour: "", slotMinutes: 60,
    priceMode: "hourly", pricePerPerson: "", minHeadcount: "", maxHeadcount: "",
    hours: defaultCourtHours(), photos: [],
  };
}

// 단계 정의 — 농구 전용이라 종목 선택 단계 없음.
// 운영 주체(개인·사업자/학교/기관)는 가입 직후 계정 단위로 이미 받았으므로(OwnerTypeGate)
// 여기서 다시 묻지 않고, 그 값에 맞춰 질문과 질문 자체를 바꾼다.
//  · contact = "연락받을 곳" — 공개(구장 대표번호) / 비공개(담당자) 를 갈라서 받는다.
//  · verify  = "자격 확인" — 주체별로 받는 것이 완전히 다르다.
//      사업자 → 상호·대표자명·사업자등록번호·개업일자·과세유형 + 등록증 → 국세청 진위확인(자동)
//      학교   → NEIS 검색으로 실재 학교 확정(대표번호 서버 고정) + 확인 서류 → 담당자 확인(수동)
//      기관   → 기관명·고유번호(선택) + 위임 서류 → 담당자 확인(수동)
//  · 정산 계좌는 여기서 받지 않는다 — 심사 통과 여부도 모르는 사람에게 계좌·예금주를
//      요구하는 게 이 폼에서 저항이 가장 큰 구간이었다. 승인 후 내정보(BusinessSection)에서
//      받는다. 지급 직전에만 있으면 되는 값이라 등록 시점에 필수일 이유가 없다.
//  · 편의시설·주차·이용안내·키워드는 여기서 묻지 않는다 — 승인 심사에 필요 없는 값인데
//      필수 구간 한가운데 있어서, 여기서 이탈하면 심사 자체가 시작되지 않았다.
//      승인 후 구장정보(OwnerVenuePage)에서 언제든 채울 수 있다.
//
// 순서 근거: 쉽고 이미 알고 있는 값(이름·위치·사진) → 판단이 필요한 값(코트·요금) →
// 남에게 물어봐야 할 수도 있는 값(담당자·서류) 순. 서류를 앞에 두면 준비 안 된 사람이
// 첫 화면에서 끊긴다. 대신 인트로에서 준비물을 먼저 고지해 "끝에서야 알게 되는" 문제를 막는다.
const STEPS = ["intro", "name", "location", "photos", "courts", "contact", "verify", "review"];
const LEAD_STEPS = 1; // intro — 진행바에서 제외
const CONTENT_TOTAL = STEPS.length - LEAD_STEPS;
// 진행 헤더에 쓰는 국면 이름 — "7단계 중 5단계"보다 "지금 무슨 성격의 질문인지"가 먼저 읽혀야 한다.
const STEP_GROUP = {
  name: "구장 소개", location: "구장 소개", photos: "구장 소개",
  courts: "운영 · 요금",
  contact: "연락처", verify: "자격 확인",
  review: "최종 확인",
};

const won = (v) => (Number(v) > 0 ? Number(v).toLocaleString() : "");

export default function OwnerOnboardingPage() {
  const navigate = useNavigate();
  const confirmExit = useExitConfirm();
  const { uid, venue, venues, userDoc, loading: ownerLoading, refresh, setActiveVenue } = useOwner();
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
    bizName: "", bizNo: "", deptName: "", ownerName: "", contactName: "", contactPhone: "",
  });
  const [sportTypes, setSportTypes] = useState(["농구"]); // 농구 전용
  const [photos, setPhotos] = useState([]); // [{url, storagePath}]
  const [facilities, setFacilities] = useState([]);
  const [parking, setParking] = useState({ available: false, fee: "free", info: "" });
  const [keywords, setKeywords] = useState([]);
  const [displayMode, setDisplayMode] = useState("grouped");
  const [displayName, setDisplayName] = useState("");
  const [courts, setCourts] = useState([makeCourt(0)]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── 주체 증빙(verify 단계) ──
  // 상호·대표자명은 form 에 있고, 여기엔 주체 확인에만 쓰는 값만 둔다.
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

  // ── 신규 등록 임시저장 ──────────────────────────────────────────
  // 구장 문서는 마지막 제출 때 생긴다. 그전까지 입력값은 이 화면 state 에만 있어서,
  // 새로고침·전화 한 통에 사진까지 전부 날아갔다(업로드된 파일은 Storage 에 고아로 남았다).
  // 재신청(editingId)은 서버에 원본이 있으니 신규 등록만 저장한다.
  const draftKey = !editingId && uid ? `hm_owner_onboarding_draft:${uid}` : "";
  const draftLoaded = useRef(false);

  // ── 정산 계좌 ── 승인 후 내정보에서 받는다(온보딩에서는 묻지 않는다).

  // 재신청(반려 등): 기존 값 프리필
  useEffect(() => {
    if (!editingId) return;
    setForm({
      name: venue.name || "", address: venue.address || "", addressDetail: venue.addressDetail || "",
      region: venue.region || "", lat: venue.lat ?? "", lng: venue.lng ?? "",
      phone: venue.phone || "", directions: venue.directions || "",
      description: venue.description || "", rules: venue.rules || "", refundPolicy: venue.refundPolicy || DEFAULT_REFUND,
      bizName: venue.bizName || "", bizNo: venue.bizNo || "", deptName: venue.deptName || "",
      ownerName: venue.ownerName || "",
      // 담당자명은 최근에 생긴 필드다 — 없던 시절 구장은 대표자명 하나로 겸했다.
      contactName: venue.contactName || venue.ownerName || "",
      contactPhone: venue.contactPhone || "",
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
    setCourts(
      (venue.courts || []).length
        ? venue.courts.map((c) => ({
            ...c, // priceBands/priceOverrides/notices/cautions 등 고급 필드 보존 (반려 재신청 시 소실 방지)
            name: c.name, type: c.type, surface: c.surface || "",
            pricePerHour: String(c.pricePerHour ?? ""), slotMinutes: c.slotMinutes,
            priceMode: c.priceMode === "perPerson" ? "perPerson" : "hourly",
            pricePerPerson: String(c.pricePerPerson ?? ""),
            minHeadcount: Number(c.minHeadcount) >= 1 ? String(c.minHeadcount) : "",
            maxHeadcount: Number(c.maxHeadcount) > 0 ? String(c.maxHeadcount) : "",
            hours: c.hours || defaultCourtHours(),
            photos: (c.photos || []).map((url, i) => ({ url, storagePath: c.storagePaths?.[i] || "" })),
          }))
        : [makeCourt(0)]
    );
  }, [editingId]); // eslint-disable-line

  // 2호점 등록(?new=1): 사업자 정보를 처음부터 다시 받지 않는다.
  // 주체 증빙은 구장 문서마다 따로 붙지만 사업자·학교 자체는 그대로라, 이미 인증받은
  // 구장의 값을 그대로 채워준다. (구장명·주소·코트처럼 구장마다 다른 값은 당연히 비운다)
  useEffect(() => {
    if (editingId || !isNewVenue) return;
    const src = (venues || []).find((v) => v.business?.status === "verified") || (venues || [])[0];
    if (!src?.business) return;
    const b = src.business;
    setForm((p) => ({
      ...p,
      bizName: p.bizName || b.bizName || src.bizName || "",
      bizNo: p.bizNo || b.bizNo || src.bizNo || "",
      ownerName: p.ownerName || b.ownerName || src.ownerName || "",
      contactName: p.contactName || src.contactName || src.ownerName || "",
      contactPhone: p.contactPhone || src.contactPhone || "",
      deptName: p.deptName || src.deptName || "",
    }));
    setBiz((p) => (p.openDate || p.licenseUrl ? p : {
      openDate: b.openDate || "",
      taxType: b.taxType === "general" ? "general" : "simple",
      licenseUrl: b.licenseUrl || "",
    }));
    setPickedSchool((p) => p || b.school || null);
  }, [isNewVenue, editingId, venues]); // eslint-disable-line

  // 임시저장 불러오기 — 화면에 처음 들어올 때 한 번만. (사진은 이미 업로드된 URL 이라 그대로 산다)
  useEffect(() => {
    if (!draftKey || draftLoaded.current) return;
    draftLoaded.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.form) setForm((p) => ({ ...p, ...d.form }));
      if (Array.isArray(d.sportTypes) && d.sportTypes.length) setSportTypes(d.sportTypes);
      if (Array.isArray(d.photos)) setPhotos(d.photos);
      if (Array.isArray(d.facilities)) setFacilities(d.facilities);
      if (d.parking) setParking(d.parking);
      if (Array.isArray(d.keywords)) setKeywords(d.keywords);
      if (d.displayMode) setDisplayMode(d.displayMode);
      if (typeof d.displayName === "string") setDisplayName(d.displayName);
      if (Array.isArray(d.courts) && d.courts.length) setCourts(d.courts);
      if (d.biz) setBiz(d.biz);
      if (d.pickedSchool) setPickedSchool(d.pickedSchool);
      // 단계도 복원한다 — 8단계까지 갔다가 1단계부터 다시 훑게 하면 저장한 의미가 없다.
      // ?step= 으로 직접 들어온 경우는 그 단계를 존중한다.
      if (typeof d.step === "number" && !searchParams.get("step")) {
        setStep(Math.min(STEPS.length - 1, Math.max(0, d.step)));
      }
    } catch { /* 깨진 임시저장은 조용히 버린다 */ }
  }, [draftKey]); // eslint-disable-line

  // 임시저장 쓰기 — 입력이 바뀔 때마다. localStorage 라 용량 제한이 있어 사진은 URL 만 담긴다.
  useEffect(() => {
    if (!draftKey || !draftLoaded.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        form, sportTypes, photos, facilities, parking, keywords,
        displayMode, displayName, courts, biz, pickedSchool, step,
      }));
    } catch { /* 용량 초과 등은 무시 — 저장 실패가 입력을 막으면 안 된다 */ }
  }, [draftKey, form, sportTypes, photos, facilities, parking, keywords, displayMode, displayName, courts, biz, pickedSchool, step]);

  const clearDraft = () => { try { if (draftKey) localStorage.removeItem(draftKey); } catch {} };

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));


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
  const flow = registerFlow(ownerType);
  // 주체별로 갈리는 단계 제목·안내 — 문구의 단일 출처는 constants/ownerType.js 표.
  const STEP_TITLE = { contact: typeOpt.contactTitle, verify: typeOpt.verifyTitle };
  const STEP_SUB = { contact: typeOpt.contactSub, verify: typeOpt.verifySub };
  // 자격 확인에 쓰는 이름. 사업자는 등록증상 대표자명(국세청 대조 대상),
  // 학교·기관은 담당자 본인이라 담당자명을 그대로 쓴다.
  const verifyPersonName = typeOpt.needsBizNo ? form.ownerName : form.contactName;

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
    // 1인 요금제 코트는 최소 인원이 하한가 역할이라 반드시 정하고 넘어가야 한다.
    // 코트가 2개 이상이면 코트당 사진 1장은 받아야 한다 — 없으면 사용자 화면에서 모든 코트가
    // 같은 구장 대표 사진으로 대체돼, 무엇이 다른지 볼 방법이 사라진다(운영 구장 26개 코트 전부가
    // 사진 0장이었던 원인이 "선택" 항목이라서였다). 코트가 하나면 구장 사진으로 충분하다.
    if (id === "courts") return courts.length > 0 && courts.every(
      (c) => c.name.trim() && hasAnyOpenDay(c.hours) && (c.priceMode !== "perPerson" || Number(c.minHeadcount) >= 1)
        && (courts.length < 2 || (c.photos || []).length > 0)
    );
    // 심사는 담당자 연락으로 이뤄지므로 이름·연락처가 없으면 승인 자체가 불가능하다.
    // 구장 연락처도 필수 — 예약자에게 공개할 번호가 없으면 담당자 개인 휴대폰이 대신
    // 노출되던 문제가 있었다(지금은 폴백을 끊었으므로 여기서 반드시 받아야 한다).
    if (id === "contact") return !!form.phone.trim() && !!form.contactName.trim() && !!form.contactPhone.trim();
    if (id === "verify") return !verifyError();
    return true;
  })();

  // 주체별 증빙 미비 사유 — 서버(submitBusinessVerification)와 같은 기준으로 미리 막는다.
  function verifyError() {
    if (!form.bizName.trim()) return `${typeOpt.orgLabel}을 입력해주세요.`;
    if (typeOpt.needsBizNo) {
      if (!form.ownerName.trim()) return "사업자등록증에 적힌 대표자명을 입력해주세요.";
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

  const goStep = (key) => {
    const i = STEPS.indexOf(key);
    if (i >= 0) setStep(i);
  };

  const goNext = () => {
    if (!canNext) {
      if (id === "name") return showAlert("구장명을 입력해주세요.");
      if (id === "location") return showAlert("지도에서 구장 위치에 핀을 맞춰주세요.");
      if (id === "photos") return showAlert("구장 사진을 최소 1장 등록해주세요.\n사진이 있으면 승인도 빠르고 예약도 잘 들어와요.");
      if (id === "courts") {
        const noMin = courts.some((c) => c.priceMode === "perPerson" && !(Number(c.minHeadcount) >= 1));
        return showAlert(noMin
          ? "1인 요금제 코트는 최소 인원을 정해주세요.\n정하지 않으면 1명이 1인 요금만 내고 그 시간을 통째로 쓰게 돼요."
          : "코트 이름과 운영시간(최소 1개 요일)을 확인해주세요.");
      }
      if (id === "contact") return showAlert(`구장 대표번호와 ${typeOpt.managerLabel}, 담당자 연락처를 입력해주세요.\n대표번호는 예약자에게 안내되고, 담당자 연락처로는 심사 확인 연락을 드려요.`);
      if (id === "verify") return showAlert(verifyError());
      return;
    }
    track("owner_onboarding_step", { step: id }); // 어느 단계에서 이탈하는지 정량화
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  // 첫 단계에서의 뒤로가기:
  //  - 등록된 구장이 있으면(=구장 추가 중) 구장주 홈으로
  //  - 없으면 OwnerGate가 다시 온보딩으로 되돌리므로(무한 반복) 앱 종료 확인으로 받는다
  const goBack = () => {
    if (step > 0) { setStep((s) => s - 1); return; }
    if (venue) { navigate("/owner/home"); return; }
    confirmExit();
  };
  // 안드로이드 하드웨어 뒤로가기도 화면의 ‹ 버튼과 같게 (단계별로 되돌아감)
  useBackInterceptor(true, goBack);

  const handleSubmit = async () => {
    if (!form.name.trim()) { goStep("name"); return showAlert("구장명을 입력해주세요."); }
    if (!form.address.trim()) { goStep("location"); return showAlert("주소를 입력해주세요."); }
    if (photos.length === 0) { goStep("photos"); return showAlert("구장 사진을 최소 1장 등록해주세요."); }
    if (courts.some((c) => c.priceMode === "perPerson" && !(Number(c.minHeadcount) >= 1))) {
      goStep("courts");
      return showAlert("1인 요금제 코트는 최소 인원을 정해주세요.\n정하지 않으면 1명이 1인 요금만 내고 그 시간을 통째로 쓰게 돼요.");
    }
    if (!form.phone.trim()) { goStep("contact"); return showAlert("구장 대표번호를 입력해주세요. 예약자에게 안내되는 번호예요."); }
    if (!form.contactName.trim() || !form.contactPhone.trim()) {
      goStep("contact");
      return showAlert(`${typeOpt.managerLabel}과 담당자 연락처를 입력해주세요. 심사 확인 연락을 드릴 곳이에요.`);
    }
    const vErr = verifyError();
    if (vErr) { goStep("verify"); return showAlert(vErr); }
    setBusy(true);
    try {
      const payload = {
        ownerUid: uid, ...form, ownerType,
        // 자격 확인에 쓰는 이름 — 학교·기관은 담당자 본인이 확인 대상이라 담당자명을 그대로 쓴다.
        ownerName: verifyPersonName,
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
          bizNo: form.bizNo, bizName: form.bizName, ownerName: verifyPersonName,
          openDate: biz.openDate, taxType: biz.taxType, licenseUrl: biz.licenseUrl,
          school: pickedSchool,
        });
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
      clearDraft(); // 제출됐으니 임시저장은 버린다 — 남겨두면 다음 "구장 추가"에 옛 값이 딸려온다
      await refresh();
      navigate("/owner/home", { replace: true });
    } catch (e) {
      showAlert(e?.message || "신청에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;

  // ── 인트로 ──
  // 여기서 "무엇을 준비해야 하는지 / 제출 뒤 무슨 일이 일어나는지"를 다 보여준다.
  // 서류를 마지막 단계에 두는 대신, 시작 전에 준비물을 알려 헛걸음을 막는 자리다.
  if (id === "intro") {
    return (
      <Shell>
        <Scroll>
          <IntroHead>
            <IntroLogo src={images.logo} alt="할래말래" />
            <TypeTag>{typeOpt.label}</TypeTag>
            <IntroTitle>{editingId ? "구장 정보를 다시 등록해요" : "구장 등록을 시작해요"}</IntroTitle>
            <IntroSub>{typeOpt.introSub}</IntroSub>
          </IntroHead>

          <SecHead>등록 절차</SecHead>
          <Flow>
            {flow.map((f, i) => (
              <FlowItem key={i} $last={i === flow.length - 1}>
                <FlowNo $on={i === 0}>{i + 1}</FlowNo>
                <FlowBody>
                  <FlowTitle>{f.title}</FlowTitle>
                  <FlowDesc>{f.desc}</FlowDesc>
                </FlowBody>
              </FlowItem>
            ))}
          </Flow>

          <SecHead>미리 준비해두면 좋아요</SecHead>
          <PrepList>
            {typeOpt.prep.map((t, i) => (
              <PrepItem key={i}><PrepDot /><span>{t}</span></PrepItem>
            ))}
          </PrepList>

          <NoteBox>
            회원이 예약을 요청하면 승인하시고, 이용요금은 앱에서 결제돼요.{"\n"}
            결제 대금은 플랫폼 이용료 {PLATFORM_FEE_LABEL}를 뺀 금액으로 정산 계좌에 지급돼요.
          </NoteBox>
          <StepHint>입력한 내용은 자동으로 저장돼요. 중간에 나가도 이어서 할 수 있어요.</StepHint>
        </Scroll>
        <Footer>
          <NextBtn type="button" onClick={goNext}>시작하기</NextBtn>
        </Footer>
      </Shell>
    );
  }

  return (
    <Shell>
      <Progress><Bar style={{ width: `${((step - LEAD_STEPS + 1) / CONTENT_TOTAL) * 100}%` }} /></Progress>
      <StepMeta>
        <StepGroup>{STEP_GROUP[id]}</StepGroup>
        <StepCount>{step - LEAD_STEPS + 1} / {CONTENT_TOTAL}</StepCount>
      </StepMeta>

      <Scroll>
        <StepTitle>{STEP_TITLE[id] || TITLES[id]}</StepTitle>
        {(STEP_SUB[id] || SUBS[id]) && <StepSub>{STEP_SUB[id] || SUBS[id]}</StepSub>}

        {id === "name" && (
          <>
            <Field>
              <Label>구장명</Label>
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={typeOpt.venueNamePlaceholder} autoFocus />
            </Field>
            <StepHint>지도 앱(네이버·카카오)에 올라간 이름과 같게 적으면 회원이 찾기 쉬워요.</StepHint>
          </>
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
            <StepHint>핀 위치가 회원 앱의 길찾기 목적지가 돼요. 건물 입구에 맞춰주세요.</StepHint>
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
            <CountLine $warn={photos.length < PHOTO_RECOMMEND}>
              {photos.length}장 등록됨 · {PHOTO_RECOMMEND}장 이상 권장
            </CountLine>
            <GuideBox>
              <GuideTitle>이렇게 찍으면 예약이 잘 들어와요</GuideTitle>
              <GuideItem>코트 전체가 들어간 전경 (가로로)</GuideItem>
              <GuideItem>바닥·골대 상태를 알 수 있는 사진</GuideItem>
              <GuideItem>출입구·주차장 등 처음 오는 사람이 헤매는 곳</GuideItem>
            </GuideBox>
            <StepHint>첫 번째 사진이 대표 사진으로 사용돼요.</StepHint>
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
                <Field>
                  <Label>과금 방식</Label>
                  <Select value={c.priceMode || "hourly"} onChange={(e) => setCourt(i, { priceMode: e.target.value })}>
                    <option value="hourly">코트 대관 — 시간당 금액</option>
                    <option value="perPerson">1인 요금 — 1인 시간당 × 인원</option>
                  </Select>
                </Field>
                {c.priceMode === "perPerson" ? (
                  <>
                    <Row>
                      <Field>
                        <Label>1인 시간당 가격(원)</Label>
                        <Input type="number" value={c.pricePerPerson} onChange={(e) => setCourt(i, { pricePerPerson: e.target.value })} placeholder="예: 5000" />
                        {payoutHint(c.pricePerPerson) ? <FieldHint>1인 기준 · {payoutHint(c.pricePerPerson)}</FieldHint> : null}
                      </Field>
                      <Field>
                        <Label>슬롯 단위(분)</Label>
                        <Select value={c.slotMinutes} onChange={(e) => setCourt(i, { slotMinutes: Number(e.target.value) })}>
                          <option value={30}>30분</option><option value={60}>60분</option><option value={90}>90분</option><option value={120}>120분</option>
                        </Select>
                      </Field>
                    </Row>
                    <Row>
                      <Field>
                        <Label>최소 인원 · 필수</Label>
                        <Input type="number" min="1" value={c.minHeadcount} onChange={(e) => setCourt(i, { minHeadcount: e.target.value })} placeholder="예: 8" />
                      </Field>
                      <Field>
                        <Label>정원 <Opt>(비우면 제한 없음)</Opt></Label>
                        <Input type="number" value={c.maxHeadcount} onChange={(e) => setCourt(i, { maxHeadcount: e.target.value })} placeholder="예: 20" />
                      </Field>
                    </Row>
                    {/* 최소 인원이 이 코트의 시간당 하한가 — 안 정하면 1명이 1인 요금만 내고 그 시간을 통째로 쓴다. */}
                    <FieldHint>
                      {(() => {
                        const heads = Math.floor(Number(c.minHeadcount) || 0);
                        const unit = Number(c.pricePerPerson) || 0;
                        const hours = Math.max(1, Math.round(((c.slotMinutes || 60) / 60) * 10) / 10);
                        if (!heads) return "최소 인원을 정해주세요. 정하지 않으면 1명이 1인 요금만 내고 그 시간을 통째로 쓸 수 있어요.";
                        if (!unit) return `최소 ${heads}명 · 1인 요금을 넣으면 보장 금액을 계산해 드려요.`;
                        return `${hours}시간 예약 기준 최소 ${(unit * heads * hours).toLocaleString()}원부터 받아요 (${heads}명 미만도 ${heads}명 요금).`;
                      })()}
                    </FieldHint>
                  </>
                ) : (
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
                )}
                <Field>
                  <Label>요일별 운영시간</Label>
                  <CourtHoursEditor hours={c.hours} onChange={(hours) => setCourt(i, { hours })} />
                </Field>
                <Field>
                  <Label>코트 소개 <Opt>{courts.length > 1 ? "(권장)" : "(선택)"}</Opt></Label>
                  <Textarea
                    rows={3}
                    value={c.description || ""}
                    onChange={(e) => setCourt(i, { description: e.target.value })}
                    placeholder={courts.length > 1
                      ? "다른 코트와 뭐가 다른지 적어주세요. 예: 천장이 높아 3점 슛 연습에 좋아요."
                      : "예: 정규 코트 1면. 천장고 7m, 전광판·벤치 있음."}
                  />
                  <FieldHint>회원이 보는 코트 정보에 그대로 나와요.</FieldHint>
                </Field>
                <Field>
                  {/* 코트가 여러 개면 필수 — 사진이 없으면 회원 화면에서 전부 같은 구장 사진으로 보인다. */}
                  <Label>코트 사진 <Opt>{courts.length > 1 ? "(필수)" : "(선택)"}</Opt></Label>
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
                  <FieldHint>
                    이 코트만 찍은 사진이에요. 회원이 코트를 고를 때 보여요.
                    {courts.length > 1 && (c.photos || []).length === 0
                      ? " 코트가 여러 개라 코트마다 1장은 필요해요 — 없으면 회원에게는 전부 같은 사진으로 보여요."
                      : ""}
                  </FieldHint>
                </Field>
              </CourtCard>
            ))}
            <HiddenFile ref={courtFileRef} type="file" accept="image/*" onChange={handleCourtFile} />
            <GhostBtn type="button" onClick={addCourt}>＋ 코트 추가</GhostBtn>
            <StepHint>예약은 코트 단위로 들어와요. 동시에 따로 빌려줄 수 있는 만큼 나눠서 등록해주세요.</StepHint>

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

        {/* 공개되는 번호와 비공개인 담당자 정보를 한 화면에 섞어 받던 자리다.
            어느 쪽이 회원에게 보이는지 헷갈려 개인 휴대폰을 대표번호에 적는 일이 있어 블록을 갈랐다. */}
        {id === "contact" && (
          <>
            <Block>
              <BlockHead>
                <BlockTitle>구장 대표번호</BlockTitle>
                <Tag $tone="open">예약자에게 공개</Tag>
              </BlockHead>
              <Field>
                <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="예: 02-1234-5678" inputMode="tel" />
              </Field>
              <StepHint>예약 확정 안내에 함께 나가는 번호예요. 개인 휴대폰 대신 구장 대표번호를 적어주세요.</StepHint>
            </Block>

            <Block>
              <BlockHead>
                <BlockTitle>{typeOpt.contactHead}</BlockTitle>
                <Tag $tone="closed">비공개 · 심사 확인용</Tag>
              </BlockHead>
              <Row>
                <Field><Label>{typeOpt.managerLabel}</Label><Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder={typeOpt.managerPlaceholder} /></Field>
                <Field><Label>담당자 연락처</Label><Input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="예: 010-1234-5678" inputMode="tel" /></Field>
              </Row>
              {!typeOpt.needsBizNo && (
                <Field><Label>담당 부서 <Opt>(선택)</Opt></Label><Input value={form.deptName} onChange={(e) => set({ deptName: e.target.value })} placeholder={isSchool ? "예: 체육부" : "예: 시설운영팀"} /></Field>
              )}
              <StepHint>
                심사 중 확인할 게 있으면 이 번호로 연락드려요. 회원에게는 보이지 않아요.
                {typeOpt.needsBizNo ? " 사업자등록증상 대표자명은 다음 단계에서 따로 받아요." : ""}
              </StepHint>
            </Block>
          </>
        )}

        {id === "verify" && (
          <>
            <NoteBox>{typeOpt.sellerNote}</NoteBox>

            {/* 사업자 — 국세청 진위확인으로 자동 승인까지 이어진다 */}
            {typeOpt.needsBizNo && (
              <>
                <Field><Label>{typeOpt.orgLabel}</Label>
                  <Input value={form.bizName} onChange={(e) => set({ bizName: e.target.value })} placeholder={typeOpt.orgPlaceholder} />
                  <FieldHint>사업자등록증에 적힌 상호 그대로 입력해주세요.</FieldHint>
                </Field>
                {/* 대표자명은 국세청 대조 값이라 담당자명과 같은 화면에 두면 매니저 이름이 들어와 자동 반려된다. */}
                <Field><Label>{typeOpt.personLabel}</Label>
                  <Input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder={typeOpt.personPlaceholder} />
                  <FieldHint>등록증상 대표자 이름이에요. 담당자가 달라도 여기는 대표자명을 적어야 확인이 통과돼요.</FieldHint>
                </Field>
                <Field><Label>사업자등록번호</Label>
                  <Input value={form.bizNo} onChange={(e) => set({ bizNo: formatBizNo(e.target.value) })} placeholder="123-45-67890" inputMode="numeric" />
                  {form.bizNo.trim() && !isValidBizNo(form.bizNo) && (
                    <ErrHint>사업자등록번호 10자리를 정확히 입력해주세요.</ErrHint>
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
                  <b>＋</b>
                  {uploading ? "올리는 중…" : "파일 첨부"}
                </DocUpload>
              )}
              <HiddenFile ref={licRef} type="file" accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadLicense(f); }} />
              <FieldHint>글자가 또렷하게 보이는 사진이면 돼요. 심사 용도로만 쓰고 회원에게 공개하지 않아요.</FieldHint>
            </Field>

            {!typeOpt.needsBizNo && (
              <StepHint>사업자등록번호는 받지 않아요. 제출하신 서류와 담당자 연락으로 확인해요.</StepHint>
            )}
          </>
        )}

        {/* 최종 확인 — 항목별로 그 값을 입력한 단계로 되돌아갈 수 있어야 한다.
            "뒤로 5번"으로 고치게 하면 오타 하나에도 제출을 미룬다. */}
        {id === "review" && (
          <>
            <RSec>
              <RHead><RTitle>구장 소개</RTitle><REdit type="button" onClick={() => goStep("name")}>수정</REdit></RHead>
              <RRow><b>운영 주체</b><span>{typeOpt.label}</span></RRow>
              <RRow><b>구장명</b><span>{form.name || "-"}</span></RRow>
              <RRow><b>주소</b><span>{form.address || "-"}{form.addressDetail ? ` ${form.addressDetail}` : ""}</span></RRow>
              <RRow><b>사진</b><span>{photos.length}장</span></RRow>
            </RSec>

            <RSec>
              <RHead><RTitle>운영 · 요금</RTitle><REdit type="button" onClick={() => goStep("courts")}>수정</REdit></RHead>
              {courts.map((c, i) => (
                <RRow key={i}>
                  <b>{c.name || `코트 ${i + 1}`}</b>
                  <span>
                    {c.priceMode === "perPerson"
                      ? `1인 ${won(c.pricePerPerson) || "-"}원 · 최소 ${c.minHeadcount || "-"}명`
                      : `시간당 ${won(c.pricePerHour) || "-"}원`}
                    {" · "}{c.slotMinutes || 60}분 단위
                  </span>
                </RRow>
              ))}
            </RSec>

            <RSec>
              <RHead><RTitle>연락처</RTitle><REdit type="button" onClick={() => goStep("contact")}>수정</REdit></RHead>
              <RRow><b>구장 대표번호</b><span>{form.phone || "-"}</span></RRow>
              <RRow><b>{typeOpt.managerLabel}</b><span>{form.contactName || "-"} · {form.contactPhone || "-"}</span></RRow>
              {!typeOpt.needsBizNo && form.deptName && <RRow><b>담당 부서</b><span>{form.deptName}</span></RRow>}
            </RSec>

            <RSec>
              <RHead><RTitle>{typeOpt.verifyTitle}</RTitle><REdit type="button" onClick={() => goStep("verify")}>수정</REdit></RHead>
              <RRow><b>{typeOpt.orgLabel}</b><span>{form.bizName || "-"}</span></RRow>
              {typeOpt.needsBizNo ? (
                <>
                  <RRow><b>{typeOpt.personLabel}</b><span>{form.ownerName || "-"}</span></RRow>
                  <RRow><b>사업자번호</b><span>{form.bizNo || "-"}</span></RRow>
                  <RRow><b>개업일자</b><span>{biz.openDate || "-"} · {biz.taxType === "general" ? "일반과세자" : "간이과세자"}</span></RRow>
                </>
              ) : isSchool && pickedSchool ? (
                <RRow><b>학교 대표번호</b><span>{pickedSchool.tel || "-"}</span></RRow>
              ) : null}
              <RRow><b>{typeOpt.docLabel}</b><span>{biz.licenseUrl ? "첨부됨" : "없음"}</span></RRow>
            </RSec>

            <SecHead>제출하면 이렇게 진행돼요</SecHead>
            <Flow>
              {flow.slice(2).map((f, i) => (
                <FlowItem key={i} $last={i === flow.length - 3}>
                  <FlowNo $on={i === 0}>{i + 3}</FlowNo>
                  <FlowBody>
                    <FlowTitle>{f.title}</FlowTitle>
                    <FlowDesc>{f.desc}</FlowDesc>
                  </FlowBody>
                </FlowItem>
              ))}
            </Flow>
            <StepHint>편의시설·이용안내·키워드는 승인 후 구장정보에서 언제든 채울 수 있어요.</StepHint>
          </>
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
  courts: "예약받을 코트를 등록해요",
  review: "입력한 내용을 확인해요",
};
// 운영 주체별로 갈리는 문구(제목·안내·플레이스홀더)는 constants/ownerType.js 표에 모아뒀다.
const SUBS = {
  location: "지도를 움직여 핀을 맞추면 주소가 자동으로 입력돼요.",
  photos: "구장 전경, 코트, 시설 사진을 올려주세요. (여러 장 가능)",
  courts: "코트마다 종류·바닥·가격·운영시간을 따로 설정해요.",
};

/* 구장주 앱은 고정 팔레트(od.js C)로 통일돼 있다 — 이 화면만 앱 테마를 따르면
   다크모드에서 워크스페이스와 배경·글자색이 어긋난다. */
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  background: ${C.white};
`;
const Progress = styled.div`
  height: 4px;
  background: ${C.slate200};
  flex-shrink: 0;
`;
const Bar = styled.div`
  height: 100%;
  background: ${C.violet600};
  border-radius: 0 4px 4px 0;
  transition: width 0.3s ease;
`;
const StepMeta = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px max(18px, env(safe-area-inset-left)) 0 max(18px, env(safe-area-inset-right));
`;
const StepGroup = styled.span`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: ${C.violet600};
`;
const StepCount = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${C.slate400};
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px max(18px, env(safe-area-inset-left)) 24px max(18px, env(safe-area-inset-right));
  display: flex;
  flex-direction: column;
  gap: 14px;
`;
const StepTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${C.slate800};
  line-height: 1.35;
  word-break: keep-all;
`;
const StepSub = styled.div`
  font-size: 14px;
  color: ${C.slate500};
  line-height: 1.5;
  margin-top: -6px;
  word-break: keep-all;
`;
const StepHint = styled.div`
  font-size: 12.5px;
  color: ${C.slate500};
  line-height: 1.5;
  word-break: keep-all;
`;
const ErrHint = styled.div`
  font-size: 12.5px;
  font-weight: 600;
  color: ${C.red500};
  line-height: 1.5;
`;
const SubHead = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${C.slate800};
  margin-top: 6px;
`;
const SecHead = styled.div`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: ${C.slate400};
  margin-top: 6px;
`;
const Opt = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${C.slate400};
`;
const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px max(18px, env(safe-area-inset-left)) calc(14px + env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-right));
  border-top: 1px solid ${C.slate200};
  background: ${C.white};
`;
const BackText = styled.button`
  background: none;
  border: none;
  color: ${C.slate500};
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
  background: ${C.violet600};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: ${C.violet700}; }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* ── 인트로: 준비물 · 등록 절차 순서도 ── */
const IntroHead = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 12px 0 6px;
`;
const IntroLogo = styled.img`width: 64px; height: 64px; object-fit: contain;`;
const TypeTag = styled.div`
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid ${C.slate200};
  background: ${C.slate100};
  color: ${C.slate500};
  font-size: 12.5px;
  font-weight: 700;
`;
const IntroTitle = styled.div`
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${C.slate800};
`;
const IntroSub = styled.div`
  font-size: 14px;
  color: ${C.slate500};
  line-height: 1.55;
  word-break: keep-all;
`;
const Flow = styled.div`
  display: flex;
  flex-direction: column;
`;
const FlowItem = styled.div`
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: ${({ $last }) => ($last ? 0 : "16px")};

  /* 단계를 잇는 세로선 — 순서가 있는 절차라는 걸 모양만으로 읽히게 한다 */
  &::before {
    content: "";
    display: ${({ $last }) => ($last ? "none" : "block")};
    position: absolute;
    left: 13px;
    top: 26px;
    bottom: 4px;
    width: 1px;
    background: ${C.slate200};
  }
`;
const FlowNo = styled.div`
  flex-shrink: 0;
  width: 27px;
  height: 27px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  font-weight: 800;
  border: 1px solid ${({ $on }) => ($on ? C.violet600 : C.slate200)};
  background: ${({ $on }) => ($on ? C.violet600 : C.white)};
  color: ${({ $on }) => ($on ? "#fff" : C.slate400)};
`;
const FlowBody = styled.div`display: flex; flex-direction: column; gap: 2px; padding-top: 3px;`;
const FlowTitle = styled.div`font-size: 14.5px; font-weight: 700; color: ${C.slate800};`;
const FlowDesc = styled.div`font-size: 12.5px; color: ${C.slate500}; line-height: 1.5; word-break: keep-all;`;

const PrepList = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const PrepItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 13.5px;
  color: ${C.slate800};
  line-height: 1.45;
  word-break: keep-all;
`;
const PrepDot = styled.span`
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  margin-top: 7px;
  border-radius: 999px;
  background: ${C.violet600};
`;
const NoteBox = styled.div`
  border: 1px solid ${C.slate200};
  background: ${C.slate100};
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: ${C.slate500};
  line-height: 1.6;
  white-space: pre-line;
  word-break: keep-all;
`;

/* ── 연락처 단계: 공개/비공개 블록 ── */
const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 14px;
`;
const BlockHead = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 8px;`;
const BlockTitle = styled.div`font-size: 14.5px; font-weight: 700; color: ${C.slate800};`;
const Tag = styled.span`
  flex-shrink: 0;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  border: 1px solid ${({ $tone }) => ($tone === "open" ? C.violet200 : C.slate200)};
  color: ${({ $tone }) => ($tone === "open" ? C.violet600 : C.slate400)};
  background: ${({ $tone }) => ($tone === "open" ? C.violet50 : C.white)};
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
  background: ${C.slate100};
  border: 1px solid ${C.slate200};
`;
const PhotoImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const MainTag = styled.span`
  position: absolute; left: 6px; bottom: 6px;
  padding: 2px 8px; border-radius: 999px;
  background: ${C.violet600}; color: #fff;
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
  border: 1.5px dashed ${C.slate200};
  background: ${C.white};
  color: ${C.slate400};
  font-size: 13px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
`;
const HiddenFile = styled.input`display: none;`;
const CountLine = styled.div`
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ $warn }) => ($warn ? C.amber500 : C.green600)};
`;
const GuideBox = styled.div`
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const GuideTitle = styled.div`font-size: 13px; font-weight: 700; color: ${C.slate800};`;
const GuideItem = styled.div`
  font-size: 12.5px;
  color: ${C.slate500};
  line-height: 1.45;
  padding-left: 10px;
  position: relative;
  word-break: keep-all;
  &::before { content: "·"; position: absolute; left: 2px; }
`;

const CourtCard = styled.div`
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const CourtHead = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const DelLink = styled.button`
  border: none; background: transparent; color: ${C.red500};
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
  border: 1px solid ${C.slate200};
  background: ${C.white};
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  &:active { transform: translateY(1px); }
`;
const PickedBox = styled.div`
  border: 1px solid ${C.violet600};
  background: ${C.violet50};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;
const PickedName = styled.div`
  font-size: 13.5px;
  font-weight: 700;
  color: ${C.slate800};
`;
const PickedMeta = styled.div`
  font-size: 12px;
  line-height: 1.45;
  color: ${C.slate500};
`;
/* 서류 첨부 — 가로 꽉 찬 버튼이 아니라 정사각 슬롯.
   "여기에 사진 한 장이 들어간다"가 모양만으로 읽히고, 첨부 전/후가 같은 자리에서 바뀐다. */
const DocUpload = styled.button`
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  border: 1px dashed ${C.violet300};
  background: transparent;
  color: ${C.violet600};
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.3;
  cursor: pointer;
  & > b { font-size: 22px; font-weight: 400; line-height: 1; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const DocDone = styled.div`
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  border: 1px solid ${C.violet600};
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  color: ${C.violet600};
`;

const KeywordRow = styled.div`display: flex; gap: 8px; & > *:first-child { flex: 1; }`;
const AddKw = styled.button`
  flex-shrink: 0;
  height: 44px; padding: 0 18px; border-radius: 10px; border: none;
  background: ${C.violet600}; color: #fff;
  font-size: 14px; font-weight: 700; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* 최종 확인 — 섹션마다 그 값을 입력한 단계로 되돌아가는 수정 버튼 */
const RSec = styled.div`
  display: flex; flex-direction: column;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  overflow: hidden;
`;
const RHead = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  background: ${C.slate100};
  border-bottom: 1px solid ${C.slate200};
`;
const RTitle = styled.div`font-size: 13px; font-weight: 800; color: ${C.slate800};`;
const REdit = styled.button`
  border: none; background: transparent; color: ${C.violet600};
  font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 2px 4px;
  text-decoration: underline; text-underline-offset: 3px;
`;
const RRow = styled.div`
  display: flex; justify-content: space-between; gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid ${C.slate200};
  font-size: 13.5px;
  &:last-of-type { border-bottom: none; }
  & b { color: ${C.slate500}; font-weight: 600; flex-shrink: 0; }
  & span { color: ${C.slate800}; font-weight: 600; text-align: right; word-break: break-all; }
`;
