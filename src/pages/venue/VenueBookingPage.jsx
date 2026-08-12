/* eslint-disable */
// src/pages/venue/VenueBookingPage.jsx
// 구장 상세 — 코트/날짜/슬롯 인라인 선택 → 스티키 예약바(구장 승인제 · 승인 후 앱내 결제).
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useUIActions } from "../../hooks/useUI";
import { useBackInterceptor } from "../../hooks/useBackInterceptor";
import { proposeMatchSchedule } from "../../services/matchRoomService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import {
  getVenue,
  listReservations,
  listBlocks,
  bookVenue,
  writePartnerBooking,
  calcSlotPrice,
  splitPrice,
  dowToKey,
  isPerPerson,
  clampHeadcount,
  courtUnitPrice,
  resolveSlotPrice,
  FACILITY_OPTIONS,
} from "../../services/ownerVenueService";
import { setFavoriteVenue } from "../../services/favoriteService";
import { BOOKING_WINDOW_DAYS } from "../../constants/booking";
import { CANCEL_POLICY_TIERS, CANCEL_POLICY_NOTE } from "../../constants/cancelPolicy";
import { calcDisplayPrice, PAYMENTS_ENABLED } from "../../constants/payments";
import { openDirections, openMapView, copyText, fullAddress } from "../../utils/venueLink";
import Spinner from "../../components/common/Spinner";
import VenueMiniMap from "../../components/matchRoom/VenueMiniMap";
import { FiMapPin, FiGrid, FiCalendar, FiClock, FiInfo, FiFileText, FiCreditCard, FiCheckCircle, FiPhone, FiCopy, FiStar, FiImage, FiHome, FiMap, FiNavigation, FiUsers, FiHeart, FiZap, FiTag, FiChevronRight } from "react-icons/fi";
import { FacilityIcon } from "./facilityIcons";
import CourtNotices from "./CourtNotices";
import { listVenueReviews } from "../../services/venueReviewService";

/* ---------- time helpers ---------- */
function toMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
function toHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function overlap(aS, aE, bS, bE) { return toMin(aS) < toMin(bE) && toMin(aE) > toMin(bS); }

/* 인원제 코트의 "1인 얼마" — calcSlotPrice 에 headcount=1 을 넘겨도 clampHeadcount 가
   최소 인원까지 올려 잡아 총액이 돌아온다(최소 4명 코트면 4명분). 1인 단가를 그렇게 구하면
   "1인 24,000원" 처럼 4배로 적히므로, 인원을 곱하기 전 단계에서 따로 계산한다. */
function onePersonPrice(court, date, start, end) {
  const per = resolveSlotPrice(court, date, start);
  return Math.round((per * Math.max(0, toMin(end) - toMin(start))) / 60);
}
function buildSlots(court, dayKey) {
  if (!court) return [];
  const h = court.hours?.[dayKey];
  if (!h || h.closed) return [];
  const step = court.slotMinutes || 60;
  const out = [];
  for (let t = toMin(h.open); t + step <= toMin(h.close); t += step) out.push({ start: toHHMM(t), end: toHHMM(t + step) });
  return out;
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/* 상단 고정 섹션 탭 — 숙박앱(여기어때)식. 페이지가 길어서 "어디에 뭐가 있는지"를
   스크롤로만 알아내야 했고, 예약·리뷰처럼 바로 가고 싶은 곳이 화면 밖에 있었다.
   실제로 그려진 섹션만 탭이 된다(secRefs 에 등록된 것만). */
const TAB_ORDER = [
  { key: "court", label: "코트·요금" },
  { key: "book", label: "예약" },
  { key: "location", label: "위치" },
  { key: "review", label: "리뷰" },
  { key: "info", label: "안내" },
];
const TAB_OFFSET = 52; // 스티키 탭 자체 높이 — 이만큼 덜 내려야 섹션 제목이 탭에 안 가린다

/* 긴 소개·안내문은 4줄에서 자르고 "더보기"로 편다. 접힌 높이가 실제 높이보다
   작을 때만 버튼을 띄운다(짧은 글에 더보기가 붙으면 누를 게 없다). */
function LongText({ children }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [children]);
  return (
    <>
      <InfoPre ref={ref} $clamp={!open}>{children}</InfoPre>
      {(clipped || open) && (
        <MoreBtn type="button" onClick={() => setOpen((v) => !v)}>{open ? "접기" : "더보기"}</MoreBtn>
      )}
    </>
  );
}

