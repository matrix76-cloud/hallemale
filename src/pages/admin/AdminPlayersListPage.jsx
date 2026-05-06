/* eslint-disable */
// src/pages/admin/AdminPlayersListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import AdminFilterSummaryBar from "../../components/admin/AdminFilterSummaryBar";
import AdminLoading from "../../components/admin/AdminLoading";
import AdminPager from "../../components/admin/AdminPager";
import { fetchPlayersAdminView } from "../../services/adminPlayersService";
import { blockUser } from "../../services/adminUserBlockService";
import PlayerProfilePage from "../player/PlayerProfilePage";

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
  gap: 10px;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 2040px;
`;

const COLS = "72px 160px 100px 210px 160px 120px 120px 260px 110px 110px 240px 160px 170px 120px";

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

const Muted = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Trunc = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Mono = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Avatar = styled.img`
  width: 42px;
  height: 42px;
  border-radius: 8px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
`;

const AvatarFallback = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
`;

const TeamLogo = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  flex-shrink: 0;
`;

const TeamLogoFallback = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  flex-shrink: 0;
`;

const TeamCell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TeamTexts = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TeamName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TeamMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

const CaptainBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
`;

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

const ModalActions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
  color: ${({ theme }) => (theme?.mode === "dark" ? "#c7d2fe" : "#0B1222")};
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

function normalizeText(s) {
  return String(s || "").trim().toLowerCase();
}

export default function AdminPlayersListPage() {
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState("");
  const [regionSido, setRegionSido] = useState("all");
  const [mainPosition, setMainPosition] = useState("all");
  const [skillLevel, setSkillLevel] = useState("all");
  const [onlyCaptains, setOnlyCaptains] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);

  const pageSize = 25;
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState("");

  // 차단 모달 상태
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState(null); // { uid, nickname }
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);

  // 회원 정보 미리보기 모달
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null); // { uid, nickname }

  const openPreviewModal = (uid, nickname) => {
    if (!uid) return;
    setPreviewTarget({ uid: String(uid), nickname: String(nickname || "") });
    setPreviewOpen(true);
  };

  const closePreviewModal = () => {
    setPreviewOpen(false);
    setPreviewTarget(null);
  };

  const openTextModal = (title, text) => {
    setModalTitle(String(title || ""));
    setModalBody(String(text || ""));
    setModalOpen(true);
  };

  const openBlockModal = (uid, nickname) => {
    setBlockTarget({ uid: String(uid || ""), nickname: String(nickname || "") });
    setBlockReason("");
    setBlockOpen(true);
  };

  const closeBlockModal = () => {
    if (blockBusy) return;
    setBlockOpen(false);
    setBlockTarget(null);
    setBlockReason("");
  };

  const handleConfirmBlock = async () => {
    const uid = blockTarget?.uid;
    const reason = String(blockReason || "").trim();
    if (!uid) return;
    if (!reason) {
      window.alert("차단 사유를 입력해주세요.");
      return;
    }

    if (!window.confirm(`${blockTarget?.nickname || uid} 회원을 차단하시겠습니까?`)) {
      return;
    }

    setBlockBusy(true);
    try {
      await blockUser({ uid, reason, byAdmin: "admin" });
      setBlockOpen(false);
      setBlockTarget(null);
      setBlockReason("");
      navigate("/admin/users/blocks");
    } catch (e) {
      console.error("[AdminPlayersListPage] block failed", e);
      window.alert(e?.message || "차단 처리에 실패했습니다.");
    } finally {
      setBlockBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetchPlayersAdminView({
        limitCount: 200,
        regionSido,
        mainPosition,
        skillLevel,
        onlyCaptains,
      });
      const list = Array.isArray(res?.rows) ? res.rows : [];
      setRows(list);
      setPage(1);
    } catch (e) {
      console.error("[AdminPlayersListPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = () => {
    load();
  };

  const onReset = () => {
    setKeyword("");
    setRegionSido("all");
    setMainPosition("all");
    setSkillLevel("all");
    setOnlyCaptains(false);
    setTimeout(() => load(), 0);
  };

  const keywordLower = useMemo(() => normalizeText(keyword), [keyword]);

  const filteredRows = useMemo(() => {
    if (!keywordLower) return rows;
    return rows.filter((r) => normalizeText(r?.nickname).includes(keywordLower));
  }, [rows, keywordLower]);

  useEffect(() => {
    setPage(1);
  }, [keywordLower]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const viewRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage]);

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

      <select
        value={mainPosition}
        onChange={(e) => setMainPosition(e.target.value)}
        style={{
          height: 34,
          borderRadius: 10,
          padding: "0 10px",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          background: "#fff",
        }}
      >
        <option value="all">전체 포지션</option>
        <option value="guard">가드</option>
        <option value="forward">포워드</option>
        <option value="center">센터</option>
      </select>

      <select
        value={skillLevel}
        onChange={(e) => setSkillLevel(e.target.value)}
        style={{
          height: 34,
          borderRadius: 10,
          padding: "0 10px",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          background: "#fff",
        }}
      >
        <option value="all">전체 레벨</option>
        <option value="beginner">초급</option>
        <option value="intermediate">중급</option>
        <option value="advanced">상급</option>
      </select>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#111827" }}>
        <input
          type="checkbox"
          checked={onlyCaptains}
          onChange={(e) => setOnlyCaptains(e.target.checked)}
        />
        팀장만
      </label>
    </>
  );

  return (
    <Page>
      <AdminFilterSummaryBar
        title="선수 목록"
        subtitle={`users 컬렉션 기준 · 페이지당 ${pageSize}개 · 팀명/로고는 clubs에서 채움 · 닉네임 검색은 클라 필터`}
        dateFrom=""
        dateTo=""
        onChangeDateFrom={() => {}}
        onChangeDateTo={() => {}}
        keyword={keyword}
        onChangeKeyword={setKeyword}
        onSubmit={onSubmit}
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
              <div>아바타</div>
              <div>닉네임</div>
              <div>회원 정보</div>
              <div>uid</div>
              <div>지역</div>
              <div>포지션</div>
              <div>레벨</div>
              <div>소속팀</div>
              <div>팀장</div>
              <div>미디어</div>
              <div>소개</div>
              <div>생성</div>
              <div>업데이트</div>
              <div>관리</div>
            </Head>

            {viewRows.map((r, idx) => {
              const uid = String(r?.uid || r?.id || "").trim();
              const nickname = String(r?.nickname || "-");
              const region = String(
                r?.region ||
                  `${r?.regionSido || ""}${r?.regionGu ? ` ${r.regionGu}` : ""}` ||
                  "-"
              ).trim();

              const pos = String(r?.mainPositionLabel || r?.mainPosition || "-");
              const level = String(r?.skillLevelLabel || r?.skillLevel || "-");

              const clubName = String(r?.clubName || "").trim();
              const clubId = String(r?.clubId || "").trim();
              const clubRegion = String(r?.clubRegion || "").trim();
              const clubLogoUrl = String(r?.clubLogoUrl || "").trim();

              const intro = String(r?.intro || "").trim();

              const mediaTotal = Number(r?.mediaTotal) || 0;
              const mediaImages = Number(r?.mediaImages) || 0;
              const mediaYoutube = Number(r?.mediaYoutube) || 0;

              return (
                <Row key={uid || `${safePage}-${idx}`}>
                  <Cell>
                    {r.avatarUrl ? (
                      <Avatar
                        src={r.avatarUrl}
                        alt={nickname}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <AvatarFallback />
                    )}
                  </Cell>

                  <Cell>
                    <LinkText
                      type="button"
                      onClick={() => {
                        if (!uid) return;
                        window.open(`/player/${uid}`, "_blank");
                      }}
                      title={nickname}
                    >
                      <Trunc>{nickname}</Trunc>
                    </LinkText>
                  </Cell>

                  <Cell>
                    <InfoBtn
                      type="button"
                      onClick={() => openPreviewModal(uid, nickname)}
                      disabled={!uid}
                    >
                      회원 정보
                    </InfoBtn>
                  </Cell>

                  <Cell title={uid}>
                    <Mono>
                      <Trunc>{uid || "-"}</Trunc>
                    </Mono>
                  </Cell>

                  <Cell title={region}>
                    <Trunc>{region || "-"}</Trunc>
                  </Cell>

                  <Cell>
                    {pos && pos !== "-" ? <NumBadgeSoft>{pos}</NumBadgeSoft> : <Muted>-</Muted>}
                  </Cell>

                  <Cell>
                    {level && level !== "-" ? <NumBadgeSoft>{level}</NumBadgeSoft> : <Muted>-</Muted>}
                  </Cell>

                  <Cell title={clubId || ""}>
                    {clubId ? (
                      <TeamCell>
                        {clubLogoUrl ? (
                          <TeamLogo
                            src={clubLogoUrl}
                            alt={clubName || "team"}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <TeamLogoFallback />
                        )}

                        <TeamTexts>
                          <LinkText
                            type="button"
                            onClick={() => {
                              if (!clubId) return;
                              window.open(`/team/${clubId}`, "_blank");
                            }}
                            title={clubName || clubId}
                          >
                            <TeamName>{clubName || "(팀명 없음)"}</TeamName>
                          </LinkText>

                          <TeamMeta title={clubRegion || clubId}>
                            <Trunc>{clubRegion || clubId}</Trunc>
                          </TeamMeta>
                        </TeamTexts>
                      </TeamCell>
                    ) : (
                      <Muted>무소속</Muted>
                    )}
                  </Cell>

                  <Cell>
                    {r.isTeamCaptain ? <CaptainBadge>팀장</CaptainBadge> : <NumBadgeZero>-</NumBadgeZero>}
                  </Cell>

                  <Cell>
                    {mediaTotal > 0 ? (
                      <NumBadge title={`img:${mediaImages} yt:${mediaYoutube}`}>{mediaTotal}</NumBadge>
                    ) : (
                      <NumBadgeZero>0</NumBadgeZero>
                    )}
                  </Cell>

                  <Cell>
                    {intro ? (
                      <LinkText type="button" onClick={() => openTextModal("소개", intro)}>
                        <Trunc>{intro}</Trunc>
                      </LinkText>
                    ) : (
                      <Muted>-</Muted>
                    )}
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmd(r.createdAt)}</Mono>
                  </Cell>

                  <Cell>
                    <Mono>{fmtYmdHm(r.updatedAt)}</Mono>
                  </Cell>

                  <Cell>
                    <BlockBtn
                      type="button"
                      onClick={() => openBlockModal(uid, nickname)}
                      disabled={!uid}
                    >
                      차단
                    </BlockBtn>
                  </Cell>
                </Row>
              );
            })}

            {!viewRows.length ? (
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
            <ModalBody>{modalBody || "-"}</ModalBody>
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
            <ModalTitle>회원 차단</ModalTitle>

            <TargetLine>
              대상: <strong>{blockTarget?.nickname || "-"}</strong>{" "}
              <span style={{ opacity: 0.6, fontSize: 12 }}>({blockTarget?.uid})</span>
            </TargetLine>

            <ModalLabel>차단 사유 (필수)</ModalLabel>
            <ReasonTextarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="예: 욕설/비방 다수 신고, 노쇼 반복 등"
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

      {previewOpen && previewTarget?.uid && (
        <Overlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreviewModal();
          }}
        >
          <PreviewModal onClick={(e) => e.stopPropagation()}>
            <PreviewHeader>
              <PreviewTitle title={previewTarget?.nickname}>
                {previewTarget?.nickname || "회원 정보"}
              </PreviewTitle>
              <Btn type="button" onClick={closePreviewModal} $primary>
                닫기
              </Btn>
            </PreviewHeader>
            <PreviewBody>
              <PlayerProfilePage
                key={previewTarget.uid}
                playerId={previewTarget.uid}
                embed
              />
            </PreviewBody>
          </PreviewModal>
        </Overlay>
      )}
    </Page>
  );
}
