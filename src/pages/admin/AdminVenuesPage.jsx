/* eslint-disable */
// src/pages/admin/AdminVenuesPage.jsx
// 구장 관리 — 추천구장 + 구장주 신청을 한 테이블로 통합.
// 상태 표시/변경(신청·승인·반려), 페이지네이션, 상세보기(구장주 입력 전체 정보), 삭제.
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { createVenue, updateVenue, deleteVenue, uploadVenueImage } from "../../services/venuesService";
import {
  listAllVenuesAdmin,
  setVenueStatus,
  setBusinessStatus,
  updateMyVenue,
  defaultCourtHours,
  FACILITY_OPTIONS,
  DAY_KEYS,
  DAY_LABELS,
} from "../../services/ownerVenueService";
import CourtHoursEditor from "../owner/components/CourtHoursEditor";
import {
  MdLocalParking, MdShower, MdWc, MdMeetingRoom, MdLocalDrink,
  MdSportsBasketball, MdCheckroom, MdAcUnit, MdEventSeat, MdWifi, MdCheckCircle,
} from "react-icons/md";

const FACILITY_ICONS = {
  "주차장": MdLocalParking,
  "샤워실": MdShower,
  "화장실": MdWc,
  "탈의실": MdMeetingRoom,
  "음료판매": MdLocalDrink,
  "농구공 대여": MdSportsBasketball,
  "조끼 대여": MdCheckroom,
  "냉난방": MdAcUnit,
  "관람석": MdEventSeat,
  "와이파이": MdWifi,
};

const PAGE_SIZE = 8;

const STATUS_META = {
  pending: { label: "신청중", bg: "#fef3c7", color: "#a16207" },
  approved: { label: "승인", bg: "#dcfce7", color: "#15803d" },
  rejected: { label: "반려", bg: "#fee2e2", color: "#b91c1c" },
};
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "신청중" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];