/* 리뷰 작성일 — Firestore Timestamp(초)만 들어온다. 없으면 표시하지 않는다. */
function reviewDate(rv) {
  const sec = rv?.createdAt?.seconds;
  if (!sec) return "";
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/* 운영 시간 요약: 코트 hours(mon~sun)를 평일/토/일로 묶어서 표시 */
function hoursText(h) {
  return !h || h.closed ? "휴무" : `${h.open} ~ ${h.close}`;
}
function buildHoursSummary(court) {
  const hrs = court?.hours;
  if (!hrs) return [];
  const wk = ["mon", "tue", "wed", "thu", "fri"].map((k) => hoursText(hrs[k]));
  const allWeekdaySame = wk.every((x) => x === wk[0]);
  const sat = hoursText(hrs.sat);
  const sun = hoursText(hrs.sun);
  const rows = [];
  if (allWeekdaySame) rows.push(["평일", wk[0]]);
  else ["월", "화", "수", "목", "금"].forEach((d, i) => rows.push([d, wk[i]]));
  if (sat === sun) rows.push(["주말", sat]);
  else {
    rows.push(["토", sat]);
    rows.push(["일", sun]);
  }
  return rows;
}

/* 요금 요약: 코트가 등록한 요일별 시간대 요금(priceBands)을 운영시간과 같은 방식으로
   평일/토/일로 묶는다. 구간이 없는 코트는 기본 단가 한 줄만 보여주면 된다. */
function bandsText(bands) {
  return (bands || [])
    .map((b) => `${b.start}~${b.end} ${Number(b.price || 0).toLocaleString()}원`)
    .join("\n");
}
function buildPriceSummary(court) {
  const b = court?.priceBands;
  if (!b) return [];
  const wk = ["mon", "tue", "wed", "thu", "fri"].map((k) => bandsText(b[k]));
  const allWeekdaySame = wk.every((x) => x === wk[0]);
  const sat = bandsText(b.sat);
  const sun = bandsText(b.sun);
  const rows = [];
  if (allWeekdaySame) {
    if (wk[0]) rows.push(["평일", wk[0]]);
  } else {
    ["월", "화", "수", "목", "금"].forEach((d, i) => { if (wk[i]) rows.push([d, wk[i]]); });
  }
  if (sat === sun) {
    if (sat) rows.push(["주말", sat]);
  } else {
    if (sat) rows.push(["토", sat]);
    if (sun) rows.push(["일", sun]);
  }
  return rows;
}

export default function VenueBookingPage() {
  // /venue-book/:id            → 구장 페이지 (코트가 여러 개면 코트 목록만 보여주고 예약은 코트 페이지에서)
  // /venue-book/:id/court/:cid → 코트 상세 페이지 (그 코트만 놓고 소개·요금·공지·예약까지)
  // 예약 로직(슬롯·결제 시트·매칭 제안)은 한 벌뿐이라 컴포넌트를 나누지 않고 모드로 가른다.
  const { id, courtId: courtParam } = useParams();
  const courtView = !!courtParam;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get("match") || ""; // 매칭룸에서 들어온 경우
  const viewOnly = params.get("view") === "1"; // 매칭 카드에서 들어온 읽기 전용
  const { firebaseUser, userDoc } = useAuth();
  const { showToast } = useUIActions() || {};
  const toast = (message) => { if (showToast) showToast({ message }); };
  const uid = firebaseUser?.uid || "";

  const [venue, setVenue] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsOpen, setReviewsOpen] = useState(false); // 리뷰 전체 보기(기본 3개)
  const [loading, setLoading] = useState(true);
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState("");
  const [reservations, setReservations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null); // 매칭 두 팀 정보
  // 사진 전체보기 모달 — 구장 공통 사진과 코트별 사진이 각각 열리므로 대상을 담아둔다. { title, photos }
  const [viewer, setViewer] = useState(null);
  useBackInterceptor(!!viewer, () => setViewer(null)); // 사진 모달: HW 뒤로 시 페이지 이탈 대신 모달 닫기
  useBackInterceptor(payOpen, () => setPayOpen(false)); // 예약 확정 시트: HW 뒤로 시 시트 닫기
  const heroRef = useRef(null);
  const [heroIdx, setHeroIdx] = useState(0); // 상단 구장 사진 캐러셀 현재 인덱스

  // 섹션 탭 — 그려진 섹션의 DOM 을 모아 두고(secRefs), 스크롤 위치로 현재 탭을 정한다.
  // 스크롤 주체는 window 가 아니라 MainLayout 의 <main> 이라 그 컨테이너를 찾아 붙인다.
  const secRefs = useRef({});
  const setSec = (key) => (el) => {
    if (el) secRefs.current[key] = el;
    else delete secRefs.current[key];
  };
  const tabBarRef = useRef(null);
  const scrollerRef = useRef(null);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    let el = tabBarRef.current?.parentElement;
    while (el) {
      const ov = window.getComputedStyle(el).overflowY;
      if (ov === "auto" || ov === "scroll") break;
      el = el.parentElement;
    }
    const sc = el || null;
    scrollerRef.current = sc;
    if (!sc) return;
    const onScroll = () => {
      const base = sc.getBoundingClientRect().top + TAB_OFFSET + 8;
      let cur = "";
      for (const t of TAB_ORDER) {
        const node = secRefs.current[t.key];
        if (node && node.getBoundingClientRect().top <= base) cur = t.key;
      }
      setActiveTab(cur);
    };
    onScroll();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, [id, courtParam, loading]);

  const goSec = (key) => {
    const node = secRefs.current[key];
    if (!node) return;
    const sc = scrollerRef.current;
    if (!sc) return node.scrollIntoView({ behavior: "smooth", block: "start" });
    const top = node.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - TAB_OFFSET;
    sc.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  // 찜 — 목록(VenueListPage)과 같은 users.favVenueIds 를 쓴다. 상세에서도 바로 담을 수 있게.
  const [fav, setFav] = useState(false);
  useEffect(() => {
    setFav((userDoc?.favVenueIds || []).map((x) => String(x)).includes(String(id)));
  }, [userDoc?.favVenueIds, id]);
  const toggleFav = async () => {
    if (!uid) return toast("로그인이 필요해요.");
    const next = !fav;
    setFav(next);
    try {
      await setFavoriteVenue({ uid, venueId: id, isFavorite: next });
      toast(next ? "찜한 구장에 담았어요." : "찜을 해제했어요.");
    } catch (e) {
      setFav(!next);
      toast("찜 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
  };
  const onHeroScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth || 1;
    setHeroIdx(Math.round(el.scrollLeft / w));
  };

  // 매칭룸에서 들어온 경우: 두 팀 정보 로드(제안 시 상대팀 식별용)
  useEffect(() => {
    if (!matchId) { setMatchInfo(null); return; }
    let cancelled = false;
    getDoc(doc(db, "match_requests", matchId)).then((s) => {
      if (cancelled || !s.exists()) return;
      const d = s.data() || {};
      setMatchInfo({
        actorClubId: String(d.actorClubId || ""),
        targetClubId: String(d.targetClubId || ""),
        fromName: String(d.fromTeamSnapshot?.name || ""),
        toName: String(d.toTeamSnapshot?.name || ""),
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [matchId]);

  // 구장 리뷰 로드
  useEffect(() => {
    if (!id) return;
    let alive = true;
    listVenueReviews(id).then((rows) => { if (alive) setReviews(Array.isArray(rows) ? rows : []); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  const dates = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
      const d = new Date(base + i * 86400000);
      return { date: ymd(d), day: d.getDate(), wd: WEEK[d.getDay()], dow: d.getDay() };
    });
  }, []);

  const nowMin = useMemo(() => {
    const n = new Date();
    return { today: ymd(n), min: n.getHours() * 60 + n.getMinutes() };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVenue(id).then((v) => {
      if (cancelled) return;
      setVenue(v);
      // 코트 페이지면 URL 이 코트를 정한다 — 없는 코트 id 로 들어오면 첫 코트로 떨어뜨린다.
      const wanted = courtParam && v?.courts?.some((c) => c.id === courtParam) ? courtParam : "";
      setCourtId(wanted || v?.courts?.[0]?.id || "");
      setDate(dates[0]?.date || "");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [id, courtParam]);

  const court = venue?.courts?.find((c) => c.id === courtId) || venue?.courts?.[0] || null;
  const dayKey = useMemo(() => {
    const info = dates.find((d) => d.date === date);
    return info ? dowToKey(info.dow) : "mon";
  }, [dates, date]);
  const dayHours = court?.hours?.[dayKey];
  const isClosed = !dayHours || dayHours.closed;
  const slots = useMemo(() => buildSlots(court, dayKey), [court, dayKey]);

  const loadSlots = async () => {
    if (!venue?.id || !court?.id) return;
    setSlotsLoading(true);
    try {
      const [rs, bs] = await Promise.all([
        listReservations({ venueId: venue.id, date, courtId: court.id }),
        listBlocks({ venueId: venue.id, date, courtId: court.id }),
      ]);
      setReservations(rs); setBlocks(bs);
    } catch (e) {
      console.warn("[VenueBooking] loadSlots failed", e);
    } finally { setSlotsLoading(false); }
  };

  useEffect(() => { setSelected(null); loadSlots(); /* eslint-disable-next-line */ }, [venue?.id, courtId, date]);

  const slotState = (slot) => {
    if (reservations.some((r) => ["requested", "pending", "confirmed"].includes(r.status) && overlap(slot.start, slot.end, r.startTime, r.endTime))) return "reserved";
    if (blocks.some((b) => overlap(slot.start, slot.end, b.startTime, b.endTime))) return "blocked";
    if (date === nowMin.today && toMin(slot.start) <= nowMin.min) return "past";
    return "open";
  };

  // 연속된 빈 슬롯을 눌러 범위 선택
  const onSlotClick = (s) => {
    if (viewOnly) return;
    if (slotState(s) !== "open") return;
    const sS = toMin(s.start), sE = toMin(s.end);
    if (!selected) { setSelected({ start: s.start, end: s.end }); return; }
    const selS = toMin(selected.start), selE = toMin(selected.end);
    if (sS === selE) return setSelected({ start: selected.start, end: s.end });
    if (sE === selS) return setSelected({ start: s.start, end: selected.end });
    if (sS >= selS && sE <= selE) {
      if (selE - selS <= sE - sS) return setSelected(null);
      if (sE === selE) return setSelected({ start: selected.start, end: s.start });
      if (sS === selS) return setSelected({ start: s.end, end: selected.end });
      return setSelected({ start: s.start, end: s.end });
    }
    setSelected({ start: s.start, end: s.end });
  };

  // 인원제 코트(1인 요금)에서만 쓰는 인원. 코트를 바꾸면 그 코트의 최소 인원으로 되돌린다.
  const perPerson = isPerPerson(court);
  const [headcount, setHeadcount] = useState(1);
  useEffect(() => { setHeadcount(clampHeadcount(court, court?.minHeadcount)); }, [court?.id]); // eslint-disable-line
  const heads = clampHeadcount(court, headcount);
  const maxHeads = Math.max(0, Number(court?.maxHeadcount) || 0);
  const minHeads = Math.max(1, Number(court?.minHeadcount) || 1);

  const price = selected && court ? calcSlotPrice(court, selected.start, selected.end, date, heads) : 0;
  // 총액 표시 모델 — 구장 등록가가 곧 결제액이다. 플랫폼 이용료는 여기에 더하는 게 아니라
  // 구장 정산에서 떼므로, 소비자 화면에는 항목으로 노출하지 않는다.
  const payTotal = price;

  // 예약 시트에서 구장에 전달할 요청사항 (선택)
  const [userNote, setUserNote] = useState("");

  const copyAddress = async () => {
    const full = fullAddress(venue?.address, venue?.addressDetail);
    if (!full) return;
    toast((await copyText(full)) ? "주소를 복사했어요." : "주소 복사에 실패했어요.");
  };

  const handleRequest = async () => {
    if (!uid) return toast("로그인이 필요해요.");
    if (!selected || !court) return;
    setPaying(true);
    try {
      await bookVenue({
        venue, court, date,
        startTime: selected.start, endTime: selected.end,
        user: {
          uid,
          userName: userDoc?.nickname || "",
          teamName: userDoc?.activeTeamName || userDoc?.teamName || "",
          phone: userDoc?.phoneE164 || userDoc?.phone || "",
        },
        userNote,
        headcount: heads,
      });
      setPayOpen(false);
      setUserNote("");
      setSelected(null);
      await loadSlots();
      // 즉시예약 구장은 승인 단계가 없다(bookVenue 가 pending/confirmed 로 바로 만든다).
      toast(
        venue?.autoApprove !== true
          ? "예약 요청을 보냈어요! 구장 승인 후 확정돼요."
          : PAYMENTS_ENABLED
            ? "예약이 잡혔어요! 결제를 마치면 확정돼요."
            : "예약이 확정됐어요!"
      );
    } catch (e) {
      if (e?.code === "slot_taken") { await loadSlots(); }
      toast(e?.message || "예약 요청에 실패했어요.");
    } finally { setPaying(false); }
  };

  const myClubId = userDoc?.activeTeamId || userDoc?.clubId || "";
  const handlePropose = async () => {
    if (!selected || !court) return;
    if (!matchInfo) return toast("매칭 정보를 불러오는 중이에요. 잠시 후 다시 시도해주세요.");
    if (!myClubId) return toast("팀 정보를 확인할 수 없어요.");
    if (venue.lat == null || venue.lng == null) return toast("이 구장은 좌표 정보가 없어 제안할 수 없어요.");
    // 매칭 제휴예약은 총액을 두 팀이 반씩 낸다 — 인원제 코트는 총액이 인원에 따라 달라져
    // 반반 규칙이 성립하지 않는다. 다른 코트·구장으로 제안하게 막는다.
    if (perPerson) return toast("1인 요금제 코트는 매칭 제휴예약으로 제안할 수 없어요. 다른 코트를 골라주세요.");

    const isActor = myClubId === matchInfo.actorClubId;
    const opponentClubId = isActor ? matchInfo.targetClubId : matchInfo.actorClubId;
    const myTeamName = isActor ? matchInfo.fromName : matchInfo.toName;
    const oppTeamName = isActor ? matchInfo.toName : matchInfo.fromName;

    // ✅ 제안 전 확인창
    const ok = await showConfirm(
      `${venue.name}\n${date} ${selected.start}~${selected.end}\n\n이 구장·일정으로 ${oppTeamName || "상대팀"}에게 제안할까요?`
    );
    if (!ok) return;

    setPaying(true);
    try {
      await proposeMatchSchedule({
        matchRequestId: matchId,
        scheduledAtISO: new Date(`${date}T${selected.start}:00`).toISOString(),
        fieldAddress: `${venue.name}${venue.address ? ` (${venue.address})` : ""}`,
        fieldLatLng: { lat: venue.lat, lng: venue.lng },
        durationMin: toMin(selected.end) - toMin(selected.start),
        proposedByClubId: myClubId,
        opponentClubId, // 이미 아는 값 → 서비스가 경기 문서를 다시 읽지 않는다
      });
      await writePartnerBooking({
        matchId, venue, court, date,
        startTime: selected.start, endTime: selected.end,
        proposerUid: uid, proposerClubId: myClubId, proposerTeamName: myTeamName,
        opponentClubId, opponentTeamName: oppTeamName,
      });
      toast("상대팀에 구장·일정을 제안했어요!");
      // 직접입력 제안 흐름과 동일하게 채팅 화면으로 복귀 (핀 카드 + 채팅 유지)
      navigate(`/match-roomdetail/${matchId}`, { replace: true });
    } catch (e) {
      toast(e?.message || "제안에 실패했어요.");
    } finally { setPaying(false); }
  };

  if (loading) return <Center><Spinner size="lg" /></Center>;
  if (!venue) return <Center>구장 정보를 찾을 수 없어요.</Center>;

  const photos = (venue.photos?.length ? venue.photos : venue.imageUrl ? [venue.imageUrl] : []).filter(Boolean);
  const courtPhotos = (court?.photos || []).filter(Boolean); // 선택한 코트의 사진
  const hasLatLng = venue.lat != null && venue.lng != null;
  // 보유 항목은 표준 목록 순서로 세우되, 목록에 없는 이름으로 등록된 것도 빠뜨리지 않는다
  // (표준 목록으로만 걸러내면 구장주가 등록한 "정수기" 같은 항목이 화면에서 사라진다.
  //  FacilityIcon 은 모르는 이름이면 기본 아이콘을 준다).
  const facAll = (venue.facilities || []).filter(Boolean);
  const facOwned = [
    ...FACILITY_OPTIONS.filter((f) => facAll.includes(f)),
    ...facAll.filter((f) => !FACILITY_OPTIONS.includes(f)),
  ];
  const facMissing = FACILITY_OPTIONS.filter((f) => !facAll.includes(f));
  // 구장 페이지인데 코트가 여러 개인 상태 = "코트 목록" 모드.
  // 이때는 특정 코트의 요금·운영시간·예약을 그리지 않는다(어느 코트 것인지 알 수 없으므로).
  const multiCourtIndex = !courtView && (venue.courts || []).length > 1;
  // 실제로 그려지는 섹션만 탭에 세운다 — 없는 곳으로 가는 탭은 눌러도 아무 일이 안 일어난다.
  const tabKeys = [court ? "court" : "", multiCourtIndex ? "" : "book", "location", "review", "info"].filter(Boolean);
  // 코트 페이지는 그 코트 사진을 머리에 세운다(없으면 구장 사진).
  const heroPhotos = courtView && courtPhotos.length > 0 ? courtPhotos : photos;
  const heroLabel = courtView && courtPhotos.length > 0 ? `${court?.name} 사진` : "구장 사진";
  // 코트 목록 모드의 하단 바에 쓸 "얼마부터" — 목록·지도와 같은 기준(가장 싼 코트 단가).
  const minCourtPrice = (venue.courts || [])
    .map((c) => calcDisplayPrice(courtUnitPrice(c)))
    .filter((p) => p > 0)
    .reduce((m, p) => (m === 0 || p < m ? p : m), 0);
  const hoursSummary = buildHoursSummary(court);
  const priceSummary = buildPriceSummary(court);
  // 즉시예약 구장은 구장주 승인 단계가 없다 — 안내문·버튼 문구가 흐름과 어긋나면 안 된다.
  const autoApprove = venue.autoApprove === true;
  const unitPrice = calcDisplayPrice(courtUnitPrice(court));
  const unitLabel = perPerson ? "1인 · 시간당" : "시간당";
  const parkLabel = !venue.parking?.available
    ? "불가"
    : venue.parking.fee === "paid" ? "유료" : "무료";
  // contactPhone(담당자 개인 휴대폰)은 "비공개"로 받은 값이라 폴백으로도 쓰지 않는다.
  const venuePhone = venue.phone || "";
  const place = {
    name: venue.name,
    address: fullAddress(venue.address, venue.addressDetail),
    lat: venue.lat,
    lng: venue.lng,
  };

  return (
    <Wrap>
      {/* 코트 페이지의 히어로는 그 코트 사진이다. 코트 사진이 없으면 구장 사진으로 내려간다
          (여기서는 대체해도 오해가 없다 — 비교 대상이 한 화면에 같이 있지 않으므로). */}
      {heroPhotos.length > 0 && (
        <Hero>
          <HeroTrack ref={heroRef} onScroll={onHeroScroll}>
            {heroPhotos.map((u, i) => (
              <HeroSlide key={i} src={u} alt={`${heroLabel} ${i + 1}`} />
            ))}
          </HeroTrack>
          {heroPhotos.length > 1 && <HeroCount>{heroIdx + 1}/{heroPhotos.length}</HeroCount>}
          {/* 사진은 여기 한 곳에서만 본다 — 예전엔 아래에 "시설 사진" 그리드가 따로 있어
              같은 사진을 한 페이지에서 두 번 보여주고 있었다. */}
          <HeroAll type="button" onClick={() => setViewer({ title: heroLabel, photos: heroPhotos })}>
            <FiImage size={13} /> 사진 {heroPhotos.length}장
          </HeroAll>
        </Hero>
      )}

      <Head>
        {courtView ? (
          <CourtCrumb type="button" onClick={() => navigate(`/venue-book/${id}${window.location.search}`)}>
            {venue.name} <FiChevronRight size={13} />
          </CourtCrumb>
        ) : null}
        <TitleRow>
          <VName>{courtView && court ? court.name : venue.name}</VName>
          <FavBtn type="button" onClick={toggleFav} $on={fav} aria-label={fav ? "찜 해제" : "찜하기"}>
            <FiHeart size={19} fill={fav ? "#ef4444" : "none"} />
          </FavBtn>
        </TitleRow>
        <MetaRow>
          {autoApprove ? (
            <InstantChip><FiZap size={12} /> 즉시 예약</InstantChip>
          ) : (
            <TagChip>승인 후 확정</TagChip>
          )}
          {venue.business?.status === "verified" ? (
            <VerifiedChip><FiCheckCircle size={12} /> 국세청 인증</VerifiedChip>
          ) : null}
          {Number(venue.rating) > 0 ? (
            // 평점은 리뷰로 가는 입구다 — 눌러서 리뷰 섹션으로 내려간다.
            <RatingChip type="button" onClick={() => goSec("review")}>
              <FiStar size={12} /> {Number(venue.rating).toFixed(1)}
              {venue.reviewCount ? <em>({venue.reviewCount})</em> : null}
            </RatingChip>
          ) : null}
          {(venue.sportTypes || []).map((s) => <SportChip key={s}>{s}</SportChip>)}
          <TagChip>{venue.type === "outdoor" ? "실외" : "실내"}</TagChip>
          <TagChip>{venue.cost === "free" ? "무료" : "유료"}</TagChip>
          {venue.region ? <TagChip $muted>{venue.region}</TagChip> : null}
        </MetaRow>
        <VAddr>{venue.address} {venue.addressDetail}</VAddr>
        {(venue.keywords || []).length > 0 && (
          <KeywordRow>{venue.keywords.map((k) => <Kw key={k}>#{k}</Kw>)}</KeywordRow>
        )}
      </Head>

      {/* 섹션 탭 — 스크롤하면 상단에 붙는다. 현재 보고 있는 섹션이 밑줄로 표시된다. */}
      <TabBar ref={tabBarRef}>
        {TAB_ORDER.filter((t) => tabKeys.includes(t.key)).map((t) => (
          <Tab key={t.key} type="button" $on={activeTab === t.key} onClick={() => goSec(t.key)}>
            {t.key === "review" && Number(venue.reviewCount) > 0 ? `${t.label} ${venue.reviewCount}` : t.label}
          </Tab>
        ))}
      </TabBar>

      {/* 핵심 정보 한 줄 요약 — 스크롤하지 않고도 요금·예약 단위·확정 방식·주차를 판단할 수 있게. */}
      {court ? (
        <KeyFacts>
          <KfCell>
            <KfLabel>요금</KfLabel>
            <KfValue>{unitPrice > 0 ? `${unitPrice.toLocaleString()}원` : "문의"}</KfValue>
            <KfSub>{unitPrice > 0 ? unitLabel : "구장에 확인"}</KfSub>
          </KfCell>
          <KfCell>
            <KfLabel>예약 단위</KfLabel>
            <KfValue>{court.slotMinutes || 60}분</KfValue>
            <KfSub>연속 선택 가능</KfSub>
          </KfCell>
          <KfCell>
            <KfLabel>확정 방식</KfLabel>
            <KfValue>{autoApprove ? "즉시" : "승인 후"}</KfValue>
            <KfSub>{autoApprove ? "승인 없이 확정" : "구장주 승인"}</KfSub>
          </KfCell>
          <KfCell>
            <KfLabel>주차</KfLabel>
            <KfValue>{parkLabel}</KfValue>
            <KfSub>{venue.parking?.available ? (venue.parking.info || "이용 가능") : "인근 주차장 이용"}</KfSub>
          </KfCell>
        </KeyFacts>
      ) : null}

      <Notice>
        <FiInfo size={15} />
        <span>
          예약 전 <b>운영 시간·이용 안내</b>를 확인해 주세요.{" "}
          {!autoApprove ? (
            <>예약을 요청하면 구장주가 승인하고, 안내에 따라 앱에서 결제하면 예약이 확정돼요.</>
          ) : PAYMENTS_ENABLED ? (
            <>이 구장은 <b>즉시 예약</b>이라 승인 절차 없이 시간이 바로 잡히고, 결제를 마치면 확정돼요.</>
          ) : (
            <>이 구장은 <b>즉시 예약</b>이라 승인 절차 없이 예약이 바로 확정돼요.</>
          )}
        </span>
      </Notice>

      {venue.description && (
        <Section>
          {/* venue.description(구장 단위 소개)을 그리는 자리다 — 코트별 설명이 아니다. */}
          <SecTitle><FiInfo size={17} />구장 소개</SecTitle>
          <LongText>{venue.description}</LongText>
        </Section>
      )}

      {/* 보유한 것만 아이콘으로 세우고, 없는 건 한 줄 텍스트로 내린다.
          예전엔 전체 목록을 다 그려서 12칸 중 8칸이 회색 아이콘이었다 — 없다는 정보를
          아이콘 8개 자리로 말하고 있었다. */}
      <Section>
        <SecTitle><FiCheckCircle size={17} />편의시설</SecTitle>
        {facOwned.length > 0 ? (
          <FacGrid>
            {facOwned.map((f) => (
              <FacCell key={f} $on>
                <FacIconWrap $on><FacilityIcon name={f} size={22} /></FacIconWrap>
                <FacLabel>{f}</FacLabel>
              </FacCell>
            ))}
          </FacGrid>
        ) : (
          <InfoPre>등록된 편의시설 정보가 없어요.</InfoPre>
        )}
        {facMissing.length > 0 && <FacNone>미보유 · {facMissing.join(" · ")}</FacNone>}
      </Section>

      {/* 코트에 딸린 정보는 전부 이 한 블록에 모은다 — 코트 고르기 → 사진 → 요금 → 스펙 →
          운영 시간 → 그 코트의 공지. 예전엔 이 다섯이 페이지 위아래로 흩어져 있어서,
          코트를 바꾸면 화면 곳곳이 같이 바뀌는데 사용자는 그걸 볼 수 없었다.
          슬롯을 눌러보기 전에 "얼마짜리 어떤 코트인지"가 먼저 보여야 하므로 예약 섹션보다 앞에 둔다. */}
      {court && (
        <Section ref={setSec("court")}>
          <SecTitle>
            <FiTag size={17} />
            {multiCourtIndex ? `코트 ${venue.courts.length}개` : "코트·요금"}
            {courtView && court.name ? <SecSub>· {court.name}</SecSub> : null}
          </SecTitle>
          {multiCourtIndex ? (
            <SecLead>코트마다 사진·요금·운영시간이 달라요. 눌러서 코트 상세를 보고 예약하세요.</SecLead>
          ) : null}

          {/* 코트 카드 = 숙박앱의 "객실 카드". 썸네일 · 스펙 · 요금 · 예약 버튼이 한 줄에 있어
              카드 하나만 봐도 그 코트를 예약할지 말지 판단된다.
              썸네일은 그 코트가 등록한 사진이다 — 없으면 구장 대표 사진으로 때우지 않는다:
              그러면 모든 코트가 같은 그림이 돼 "차이가 없다"고 잘못 알려주게 된다.
              썸네일을 누르면 그 코트 사진만 전체보기로 열린다(카드 이동과 구분). */}
          {multiCourtIndex && (
            <CourtList>
              {venue.courts.map((c) => {
                const cp = (c.photos || []).filter(Boolean);
                const cUnit = calcDisplayPrice(courtUnitPrice(c));
                return (
                  <CourtCard
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/venue-book/${id}/court/${c.id}${window.location.search}`)}
                  >
                    {cp.length > 0 ? (
                      <CourtThumbWrap
                        onClick={(e) => { e.stopPropagation(); setViewer({ title: `${c.name} 사진`, photos: cp }); }}
                      >
                        <CourtThumb src={cp[0]} alt={`${c.name} 사진`} />
                        {cp.length > 1 ? <ThumbCount>+{cp.length - 1}</ThumbCount> : null}
                      </CourtThumbWrap>
                    ) : (
                      <CourtThumbEmpty><FiImage size={17} /><span>사진 없음</span></CourtThumbEmpty>
                    )}
                    <CourtInfo>
                      <CourtCName>{c.name}</CourtCName>
                      <CourtCSub>
                        {c.type === "outdoor" ? "실외" : "실내"}
                        {c.surface ? ` · ${c.surface}` : ""}
                        {` · ${c.slotMinutes || 60}분 단위`}
                      </CourtCSub>
                      {c.description ? <CourtCDesc>{c.description}</CourtCDesc> : null}
                      <CourtPriceRow>
                        <CourtCPrice>
                          {cUnit > 0 ? `${cUnit.toLocaleString()}원` : "문의"}
                          <small>{isPerPerson(c) ? " /1인·시간" : " /시간"}</small>
                        </CourtCPrice>
                        <CourtGo>예약하기 <FiChevronRight size={14} /></CourtGo>
                      </CourtPriceRow>
                    </CourtInfo>
                  </CourtCard>
                );
              })}
            </CourtList>
          )}

          {/* 아래는 "이 코트 하나"의 상세 — 코트 목록을 보여주는 구장 페이지에서는 그리지 않는다.
              (목록에서 특정 코트의 요금·운영시간을 같이 띄우면 어느 코트 것인지 알 수 없다) */}
          {!multiCourtIndex && (
          <>
          {court.description ? <InfoPre>{court.description}</InfoPre> : null}

          {/* 코트 페이지는 히어로가 이미 코트 사진이다 — 여기서 또 그리면 같은 사진이 두 번 나온다.
              구장 페이지(코트 1개)에서는 히어로가 구장 사진이라 이 스트립이 코트 사진의 유일한 자리다. */}
          {!courtView && courtPhotos.length > 0 && (
            <CourtPhotos>
              <SecTitleRow>
                <CourtPhotoLabel>{court?.name} 사진 {courtPhotos.length}장</CourtPhotoLabel>
                <SeeAll type="button" onClick={() => setViewer({ title: `${court?.name} 사진`, photos: courtPhotos })}>
                  전체보기
                </SeeAll>
              </SecTitleRow>
              <CourtPhotoStrip>
                {courtPhotos.map((u, i) => (
                  <CourtPhotoImg
                    key={i}
                    src={u}
                    alt={`${court?.name} 사진 ${i + 1}`}
                    onClick={() => setViewer({ title: `${court?.name} 사진`, photos: courtPhotos })}
                  />
                ))}
              </CourtPhotoStrip>
            </CourtPhotos>
          )}

          <HoursTable>
            <HoursRow>
              <span>기본 요금</span>
              <b>{unitPrice > 0 ? `${unitPrice.toLocaleString()}원 / ${perPerson ? "1인 1시간" : "1시간"}` : "구장 문의"}</b>
            </HoursRow>
            {priceSummary.map(([label, val]) => (
              <HoursRow key={label}>
                <span>{label}</span>
                <BandVal>{val}</BandVal>
              </HoursRow>
            ))}
          </HoursTable>
          <PolicyNote>
            표시 금액이 곧 결제 금액이에요. 추가 수수료는 붙지 않아요.
            {priceSummary.length ? " 시간대별 요금이 정해진 구간은 위 금액이 먼저 적용돼요." : ""}
            {perPerson ? " 인원제 코트라 총액은 1인 요금 × 시간 × 인원으로 계산돼요." : ""}
          </PolicyNote>
          <SpecGrid>
            {[
              ["코트 유형", court.type === "outdoor" ? "실외" : "실내"],
              ["바닥재", court.surface || "미등록"],
              ["과금 방식", perPerson ? "1인 요금제" : "코트 대관"],
              perPerson
                ? ["이용 인원", `최소 ${minHeads}명${maxHeads > 0 ? ` · 최대 ${maxHeads}명` : ""}`]
                : ["예약 단위", `${court.slotMinutes || 60}분`],
            ].map(([k, v]) => (
              <SpecCell key={k}>
                <SpecK>{k}</SpecK>
                <SpecV>{v}</SpecV>
              </SpecCell>
            ))}
          </SpecGrid>

          {hoursSummary.length > 0 && (
            <>
              <SubHead><FiClock size={15} />운영 시간</SubHead>
              <HoursTable>
                {hoursSummary.map(([label, val]) => (
                  <HoursRow key={label} $off={val === "휴무"}>
                    <span>{label}</span>
                    <b>{val}</b>
                  </HoursRow>
                ))}
              </HoursTable>
            </>
          )}

          {/* 이 코트의 공지·주의사항 — 코트를 고른 자리 바로 아래여야 어느 코트 얘기인지 통한다. */}
          <CourtNotices court={court} />
          </>
          )}
        </Section>
      )}

      {/* 코트 목록을 보여주는 구장 페이지에서는 예약을 받지 않는다 — 코트를 고른 뒤 코트 페이지에서 잡는다. */}
      {!multiCourtIndex && (
      <Section ref={setSec("book")}>
        <SecTitle><FiGrid size={17} />{viewOnly ? "예약 현황" : "예약"}</SecTitle>
        {(venue.courts || []).length === 0 ? (
          <CourtEmpty>아직 등록된 코트가 없어요. 구장에 문의해 주세요.</CourtEmpty>
        ) : (
          <>
            {/* 코트 선택·사진은 위 "코트·요금" 블록으로 옮겼다 — 여기서는 날짜와 시간만 고른다. */}
            <DateStrip>
              {dates.map((d) => (
                <DateCell key={d.date} $on={d.date === date} $dow={d.dow} onClick={() => setDate(d.date)}>
                  <small>{d.wd}</small><b>{d.day}</b>
                </DateCell>
              ))}
            </DateStrip>

            <LegendRow>
              <Legend>
                <span className="open">예약 가능</span>
                <span className="reserved">예약완료</span>
                <span className="blocked">사용 불가</span>
              </Legend>
              {/* 날짜 스트립이 3주에서 끊기는 이유를 화면에서 알려준다(BOOKING_WINDOW_DAYS). */}
              <LegendNote>오늘부터 {BOOKING_WINDOW_DAYS}일 이내 예약 가능</LegendNote>
            </LegendRow>

            {isClosed ? (
              <Empty>이 요일은 휴무예요.</Empty>
            ) : slots.length === 0 ? (
              <Empty>운영 시간이 없어요.</Empty>
            ) : (
              <SlotGrid>
                {slots.map((s, i) => {
                  const st = slotState(s);
                  const on = selected && toMin(s.start) >= toMin(selected.start) && toMin(s.end) <= toMin(selected.end);
                  return (
                    <Slot key={i} $st={st} $on={on} disabled={st !== "open"} onClick={() => onSlotClick(s)}>
                      <b>{s.start}~{s.end}</b>
                      <span className={st === "open" ? "price" : ""}>
                        {/* 슬롯 금액도 목록과 같은 기준(결제 총액)으로 보여준다 — 고르는 동안 금액이 커지면 순차공개 가격책정이 된다.
                            인원제 코트는 인원에 따라 총액이 달라지므로 슬롯에는 1인 단가를 적는다. */}
                        {st === "reserved" ? "예약완료" : st === "blocked" ? "사용 불가" : st === "past" ? "마감"
                          : `${perPerson ? "1인 " : ""}${calcDisplayPrice(
                              perPerson ? onePersonPrice(court, date, s.start, s.end) : calcSlotPrice(court, s.start, s.end, date, 1)
                            ).toLocaleString()}원`}
                      </span>
                    </Slot>
                  );
                })}
              </SlotGrid>
            )}

            {/* 인원제 코트 — 인원이 곧 금액이라 시간 선택 바로 아래에서 정한다. */}
            {perPerson && !viewOnly && selected && (
              <HeadBox>
                <HeadTop>
                  <HeadLabel><FiUsers size={15} /> 이용 인원</HeadLabel>
                  <Stepper>
                    <StepBtn type="button" onClick={() => setHeadcount((n) => Math.max(minHeads, n - 1))} disabled={heads <= minHeads}>−</StepBtn>
                    <StepNum>{heads}명</StepNum>
                    <StepBtn type="button" onClick={() => setHeadcount((n) => (maxHeads > 0 ? Math.min(maxHeads, n + 1) : n + 1))} disabled={maxHeads > 0 && heads >= maxHeads}>＋</StepBtn>
                  </Stepper>
                </HeadTop>
                <HeadHint>
                  1인 {calcDisplayPrice(onePersonPrice(court, date, selected.start, selected.end)).toLocaleString()}원 × {heads}명
                  {maxHeads > 0 ? ` · 최대 ${maxHeads}명` : ""}
                </HeadHint>
                {/* 최소 인원은 구장이 정한 하한이다 — 적게 와도 이 인원 요금을 낸다는 걸 결제 전에 못 박는다. */}
                {minHeads > 1 && (
                  <HeadHint>
                    이 코트는 <b>최소 {minHeads}명</b>부터 예약할 수 있어요. {minHeads}명보다 적게 와도 {minHeads}명 요금이에요.
                  </HeadHint>
                )}
              </HeadBox>
            )}
          </>
        )}
      </Section>
      )}

      <Section ref={setSec("location")}>
        <SecTitle><FiMapPin size={17} />위치·교통</SecTitle>
        {hasLatLng && <VenueMiniMap latLng={{ lat: venue.lat, lng: venue.lng }} height={170} />}
        <AddrRow>
          <VAddr style={{ flex: 1 }}>
            <FiMapPin size={13} style={{ verticalAlign: -2 }} /> {venue.address} {venue.addressDetail}
          </VAddr>
          <CopyBtn type="button" onClick={copyAddress}><FiCopy size={12} /> 주소복사</CopyBtn>
        </AddrRow>
        {venuePhone ? (
          <PhoneLink href={`tel:${venuePhone}`}><FiPhone size={13} /> {venuePhone}</PhoneLink>
        ) : null}
        <ParkRow $off={!venue.parking?.available}>
          🅿️ {venue.parking?.available
            ? `주차 가능 · ${venue.parking.fee === "paid" ? "유료" : "무료"}${venue.parking.info ? ` · ${venue.parking.info}` : ""}`
            : "주차 불가"}
        </ParkRow>
        {venue.directions ? (
          <DirBox><b>찾아오는 길</b><InfoPre>{venue.directions}</InfoPre></DirBox>
        ) : null}
        {venue.address || hasLatLng ? (
          <MapBtnRow>
            <MapBtn type="button" onClick={() => openMapView(place)}>
              <FiMap size={15} /> 지도보기
            </MapBtn>
            <MapBtn type="button" onClick={() => openDirections(place)}>
              <FiNavigation size={15} /> 길찾기
            </MapBtn>
          </MapBtnRow>
        ) : null}
      </Section>

      {venue.rules && (
        <Section ref={setSec("info")}>
          <SecTitle><FiFileText size={17} />이용 안내</SecTitle>
          <LongText>{venue.rules}</LongText>
        </Section>
      )}
      <Section ref={venue.rules ? undefined : setSec("info")}>
        <SecTitle><FiCreditCard size={17} />취소·환불 규정</SecTitle>
        <PolicyTable>
          {CANCEL_POLICY_TIERS.map((t) => (
            <PolicyRow key={t.when}>
              <PolicyWhen>{t.when}</PolicyWhen>
              <PolicyWhat $tone={t.tone}>{t.what}</PolicyWhat>
            </PolicyRow>
          ))}
        </PolicyTable>
        <PolicyNote>{CANCEL_POLICY_NOTE}</PolicyNote>
        {venue.refundPolicy ? (
          <DirBox><b>이 구장 이용 안내</b><InfoPre>{venue.refundPolicy}</InfoPre></DirBox>
        ) : null}
      </Section>

      <Section ref={setSec("review")}>
        <SecTitle><FiStar size={17} />리뷰{reviews.length > 0 ? ` (${reviews.length})` : ""}</SecTitle>
        {Number(venue.rating) > 0 ? (
          <RvSummary>
            <RvAvg>★ {Number(venue.rating).toFixed(1)}</RvAvg>
            <RvCnt>리뷰 {Number(venue.reviewCount) || reviews.length}개</RvCnt>
          </RvSummary>
        ) : null}
        {reviews.length === 0 ? (
          <InfoPre>아직 등록된 리뷰가 없어요. 이용 후 첫 리뷰를 남겨보세요.</InfoPre>
        ) : (
          <RvList>
            {/* 처음엔 3개만 — 리뷰가 20개면 그 아래 안내·사업자 정보가 화면 밖으로 밀린다. */}
            {(reviewsOpen ? reviews : reviews.slice(0, 3)).map((rv) => (
              <RvItem key={rv.id}>
                <RvItemTop>
                  <RvName>
                    {rv.userName || "회원"}
                    {reviewDate(rv) ? <RvDate>{reviewDate(rv)}</RvDate> : null}
                  </RvName>
                  <RvItemStars>{"★".repeat(Math.max(1, Math.min(5, Number(rv.rating) || 0)))}</RvItemStars>
                </RvItemTop>
                {rv.text ? <RvItemText>{rv.text}</RvItemText> : null}
              </RvItem>
            ))}
            {reviews.length > 3 && (
              <MoreWide type="button" onClick={() => setReviewsOpen((v) => !v)}>
                {reviewsOpen ? "리뷰 접기" : `리뷰 ${reviews.length}개 모두 보기`}
              </MoreWide>
            )}
          </RvList>
        )}
      </Section>

      {(venue.bizName || venue.ownerName || venuePhone || venue.business?.bizNo) && (
        <Section>
          <SecTitle><FiHome size={17} />사업자 정보</SecTitle>
          <HostCard>
            <HostName>{venue.business?.bizName || venue.bizName || venue.ownerName}</HostName>
            {(venue.business?.ownerName || venue.ownerName) ? (
              <HostSub>대표자 {venue.business?.ownerName || venue.ownerName}</HostSub>
            ) : null}
            {venue.business?.status === "verified" && venue.business?.bizNo ? (
              <HostSub>사업자등록번호 {venue.business.bizNo}</HostSub>
            ) : null}
            {venue.salesReport?.number ? (
              <HostSub>통신판매업 신고 {venue.salesReport.number}</HostSub>
            ) : null}
            {venue.address ? (
              <HostSub>사업장 {venue.address}{venue.addressDetail ? ` ${venue.addressDetail}` : ""}</HostSub>
            ) : null}
            {venuePhone ? (
              <PhoneLink href={`tel:${venuePhone}`}><FiPhone size={13} /> {venuePhone}</PhoneLink>
            ) : null}
          </HostCard>
          <LegalNote>
            할래말래는 통신판매중개자로서 통신판매의 당사자가 아니며, 구장 예약·이용 및 환불에 대한 책임은
            판매자(구장 사업자)에게 있습니다.
          </LegalNote>
        </Section>
      )}

      <div style={{ height: 90 }} />

      {viewer && (
        <Sheet onClick={(e) => { if (e.target === e.currentTarget) setViewer(null); }}>
          <PhotosModal onClick={(e) => e.stopPropagation()}>
            <PhotosHead>
              <SheetTitle style={{ margin: 0 }}>{viewer.title} ({viewer.photos.length})</SheetTitle>
              <CloseX type="button" onClick={() => setViewer(null)}>×</CloseX>
            </PhotosHead>
            <PhotosScroll>
              {viewer.photos.map((u, i) => (
                <PhotoFull key={i} src={u} alt={`${viewer.title} ${i + 1}`} />
              ))}
            </PhotosScroll>
          </PhotosModal>
        </Sheet>
      )}

      {/* 시간을 고르기 전에도 하단 바를 띄운다 — 예전엔 selected 가 있어야만 바가 나타나서,
          들어오자마자는 예약 버튼이 화면 어디에도 없고 직접 스크롤해 찾아야 했다. */}
      {!viewOnly && !selected && (venue.courts || []).length > 0 && (
        <BottomBar>
          <div>
            {/* 구장 페이지(코트 목록)에서는 아직 코트가 안 정해졌다 — 특정 코트 이름·요금을 적으면 거짓말이 된다. */}
            <BbDate>{multiCourtIndex ? "예약할 코트를 골라 주세요" : `${court?.name ? `${court.name} · ` : ""}시간을 선택해 주세요`}</BbDate>
            <BbPrice>
              {multiCourtIndex
                ? `코트 ${venue.courts.length}개`
                : unitPrice > 0 ? `${unitPrice.toLocaleString()}원` : "요금 문의"}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>
                {multiCourtIndex ? (minCourtPrice > 0 ? ` · ${minCourtPrice.toLocaleString()}원부터` : "") : ` · ${unitLabel}`}
              </span>
            </BbPrice>
          </div>
          <BookBtn type="button" onClick={() => goSec(multiCourtIndex ? "court" : "book")}>
            {multiCourtIndex ? "코트 고르기" : "시간 고르기"}
          </BookBtn>
        </BottomBar>
      )}

      {!viewOnly && selected && (
        <BottomBar>
          <div>
            <BbDate>{date} {selected.start}~{selected.end}{perPerson ? ` · ${heads}명` : ""}</BbDate>
            <BbPrice>
              {(matchId ? price : payTotal).toLocaleString()}원
              {matchId ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}> · 두 팀 반반</span>
              ) : null}
            </BbPrice>
          </div>
          {matchId ? (
            <BookBtn onClick={handlePropose} disabled={paying}>구장·일정 제안하기</BookBtn>
          ) : (
            <BookBtn onClick={() => setPayOpen(true)}>{autoApprove ? "바로 예약" : "예약 요청"}</BookBtn>
          )}
        </BottomBar>
      )}

      {payOpen && selected && court && (
        <Sheet onClick={(e) => { if (e.target === e.currentTarget) setPayOpen(false); }}>
          <SheetCard onClick={(e) => e.stopPropagation()}>
            <SheetTitle>{autoApprove ? "예약 확인" : "예약 요청"}</SheetTitle>
            <SheetLead>아래 내용이 맞는지 확인해 주세요.</SheetLead>
            <PayRow><span>{venue.name} · {court.name}</span></PayRow>
            <PayRow><span>{date} {selected.start}~{selected.end}</span></PayRow>
            <PayRow>
              <span>이용 시간</span>
              <b>{Math.round(((toMin(selected.end) - toMin(selected.start)) / 60) * 10) / 10}시간</b>
            </PayRow>
            {perPerson && (
              <>
                <PayRow>
                  <span>이용 인원</span>
                  <b>{heads}명 · 1인 {calcDisplayPrice(onePersonPrice(court, date, selected.start, selected.end)).toLocaleString()}원</b>
                </PayRow>
                {minHeads > 1 && (
                  <PayRow><span>최소 인원</span><b>{minHeads}명 (미달해도 {minHeads}명 요금)</b></PayRow>
                )}
              </>
            )}
            <Divider />
            <PayRow $big><span>결제 금액</span><b>{payTotal.toLocaleString()} 원</b></PayRow>
            <PayRow><span>결제 방식</span><b>{PAYMENTS_ENABLED ? "앱에서 결제" : "준비 중"}</b></PayRow>

            <NoteLabel htmlFor="venue-user-note">요청사항 <span>(선택)</span></NoteLabel>
            <NoteInput
              id="venue-user-note"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="구장에 미리 전할 내용을 적어주세요. (예: 조명 켜주세요, 20분 일찍 도착합니다)"
              maxLength={300}
            />

            <ChargeBox>
              <small>
                {!autoApprove
                  ? "지금은 결제되지 않아요. 구장주가 승인하면 결제 안내를 보내드리고, 결제가 끝나야 예약이 확정돼요."
                  : PAYMENTS_ENABLED
                    ? "승인 절차 없이 이 시간이 바로 잡혀요. 이어서 안내되는 결제를 마쳐야 예약이 유지돼요."
                    : "승인 절차 없이 이 시간이 바로 잡히고, 예약이 곧바로 확정돼요."}
              </small>
            </ChargeBox>
            <ChargeBox>
              <small>
                예약 취소는 마이페이지 &gt; 내 구장 예약에서 이용 시작 전까지 할 수 있어요.
                취소 시점에 따라 위 <b>취소·환불 규정</b>이 적용되고, 당일 취소·노쇼가 반복되면 예약이 제한될 수 있어요.
                {venue.refundPolicy ? ` 구장 안내: ${venue.refundPolicy}` : ""}
              </small>
            </ChargeBox>
            <PayBtn disabled={paying} onClick={handleRequest}>
              {paying ? "처리 중…" : autoApprove ? "예약하기" : "예약 요청하기"}
            </PayBtn>
            <CancelBtn onClick={() => setPayOpen(false)} disabled={paying}>취소</CancelBtn>
          </SheetCard>
        </Sheet>
      )}

    </Wrap>
  );
}

/* ---------- styles ---------- */
const Wrap = styled.div`display: flex; flex-direction: column; gap: 22px; padding-bottom: 8px;`;
const Center = styled.div`min-height: 40vh; display: flex; align-items: center; justify-content: center; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;`;
const Cover = styled.img`width: 100%; height: 180px; object-fit: cover; border-radius: 14px;`;
/* 상단 구장 사진 히어로 캐러셀 (풀블리드 + 스와이프 + N/N 인디케이터) */
const Hero = styled.div`
  position: relative;
  margin: -16px -16px 0;
`;
const HeroTrack = styled.div`
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const HeroSlide = styled.img`
  flex: 0 0 100%;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  scroll-snap-align: center;
  display: block;
`;
const HeroCount = styled.div`
  position: absolute;
  right: 12px; bottom: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px; font-weight: 700;
  padding: 3px 10px; border-radius: 999px;
`;
const HeroAll = styled.button`
  position: absolute;
  left: 12px; bottom: 12px;
  display: inline-flex; align-items: center; gap: 5px;
  border: none; cursor: pointer;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px; font-weight: 700;
  padding: 4px 11px; border-radius: 999px;
`;

/* 섹션 제목 + 우측 전체보기 */
const SecTitleRow = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
const SecLead = styled.div`
  font-size: 12.5px; line-height: 1.5; margin-top: -4px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const SeeAll = styled.button`
  border: none; background: transparent; cursor: pointer;
  font-size: 12.5px; font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

/* 한 섹션 안에서 묶음을 가르는 소제목 (코트·요금 안의 "운영 시간" 등) */
const SubHead = styled.div`
  display: flex; align-items: center; gap: 6px;
  font-size: 13.5px; font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  & > svg { color: ${({ theme }) => theme.colors.textWeak}; flex-shrink: 0; }
`;

/* 전체보기 모달 */
const PhotosModal = styled.div`
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  max-height: 88vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px 18px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 12px;
`;
const PhotosHead = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const CloseX = styled.button`
  border: none; background: transparent; cursor: pointer;
  font-size: 24px; line-height: 1; color: ${({ theme }) => theme.colors.textWeak};
`;
const PhotosScroll = styled.div`
  overflow-y: auto;
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const PhotoFull = styled.img`
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 10px;
  background: ${({ theme }) => theme.colors.surface};
`;
/* 편의시설: 보유 항목만 그리드로. 아이콘은 기존 FacilityIcon 유지 */
const FacGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px 8px;
`;
const FacCell = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  opacity: ${({ $on }) => ($on ? 1 : 0.38)};
`;
const FacIconWrap = styled.div`
  width: 46px; height: 46px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ $on, theme }) => ($on ? theme.colors.textNormal : theme.colors.textWeak)};
`;
const FacLabel = styled.div`
  font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.2;
  color: ${({ theme }) => theme.colors.textNormal};
`;
const FacNone = styled.div`
  font-size: 12px; line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const InfoPre = styled.div`
  font-size: 13.5px; line-height: 1.65; white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.textNormal};
  ${({ $clamp }) => $clamp && `
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`;
/* 더보기/접기 — 글 아래 왼쪽에 붙는 텍스트 버튼 */
const MoreBtn = styled.button`
  align-self: flex-start; margin-top: -6px;
  border: none; background: transparent; padding: 0; cursor: pointer;
  font-size: 12.5px; font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;
/* 리뷰 더 보기 — 목록 끝에 붙는 가로 꽉 찬 버튼 */
const MoreWide = styled.button`
  height: 44px; border-radius: 11px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13.5px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;

/* 상단 고정 섹션 탭 — 스크롤 컨테이너(<main>) 기준으로 붙는다.
   풀블리드(좌우 -16px)로 깔되 안쪽 패딩으로 본문과 줄을 맞춘다. */
const TabBar = styled.div`
  position: sticky; top: 0; z-index: 30;
  margin: -6px -16px 0; padding: 0 16px;
  display: flex; gap: 20px; overflow-x: auto;
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const Tab = styled.button`
  flex: 0 0 auto; padding: 14px 1px 12px; cursor: pointer;
  border: none; border-bottom: 2px solid ${({ $on, theme }) => ($on ? theme.colors.textStrong : "transparent")};
  background: transparent; white-space: nowrap;
  font-size: 13.5px;
  font-weight: ${({ $on }) => ($on ? 800 : 600)};
  color: ${({ $on, theme }) => ($on ? theme.colors.textStrong : theme.colors.textWeak)};
`;
const Head = styled.div`display: flex; flex-direction: column; gap: 7px;`;
const TitleRow = styled.div`display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;`;
const VName = styled.div`font-size: 19px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const VAddr = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak};`;
const FavBtn = styled.button`
  flex-shrink: 0; width: 38px; height: 38px; margin: -6px -6px 0 0;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; cursor: pointer;
  color: ${({ $on, theme }) => ($on ? "#ef4444" : theme.colors.textWeak)};
  &:active { transform: scale(0.92); }
`;

/* 핵심 정보 요약 스트립 (요금·예약 단위·확정 방식·주차) */
const KeyFacts = styled.div`
  display: grid; grid-template-columns: repeat(4, 1fr);
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px; overflow: hidden;
`;
const KfCell = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 12px 4px; min-width: 0;
  & + & { border-left: 1px solid ${({ theme }) => theme.colors.border}; }
`;
const KfLabel = styled.div`font-size: 11px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak};`;
const KfValue = styled.div`
  font-size: 14px; font-weight: 800; line-height: 1.25; text-align: center;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const KfSub = styled.div`
  font-size: 10.5px; line-height: 1.3; text-align: center;
  color: ${({ theme }) => theme.colors.textWeak};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
`;

/* 요금 구간(여러 줄) · 코트 스펙 그리드 */
const BandVal = styled.b`
  white-space: pre-line; text-align: right; line-height: 1.45;
  font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};
`;
const SpecGrid = styled.div`display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;`;
const SpecCell = styled.div`
  display: flex; flex-direction: column; gap: 3px;
  padding: 10px 12px; border-radius: 10px;
  background: ${({ theme }) => theme.colors.surface};
`;
const SpecK = styled.div`font-size: 11.5px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak};`;
const SpecV = styled.div`font-size: 13.5px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};`;

const MetaRow = styled.div`display: flex; align-items: center; gap: 6px; flex-wrap: wrap;`;
const RatingChip = styled.button`
  display: inline-flex; align-items: center; gap: 3px;
  border: none; background: transparent; padding: 0; cursor: pointer;
  font-size: 12.5px; font-weight: 800; color: #f59e0b;
  & em { font-style: normal; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; text-decoration: underline; }
`;
const TagChip = styled.span`
  display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ $muted, theme }) => ($muted ? theme.colors.textWeak : theme.colors.textNormal)};
`;
/* 즉시예약(autoApprove) 구장 표식 — 승인 대기 없이 확정된다는 뜻이라 눈에 띄어야 한다. */
const InstantChip = styled.span`
  display: inline-flex; align-items: center; gap: 3px; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.22)" : "#efe9ff")};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.4)" : "#ddd0ff")};
  color: ${({ theme }) => theme.colors.primary};
`;
const VerifiedChip = styled.span`
  display: inline-flex; align-items: center; gap: 3px; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.16)" : "#ecfdf5")};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.4)" : "#a7f3d0")};
  color: #059669;
`;
/* 종목 칩 */
const SportChip = styled.span`
  display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textNormal};
`;
/* 대표키워드 */
const KeywordRow = styled.div`display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;`;
const Kw = styled.span`
  font-size: 12px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;
/* 주차 안내 */
const ParkRow = styled.div`
  font-size: 13px; font-weight: 600; line-height: 1.5;
  color: ${({ $off, theme }) => ($off ? theme.colors.textWeak : theme.colors.textNormal)};
`;
/* 찾아오는 길 */
const DirBox = styled.div`
  display: flex; flex-direction: column; gap: 4px;
  & > b { font-size: 12.5px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong}; }
`;
const Notice = styled.div`
  display: flex; align-items: flex-start; gap: 8px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px; padding: 11px 13px;
  font-size: 12.5px; line-height: 1.55; color: ${({ theme }) => theme.colors.textNormal};
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; margin-top: 1px; }
  & b { font-weight: 700; color: ${({ theme }) => theme.colors.textStrong}; }
`;
const AddrRow = styled.div`display: flex; align-items: center; gap: 8px;`;
const CopyBtn = styled.button`
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 11px; border-radius: 9px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal}; font-size: 12px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;
const PhoneLink = styled.a`
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13.5px; font-weight: 700; text-decoration: none;
  color: ${({ theme }) => theme.colors.primary};
`;
const MapBtnRow = styled.div`display: flex; gap: 8px; margin-top: 2px;`;
const MapBtn = styled.button`
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 42px; border-radius: 10px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong}; font-size: 13px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;

/* 취소·환불 규정 테이블 */
const POLICY_TONES = { ok: "#16a34a", warn: "#b45309", danger: "#dc2626" };
const PolicyTable = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px; overflow: hidden;
`;
const PolicyRow = styled.div`
  display: flex; align-items: stretch;
  & + & { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
`;
const PolicyWhen = styled.div`
  flex: 0 0 40%; padding: 11px 12px;
  background: ${({ theme }) => theme.colors.surface};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12.5px; font-weight: 700; line-height: 1.45;
  color: ${({ theme }) => theme.colors.textNormal};
`;
const PolicyWhat = styled.div`
  flex: 1; padding: 11px 12px;
  font-size: 12.5px; line-height: 1.45; font-weight: 600;
  color: ${({ $tone }) => POLICY_TONES[$tone] || POLICY_TONES.warn};
`;
const PolicyNote = styled.div`
  font-size: 12px; line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const SecSub = styled.span`font-size: 13px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak};`;
const HostCard = styled.div`
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px; border-radius: 12px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;
const HostName = styled.div`font-size: 14.5px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const HostSub = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};`;
const LegalNote = styled.p`
  margin: 8px 2px 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const HoursTable = styled.div`
  display: flex; flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 12px; overflow: hidden;
`;
const HoursRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px; font-size: 13.5px;
  & + & { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
  & > span { color: ${({ theme }) => theme.colors.textNormal}; font-weight: 600; }
  & > b {
    font-weight: 700;
    color: ${({ $off, theme }) => ($off ? "#dc2626" : theme.colors.textStrong)};
  }
`;
const Section = styled.div`display: flex; flex-direction: column; gap: 13px;`;
const RvSummary = styled.div`display: flex; align-items: baseline; gap: 10px;`;
const RvAvg = styled.div`font-size: 22px; font-weight: 800; color: #f59e0b;`;
const RvCnt = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak};`;
const RvList = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const RvItem = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px; padding: 11px 13px;
  display: flex; flex-direction: column; gap: 5px;
`;
const RvItemTop = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 8px;`;
const RvName = styled.div`
  display: flex; align-items: baseline; gap: 7px; min-width: 0;
  font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};
`;
const RvDate = styled.span`font-size: 11.5px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak};`;
const RvItemStars = styled.div`font-size: 13px; color: #f59e0b; letter-spacing: 1px;`;
const RvItemText = styled.div`font-size: 13px; line-height: 1.5; color: ${({ theme }) => theme.colors.textNormal}; white-space: pre-wrap; word-break: break-word;`;
const SecTitle = styled.div`
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex; align-items: center; gap: 7px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; }
`;
const Chips = styled.div`
  display: flex; gap: 8px; overflow-x: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const Chip = styled.button`
  flex: 0 0 auto; padding: 9px 14px; border-radius: 12px; cursor: pointer;
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textNormal)};
  font-size: 13.5px; font-weight: 700;
  & small { font-size: 11px; font-weight: 600; opacity: 0.85; }
`;
/* 코트 선택 카드 (목업 디자인) */
const CourtList = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const CourtEmpty = styled.div`
  padding: 24px 12px; text-align: center;
  font-size: 13px; color: ${({ theme }) => theme.colors.textWeak};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: 14px;
`;
const CourtCard = styled.button`
  width: 100%; text-align: left; cursor: pointer;
  display: flex; align-items: stretch; gap: 12px; padding: 12px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  &:active { transform: translateY(1px); }
`;
/* 좌측 썸네일 — 그 코트가 등록한 첫 사진. 여러 장이면 우측 하단에 +N */
const CourtThumbWrap = styled.div`
  position: relative; flex: 0 0 96px; width: 96px; align-self: flex-start;
`;
const CourtThumb = styled.img`
  width: 96px; height: 96px; object-fit: cover; border-radius: 10px; display: block;
  background: ${({ theme }) => theme.colors.surface};
`;
const ThumbCount = styled.span`
  position: absolute; right: 5px; bottom: 5px;
  background: rgba(0, 0, 0, 0.6); color: #fff;
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
`;
const CourtThumbEmpty = styled.div`
  flex: 0 0 96px; width: 96px; height: 96px; border-radius: 10px; align-self: flex-start;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
  & span { font-size: 11px; font-weight: 600; }
`;
const CourtInfo = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;`;
/* 요금 + 예약 버튼 — 카드 오른쪽 아래에 붙여 "이 코트는 얼마"가 마지막에 남게 한다 */
const CourtPriceRow = styled.div`
  margin-top: auto; padding-top: 8px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 8px;
`;
/* 코트 페이지 상단 — 어느 구장의 코트인지, 눌러서 구장으로 */
const CourtCrumb = styled.button`
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 2px;
  border: none; background: transparent; padding: 0; cursor: pointer;
  font-size: 12.5px; font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const CourtGo = styled.span`
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 1px;
  height: 32px; padding: 0 10px 0 12px; border-radius: 9px;
  font-size: 12.5px; font-weight: 800; white-space: nowrap;
  background: ${({ theme }) => theme.colors.primary}; color: #fff;
`;
/* 코트 소개 — 카드 안에서는 2줄까지만. 전문은 코트 상세에서 본다. */
const CourtCDesc = styled.div`
  font-size: 12.5px; line-height: 1.5; margin-top: 2px;
  color: ${({ theme }) => theme.colors.textWeak};
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
`;
const CourtCName = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const CourtCSub = styled.div`font-size: 12px; color: ${({ theme }) => theme.colors.textWeak};`;
const CourtCPrice = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.primary}; & small { font-size: 11.5px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }`;
/* 선택한 코트의 사진 — 가로 스크롤 스트립(탭하면 전체보기) */
const CourtPhotos = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const CourtPhotoLabel = styled.div`
  font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textNormal};
`;
const CourtPhotoStrip = styled.div`
  display: flex; gap: 8px; overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const CourtPhotoImg = styled.img`
  flex: 0 0 auto; width: 42%; aspect-ratio: 4 / 3; object-fit: cover;
  border-radius: 10px; cursor: pointer; scroll-snap-align: start;
  background: ${({ theme }) => theme.colors.surface};
`;
const DateStrip = styled.div`
  display: flex; gap: 8px; overflow-x: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const DateCell = styled.button`
  flex: 0 0 auto; width: 52px; height: 60px; border-radius: 12px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-weight: 700;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, $dow, theme }) => ($on ? "#fff" : $dow === 0 ? "#ef4444" : $dow === 6 ? "#2563eb" : theme.colors.textNormal)};
  & small { font-size: 11px; opacity: 0.85; }
  & b { font-size: 16px; }
`;
const SlotGrid = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;`;
const Slot = styled.button`
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 13px 4px; border-radius: 11px;
  cursor: ${({ $st }) => ($st === "open" ? "pointer" : "not-allowed")};
  transition: transform 0.1s, border-color 0.12s;
  border: 1px solid ${({ $on, $st, theme }) =>
    $on ? theme.colors.primary : $st === "open" ? theme.colors.border : "transparent"};
  background: ${({ $on, $st, theme }) =>
    $on ? theme.colors.primary : $st === "open" ? theme.colors.card : theme.colors.surface};
  color: ${({ $on, $st, theme }) =>
    $on ? "#fff" : $st === "open" ? theme.colors.textStrong : theme.colors.textWeak};
  opacity: ${({ $st }) => ($st === "open" ? 1 : 0.65)};
  &:active { transform: ${({ $st }) => ($st === "open" ? "translateY(1px)" : "none")}; }
  & b {
    font-size: 14px; font-weight: 700;
    text-decoration: ${({ $st }) => ($st === "open" ? "none" : "line-through")};
    text-decoration-thickness: 1px;
  }
  & span { font-size: 11.5px; font-weight: 700; }
  & .price { color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.primary)}; }
`;
const Empty = styled.div`text-align: center; font-size: 13px; color: ${({ theme }) => theme.colors.textWeak}; padding: 24px 0;`;

/* 인원제 코트의 인원 선택 */
const HeadBox = styled.div`
  display: flex; flex-direction: column; gap: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px; padding: 13px 14px;
`;
const HeadTop = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
const HeadLabel = styled.div`
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};
`;
const Stepper = styled.div`display: flex; align-items: center; gap: 4px;`;
const StepBtn = styled.button`
  width: 34px; height: 34px; border-radius: 9px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 16px; font-weight: 700; line-height: 1;
  &:disabled { opacity: 0.35; cursor: not-allowed; }
  &:active:not(:disabled) { transform: translateY(1px); }
`;
const StepNum = styled.div`
  min-width: 52px; text-align: center;
  font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};
`;
const HeadHint = styled.div`font-size: 12px; color: ${({ theme }) => theme.colors.textWeak};`;
const LegendRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
`;
const LegendNote = styled.div`font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};`;
const Legend = styled.div`
  display: flex; gap: 14px; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};
  & span { display: inline-flex; align-items: center; }
  & span::before {
    content: ""; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px;
    border: 1px solid ${({ theme }) => theme.colors.border};
  }
  & .open::before { background: ${({ theme }) => theme.colors.card}; }
  & .reserved::before, & .blocked::before { background: ${({ theme }) => theme.colors.surface}; }
`;

const BottomBar = styled.div`
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 0;
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  background: ${({ theme }) => theme.colors.card};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 60;
`;
const BbDate = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};`;
const BbPrice = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const BookBtn = styled.button`
  height: 48px; padding: 0 26px; border-radius: 12px; border: none; cursor: pointer;
  background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 15px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;

const Sheet = styled.div`position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 950;`;
const SheetCard = styled.div`
  box-sizing: border-box;
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  max-height: 85vh; overflow-y: auto;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 20px 20px 0 0; padding: 22px 22px calc(24px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 11px;
`;
const SheetTitle = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; margin-bottom: 4px;`;
const PayRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: ${({ $big }) => ($big ? "15px" : "13.5px")};
  color: ${({ theme }) => theme.colors.textNormal};
  & b { font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; }
`;
const Divider = styled.div`height: 1px; background: ${({ theme }) => theme.colors.border}; margin: 4px 0;`;
const SheetLead = styled.div`
  font-size: 13px; color: ${({ theme }) => theme.colors.textWeak}; margin: -2px 0 4px;
`;
const NoteLabel = styled.label`
  margin-top: 4px; font-size: 13px; font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  & span { font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }
`;
const NoteInput = styled.textarea`
  width: 100%; min-height: 64px; resize: vertical; box-sizing: border-box;
  border-radius: 10px; padding: 10px 12px; outline: none;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13.5px; font-family: inherit; line-height: 1.5;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
  &::placeholder { color: ${({ theme }) => theme.colors.textWeak}; }
`;
const ChargeBox = styled.div`display: flex; flex-direction: column; gap: 8px; background: ${({ theme }) => theme.colors.surface}; border-radius: 12px; padding: 12px; & small { font-size: 12px; color: ${({ theme }) => theme.colors.textWeak}; }`;
const ChargeBtns = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const Cb = styled.button`flex: 1; min-width: 70px; height: 40px; border-radius: 9px; border: 1px solid ${({ theme }) => theme.colors.border}; background: ${({ theme }) => theme.colors.card}; color: ${({ theme }) => theme.colors.textNormal}; font-size: 12.5px; font-weight: 700; cursor: pointer;`;
const PayBtn = styled.button`
  height: 52px; border-radius: 12px; border: none; cursor: pointer; margin-top: 6px;
  background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 15px; font-weight: 800;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const CancelBtn = styled.button`height: 44px; border-radius: 12px; border: none; background: transparent; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px; font-weight: 600; cursor: pointer;`;
