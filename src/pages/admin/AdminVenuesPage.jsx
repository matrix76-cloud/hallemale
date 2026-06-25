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
  updateMyVenue,
  DAY_KEYS,
  DAY_LABELS,
} from "../../services/ownerVenueService";

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
const ImgPick = styled.div`width: 100%; height: 130px; border-radius: 8px; border: 1.5px dashed ${({ theme }) => theme?.colors?.border || "#d1d5db"}; display: grid; place-items: center; background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"}; overflow: hidden; cursor: pointer; margin-bottom: 10px;`;
const ImgPrev = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const Hidden = styled.input`display: none;`;

function emptyForm() {
  return { id: null, name: "", address: "", addressDetail: "", lat: "", lng: "", imageUrl: "", storagePath: "", type: "indoor", cost: "free", memo: "", order: 0, active: true };
}

export default function AdminVenuesPage() {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null); // 상세 모달 venue

  // 추천구장 생성 폼
  const [form, setForm] = useState(emptyForm());
  const [formOpen, setFormOpen] = useState(false);
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
      setDetail((d) => (d && d.id === row.id ? { ...d, status, rejectReason: status === "rejected" ? reason : "" } : d));
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
      setDetail(null);
    } catch (e) {
      window.alert(e?.message || "삭제 실패");
    } finally { setBusy(false); }
  };

  /* 추천구장 생성/수정 */
  const updateForm = (p) => setForm((prev) => ({ ...prev, ...p }));
  const openCreate = () => { setForm(emptyForm()); setFormOpen(true); };
  const closeForm = () => { setForm(emptyForm()); setFormOpen(false); };
  const pickImage = () => { if (!busy && !uploading) fileRef.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    setUploading(true);
    try { const { imageUrl, storagePath } = await uploadVenueImage(file); updateForm({ imageUrl, storagePath }); }
    catch (err) { window.alert(err?.message || "업로드 실패"); }
    finally { setUploading(false); }
  };
  const saveForm = async () => {
    if (!form.name.trim()) return window.alert("구장명을 입력해주세요.");
    if (!form.address.trim()) return window.alert("주소를 입력해주세요.");
    setBusy(true);
    try {
      if (isEditing) await updateVenue(form.id, form);
      else await createVenue(form);
      closeForm(); await load();
    } catch (e) { window.alert(e?.message || "저장 실패"); }
    finally { setBusy(false); }
  };
  const editRecommended = (row) => {
    setForm({
      id: row.id, name: row.name, address: row.address, addressDetail: row.addressDetail,
      lat: row.lat ?? "", lng: row.lng ?? "", imageUrl: row.imageUrl, storagePath: row.storagePath,
      type: row.type, cost: row.cost, memo: row.description || "", order: 0, active: row.active,
    });
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
                    <SBtn onClick={() => setDetail(row)}>상세</SBtn>
                    {row.status !== "approved" && <SBtn $primary onClick={() => changeStatus(row, "approved")} disabled={busy}>승인</SBtn>}
                    {row.status !== "rejected" && <SBtn $danger onClick={() => changeStatus(row, "rejected")} disabled={busy}>반려</SBtn>}
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

      {/* 상세보기 모달 — 구장주 입력 전체 정보 */}
      {detail && (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <ModalTitle>
                {detail.name || "(이름 없음)"}
                <StatusBadge $bg={(STATUS_META[detail.status] || STATUS_META.approved).bg} $c={(STATUS_META[detail.status] || STATUS_META.approved).color}>
                  {(STATUS_META[detail.status] || STATUS_META.approved).label}
                </StatusBadge>
              </ModalTitle>
              <Close type="button" onClick={() => setDetail(null)}>×</Close>
            </ModalHead>

            {(detail.photos?.length > 0 || detail.imageUrl) && (
              <Gallery>
                {(detail.photos?.length ? detail.photos : [detail.imageUrl]).filter(Boolean).map((u, i) => (
                  <GImg key={i} src={u} alt={`사진 ${i + 1}`} />
                ))}
              </Gallery>
            )}

            <Sec>
              <SecTitle>기본 정보</SecTitle>
              <DRow><b>출처</b><span>{detail.ownerUid ? "구장주 신청" : "추천(어드민)"}</span></DRow>
              <DRow><b>주소</b><span>{detail.address}{detail.addressDetail ? ` ${detail.addressDetail}` : ""}</span></DRow>
              {detail.region && <DRow><b>지역</b><span>{detail.region}</span></DRow>}
              {detail.phone && <DRow><b>구장 연락처</b><span>{detail.phone}</span></DRow>}
              <DRow><b>유형 / 비용</b><span>{detail.type === "outdoor" ? "실외" : "실내"} · {detail.cost === "paid" ? "유료" : "무료"}</span></DRow>
              <DRow><b>등록일</b><span>{fmtYmd(detail.createdAt)}</span></DRow>
              {detail.rejectReason && <DRow><b>반려사유</b><span style={{ color: "#b91c1c" }}>{detail.rejectReason}</span></DRow>}
            </Sec>

            {detail.facilities?.length > 0 && (
              <Sec>
                <SecTitle>편의시설</SecTitle>
                <Chips>{detail.facilities.map((f) => <FacChip key={f}>{f}</FacChip>)}</Chips>
              </Sec>
            )}

            {detail.courts?.length > 0 && (
              <Sec>
                <SecTitle>예약 대상 (코트 {detail.courts.length}개)</SecTitle>
                {detail.courts.map((c) => (
                  <CourtBox key={c.id}>
                    <CourtTop>
                      <span>{c.name} · {c.type === "outdoor" ? "실외" : "실내"}</span>
                      <span>{won(c.pricePerHour)} / {c.slotMinutes}분</span>
                    </CourtTop>
                    <Hours>
                      {DAY_KEYS.map((k) => {
                        const h = c.hours?.[k] || {};
                        return (
                          <HourCell key={k} $closed={h.closed}>
                            <b>{DAY_LABELS[k]}</b>
                            {h.closed ? "휴무" : `${h.open}~${h.close}`}
                          </HourCell>
                        );
                      })}
                    </Hours>
                  </CourtBox>
                ))}
              </Sec>
            )}

            {detail.description && (<Sec><SecTitle>구장 소개</SecTitle><Pre>{detail.description}</Pre></Sec>)}
            {detail.rules && (<Sec><SecTitle>이용 규칙</SecTitle><Pre>{detail.rules}</Pre></Sec>)}
            {detail.refundPolicy && (<Sec><SecTitle>환불 정책</SecTitle><Pre>{detail.refundPolicy}</Pre></Sec>)}

            {detail.ownerUid && (
              <Sec>
                <SecTitle>사업자 / 관리자 정보</SecTitle>
                {detail.ownerName && <DRow><b>대표자</b><span>{detail.ownerName}</span></DRow>}
                {detail.contactPhone && <DRow><b>연락처</b><span>{detail.contactPhone}</span></DRow>}
                {detail.bizName && <DRow><b>상호</b><span>{detail.bizName}</span></DRow>}
                {detail.bizNo && <DRow><b>사업자번호</b><span>{detail.bizNo}</span></DRow>}
                <DRow><b>구장주 UID</b><span style={{ fontSize: 11, wordBreak: "break-all" }}>{detail.ownerUid}</span></DRow>
              </Sec>
            )}

            <ModalActions>
              {detail.status !== "approved" && <SBtn $primary onClick={() => changeStatus(detail, "approved")} disabled={busy}>승인</SBtn>}
              {detail.status !== "rejected" && <SBtn $danger onClick={() => changeStatus(detail, "rejected")} disabled={busy}>반려</SBtn>}
              {detail.status !== "pending" && <SBtn onClick={() => changeStatus(detail, "pending")} disabled={busy}>신청대기로</SBtn>}
              {!detail.ownerUid && <SBtn onClick={() => { const d = detail; setDetail(null); editRecommended(d); }}>정보 수정</SBtn>}
              <SBtn $danger onClick={() => handleDelete(detail)} disabled={busy}>삭제</SBtn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}

      {/* 추천 구장 등록/수정 폼 */}
      {formOpen && (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget && !busy && !uploading) closeForm(); }}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <ModalTitle>{isEditing ? "추천 구장 수정" : "추천 구장 등록"}</ModalTitle>
              <Close type="button" onClick={closeForm} disabled={busy || uploading}>×</Close>
            </ModalHead>

            <ImgPick onClick={pickImage}>
              {form.imageUrl ? <ImgPrev src={form.imageUrl} alt="" /> : <span style={{ fontSize: 12, color: "#9ca3af" }}>{uploading ? "업로드 중…" : "클릭해서 이미지 선택"}</span>}
            </ImgPick>

            <FormField><FLabel>구장명</FLabel><FInput value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="예: 고려대 화정체육관" /></FormField>
            <FormField><FLabel>주소</FLabel><FInput value={form.address} onChange={(e) => updateForm({ address: e.target.value })} placeholder="예: 서울 성북구 고려대로 1" /></FormField>
            <FormField><FLabel>상세 주소</FLabel><FInput value={form.addressDetail} onChange={(e) => updateForm({ addressDetail: e.target.value })} placeholder="예: 지하 1층 농구코트" /></FormField>
            <FRow>
              <FormField><FLabel>위도</FLabel><FInput type="number" step="any" value={form.lat} onChange={(e) => updateForm({ lat: e.target.value })} placeholder="37.5896" /></FormField>
              <FormField><FLabel>경도</FLabel><FInput type="number" step="any" value={form.lng} onChange={(e) => updateForm({ lng: e.target.value })} placeholder="127.0297" /></FormField>
            </FRow>
            <FRow>
              <FormField><FLabel>종류</FLabel><FSelect value={form.type} onChange={(e) => updateForm({ type: e.target.value })}><option value="indoor">실내</option><option value="outdoor">실외</option></FSelect></FormField>
              <FormField><FLabel>이용 비용</FLabel><FSelect value={form.cost} onChange={(e) => updateForm({ cost: e.target.value })}><option value="free">무료</option><option value="paid">유료</option></FSelect></FormField>
            </FRow>
            <FormField><FLabel>메모</FLabel><FTextarea value={form.memo} onChange={(e) => updateForm({ memo: e.target.value })} placeholder="예: 평일 18시 이후 개방 / 주차 가능" /></FormField>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => updateForm({ active: e.target.checked })} /> 사용자에게 노출 (활성)
            </label>

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