function fmtYmd(d) {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${dd}`;
}
function won(n) {
  const v = Number(n) || 0;
  return v ? `${v.toLocaleString()}원` : "무료";
}

/* ───────────── styles ───────────── */
const Page = styled.div`display: flex; flex-direction: column; gap: 16px;`;
const HeaderRow = styled.div`
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
`;
const Title = styled.h1`margin: 0; font-size: 18px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Sub = styled.div`font-size: 12px; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"}; margin-top: 4px;`;
const PrimaryHeaderBtn = styled.button`
  height: 36px; padding: 0 16px; border-radius: 8px; border: none;
  background: ${({ theme }) => theme?.colors?.primary || "#4f46e5"}; color: #fff;
  font-size: 13px; font-weight: 600; cursor: pointer;
  &:active { transform: translateY(1px); }
`;
const Card = styled.section`
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 10px; padding: 14px;
`;
const FilterRow = styled.div`display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;`;
const Chip = styled.button`
  height: 32px; padding: 0 14px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on, theme }) => ($on ? "#fff" : (theme?.colors?.textNormal || "#4b5563"))};
`;

const Table = styled.div`width: 100%; display: flex; flex-direction: column;`;
const HeadRow = styled.div`
  display: grid;
  grid-template-columns: 56px 1fr 80px 96px 64px 92px 220px;
  gap: 10px; align-items: center;
  padding: 0 8px 10px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 11.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  @media (max-width: 860px) { grid-template-columns: 44px 1fr 70px 150px; }
`;
const Rowi = styled.div`
  display: grid;
  grid-template-columns: 56px 1fr 80px 96px 64px 92px 220px;
  gap: 10px; align-items: center;
  padding: 10px 8px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.divider || "#f1f5f9"};
  font-size: 13px;
  @media (max-width: 860px) { grid-template-columns: 44px 1fr 70px 150px; }
`;
const Thumb = styled.div`
  width: 56px; height: 40px; border-radius: 6px; overflow: hidden;
  background: ${({ theme }) => theme?.colors?.surface || "#f3f4f6"};
  @media (max-width: 860px) { width: 44px; height: 34px; }
`;
const ThumbImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const NameCell = styled.div`min-width: 0;`;
const Nm = styled.div`font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Addr = styled.div`font-size: 11.5px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Hide = styled.span`@media (max-width: 860px) { display: none; }`;
const StatusBadge = styled.span`
  display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 700; background: ${({ $bg }) => $bg}; color: ${({ $c }) => $c};
`;
const SourceTag = styled.span`
  font-size: 11px; font-weight: 600;
  color: ${({ $owner, theme }) => ($owner ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.textWeak || "#9ca3af"))};
`;
const Actions = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
const SBtn = styled.button`
  height: 30px; padding: 0 10px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid ${({ $primary, $danger, theme }) =>
    $primary ? "transparent" : $danger ? "#fecaca" : (theme?.colors?.border || "#e5e7eb")};
  background: ${({ $primary, $danger, theme }) =>
    $primary ? (theme?.colors?.primary || "#4f46e5") : $danger ? "#fef2f2" : (theme?.colors?.card || "#fff")};
  color: ${({ $primary, $danger, theme }) =>
    $primary ? "#fff" : $danger ? "#b91c1c" : (theme?.colors?.textNormal || "#374151")};
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const EmptyText = styled.div`padding: 28px 0; text-align: center; font-size: 13px; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;

const Pager = styled.div`display: flex; justify-content: center; gap: 6px; margin-top: 14px;`;
const PageNum = styled.button`
  min-width: 32px; height: 32px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 600;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on, theme }) => ($on ? "#fff" : (theme?.colors?.textNormal || "#4b5563"))};
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

/* modal */
const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 99999; background: rgba(15,23,42,0.45);
  display: grid; place-items: center; padding: 16px; overflow-y: auto;
`;
const Modal = styled.div`
  width: min(720px, 96vw); max-height: calc(100vh - 32px); overflow-y: auto;
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border-radius: 12px; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; padding: 18px;
`;
const ModalHead = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px;`;
const ModalTitle = styled.div`font-size: 16px; font-weight: 800; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; display: flex; align-items: center; gap: 8px;`;
const Close = styled.button`width: 32px; height: 32px; border-radius: 999px; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; background: transparent; font-size: 18px; cursor: pointer; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const Gallery = styled.div`display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px;`;
const GImg = styled.img`width: 150px; height: 100px; object-fit: cover; border-radius: 8px; flex-shrink: 0; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};`;
const Sec = styled.div`margin-bottom: 16px;`;
const SecTitle = styled.div`font-size: 12px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; margin-bottom: 8px; letter-spacing: 0.3px;`;
const DRow = styled.div`display: flex; gap: 10px; font-size: 13px; padding: 4px 0; & > b { width: 90px; flex-shrink: 0; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; font-weight: 600; } & > span { color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; }`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const FacChip = styled.span`padding: 5px 11px; border-radius: 999px; background: ${({ theme }) => theme?.colors?.surface || "#f3f4f6"}; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; font-size: 12px;`;
const CourtBox = styled.div`border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 10px; padding: 12px; margin-bottom: 8px;`;
const CourtTop = styled.div`display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 8px;`;
const Hours = styled.div`display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; @media (max-width: 560px){ grid-template-columns: repeat(4, 1fr); }`;
const HourCell = styled.div`
  text-align: center; font-size: 10.5px; padding: 5px 2px; border-radius: 6px;
  background: ${({ $closed, theme }) => ($closed ? "#fef2f2" : (theme?.colors?.surface || "#f3f4f6"))};
  color: ${({ $closed }) => ($closed ? "#b91c1c" : "inherit")};
  & b { display: block; font-size: 11px; margin-bottom: 2px; }
`;
const Pre = styled.div`font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const ModalActions = styled.div`display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid ${({ theme }) => theme?.colors?.divider || "#f1f5f9"}; padding-top: 14px; margin-top: 4px;`;

/* 추천구장 생성 폼 */
const FormField = styled.label`display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;`;
const FLabel = styled.span`font-size: 12px; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const FInput = styled.input`height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; background: ${({ theme }) => theme?.colors?.card || "#fff"}; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; font-size: 13px; font-family: inherit;`;
const FTextarea = styled.textarea`min-height: 60px; padding: 10px 12px; border-radius: 8px; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; background: ${({ theme }) => theme?.colors?.card || "#fff"}; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; font-size: 13px; font-family: inherit; resize: vertical;`;
const FSelect = styled.select`height: 38px; padding: 0 10px; border-radius: 8px; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; background: ${({ theme }) => theme?.colors?.card || "#fff"}; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; font-size: 13px;`;
const FRow = styled.div`display: flex; gap: 10px; & > * { flex: 1; }`;
const Hidden = styled.input`display: none;`;
const Notice = styled.div`
  font-size: 12px; line-height: 1.5; padding: 10px 12px; margin-bottom: 12px;
  border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e;
`;
const FormSecTitle = styled.div`
  font-size: 13px; font-weight: 800; margin: 16px 0 8px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  &:first-child { margin-top: 0; }
`;
const FormTabs = styled.div`
  display: flex; gap: 4px; margin-bottom: 12px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;
const FormTab = styled.button`
  flex: 1; height: 40px; border: none; background: transparent; cursor: pointer;
  font-size: 13.5px; font-weight: 700; position: relative;
  color: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.textWeak || "#9ca3af"))};
  &::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
    background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")}; }
