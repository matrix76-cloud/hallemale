/* eslint-disable */
// src/pages/venue/VenueBookingPage.jsx
// 구장 상세 — 코트 목록 → 코트 선택 시 예약 페이지(CourtBookingPage)로 이동. 예약은 현장 정산·구장 승인제.
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
  FACILITY_OPTIONS,
} from "../../services/ownerVenueService";
import { BOOKING_WINDOW_DAYS } from "../../constants/booking";
import Spinner from "../../components/common/Spinner";
import VenueMiniMap from "../../components/matchRoom/VenueMiniMap";
import { FiMapPin, FiGrid, FiCalendar, FiClock, FiInfo, FiFileText, FiCreditCard, FiCheckCircle, FiPhone, FiCopy, FiStar, FiImage, FiHome } from "react-icons/fi";
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

export default function VenueBookingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get("match") || ""; // 매칭룸에서 들어온 경우
  const viewOnly = params.get("view") === "1"; // 매칭 카드에서 들어온 읽기 전용
  const { firebaseUser, userDoc } = useAuth();
  const { showToast } = useUIActions() || {};
  const toast = (message) => { if (showToast) showToast({ message }); };
  const uid = firebaseUser?.uid || "";
  const suffix = matchId ? `?match=${matchId}` : viewOnly ? "?view=1" : "";
  const goCourt = (c) => navigate(`/venue-book/${id}/court/${c.id}${suffix}`);

  const [venue, setVenue] = useState(null);
  const [reviews, setReviews] = useState([]);
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
  const [photosOpen, setPhotosOpen] = useState(false); // 시설 사진 전체보기 모달
  useBackInterceptor(photosOpen, () => setPhotosOpen(false)); // 사진 모달: HW 뒤로 시 페이지 이탈 대신 모달 닫기
  useBackInterceptor(payOpen, () => setPayOpen(false)); // 예약 확정 시트: HW 뒤로 시 시트 닫기
  const heroRef = useRef(null);
  const [heroIdx, setHeroIdx] = useState(0); // 상단 구장 사진 캐러셀 현재 인덱스
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
      setCourtId(v?.courts?.[0]?.id || "");
      setDate(dates[0]?.date || "");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [id]);

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

  // 연속된 빈 슬롯을 눌러 범위 선택 (CourtBookingPage와 동일)
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

  const price = selected && court ? calcSlotPrice(court, selected.start, selected.end, date) : 0;

  const copyAddress = async () => {
    const full = `${venue?.address || ""}${venue?.addressDetail ? ` ${venue.addressDetail}` : ""}`.trim();
    if (!full) return;
    try {
      await navigator.clipboard.writeText(full);
      toast("주소를 복사했어요.");
    } catch {
      toast("주소 복사에 실패했어요.");
    }
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
      });
      setPayOpen(false);
      setSelected(null);
      await loadSlots();
      toast("예약 요청을 보냈어요! 구장 승인 후 확정돼요.");
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
  const hasLatLng = venue.lat != null && venue.lng != null;
  const hoursSummary = buildHoursSummary(court);
  const venuePhone = venue.phone || venue.contactPhone || "";

  return (
    <Wrap>
      {photos.length > 0 && (
        <Hero>
          <HeroTrack ref={heroRef} onScroll={onHeroScroll}>
            {photos.map((u, i) => (
              <HeroSlide key={i} src={u} alt={`구장 사진 ${i + 1}`} />
            ))}
          </HeroTrack>
          {photos.length > 1 && <HeroCount>{heroIdx + 1}/{photos.length}</HeroCount>}
        </Hero>
      )}

      <Head>
        <VName>{venue.name}</VName>
        <MetaRow>
          {venue.business?.status === "verified" ? (
            <VerifiedChip><FiCheckCircle size={12} /> 국세청 인증</VerifiedChip>
          ) : null}
          {venue.rating ? (
            <RatingChip>
              <FiStar size={12} /> {Number(venue.rating).toFixed(1)}
              {venue.reviewCount ? <em> ({venue.reviewCount})</em> : null}
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

      <CourtNotices court={court} />

      <Notice>
        <FiInfo size={15} />
        <span>
          예약 전 <b>운영 시간·이용 안내</b>를 확인해주세요. 예약 요청 후 구장주가
          승인하면 확정되며, 이용료는 현장에서 정산해요.
        </span>
      </Notice>

      {venue.description && (
        <Section>
          <SecTitle><FiInfo size={17} />코트 소개</SecTitle>
          <InfoPre>{venue.description}</InfoPre>
        </Section>
      )}

      <Section>
        <SecTitle><FiCheckCircle size={17} />편의시설</SecTitle>
        <FacGrid>
          {FACILITY_OPTIONS.map((f) => {
            const on = (venue.facilities || []).includes(f);
            return (
              <FacCell key={f} $on={on}>
                <FacIconWrap $on={on}><FacilityIcon name={f} size={22} /></FacIconWrap>
                <FacLabel>{f}</FacLabel>
              </FacCell>
            );
          })}
        </FacGrid>
      </Section>

      <Section>
        <SecTitle><FiGrid size={17} />{viewOnly ? "예약 현황" : "예약"}</SecTitle>
        {(venue.courts || []).length === 0 ? (
          <CourtEmpty>아직 등록된 코트가 없어요. 구장에 문의해 주세요.</CourtEmpty>
        ) : (
          <>
            {(venue.courts || []).length > 1 && (
              <CourtChips>
                {venue.courts.map((c) => (
                  <CourtChip key={c.id} type="button" $on={c.id === courtId} onClick={() => setCourtId(c.id)}>
                    {c.name}
                  </CourtChip>
                ))}
              </CourtChips>
            )}

            <DateStrip>
              {dates.map((d) => (
                <DateCell key={d.date} $on={d.date === date} $dow={d.dow} onClick={() => setDate(d.date)}>
                  <small>{d.wd}</small><b>{d.day}</b>
                </DateCell>
              ))}
            </DateStrip>

            <Legend>
              <span className="open">예약 가능</span>
              <span className="reserved">예약완료</span>
              <span className="blocked">사용 불가</span>
            </Legend>

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
                        {st === "reserved" ? "예약완료" : st === "blocked" ? "사용 불가" : st === "past" ? "마감" : `${calcSlotPrice(court, s.start, s.end, date).toLocaleString()}원`}
                      </span>
                    </Slot>
                  );
                })}
              </SlotGrid>
            )}
          </>
        )}
      </Section>

      {photos.length > 0 && (
        <Section>
          <SecTitleRow>
            <SecTitle><FiImage size={17} />시설 사진</SecTitle>
            <SeeAll type="button" onClick={() => setPhotosOpen(true)}>전체보기</SeeAll>
          </SecTitleRow>
          <PhotoGrid>
            {photos.map((u, i) => (
              <PhotoThumb key={i} src={u} alt={`시설 사진 ${i + 1}`} onClick={() => setPhotosOpen(true)} />
            ))}
          </PhotoGrid>
        </Section>
      )}

      <Section>
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
      </Section>

      {hoursSummary.length > 0 && (
        <Section>
          <SecTitle>
            <FiClock size={17} />운영 시간
            {venue.courts?.length > 1 && court?.name ? <SecSub>· {court.name}</SecSub> : null}
          </SecTitle>
          <HoursTable>
            {hoursSummary.map(([label, val]) => (
              <HoursRow key={label} $off={val === "휴무"}>
                <span>{label}</span>
                <b>{val}</b>
              </HoursRow>
            ))}
          </HoursTable>
        </Section>
      )}

      {venue.rules && (
        <Section>
          <SecTitle><FiFileText size={17} />이용 안내</SecTitle>
          <InfoPre>{venue.rules}</InfoPre>
        </Section>
      )}
      {venue.refundPolicy && (
        <Section>
          <SecTitle><FiCreditCard size={17} />취소·노쇼 안내</SecTitle>
          <InfoPre>{venue.refundPolicy}</InfoPre>
        </Section>
      )}

      <Section>
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
            {reviews.map((rv) => (
              <RvItem key={rv.id}>
                <RvItemTop>
                  <RvName>{rv.userName || "회원"}</RvName>
                  <RvItemStars>{"★".repeat(Math.max(1, Math.min(5, Number(rv.rating) || 0)))}</RvItemStars>
                </RvItemTop>
                {rv.text ? <RvItemText>{rv.text}</RvItemText> : null}
              </RvItem>
            ))}
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

      {photosOpen && (
        <Sheet onClick={(e) => { if (e.target === e.currentTarget) setPhotosOpen(false); }}>
          <PhotosModal onClick={(e) => e.stopPropagation()}>
            <PhotosHead>
              <SheetTitle style={{ margin: 0 }}>시설 사진 ({photos.length})</SheetTitle>
              <CloseX type="button" onClick={() => setPhotosOpen(false)}>×</CloseX>
            </PhotosHead>
            <PhotosScroll>
              {photos.map((u, i) => (
                <PhotoFull key={i} src={u} alt={`시설 사진 ${i + 1}`} />
              ))}
            </PhotosScroll>
          </PhotosModal>
        </Sheet>
      )}

      {!viewOnly && selected && (
        <BottomBar>
          <div>
            <BbDate>{date} {selected.start}~{selected.end}</BbDate>
            <BbPrice>
              {price.toLocaleString()}원
              <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>
                {matchId ? " · 두 팀 반반" : " · 현장 정산"}
              </span>
            </BbPrice>
          </div>
          {matchId ? (
            <BookBtn onClick={handlePropose} disabled={paying}>구장·일정 제안하기</BookBtn>
          ) : (
            <BookBtn onClick={() => setPayOpen(true)}>예약 요청</BookBtn>
          )}
        </BottomBar>
      )}

      {payOpen && selected && court && (
        <Sheet onClick={(e) => { if (e.target === e.currentTarget) setPayOpen(false); }}>
          <SheetCard onClick={(e) => e.stopPropagation()}>
            <SheetTitle>예약 요청</SheetTitle>
            <PayRow><span>{venue.name} · {court.name}</span></PayRow>
            <PayRow><span>{date} {selected.start}~{selected.end}</span></PayRow>
            <Divider />
            <PayRow $big><span>이용료</span><b>{price.toLocaleString()} 원</b></PayRow>
            <PayRow><span>결제 방식</span><b>현장 정산</b></PayRow>
            <ChargeBox>
              <small>결제 없이 예약을 요청해요. 구장주가 승인하면 예약이 확정되고, 이용료는 현장에서 정산해요.</small>
            </ChargeBox>
            <ChargeBox>
              <small>
                예약 취소는 마이페이지 &gt; 내 구장 예약에서 할 수 있어요.{" "}
                {venue.refundPolicy
                  ? `취소·노쇼 안내: ${venue.refundPolicy}`
                  : "취소·환불·노쇼 규정은 구장 운영정책 및 「취소 및 환불 정책」을 따릅니다."}
              </small>
            </ChargeBox>
            <PayBtn disabled={paying} onClick={handleRequest}>
              {paying ? "요청 중…" : "예약 요청하기"}
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

/* 섹션 제목 + 우측 전체보기 */
const SecTitleRow = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
const SeeAll = styled.button`
  border: none; background: transparent; cursor: pointer;
  font-size: 12.5px; font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

/* 시설 사진: 2행 가로 스크롤 그리드 (한 화면 2열×2행=4개, 오른쪽으로 계속 스와이프) */
const PhotoGrid = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(2, 1fr);
  grid-auto-columns: calc((100% - 8px) / 2);
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const PhotoThumb = styled.img`
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 10px;
  cursor: pointer;
  scroll-snap-align: start;
  background: ${({ theme }) => theme.colors.surface};
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
/* 편의시설: 전체 카테고리 그리드 (보유=활성, 미보유=흐림). 아이콘은 기존 FacilityIcon 유지 */
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
  background: ${({ $on, theme }) =>
    $on ? (theme.mode === "dark" ? "rgba(124,92,201,0.18)" : "#f3efff") : theme.colors.surface};
  color: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.textWeak)};
