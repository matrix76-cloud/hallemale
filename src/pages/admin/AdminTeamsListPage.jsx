/* eslint-disable */
// src/pages/admin/AdminTeamsListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import AdminFilterSummaryBar from "../../components/admin/AdminFilterSummaryBar";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import { fetchTeamsAdminView } from "../../services/adminTeamsService";
import { blockTeam } from "../../services/adminTeamBlockService";
import TeamProfilePage from "../team/TeamProfilePage";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  overflow: hidden;
`;

const CardBody = styled.div`
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 2420px;
`;

/* ✅ 비디오 컬럼 제거(110px 하나 빠짐) + 관리(차단) 컬럼 추가 + 팀 정보 컬럼 추가 */
const COLS =
  "80px 180px 100px 220px 240px 220px 240px 90px 110px 140px 110px 90px 110px 110px 110px 160px 130px 130px 120px 280px 280px 120px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: nowrap;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6"};
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};

  &:hover {
    background: ${({ theme }) =>
      theme?.mode === "dark" ? "rgba(99,102,241,0.08)" : "#fafbff"};
  }
`;

const EmptyText = styled.div`
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Cell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
`;

const Mono = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Muted = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Logo = styled.img`
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
`;

const LogoFallback = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
`;

const LinkText = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  text-align: left;
  min-width: 0;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const Trunc = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ✅ 뱃지 컬러: 진한 남색 */
const BLUE = "#0B1222";
const BLUE_SOFT = "rgba(11, 18, 34, 0.10)";
const BLUE_SOFT2 = "rgba(11, 18, 34, 0.08)";

const NumBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: ${BLUE};
  color: #ffffff;
`;

const NumBadgeSoft = styled(NumBadge)`
  background: ${BLUE_SOFT};
  color: ${BLUE};
`;

const NumBadgeZero = styled(NumBadge)`
  background: ${BLUE_SOFT2};
  color: ${BLUE};
`;

const BadgeWarn = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
`;

const OwnerCell = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const OwnerName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const OwnerUid = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
`;

const Modal = styled.div`
  width: min(760px, 92vw);
  max-height: 82vh;
  overflow: auto;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
  padding: 16px 16px 18px;
`;

const ModalTitle = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 8px;
`;

const ModalBody = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  line-height: 1.7;
  white-space: pre-line;
`;

const ModalList = styled.div`
  margin-top: 10px;
  border-top: 1px dashed ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;

const ModalRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 2px;
  border-top: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6"};

  &:first-child {
    border-top: none;
  }

  .left {
    width: 120px;
    flex-shrink: 0;
    font-size: 12px;
    color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  }
  .right {
    min-width: 0;
    flex: 1;
    font-size: 13px;
    color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  a {
    color: ${({ theme }) =>
      theme?.mode === "dark" ? theme?.colors?.primary : BLUE};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const ModalActions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Btn = styled.button`
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $primary, theme }) =>
    $primary
      ? theme?.mode === "dark"
        ? theme?.colors?.primary
        : BLUE
      : theme?.colors?.card || "#ffffff"};
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  cursor: pointer;
  font-size: 12px;
  padding: 0 12px;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const BlockBtn = styled.button`
  height: 32px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2"};
  color: ${({ theme }) => (theme?.mode === "dark" ? "#fca5a5" : "#b91c1c")};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const InfoBtn = styled.button`
  height: 32px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(99,102,241,0.45)" : "rgba(11, 18, 34, 0.18)"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(99,102,241,0.16)" : "rgba(11, 18, 34, 0.06)"};
  color: ${({ theme }) => (theme?.mode === "dark" ? "#c7d2fe" : BLUE)};
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const ModalLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  margin-bottom: 6px;
`;

const ReasonTextarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const TargetLine = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};

  strong {
    color: ${({ theme }) => (theme?.mode === "dark" ? "#fca5a5" : "#b91c1c")};
  }
`;

/* ✅ 팀 정보 미리보기 (사용자 화면 컴포넌트 직접 렌더) */
const PreviewModal = styled.div`
  width: min(460px, 96vw);
  max-height: 92vh;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};
`;

const PreviewTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PreviewBody = styled.div`
  flex: 1;
  min-height: 0;
  max-height: 82vh;
  overflow-y: auto;
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
`;

/* ✅ 페이지네이션 UI */
const PagerBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const PagerLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PagerRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PagerInfo = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const PageChip = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(11, 18, 34, 0.08);
  color: #0b1222;
`;

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtYmd(v) {
  const d = toDate(v);
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtYmdHm(v) {
  const d = toDate(v);
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function joinTags(tags) {
  if (!Array.isArray(tags)) return "";
  return tags.map((t) => String(t || "").trim()).filter(Boolean).join(" ");
}

function buildMediaList(media = [], type) {
  const list = Array.isArray(media) ? media : [];
  const t = String(type || "").toLowerCase();
  return list
    .filter((m) => String(m?.type || "").toLowerCase() === t)
    .map((m) => {
      const url = String(m?.url || "").trim();
      const caption = String(m?.caption || "").trim();
      const createdAt = m?.createdAt;
      const youtubeId = String(m?.youtubeId || "").trim();
      return { url, caption, createdAt, youtubeId };
    });
}

export default function AdminTeamsListPage() {
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [regionSido, setRegionSido] = useState("all");

  const [loading, setLoading] = useState(true);
  const [rawRows, setRawRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState("");
  const [modalList, setModalList] = useState(null);

  // 차단 모달 상태
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState(null); // { clubId, name }
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);

  // 팀 정보 미리보기 모달 상태
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null); // { clubId, name }

  /* ✅ 페이지네이션: 기본 25개 */
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const openTextModal = (title, text) => {
    setModalTitle(String(title || ""));
    setModalBody(String(text || ""));
    setModalList(null);
    setModalOpen(true);
  };

  const openMediaModal = (title, items) => {
    setModalTitle(String(title || ""));
    setModalBody("");
    setModalList(Array.isArray(items) ? items : []);
    setModalOpen(true);
  };

  const openBlockModal = (clubId, name) => {
    setBlockTarget({ clubId: String(clubId || ""), name: String(name || "") });
    setBlockReason("");
    setBlockOpen(true);
  };

  const openPreviewModal = (clubId, name) => {
    if (!clubId) return;
    setPreviewTarget({ clubId: String(clubId), name: String(name || "") });
    setPreviewOpen(true);
  };

  const closePreviewModal = () => {
    setPreviewOpen(false);
    setPreviewTarget(null);
  };

  const closeBlockModal = () => {
    if (blockBusy) return;
    setBlockOpen(false);
    setBlockTarget(null);
    setBlockReason("");
  };

  const handleConfirmBlock = async () => {
    const clubId = blockTarget?.clubId;
    const reason = String(blockReason || "").trim();
    if (!clubId) return;
    if (!reason) {
      window.alert("차단 사유를 입력해주세요.");
      return;
    }

    if (!window.confirm(`${blockTarget?.name || clubId} 팀을 차단하시겠습니까?`)) {
      return;
    }

    setBlockBusy(true);
    try {
      await blockTeam({ clubId, reason, byAdmin: "admin" });
      setBlockOpen(false);
      setBlockTarget(null);
      setBlockReason("");
      navigate("/admin/teams/blocks");
    } catch (e) {
      console.error("[AdminTeamsListPage] block failed", e);
      window.alert(e?.message || "차단 처리에 실패했습니다.");
    } finally {
      setBlockBusy(false);
    }
  };

  const load = async ({ resetPage = true } = {}) => {
    if (resetPage) setPage(1);

    setLoading(true);
    setErr("");
    try {
      const res = await fetchTeamsAdminView({
        limitCount: 200,
        keyword,
        regionSido,
        dateFrom,
        dateTo,
      });
      setRawRows(res.rows || []);
      setRows(res.filtered || []);
    } catch (e) {
      console.error("[AdminTeamsListPage] load failed", e);
      setRawRows([]);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ resetPage: true });
  }, []);

  const extraFilters = (
    <>
      <select
        value={regionSido}
        onChange={(e) => setRegionSido(e.target.value)}
        style={{
          height: 34,
          borderRadius: 10,
          padding: "0 10px",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          background: "#fff",
        }}
      >
        <option value="all">전체 지역</option>
        <option value="서울">서울</option>
        <option value="경기">경기</option>
        <option value="인천">인천</option>
        <option value="부산">부산</option>
        <option value="대구">대구</option>
        <option value="대전">대전</option>
        <option value="광주">광주</option>
        <option value="울산">울산</option>
        <option value="세종">세종</option>
        <option value="강원">강원</option>
        <option value="충북">충북</option>
        <option value="충남">충남</option>
        <option value="전북">전북</option>
        <option value="전남">전남</option>
        <option value="경북">경북</option>
        <option value="경남">경남</option>
        <option value="제주">제주</option>
      </select>
    </>
  );

  const onReset = () => {
    setDateFrom("");
    setDateTo("");
    setKeyword("");
    setRegionSido("all");
    setTimeout(() => load({ resetPage: true }), 0);
  };

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, Number(pageSize) || 25)));

  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedRows = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 25);
    const p = Math.min(Math.max(1, safePage), totalPages);
    const start = (p - 1) * size;
    return rows.slice(start, start + size);
  }, [rows, pageSize, safePage, totalPages]);

  const rangeLabel = useMemo(() => {
    if (!totalCount) return "0 / 0";
    const size = Math.max(1, Number(pageSize) || 25);
    const p = Math.min(Math.max(1, safePage), totalPages);
    const start = (p - 1) * size + 1;
    const end = Math.min(p * size, totalCount);
    return `${start}-${end} / ${totalCount}`;
  }, [totalCount, pageSize, safePage, totalPages]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [safePage]);

  return (
    <Page>
      <AdminFilterSummaryBar
        title="팀 목록"
        subtitle="clubs 컬렉션 기준 · 최근 200개 로드 후 필터"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onChangeDateFrom={setDateFrom}
        onChangeDateTo={setDateTo}
        keyword={keyword}
        onChangeKeyword={setKeyword}
        onSubmit={() => load({ resetPage: true })}
        onReset={onReset}
        extraFilters={extraFilters}
      />

      {loading ? (
        <Card>
          <AdminLoading />
        </Card>
      ) : err ? (
        <Card>
          <CardBody>
            <Muted style={{ color: "#b91c1c" }}>{err}</Muted>
          </CardBody>
        </Card>
      ) : (
      <Card>
        <TableWrap>
          <Table>
            <Head>
              <div>로고</div>
              <div>팀명</div>
              <div>팀 정보</div>
              <div>clubId</div>
              <div>팀장</div>
              <div>지역</div>
              <div>태그</div>
              <div>팀원</div>
              <div>승인대기</div>
              <div>승-무-패</div>
              <div>총경기</div>
              <div>승률</div>
              <div>미디어</div>
              <div>이미지</div>
              <div>유튜브</div>
              <div>마지막 업로드</div>
              <div>생성일</div>
              <div>업데이트</div>
              <div>경과일</div>
              <div>소개</div>
              <div>홍보문</div>
              <div>관리</div>
            </Head>

            {pagedRows.map((r, idx) => {
              const clubId = String(r.clubId || r.id || "").trim();
              const name = String(r.name || "-");
              const ownerUid = String(r.ownerUid || "").trim();
              const ownerName = String(r.ownerName || "").trim();

              const description = String(r.description || "");
              const promoText = String(r?.promo?.promoText || "");

              const tagsText = joinTags(r.tags);
              const region = String(r.region || "-");

              const pending = Number(r.pendingJoinRequestsCount) || 0;

              const mediaTotal = Number(r.mediaTotal) || 0;
              const imgCount = Number(r.mediaImages) || 0;
              const ytCount = Number(r.mediaYoutube) || 0;

              const mc = r.memberCountValue;
              const hasMc = typeof mc === "number" && Number.isFinite(mc);

              return (
                <Row key={clubId || `${safePage}-${idx}`}>
                  <Cell>
                    {r.logoUrl ? (
                      <Logo
                        src={r.logoUrl}
                        alt={name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <LogoFallback />
                    )}
                  </Cell>

                  <Cell>
                    <LinkText
                      type="button"
                      onClick={() => {
                        if (!clubId) return;
                        window.open(`/team/${clubId}`, "_blank");
                      }}
                      title={name}
                    >
                      <Trunc>{name}</Trunc>
                    </LinkText>
                  </Cell>

                  <Cell>
                    <InfoBtn
                      type="button"
                      onClick={() => openPreviewModal(clubId, name)}
                      disabled={!clubId}
                    >
                      팀 정보
                    </InfoBtn>
                  </Cell>

                  <Cell title={clubId}>
                    <Mono>
                      <Trunc>{clubId || "-"}</Trunc>
                    </Mono>
                  </Cell>

                  <Cell title={ownerUid}>
                    <OwnerCell>
                      <OwnerName>{ownerName || "이름없음"}</OwnerName>
                      <OwnerUid>{ownerUid || "-"}</OwnerUid>
                    </OwnerCell>
                  </Cell>

                  <Cell title={region}>
                    <Trunc>{region}</Trunc>
                  </Cell>

                  <Cell>
                    {tagsText ? (
                      <LinkText type="button" onClick={() => openTextModal("태그", tagsText)}>
                        <Trunc>{tagsText}</Trunc>
                      </LinkText>
                    ) : (
                      <Muted>-</Muted>
                    )}
                  </Cell>

                  <Cell>
                    {!hasMc ? (
                      <NumBadgeZero>-</NumBadgeZero>
                    ) : mc > 0 ? (
                      <NumBadge>{mc}명</NumBadge>
                    ) : (
                      <NumBadgeZero>0명</NumBadgeZero>
                    )}
                  </Cell>

                  <Cell>
                    {pending > 0 ? <BadgeWarn>{pending}건</BadgeWarn> : <NumBadgeZero>0</NumBadgeZero>}
                  </Cell>

                  <Cell>
                    <NumBadgeSoft>{String(r.recordText || "0-0-0")}</NumBadgeSoft>
                  </Cell>

                  <Cell>
                    {Number(r.totalMatches) > 0 ? (
                      <NumBadge>{Number(r.totalMatches)}</NumBadge>
                    ) : (
                      <NumBadgeZero>0</NumBadgeZero>
                    )}
                  </Cell>

                  <Cell>
                    <NumBadgeSoft>{String(r.winRatePct || "0%")}</NumBadgeSoft>
                  </Cell>

                  <Cell>
                    {mediaTotal > 0 ? <NumBadge>{mediaTotal}</NumBadge> : <NumBadgeZero>0</NumBadgeZero>}
                  </Cell>

                  <Cell>
                    {imgCount > 0 ? (
                      <LinkText
                        type="button"
                        onClick={() => openMediaModal("이미지 목록", buildMediaList(r.media || [], "image"))}
                      >
                        <NumBadge>{imgCount}</NumBadge>
                      </LinkText>
                    ) : (
                      <NumBadgeZero>0</NumBadgeZero>
                    )}
                  </Cell>

                  <Cell>
                    {ytCount > 0 ? (
                      <LinkText
                        type="button"
                        onClick={() => openMediaModal("유튜브 목록", buildMediaList(r.media || [], "youtube"))}
                      >
                        <NumBadge>{ytCount}</NumBadge>
                      </LinkText>
                    ) : (
                      <NumBadgeZero>0</NumBadgeZero>
                    )}
                  </Cell>

                  <Cell>
                    {r.lastMediaAt ? <Mono>{fmtYmdHm(r.lastMediaAt)}</Mono> : <Muted>-</Muted>}
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmd(r.createdAt)}</Mono>
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmd(r.updatedAt)}</Mono>
                  </Cell>

                  <Cell>
                    {r.daysSinceUpdated != null ? (
                      <NumBadgeSoft>{r.daysSinceUpdated}일</NumBadgeSoft>
                    ) : (
                      <Muted>-</Muted>
                    )}
                  </Cell>

                  <Cell>
                    {description ? (
                      <LinkText type="button" onClick={() => openTextModal("팀 소개", description)}>
                        <Trunc>{description}</Trunc>
                      </LinkText>
                    ) : (
                      <Muted>-</Muted>
                    )}
                  </Cell>

                  <Cell>
                    {promoText ? (
                      <LinkText type="button" onClick={() => openTextModal("홍보문", promoText)}>
                        <Trunc>{promoText}</Trunc>
                      </LinkText>
                    ) : (
                      <Muted>-</Muted>
                    )}
                  </Cell>

                  <Cell>
                    <BlockBtn
                      type="button"
                      onClick={() => openBlockModal(clubId, name)}
                      disabled={!clubId}
                    >
                      차단
                    </BlockBtn>
                  </Cell>
                </Row>
              );
            })}

            {!pagedRows.length ? (
              <Row style={{ gridTemplateColumns: "1fr" }}>
                <EmptyText>결과가 없습니다.</EmptyText>
              </Row>
            ) : null}
          </Table>
        </TableWrap>
        <AdminPager
          totalCount={totalCount}
          page={safePage}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </Card>
      )}

      {modalOpen && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{modalTitle}</ModalTitle>

            {modalList ? (
              <ModalList>
                {modalList.map((it, idx) => {
                  const url = String(it.url || "").trim();
                  const caption = String(it.caption || "").trim();
                  const when = it.createdAt ? fmtYmdHm(it.createdAt) : "-";
                  const label =
                    modalTitle.includes("유튜브") && it.youtubeId
                      ? `youtube:${it.youtubeId}`
                      : url
                      ? url
                      : "-";

                  return (
                    <ModalRow key={`${label}-${idx}`}>
                      <div className="left">{when}</div>
                      <div className="right" title={label}>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {caption ? `${caption} · ${label}` : label}
                          </a>
                        ) : (
                          <span>{caption || "-"}</span>
                        )}
                      </div>
                    </ModalRow>
                  );
                })}
                {!modalList.length ? (
                  <ModalRow>
                    <div className="left">-</div>
                    <div className="right">
                      항목이 없습니다.
                    </div>
                  </ModalRow>
                ) : null}
              </ModalList>
            ) : (
              <ModalBody>{modalBody || "-"}</ModalBody>
            )}

            <ModalActions>
              <Btn type="button" onClick={() => setModalOpen(false)} $primary>
                닫기
              </Btn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}

      {blockOpen && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBlockModal();
          }}
        >
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>팀 차단</ModalTitle>

            <TargetLine>
              대상: <strong>{blockTarget?.name || "-"}</strong>{" "}
              <span style={{ opacity: 0.6, fontSize: 12 }}>({blockTarget?.clubId})</span>
            </TargetLine>

            <ModalLabel>차단 사유 (필수)</ModalLabel>
            <ReasonTextarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="예: 부적절한 팀명/홍보문, 다수 신고 누적 등"
              disabled={blockBusy}
              autoFocus
            />

            <ModalActions>
              <Btn type="button" onClick={closeBlockModal} disabled={blockBusy}>
                취소
              </Btn>
              <Btn
                type="button"
                onClick={handleConfirmBlock}
                disabled={blockBusy || !blockReason.trim()}
                $primary
              >
                {blockBusy ? "처리중…" : "차단하기"}
              </Btn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}

      {previewOpen && previewTarget?.clubId && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreviewModal();
          }}
        >
          <PreviewModal onClick={(e) => e.stopPropagation()}>
            <PreviewHeader>
              <PreviewTitle title={previewTarget?.name}>
                {previewTarget?.name || "팀 정보"}
              </PreviewTitle>
              <Btn type="button" onClick={closePreviewModal} $primary>
                닫기
              </Btn>
            </PreviewHeader>
            <PreviewBody>
              <TeamProfilePage
                key={previewTarget.clubId}
                teamId={previewTarget.clubId}
                embed
              />
            </PreviewBody>
          </PreviewModal>
        </Overlay>
      )}
    </Page>
  );
}