`;
const TabBody = styled.div`min-height: 240px;`;
const BizBox = styled.div`
  margin-top: 12px; padding: 12px; border-radius: 10px;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;
const BizStatus = styled.span`
  font-weight: 700;
  color: ${({ $s }) => ($s === "verified" ? "#15803d" : $s === "pending" ? "#a16207" : $s === "rejected" ? "#b91c1c" : "#6b7280")};
`;
const PhotoStrip = styled.div`display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 10px;`;
const PhotoBox = styled.div`position: relative; flex: 0 0 auto; width: 104px; height: 78px; border-radius: 8px; overflow: hidden; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};`;
const PhotoImg2 = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const RemovePhoto = styled.button`position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 999px; border: none; background: rgba(0,0,0,0.6); color: #fff; font-size: 12px; line-height: 1; cursor: pointer;`;
const AddPhoto = styled.button`flex: 0 0 auto; width: 104px; height: 78px; border-radius: 8px; border: 1.5px dashed ${({ theme }) => theme?.colors?.border || "#d1d5db"}; background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"}; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; font-size: 12px; cursor: pointer;`;
const FacWrap = styled.div`display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;`;
const FacBtn = styled.button`
  display: inline-flex; align-items: center; gap: 7px;
  padding: 11px 15px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on, theme }) => ($on ? "#fff" : (theme?.colors?.textNormal || "#4b5563"))};
  & svg { font-size: 18px; flex-shrink: 0; }
  &:active { transform: translateY(1px); }
`;
const CourtCard = styled.div`border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 10px; padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 10px;`;
const CourtHead = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const DelLink = styled.button`border: none; background: transparent; color: #b91c1c; font-size: 12.5px; font-weight: 700; cursor: pointer;`;
const GhostBtn = styled.button`height: 38px; border-radius: 8px; border: 1.5px dashed ${({ theme }) => theme?.colors?.border || "#d1d5db"}; background: transparent; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"}; font-size: 13px; font-weight: 700; cursor: pointer; width: 100%;`;

function emptyForm() {
  return {
    id: null, ownerUid: null,
    name: "", address: "", addressDetail: "", region: "", phone: "",
    lat: "", lng: "", imageUrl: "", storagePath: "",
    type: "indoor", cost: "free", active: true, order: 0,
    description: "", rules: "", refundPolicy: "",
    ownerName: "", contactPhone: "", bizName: "", bizNo: "",
    business: null,
  };
}
function makeCourt(idx) {
  return { name: `${idx + 1}코트`, type: "indoor", pricePerHour: "", slotMinutes: 60, hours: defaultCourtHours() };
}