`;
const FacLabel = styled.div`
  font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.2;
  color: ${({ theme }) => theme.colors.textNormal};
`;
const InfoPre = styled.div`
  font-size: 13.5px; line-height: 1.65; white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.textNormal};
`;
const Head = styled.div`display: flex; flex-direction: column; gap: 7px;`;
const VName = styled.div`font-size: 19px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const VAddr = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak};`;

const MetaRow = styled.div`display: flex; align-items: center; gap: 6px; flex-wrap: wrap;`;
const RatingChip = styled.span`
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12.5px; font-weight: 800; color: #f59e0b;
  & em { font-style: normal; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }
`;
const TagChip = styled.span`
  display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ $muted, theme }) => ($muted ? theme.colors.textWeak : theme.colors.textNormal)};
`;
const VerifiedChip = styled.span`
  display: inline-flex; align-items: center; gap: 3px; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.16)" : "#ecfdf5")};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.4)" : "#a7f3d0")};
  color: #059669;
`;
/* 종목 칩 (강조) */
const SportChip = styled.span`
  display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.22)" : "#efe9ff")};
  color: ${({ theme }) => theme.colors.primary};
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
const RvName = styled.div`font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};`;
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
  display: flex; align-items: center; gap: 12px; padding: 10px;
  border-radius: 14px; border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  &:active { transform: translateY(1px); }
