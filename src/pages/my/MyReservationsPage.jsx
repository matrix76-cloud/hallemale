/* eslint-disable */
// src/pages/my/MyReservationsPage.jsx
// 내정보 > 내 구장 예약 — 사용자가 요청/확정한 구장 예약을 확인하고 본인 취소.
// 진입: /my/reservations  (내 정보 > 내 구장 예약, 예약 확정/반려 알림 딥링크)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useUIActions } from "../../hooks/useUI";
import { showConfirm } from "../../utils/appDialog";
import { listMyReservations, cancelMyReservation, getVenue } from "../../services/ownerVenueService";
import { addVenueReview, getMyVenueReview } from "../../services/venueReviewService";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { copyText, fullAddress, openDirections, openMapView } from "../../utils/venueLink";
import { cancelDeadlineText, usableFromText } from "../../constants/cancelPolicy";
import {
  FiMapPin, FiCalendar, FiClock, FiHash, FiPhone, FiInfo,
  FiCopy, FiMap, FiNavigation, FiFileText,
} from "react-icons/fi";

const toStr = (v) => String(v || "").trim();

// 상태 라벨 + 색상 (tone: warn/ok/gray/info/danger)
const STATUS_META = {
  requested: { label: "승인 대기", tone: "warn" },
  confirmed: { label: "예약 확정", tone: "ok" },
  done: { label: "이용 완료", tone: "info" },
  rejected: { label: "반려됨", tone: "gray" },
  cancelled: { label: "취소됨", tone: "gray" },
  noshow: { label: "노쇼", tone: "danger" },
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(ymd) {
  const s = toStr(ymd);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return s;
  return `${m[2]}.${m[3]} (${WEEK[d.getDay()]})`;
}
function isFuture(r) {
  const startISO = `${toStr(r.date)}T${toStr(r.startTime) || "00:00"}:00`;
  const t = new Date(startISO).getTime();
  return Number.isFinite(t) && t >= Date.now();
}
function canCancel(r) {
  // 매칭 예약은 여기서 취소 불가. cancelMyReservation 은 match_requests 를 동기화하지 않아
  // 예약만 취소되고 경기는 confirmed 로 남는다. 취소는 매칭룸 경로로만.
  if (toStr(r.matchId)) return false;
  return ["requested", "confirmed"].includes(toStr(r.status)) && isFuture(r);
}

export default function MyReservationsPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const { showToast } = useUIActions() || {};
  const toast = (m) => { if (showToast) showToast({ message: m }); };
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [loadErr, setLoadErr] = useState(false);
  const [busyId, setBusyId] = useState("");
  // 예약 문서에는 구장명·전화만 비정규화돼 있고 주소·좌표가 없다.
  // 길찾기/지도보기/주소복사를 붙이려면 필요하므로 venueId 별로 한 번씩만 구장을 읽어온다.
  const [venueById, setVenueById] = useState({});

  // 리뷰 작성 모달
  const [reviewFor, setReviewFor] = useState(null); // 리뷰 대상 예약
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  useBackInterceptor(!!reviewFor, () => setReviewFor(null));

  const openReview = async (r) => {
    setReviewFor(r);
    setReviewRating(0);
    setReviewText("");
    try {
      const mine = await getMyVenueReview(r.venueId, myUid);
      if (mine) { setReviewRating(Number(mine.rating) || 0); setReviewText(toStr(mine.text)); }
    } catch {}
  };

  const submitReview = async () => {
    if (!reviewFor || reviewBusy) return;
    if (!(reviewRating >= 1)) { toast("별점을 선택해 주세요."); return; }
    setReviewBusy(true);
    try {
      await addVenueReview({
        venueId: reviewFor.venueId,
        uid: myUid,
        userName: userDoc?.nickname,
        rating: reviewRating,
        text: reviewText,
      });
      toast("리뷰가 등록됐어요. 고마워요!");
      setReviewFor(null);
    } catch (e) {
      toast(e?.message || "리뷰 등록에 실패했어요.");
    } finally {
      setReviewBusy(false);
    }
  };

  // 목록에 등장한 구장만 중복 없이 조회. 실패한 구장은 그냥 액션 버튼이 덜 나올 뿐이라 무시한다.
  const loadVenues = async (list) => {
    const ids = Array.from(new Set(list.map((r) => toStr(r.venueId)).filter(Boolean)));
    if (ids.length === 0) return;
    const pairs = await Promise.all(
      ids.map(async (id) => {
        try { return [id, await getVenue(id)]; } catch { return [id, null]; }
      })
    );
    setVenueById(Object.fromEntries(pairs.filter(([, v]) => v)));
  };

  const copyAddr = async (addr) => {
    toast((await copyText(addr)) ? "주소를 복사했어요." : "주소 복사에 실패했어요.");
  };
  const copyCode = async (code) => {
    toast((await copyText(code)) ? "예약번호를 복사했어요." : "예약번호 복사에 실패했어요.");
  };

  const load = async () => {
    if (!myUid) { setLoading(false); return; }
    setLoading(true);
    setLoadErr(false);
    try {
      const list = await listMyReservations(myUid);
      setRows(Array.isArray(list) ? list : []);
      loadVenues(Array.isArray(list) ? list : []); // 주소·좌표는 뒤따라 채움 (목록 표시를 막지 않음)
    } catch (e) {
      console.warn("[MyReservationsPage] load failed:", e?.message || e);
      setLoadErr(true); // 실패를 "예약 없음"으로 위장하지 않음
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [myUid]);

  // 예정(미래·미종료) 먼저, 그다음 지난/종료
  const sorted = useMemo(() => {
    const active = [];
    const past = [];
    for (const r of rows) {
      (canCancel(r) || (isFuture(r) && !["rejected", "cancelled", "noshow", "done"].includes(r.status)))
        ? active.push(r)
        : past.push(r);
    }
    return [...active, ...past];
  }, [rows]);

  const handleCancel = async (r) => {
    if (busyId) return;
    const ok = await showConfirm(`${r.venueName}\n${fmtDate(r.date)} ${r.startTime}~${r.endTime}\n\n이 예약을 취소할까요?`);
    if (!ok) return;
    setBusyId(r.id);
    try {
      await cancelMyReservation(r.id, myUid);
      toast("예약을 취소했어요.");
      await load();
    } catch (e) {
      toast(e?.message || "예약 취소에 실패했어요.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <Wrap>
        <LoadingCenter><Spinner /></LoadingCenter>
      </Wrap>
    );
  }

  if (loadErr && rows.length === 0) {
    return (
      <Wrap>
        <EmptyState text="예약을 불러오지 못했어요. 네트워크를 확인해 주세요." />
        <FindBtn type="button" onClick={load}>다시 시도</FindBtn>
      </Wrap>
    );
  }

  if (sorted.length === 0) {
    return (
      <Wrap>
        <EmptyState text="아직 예약한 구장이 없어요." />
        <FindBtn type="button" onClick={() => navigate("/venues")}>구장 둘러보기</FindBtn>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Notice>예약은 구장 승인 후 확정돼요. 이용료는 현장에서 정산합니다.</Notice>
      <List>
        {sorted.map((r) => {
          const meta = STATUS_META[r.status] || STATUS_META.requested;
          const v = venueById[toStr(r.venueId)];
          const addr = fullAddress(v?.address, v?.addressDetail);
          const phone = toStr(r.venuePhone || v?.phone || v?.contactPhone);
          const place = { name: r.venueName || v?.name, address: addr, lat: v?.lat, lng: v?.lng };
          // 확정 + 아직 안 지난 예약에만 "언제부터 이용" / 액션 버튼을 붙인다.
          const live = r.status === "confirmed" && isFuture(r);
          return (
            <Card key={r.id}>
              <TopRow>
                <VenueName
                  onClick={() => r.venueId && navigate(`/venue-book/${r.venueId}`)}
                  role="button"
                >
                  {r.venueName || "구장"}
                </VenueName>
                <StatusChip $tone={meta.tone}>{meta.label}</StatusChip>
              </TopRow>

              {/* 확정 예약: 언제부터 쓸 수 있는지를 D-day 대신 문장으로 */}
              {live ? <UseBanner><FiInfo size={14} />{usableFromText(r.date, r.startTime)}</UseBanner> : null}

              {r.reservationCode ? (
                <MetaRow $mono>
                  <FiHash size={13} />예약번호 {r.reservationCode}
                  <MiniBtn type="button" onClick={() => copyCode(r.reservationCode)}>
                    <FiCopy size={11} /> 복사
                  </MiniBtn>
                </MetaRow>
              ) : null}
              {r.courtName ? (
                <MetaRow><FiMapPin size={13} />{r.courtName}</MetaRow>
              ) : null}
              <MetaRow><FiCalendar size={13} />{fmtDate(r.date)}</MetaRow>
              <MetaRow><FiClock size={13} />{r.startTime}~{r.endTime}</MetaRow>
              {addr ? <AddrRow>{addr}</AddrRow> : null}

              {/* 확정 예약: 전화 / 주소복사 / 지도 / 길찾기 — 현장 도착까지 필요한 액션 한 줄 */}
              {live && (phone || addr || (v?.lat != null && v?.lng != null)) ? (
                <ActionGrid>
                  {phone ? (
                    <ActionCell as="a" href={`tel:${phone}`}><FiPhone size={16} /><span>구장문의</span></ActionCell>
                  ) : null}
                  {addr ? (
                    <ActionCell type="button" onClick={() => copyAddr(addr)}><FiCopy size={16} /><span>주소복사</span></ActionCell>
                  ) : null}
                  {addr || v?.lat != null ? (
                    <>
                      <ActionCell type="button" onClick={() => openMapView(place)}><FiMap size={16} /><span>지도보기</span></ActionCell>
                      <ActionCell type="button" onClick={() => openDirections(place)}><FiNavigation size={16} /><span>길찾기</span></ActionCell>
                    </>
                  ) : null}
                </ActionGrid>
              ) : null}

              {/* 구장주 안내글 (승인 시 남긴 메시지) */}
              {r.status === "confirmed" && r.ownerNote ? (
                <OwnerNote><FiInfo size={13} /><span>{r.ownerNote}</span></OwnerNote>
              ) : null}

              {/* 예약 시 남긴 요청사항 */}
              {r.userNote ? (
                <OwnerNote><FiFileText size={13} /><span><b>요청사항</b> {r.userNote}</span></OwnerNote>
              ) : null}

              <BottomRow>
                <Price>{(Number(r.price) || 0).toLocaleString()}원 <small>· 현장 정산</small></Price>
                {canCancel(r) ? (
                  <CancelBtn type="button" disabled={busyId === r.id} onClick={() => handleCancel(r)}>
                    {busyId === r.id ? "취소 중…" : "예약 취소"}
                  </CancelBtn>
                ) : null}
              </BottomRow>

              {canCancel(r) ? (
                <CancelHint>{cancelDeadlineText(r.date, r.startTime)}</CancelHint>
              ) : null}

              {/* 취소 기한이 지난 확정 예약: 왜 버튼이 없는지 + 어디로 문의할지 */}
              {!canCancel(r) && !r.matchId && r.status === "confirmed" && !isFuture(r) ? (
                <ClosedHint>
                  이용 시작 시각이 지나 앱에서는 취소할 수 없어요.
                  {phone ? <> 문의는 구장(<a href={`tel:${phone}`}>{phone}</a>)으로 해주세요.</> : " 구장에 직접 문의해 주세요."}
                </ClosedHint>
              ) : null}

              {/* 매칭 예약: 취소·변경은 매칭룸에서만 가능하므로 그쪽으로 보낸다 */}
              {r.matchId && !["rejected", "cancelled", "noshow", "done"].includes(r.status) ? (
                <MatchHint
                  type="button"
                  onClick={() => navigate(`/match-roomdetail/${r.matchId}`)}
                >
                  매칭 경기 예약이에요. 취소·변경은 매칭룸에서 →
                </MatchHint>
              ) : null}

              {r.status === "done" && r.venueId ? (
                <ReviewBtn type="button" onClick={() => openReview(r)}>⭐ 리뷰 쓰기</ReviewBtn>
              ) : null}
            </Card>
          );
        })}
      </List>

      {reviewFor ? (
        <RvOverlay onClick={() => setReviewFor(null)}>
          <RvCard onClick={(e) => e.stopPropagation()}>
            <RvTitle>{reviewFor.venueName || "구장"} 리뷰</RvTitle>
            <RvStars>
              {[1, 2, 3, 4, 5].map((n) => (
                <RvStar key={n} type="button" $on={n <= reviewRating} onClick={() => setReviewRating(n)}>★</RvStar>
              ))}
            </RvStars>
            <RvTextArea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="이용 경험을 남겨주세요 (선택)"
              maxLength={1000}
            />
            <RvActions>
              <RvCancel type="button" onClick={() => setReviewFor(null)} disabled={reviewBusy}>취소</RvCancel>
              <RvSubmit type="button" onClick={submitReview} disabled={reviewBusy}>
                {reviewBusy ? "등록 중…" : "등록"}
              </RvSubmit>
            </RvActions>
          </RvCard>
        </RvOverlay>
      ) : null}
    </Wrap>
  );
}

/* ---------- styles ---------- */
const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 14px 16px calc(32px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Notice = styled.div`
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 10px;
  padding: 10px 12px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const VenueName = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TONES = {
  warn: { bg: "#fef3c7", fg: "#b45309" },
  ok: { bg: "#dcfce7", fg: "#16a34a" },
  info: { bg: "#e0f2fe", fg: "#0369a1" },
  gray: { bg: "#f1f5f9", fg: "#475569" },
  danger: { bg: "#fee2e2", fg: "#dc2626" },
};
const StatusChip = styled.span`
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${({ $tone }) => (TONES[$tone] || TONES.gray).bg};
  color: ${({ $tone }) => (TONES[$tone] || TONES.gray).fg};
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  ${({ $mono }) => $mono ? "font-variant-numeric: tabular-nums; letter-spacing: 0.02em; font-weight: 700;" : ""}
  & > svg { color: ${({ theme }) => theme.colors.textWeak}; flex-shrink: 0; }
`;

const OwnerNote = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 10px;
  padding: 9px 11px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; margin-top: 2px; }
`;

const UseBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 10px;
  padding: 9px 11px;
  & > svg { flex-shrink: 0; }
`;

const AddrRow = styled.div`
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
  padding-left: 19px;
`;

const MiniBtn = styled.button`
  margin-left: 2px;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  &:active { transform: translateY(1px); }
`;

const ActionGrid = styled.div`
  margin-top: 4px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 6px;
`;

const ActionCell = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 58px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 11.5px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

const CancelHint = styled.div`
  font-size: 11.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ClosedHint = styled.div`
  font-size: 11.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 10px;
  padding: 9px 11px;
  & a { color: ${({ theme }) => theme.colors.primary}; font-weight: 700; }
`;

const MatchHint = styled.button`
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font-size: 11.5px;
  line-height: 1.5;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  text-align: left;
`;

const BottomRow = styled.div`
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Price = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  & small { font-size: 11px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }
`;

const CancelBtn = styled.button`
  flex-shrink: 0;
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
  &:active { transform: translateY(1px); }
`;

const FindBtn = styled.button`
  align-self: center;
  height: 46px;
  padding: 0 28px;
  border-radius: 12px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;

const LoadingCenter = styled.div`
  flex: 1;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* ---------- 리뷰 ---------- */
const ReviewBtn = styled.button`
  align-self: flex-start;
  margin-top: 2px;
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

const RvOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 950;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

const RvCard = styled.div`
  width: 100%;
  max-width: 480px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px 18px 0 0;
  padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RvTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RvStars = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
`;

const RvStar = styled.button`
  border: none;
  background: transparent;
  font-size: 34px;
  line-height: 1;
  cursor: pointer;
  color: ${({ $on, theme }) => ($on ? "#f59e0b" : theme.colors.border)};
  &:active { transform: scale(0.92); }
`;

const RvTextArea = styled.textarea`
  width: 100%;
  min-height: 88px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 14px;
  font-family: inherit;
  padding: 12px;
  outline: none;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
  &::placeholder { color: ${({ theme }) => theme.colors.textWeak}; }
`;

const RvActions = styled.div`
  display: flex;
  gap: 8px;
`;

const RvCancel = styled.button`
  flex: 1;
  height: 48px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.6; }
`;

const RvSubmit = styled.button`
  flex: 2;
  height: 48px;
  border-radius: 12px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;