export default function AdminVenuesPage() {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  // 구장 등록/수정 폼 (추천구장 + 구장주구장 공통, 전체 데이터 편집)
  const [form, setForm] = useState(emptyForm());
  const [photos, setPhotos] = useState([]);       // [{url, storagePath}]
  const [facilities, setFacilities] = useState([]); // [string]
  const [courts, setCourts] = useState([]);       // [{name,type,pricePerHour,slotMinutes,hours}]
  const [formOpen, setFormOpen] = useState(false);
  const [formTab, setFormTab] = useState("basic");
  const [uploading, setUploading] = useState(false);
  const isEditing = !!form.id;

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAllVenuesAdmin();
      setList(rows);
    } catch (e) {
      console.error("[AdminVenuesPage] load failed", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [filter]);

  const filtered = useMemo(
    () => list.filter((v) => filter === "all" || v.status === filter),
    [list, filter]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const counts = useMemo(() => ({
    pending: list.filter((v) => v.status === "pending").length,
    approved: list.filter((v) => v.status === "approved").length,
    rejected: list.filter((v) => v.status === "rejected").length,
  }), [list]);

  const changeStatus = async (row, status) => {
    let reason = "";
    if (status === "rejected") {
      reason = window.prompt(`"${row.name}" 반려 사유 (구장주에게 표시):`, row.rejectReason || "");
      if (reason === null) return;
    } else if (status === "approved") {
      if (!window.confirm(`"${row.name}" 승인할까요? 승인 시 사용자에게 노출됩니다.`)) return;
    }
    setBusy(true);
    try {
      await setVenueStatus(row.id, status, reason);
      await load();
    } catch (e) {
      window.alert(e?.message || "상태 변경 실패");
    } finally { setBusy(false); }
  };

  const handleBizStatus = async (row, status) => {
    let reason = "";
    if (status === "rejected") {
      reason = window.prompt(`"${row.name}" 사업자 인증 반려 사유:`, row.business?.rejectReason || "");
      if (reason === null) return;
    } else if (status === "verified") {
      if (!window.confirm(`"${row.name}" 사업자 인증을 승인할까요? 승인 시 구장주가 정산 계좌를 등록할 수 있어요.`)) return;
    }
    setBusy(true);
    try {
      await setBusinessStatus(row.id, status, reason);
      await load();
      // 수정 폼이 이 구장을 열고 있으면 폼의 사업자 인증 상태도 갱신
      setForm((f) => (f.id === row.id
        ? { ...f, business: { ...(f.business || {}), status, rejectReason: status === "rejected" ? reason : "" } }
        : f));
    } catch (e) {
      window.alert(e?.message || "상태 변경 실패");
    } finally { setBusy(false); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`"${row.name || row.id}" 구장을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      await deleteVenue({ id: row.id, storagePath: row.storagePath });
      await load();
      if (form.id === row.id) closeForm();
    } catch (e) {
      window.alert(e?.message || "삭제 실패");
    } finally { setBusy(false); }
  };

  /* 구장 생성/수정 (전체 데이터) */
  const updateForm = (p) => setForm((prev) => ({ ...prev, ...p }));
  const resetForm = () => { setForm(emptyForm()); setPhotos([]); setFacilities([]); setCourts([]); };
  const openCreate = () => { resetForm(); setFormTab("basic"); setFormOpen(true); };
  const closeForm = () => { resetForm(); setFormOpen(false); };
  const pickImage = () => { if (!busy && !uploading) fileRef.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    setUploading(true);
    try {
      const { imageUrl, storagePath } = await uploadVenueImage(file);
      setPhotos((prev) => [...prev, { url: imageUrl, storagePath }]);
    } catch (err) { window.alert(err?.message || "업로드 실패"); }
    finally { setUploading(false); }
  };
  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const toggleFacility = (f) =>
    setFacilities((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const setCourt = (i, patch) => setCourts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCourt = () => setCourts((prev) => [...prev, makeCourt(prev.length)]);
  const removeCourt = (i) => setCourts((prev) => prev.filter((_, idx) => idx !== i));

  const saveForm = async () => {
    if (!form.name.trim()) return window.alert("구장명을 입력해주세요.");
    if (!form.address.trim()) return window.alert("주소를 입력해주세요.");
    if (courts.some((c) => !c.name.trim())) return window.alert("코트 이름을 모두 입력해주세요.");
    setBusy(true);
    try {
      const venueType = courts[0]?.type || form.type || "indoor";
      if (isEditing) {
        // 수정 — 전체 필드 저장(updateMyVenue: 리치필드/코트/사진/편의시설/사업자정보)
        await updateMyVenue(form.id, {
          name: form.name.trim(),
          address: form.address.trim(),
          addressDetail: form.addressDetail?.trim() || "",
          region: form.region || "",
          phone: form.phone || "",
          lat: form.lat === "" ? null : Number(form.lat),
          lng: form.lng === "" ? null : Number(form.lng),
          photos: photos.map((p) => p.url),
          storagePaths: photos.map((p) => p.storagePath),
          facilities,
          courts,
          description: form.description || "",
          rules: form.rules || "",
          refundPolicy: form.refundPolicy || "",
          ownerName: form.ownerName || "",
          contactPhone: form.contactPhone || "",
          bizName: form.bizName || "",
          bizNo: form.bizNo || "",
        });
        // updateMyVenue 가 다루지 않는 type/cost/active 는 venuesService 로 보완 저장
        await updateVenue(form.id, { type: venueType, cost: form.cost, active: !!form.active });
      } else {
        // 신규 추천구장 — 기본 정보로 생성 후, 리치필드가 있으면 추가 저장
        const created = await createVenue({
          name: form.name.trim(), address: form.address.trim(), addressDetail: form.addressDetail,
          lat: form.lat, lng: form.lng, imageUrl: photos[0]?.url || "", storagePath: photos[0]?.storagePath || "",
          type: venueType, cost: form.cost, memo: form.description, order: form.order, active: !!form.active,
        });
        const newId = created?.id || created;
        if (newId && (photos.length || facilities.length || courts.length || form.description || form.rules)) {
          await updateMyVenue(newId, {
            photos: photos.map((p) => p.url), storagePaths: photos.map((p) => p.storagePath),
            facilities, courts, description: form.description || "", rules: form.rules || "",
            refundPolicy: form.refundPolicy || "", phone: form.phone || "", region: form.region || "",
          });
        }
      }
      closeForm(); await load();
    } catch (e) { window.alert(e?.message || "저장 실패"); }
    finally { setBusy(false); }
  };

  // 추천구장·구장주구장 공통 수정 진입 — 전체 데이터 프리필
  const editVenue = (row) => {
    setForm({
      id: row.id, ownerUid: row.ownerUid || null,
      name: row.name || "", address: row.address || "", addressDetail: row.addressDetail || "",
      region: row.region || "", phone: row.phone || "",
      lat: row.lat ?? "", lng: row.lng ?? "",
      imageUrl: row.imageUrl || "", storagePath: row.storagePath || "",
      type: row.type || "indoor", cost: row.cost || "free", active: row.active !== false, order: row.order || 0,
      description: row.description || "", rules: row.rules || "", refundPolicy: row.refundPolicy || "",
      ownerName: row.ownerName || "", contactPhone: row.contactPhone || "",
      bizName: row.bizName || "", bizNo: row.bizNo || "",
      business: row.business || null,
    });
    setPhotos(
      row.photos?.length
        ? row.photos.map((url, i) => ({ url, storagePath: row.storagePaths?.[i] || "" }))
        : row.imageUrl ? [{ url: row.imageUrl, storagePath: row.storagePath || "" }] : []
    );
    setFacilities(row.facilities || []);
    setCourts(
      (row.courts || []).map((c, i) => ({
        name: c.name || `${i + 1}코트`, type: c.type || "indoor",
        pricePerHour: String(c.pricePerHour ?? ""), slotMinutes: c.slotMinutes || 60,
        hours: c.hours || defaultCourtHours(),
      }))
    );
    setFormTab("basic");
    setFormOpen(true);
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>구장 관리</Title>
          <Sub>추천 구장과 구장주 신청을 한 곳에서 관리합니다. 승인된 구장만 사용자에게 노출됩니다.</Sub>
        </div>
        <PrimaryHeaderBtn type="button" onClick={openCreate}>+ 추천 구장 등록</PrimaryHeaderBtn>
      </HeaderRow>

      <Card>
        <FilterRow>
          {FILTERS.map((f) => (
            <Chip key={f.key} $on={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
              {f.key !== "all" && counts[f.key] > 0 ? ` ${counts[f.key]}` : ""}
            </Chip>
          ))}
        </FilterRow>

        {loading ? (
          <AdminLoading />
        ) : filtered.length === 0 ? (
          <EmptyText>해당하는 구장이 없습니다.</EmptyText>
        ) : (
          <Table>
            <HeadRow>
              <span></span>
              <span>구장명 / 주소</span>
              <span>상태</span>
              <Hide>출처</Hide>
              <Hide>코트</Hide>
              <Hide>등록일</Hide>
              <span>관리</span>
            </HeadRow>

            {pageRows.map((row) => {
              const sm = STATUS_META[row.status] || STATUS_META.approved;
              const isOwner = !!row.ownerUid;
              return (
                <Rowi key={row.id}>
                  <Thumb>{row.imageUrl ? <ThumbImg src={row.imageUrl} alt="" /> : null}</Thumb>
                  <NameCell>
                    <Nm>{row.name || "(이름 없음)"}</Nm>
                    <Addr>{row.address}{row.addressDetail ? ` ${row.addressDetail}` : ""}</Addr>
                  </NameCell>
                  <span><StatusBadge $bg={sm.bg} $c={sm.color}>{sm.label}</StatusBadge></span>
                  <Hide><SourceTag $owner={isOwner}>{isOwner ? "구장주 신청" : "추천"}</SourceTag></Hide>
                  <Hide>{row.courts?.length ? `${row.courts.length}개` : "-"}</Hide>
                  <Hide>{fmtYmd(row.createdAt)}</Hide>
                  <Actions>
                    {row.status !== "approved" && <SBtn $primary onClick={() => changeStatus(row, "approved")} disabled={busy}>승인</SBtn>}
                    {row.status !== "rejected" && <SBtn $danger onClick={() => changeStatus(row, "rejected")} disabled={busy}>반려</SBtn>}
                    {row.status !== "pending" && <SBtn onClick={() => changeStatus(row, "pending")} disabled={busy}>대기</SBtn>}
                    <SBtn onClick={() => editVenue(row)}>수정</SBtn>
                    <SBtn $danger onClick={() => handleDelete(row)} disabled={busy}>삭제</SBtn>
                  </Actions>
                </Rowi>
              );
            })}
          </Table>
        )}

        {!loading && filtered.length > 0 && (
          <Pager>
            <PageNum onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</PageNum>
            {Array.from({ length: pageCount }, (_, i) => (
              <PageNum key={i} $on={i === page} onClick={() => setPage(i)}>{i + 1}</PageNum>
            ))}
            <PageNum onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>›</PageNum>
          </Pager>
        )}
      </Card>

      {/* 추천 구장 등록/수정 폼 */}
      {formOpen && (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget && !busy && !uploading) closeForm(); }}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <ModalTitle>{form.ownerUid ? "구장 정보 수정" : isEditing ? "추천 구장 수정" : "추천 구장 등록"}</ModalTitle>
              <Close type="button" onClick={closeForm} disabled={busy || uploading}>×</Close>
            </ModalHead>

            {form.ownerUid && (
              <Notice>구장주가 등록한 구장입니다. 여기서 수정하면 구장주 화면·사용자 노출에도 그대로 반영됩니다.</Notice>
            )}

            <FormTabs>
              {[
                { k: "basic", label: "기본 정보" },
                { k: "facility", label: "편의시설" },
                { k: "courts", label: "코트" },
                { k: "info", label: "안내" },
                { k: "biz", label: "사업자" },
              ].map((t) => (
                <FormTab key={t.k} type="button" $on={formTab === t.k} onClick={() => setFormTab(t.k)}>{t.label}</FormTab>
              ))}
            </FormTabs>

            <TabBody>
              {formTab === "basic" && (
                <>
                  <FormSecTitle>구장 사진</FormSecTitle>
                  <PhotoStrip>
                    {photos.map((p, i) => (
                      <PhotoBox key={i}>
                        <PhotoImg2 src={p.url} alt={`사진 ${i + 1}`} />
                        <RemovePhoto type="button" onClick={() => removePhoto(i)}>×</RemovePhoto>
                      </PhotoBox>
                    ))}
                    <AddPhoto type="button" onClick={pickImage} disabled={uploading}>
                      {uploading ? "업로드 중…" : "＋ 사진"}
                    </AddPhoto>
                  </PhotoStrip>

                  <FormSecTitle>기본 정보</FormSecTitle>
                  <FormField><FLabel>구장명</FLabel><FInput value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="예: 고려대 화정체육관" /></FormField>
                  <FormField><FLabel>주소</FLabel><FInput value={form.address} onChange={(e) => updateForm({ address: e.target.value })} placeholder="예: 서울 성북구 고려대로 1" /></FormField>
                  <FormField><FLabel>상세 주소</FLabel><FInput value={form.addressDetail} onChange={(e) => updateForm({ addressDetail: e.target.value })} placeholder="예: 지하 1층 농구코트" /></FormField>
                  <FRow>
                    <FormField><FLabel>지역</FLabel><FInput value={form.region} onChange={(e) => updateForm({ region: e.target.value })} placeholder="예: 서울 성북구" /></FormField>
                    <FormField><FLabel>구장 연락처</FLabel><FInput value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} placeholder="예: 02-1234-5678" /></FormField>
                  </FRow>
                  <FRow>
                    <FormField><FLabel>위도</FLabel><FInput type="number" step="any" value={form.lat} onChange={(e) => updateForm({ lat: e.target.value })} placeholder="37.5896" /></FormField>
                    <FormField><FLabel>경도</FLabel><FInput type="number" step="any" value={form.lng} onChange={(e) => updateForm({ lng: e.target.value })} placeholder="127.0297" /></FormField>
                  </FRow>
                  <FRow>
                    <FormField><FLabel>종류</FLabel><FSelect value={form.type} onChange={(e) => updateForm({ type: e.target.value })}><option value="indoor">실내</option><option value="outdoor">실외</option></FSelect></FormField>
                    <FormField><FLabel>이용 비용</FLabel><FSelect value={form.cost} onChange={(e) => updateForm({ cost: e.target.value })}><option value="free">무료</option><option value="paid">유료</option></FSelect></FormField>
                  </FRow>
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer", margin: "4px 0 4px" }}>
                    <input type="checkbox" checked={form.active} onChange={(e) => updateForm({ active: e.target.checked })} /> 사용자에게 노출 (활성)
                  </label>
                </>
              )}

              {formTab === "facility" && (
                <>
                  <FormSecTitle>편의시설</FormSecTitle>
                  <FacWrap>
                    {FACILITY_OPTIONS.map((f) => {
                      const Ic = FACILITY_ICONS[f] || MdCheckCircle;
                      return (
                        <FacBtn key={f} type="button" $on={facilities.includes(f)} onClick={() => toggleFacility(f)}>
                          <Ic />{f}
                        </FacBtn>
                      );
                    })}
                  </FacWrap>
                </>
              )}

              {formTab === "courts" && (
                <>
                  <FormSecTitle>예약 대상 (코트)</FormSecTitle>
                  {courts.map((c, i) => (
                    <CourtCard key={i}>
                      <CourtHead>
                        <FLabel style={{ fontWeight: 700 }}>코트 {i + 1}</FLabel>
                        <DelLink type="button" onClick={() => removeCourt(i)}>삭제</DelLink>
                      </CourtHead>
                      <FRow>
                        <FormField><FLabel>이름</FLabel><FInput value={c.name} onChange={(e) => setCourt(i, { name: e.target.value })} placeholder="예: A코트" /></FormField>
                        <FormField><FLabel>종류</FLabel><FSelect value={c.type} onChange={(e) => setCourt(i, { type: e.target.value })}><option value="indoor">실내</option><option value="outdoor">실외</option></FSelect></FormField>
                      </FRow>
                      <FRow>
                        <FormField><FLabel>시간당 가격(원)</FLabel><FInput type="number" value={c.pricePerHour} onChange={(e) => setCourt(i, { pricePerHour: e.target.value })} placeholder="40000" /></FormField>
                        <FormField><FLabel>슬롯 단위(분)</FLabel><FSelect value={c.slotMinutes} onChange={(e) => setCourt(i, { slotMinutes: Number(e.target.value) })}><option value={30}>30분</option><option value={60}>60분</option><option value={90}>90분</option><option value={120}>120분</option></FSelect></FormField>
                      </FRow>
                      <FormField><FLabel>요일별 운영시간</FLabel><CourtHoursEditor hours={c.hours} onChange={(hours) => setCourt(i, { hours })} /></FormField>
                    </CourtCard>
                  ))}
                  <GhostBtn type="button" onClick={addCourt}>＋ 코트 추가</GhostBtn>
                </>
              )}

              {formTab === "info" && (
                <>
                  <FormSecTitle>안내</FormSecTitle>
                  <FormField><FLabel>구장 소개</FLabel><FTextarea value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="구장 특징, 바닥 재질, 주차 안내 등" /></FormField>
                  <FormField><FLabel>이용 규칙</FLabel><FTextarea value={form.rules} onChange={(e) => updateForm({ rules: e.target.value })} placeholder="예: 실내화 필수, 음식물 반입 금지" /></FormField>
                  <FormField><FLabel>환불 정책</FLabel><FTextarea value={form.refundPolicy} onChange={(e) => updateForm({ refundPolicy: e.target.value })} placeholder="환불 규정" /></FormField>
                </>
              )}

              {formTab === "biz" && (
                <>
                  <FormSecTitle>사업자 / 관리자 정보</FormSecTitle>
                  <FRow>
                    <FormField><FLabel>대표자명</FLabel><FInput value={form.ownerName} onChange={(e) => updateForm({ ownerName: e.target.value })} placeholder="예: 홍길동" /></FormField>
                    <FormField><FLabel>관리자 연락처</FLabel><FInput value={form.contactPhone} onChange={(e) => updateForm({ contactPhone: e.target.value })} placeholder="예: 010-1234-5678" /></FormField>
                  </FRow>
                  <FRow>
                    <FormField><FLabel>상호(사업자명)</FLabel><FInput value={form.bizName} onChange={(e) => updateForm({ bizName: e.target.value })} placeholder="예: ○○스포츠" /></FormField>
                    <FormField><FLabel>사업자등록번호</FLabel><FInput value={form.bizNo} onChange={(e) => updateForm({ bizNo: e.target.value })} placeholder="예: 123-45-67890" /></FormField>
                  </FRow>

                  {form.ownerUid && form.business && (
                    <BizBox>
                      <FormSecTitle style={{ marginTop: 4 }}>사업자 인증 심사</FormSecTitle>
                      <DRow><b>인증상태</b>
                        <BizStatus $s={form.business.status}>
                          {form.business.status === "verified" ? "인증완료" : form.business.status === "pending" ? "심사중" : form.business.status === "rejected" ? "반려" : "미제출"}
                        </BizStatus>
                      </DRow>
                      {form.business.bizNo && <DRow><b>사업자번호</b><span>{form.business.bizNo}</span></DRow>}
                      {form.business.openDate && <DRow><b>개업일자</b><span>{form.business.openDate}</span></DRow>}
                      <DRow><b>과세유형</b><span>{form.business.taxType === "general" ? "일반과세자" : "간이과세자"}</span></DRow>
                      {form.business.licenseUrl && <DRow><b>등록증</b><span><a href={form.business.licenseUrl} target="_blank" rel="noreferrer" style={{ color: "#4f46e5" }}>사본 보기</a></span></DRow>}
                      {form.business.rejectReason && <DRow><b>반려사유</b><span style={{ color: "#b91c1c" }}>{form.business.rejectReason}</span></DRow>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        {form.business.status === "pending" && (
                          <>
                            <SBtn $primary onClick={() => handleBizStatus({ id: form.id, name: form.name, business: form.business }, "verified")} disabled={busy}>인증 승인</SBtn>
                            <SBtn $danger onClick={() => handleBizStatus({ id: form.id, name: form.name, business: form.business }, "rejected")} disabled={busy}>인증 반려</SBtn>
                          </>
                        )}
                        {form.business.status === "verified" && (
                          <SBtn onClick={() => handleBizStatus({ id: form.id, name: form.name, business: form.business }, "pending")} disabled={busy}>인증 취소(심사중)</SBtn>
                        )}
                      </div>
                    </BizBox>
                  )}
                </>
              )}
            </TabBody>

            <ModalActions>
              <SBtn onClick={closeForm} disabled={busy}>취소</SBtn>
              <SBtn $primary onClick={saveForm} disabled={busy || uploading}>{busy ? "저장 중…" : isEditing ? "수정 저장" : "등록"}</SBtn>
            </ModalActions>
            <Hidden ref={fileRef} type="file" accept="image/*" onChange={onFile} />
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}