`;
const CourtThumb = styled.div`
  width: 64px; height: 64px; flex-shrink: 0; border-radius: 12px; overflow: hidden;
  background: #1b1f27; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.45);
`;
const CourtThumbImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const CourtBody = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;`;
const CourtCName = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const CourtCSub = styled.div`font-size: 12px; color: ${({ theme }) => theme.colors.textWeak};`;
const CourtCPrice = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.primary}; & small { font-size: 11.5px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }`;
const CourtBadge = styled.span`
  flex-shrink: 0; align-self: center; padding: 7px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 800; white-space: nowrap;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.22)" : "#efe9ff")};
  color: ${({ theme }) => theme.colors.primary};
`;
const CourtChips = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const CourtChip = styled.button`
  height: 38px; padding: 0 16px; border-radius: 999px; cursor: pointer;
  font-size: 13px; font-weight: 700;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textNormal)};
  &:active { transform: translateY(1px); }
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
const ChargeBox = styled.div`display: flex; flex-direction: column; gap: 8px; background: ${({ theme }) => theme.colors.surface}; border-radius: 12px; padding: 12px; & small { font-size: 12px; color: ${({ theme }) => theme.colors.textWeak}; }`;
const ChargeBtns = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const Cb = styled.button`flex: 1; min-width: 70px; height: 40px; border-radius: 9px; border: 1px solid ${({ theme }) => theme.colors.border}; background: ${({ theme }) => theme.colors.card}; color: ${({ theme }) => theme.colors.textNormal}; font-size: 12.5px; font-weight: 700; cursor: pointer;`;
const PayBtn = styled.button`
  height: 52px; border-radius: 12px; border: none; cursor: pointer; margin-top: 6px;
  background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 15px; font-weight: 800;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const CancelBtn = styled.button`height: 44px; border-radius: 12px; border: none; background: transparent; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px; font-weight: 600; cursor: pointer;`;
