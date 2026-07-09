/* eslint-disable */
// src/pages/owner/components/VenuePreviewSheet.jsx
// 구장주가 저장 전/후에 "사용자에게 보이는 상세페이지"를 그대로 미리 보는 시트.
// (사용자앱 /venue-book/:id 는 사용자 인증 게이트 뒤라 owner가 직접 못 들어감 → 자체 재현)
// ⚠️ 사용자 실제 화면(src/pages/venue/VenueBookingPage.jsx)과 섹션/순서/스타일을 1:1로 맞춘다.
import React, { useRef, useState } from "react";
import styled from "styled-components";
import {
  LuX, LuMapPin, LuPhone, LuStar, LuInfo, LuImage, LuClock,
  LuFileText, LuCreditCard, LuCopy, LuLayoutGrid, LuCircleCheck, LuStore,
  LuBell, LuTriangleAlert,
} from "react-icons/lu";
import { FacilityIcon } from "../../venue/facilityIcons";
import { FACILITY_OPTIONS } from "../../../services/ownerVenueService";
import VenueMiniMap from "../../../components/matchRoom/VenueMiniMap";
import { C } from "./od";

/* ---------- 운영시간 요약 (VenueBookingPage와 동일 로직) ---------- */
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
  else { rows.push(["토", sat]); rows.push(["일", sun]); }
  return rows;
}

export default function VenuePreviewSheet({ venue, onClose }) {
  const heroRef = useRef(null);
  const [heroIdx, setHeroIdx] = useState(0);
  if (!venue) return null;

  const photos = (venue.photos?.length ? venue.photos : venue.imageUrl ? [venue.imageUrl] : []).filter(Boolean);
  const courts = venue.courts || [];
  const court = courts[0] || null;
  const hasLatLng = venue.lat != null && venue.lng != null;
  const hoursSummary = buildHoursSummary(court);
  const phone = venue.phone || venue.contactPhone || "";
  const biz = venue.business || {};

  const onHeroScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth || 1;
    setHeroIdx(Math.round(el.scrollLeft / w));
  };
  const copyAddress = async () => {
    const full = `${venue.address || ""}${venue.addressDetail ? ` ${venue.addressDetail}` : ""}`.trim();
    if (!full) return;
    try { await navigator.clipboard.writeText(full); } catch {}
  };

  return (
    <Overlay onClick={onClose}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <Bar>
          <BarTitle>👀 사용자에게 보이는 상세페이지</BarTitle>
          <CloseBtn type="button" onClick={onClose}><LuX size={20} /></CloseBtn>
        </Bar>

        <Body>
          {/* 상단 사진 캐러셀 */}
          {photos.length > 0 ? (
            <Hero>
              <HeroTrack ref={heroRef} onScroll={onHeroScroll}>
                {photos.map((u, i) => <HeroSlide key={i} src={u} alt={`구장 사진 ${i + 1}`} />)}
              </HeroTrack>
              {photos.length > 1 && <HeroCount>{heroIdx + 1}/{photos.length}</HeroCount>}
            </Hero>
          ) : (
            <HeroEmpty>등록된 사진 없음</HeroEmpty>
          )}

          {/* 헤드: 이름 · 칩 · 주소 · 키워드 */}
          <Head>
            <VName>{venue.name || "구장 이름"}</VName>
            <MetaRow>
              {biz.status === "verified" ? (
                <VerifiedChip><LuCircleCheck size={12} /> 국세청 인증</VerifiedChip>
              ) : null}
              {venue.rating ? (
                <RatingChip>
                  <LuStar size={12} /> {Number(venue.rating).toFixed(1)}
                  {venue.reviewCount ? <em> ({venue.reviewCount})</em> : null}
                </RatingChip>
              ) : null}
              {(venue.sportTypes || []).map((s) => <SportChip key={s}>{s}</SportChip>)}
              <TagChip>{venue.type === "outdoor" ? "실외" : "실내"}</TagChip>
              <TagChip>{venue.cost === "free" ? "무료" : "유료"}</TagChip>
              {venue.region ? <TagChip $muted>{venue.region}</TagChip> : null}
            </MetaRow>
            {venue.address && <VAddr>{venue.address} {venue.addressDetail}</VAddr>}
            {(venue.keywords || []).length > 0 && (
              <KeywordRow>{venue.keywords.map((k) => <Kw key={k}>#{k}</Kw>)}</KeywordRow>
            )}
          </Head>

          {/* 코트 공지·주의사항 */}
          <CourtNoticesView court={court} />

          {/* 예약 안내 */}
          <NoticeBox>
            <LuInfo size={15} />
            <span>
              예약 전 <b>운영 시간·이용 안내</b>를 확인해주세요. 예약 요청 후 구장주가
              승인하면 확정되며, 이용료는 현장에서 정산해요.
            </span>
          </NoticeBox>

          {/* 코트 소개 */}
          {venue.description && (
            <Section>
              <SecTitle><LuInfo size={17} />코트 소개</SecTitle>
              <InfoPre>{venue.description}</InfoPre>
            </Section>
          )}

          {/* 편의시설 — 전체 그리드(보유=활성, 미보유=흐림) */}
          <Section>
            <SecTitle><LuCircleCheck size={17} />편의시설</SecTitle>
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

          {/* 코트 선택 */}
          {courts.length > 0 && (
            <Section>
              <SecTitle><LuLayoutGrid size={17} />코트 선택</SecTitle>
              <CourtList>
                {courts.map((c, i) => (
                  <CourtCard key={c.id || i}>
                    <CourtThumb>
                      {venue.imageUrl ? <CourtThumbImg src={venue.imageUrl} alt={c.name} /> : <LuLayoutGrid size={24} />}
                    </CourtThumb>
                    <CourtBody>
                      <CourtCName>{c.name}</CourtCName>
                      <CourtCSub>{c.type === "outdoor" ? "실외" : "실내"} 코트{c.surface ? ` · ${c.surface}` : ""}</CourtCSub>
                      <CourtCPrice>{(Number(c.pricePerHour) || 0).toLocaleString()}원<small> / 시간</small></CourtCPrice>
                    </CourtBody>
                    <CourtBadge>예약 가능 ›</CourtBadge>
                  </CourtCard>
                ))}
              </CourtList>
            </Section>
          )}

          {/* 시설 사진 */}
          {photos.length > 0 && (
            <Section>
              <SecTitle><LuImage size={17} />시설 사진</SecTitle>
              <PhotoGrid>
                {photos.map((u, i) => <PhotoThumb key={i} src={u} alt={`시설 사진 ${i + 1}`} />)}
              </PhotoGrid>
            </Section>
          )}

          {/* 위치·교통 */}
          <Section>
            <SecTitle><LuMapPin size={17} />위치·교통</SecTitle>
            {hasLatLng && <VenueMiniMap latLng={{ lat: venue.lat, lng: venue.lng }} height={170} />}
            {venue.address && (
              <AddrRow>
                <VAddr style={{ flex: 1 }}>
                  <LuMapPin size={13} style={{ verticalAlign: -2 }} /> {venue.address} {venue.addressDetail}
                </VAddr>
                <CopyBtn type="button" onClick={copyAddress}><LuCopy size={12} /> 주소복사</CopyBtn>
              </AddrRow>
            )}
            {phone ? <PhoneLink href={`tel:${phone}`}><LuPhone size={13} /> {phone}</PhoneLink> : null}
            <ParkRow $off={!venue.parking?.available}>
              🅿️ {venue.parking?.available
                ? `주차 가능 · ${venue.parking.fee === "paid" ? "유료" : "무료"}${venue.parking.info ? ` · ${venue.parking.info}` : ""}`
                : "주차 불가"}
            </ParkRow>
            {venue.directions ? (
              <DirBox><b>찾아오는 길</b><InfoPre>{venue.directions}</InfoPre></DirBox>
            ) : null}
          </Section>

          {/* 운영 시간 */}
          {hoursSummary.length > 0 && (
            <Section>
              <SecTitle>
                <LuClock size={17} />운영 시간
                {courts.length > 1 && court?.name ? <SecSub>· {court.name}</SecSub> : null}
              </SecTitle>
              <HoursTable>
                {hoursSummary.map(([label, val]) => (
                  <HoursRow key={label} $off={val === "휴무"}>
                    <span>{label}</span><b>{val}</b>
                  </HoursRow>
                ))}
              </HoursTable>
            </Section>
          )}

          {/* 이용 안내 */}
          {venue.rules && (
            <Section>
              <SecTitle><LuFileText size={17} />이용 안내</SecTitle>
              <InfoPre>{venue.rules}</InfoPre>
            </Section>
          )}
          {/* 취소·노쇼 안내 */}
          {venue.refundPolicy && (
            <Section>
              <SecTitle><LuCreditCard size={17} />취소·노쇼 안내</SecTitle>
              <InfoPre>{venue.refundPolicy}</InfoPre>
            </Section>
          )}

          {/* 사업자 정보 */}
          {(biz.bizName || venue.bizName || biz.ownerName || venue.ownerName || phone || biz.bizNo) && (
            <Section>
              <SecTitle><LuStore size={17} />사업자 정보</SecTitle>
              <HostCard>
                <HostName>{biz.bizName || venue.bizName || biz.ownerName || venue.ownerName}</HostName>
                {(biz.ownerName || venue.ownerName) ? (
                  <HostSub>대표자 {biz.ownerName || venue.ownerName}</HostSub>
                ) : null}
                {biz.status === "verified" && biz.bizNo ? (
                  <HostSub>사업자등록번호 {biz.bizNo}</HostSub>
                ) : null}
                {venue.salesReport?.number ? (
                  <HostSub>통신판매업 신고 {venue.salesReport.number}</HostSub>
                ) : null}
                {venue.address ? (
                  <HostSub>사업장 {venue.address}{venue.addressDetail ? ` ${venue.addressDetail}` : ""}</HostSub>
                ) : null}
                {phone ? <PhoneLink href={`tel:${phone}`}><LuPhone size={13} /> {phone}</PhoneLink> : null}
              </HostCard>
              <LegalNote>
                할래말래는 통신판매중개자로서 통신판매의 당사자가 아니며, 구장 예약·이용 및 환불에 대한 책임은
                판매자(구장 사업자)에게 있습니다.
              </LegalNote>
            </Section>
          )}

          <div style={{ height: 16 }} />
        </Body>
      </Sheet>
    </Overlay>
  );
}

/* 코트 공지·주의사항 — 사용자앱 CourtNotices를 C 팔레트로 재현(테마 무관) */
function CourtNoticesView({ court }) {
  const notices = Array.isArray(court?.notices) ? court.notices : [];
  const cautions = (Array.isArray(court?.cautions) ? court.cautions : []).filter(Boolean);
  const has = (n) => n && (n.title || n.body);
  const pinned = notices.filter((n) => n.pinned && has(n));
  const normal = notices.filter((n) => !n.pinned && has(n));
  if (!pinned.length && !normal.length && !cautions.length) return null;

  return (
    <>
      {pinned.map((n, i) => (
        <Pinned key={n.id || i}>
          <LuBell size={16} />
          <div>
            {n.title ? <PinTitle>{n.title}</PinTitle> : null}
            {n.body ? <PinBody>{n.body}</PinBody> : null}
          </div>
        </Pinned>
      ))}
      {normal.length > 0 && (
        <Section>
          <SecTitle><LuBell size={17} />공지사항</SecTitle>
          <NoticeList>
            {normal.map((n, i) => (
              <NoticeItem key={n.id || i}>
                {n.title ? <NtTitle>{n.title}</NtTitle> : null}
                {n.body ? <NtBody>{n.body}</NtBody> : null}
              </NoticeItem>
            ))}
          </NoticeList>
        </Section>
      )}
      {cautions.length > 0 && (
        <Section>
          <SecTitle><LuTriangleAlert size={17} />주의사항</SecTitle>
          <NoticeList>
            {cautions.map((c, i) => <CautionItem key={i}><Dot />{c}</CautionItem>)}
          </NoticeList>
        </Section>
      )}
    </>
  );
}

/* ---------- styles (C 고정 팔레트 = 사용자앱 라이트 테마 재현) ---------- */
const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 350;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: flex-end; justify-content: center;
`;
const Sheet = styled.div`
  width: 100%; max-width: 448px; height: 92vh;
  background: #fff; border-radius: 20px 20px 0 0;
  display: flex; flex-direction: column; overflow: hidden;
`;
const Bar = styled.div`
  flex-shrink: 0; height: 50px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 8px 0 16px; border-bottom: 1px solid ${C.slate200};
`;
const BarTitle = styled.div`font-size: 13.5px; font-weight: 700; color: ${C.slate500};`;
const CloseBtn = styled.button`border: none; background: transparent; color: ${C.slate400}; cursor: pointer; display: flex; padding: 8px;`;
const Body = styled.div`flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 22px; padding: 16px;`;

/* 상단 사진 캐러셀 (풀블리드) */
const Hero = styled.div`position: relative; margin: -16px -16px 0;`;
const HeroTrack = styled.div`
  display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const HeroSlide = styled.img`flex: 0 0 100%; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; scroll-snap-align: center; display: block;`;
const HeroCount = styled.div`
  position: absolute; right: 12px; bottom: 12px;
  background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 12px; font-weight: 700;
  padding: 3px 10px; border-radius: 999px;
`;
const HeroEmpty = styled.div`
  margin: -16px -16px 0; width: calc(100% + 32px); aspect-ratio: 16 / 10;
  background: ${C.slate100}; display: flex; align-items: center; justify-content: center;
  color: ${C.slate400}; font-size: 13px;
`;

const Head = styled.div`display: flex; flex-direction: column; gap: 7px;`;
const VName = styled.div`font-size: 19px; font-weight: 800; color: ${C.slate800};`;
const VAddr = styled.div`font-size: 13px; color: ${C.slate500};`;
const MetaRow = styled.div`display: flex; align-items: center; gap: 6px; flex-wrap: wrap;`;
const RatingChip = styled.span`
  display: inline-flex; align-items: center; gap: 3px; font-size: 12.5px; font-weight: 800; color: ${C.amber500};
  & em { font-style: normal; font-weight: 600; color: ${C.slate400}; }
`;
const TagChip = styled.span`
  display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700; background: ${C.slate100}; border: 1px solid ${C.slate200};
  color: ${({ $muted }) => ($muted ? C.slate400 : C.slate500)};
`;
const VerifiedChip = styled.span`
  display: inline-flex; align-items: center; gap: 3px; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800; background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669;
`;
const SportChip = styled.span`
  display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800; background: ${C.violet50}; color: ${C.violet600};
`;
const KeywordRow = styled.div`display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;`;
const Kw = styled.span`font-size: 12px; font-weight: 600; color: ${C.slate400};`;

const NoticeBox = styled.div`
  display: flex; align-items: flex-start; gap: 8px;
  background: ${C.slate100}; border: 1px solid ${C.slate200}; border-radius: 12px; padding: 11px 13px;
  font-size: 12.5px; line-height: 1.55; color: ${C.slate500};
  & > svg { color: ${C.violet600}; flex-shrink: 0; margin-top: 1px; }
  & b { font-weight: 700; color: ${C.slate800}; }
`;

const Section = styled.div`display: flex; flex-direction: column; gap: 13px;`;
const SecTitle = styled.div`
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: ${C.slate800};
  display: flex; align-items: center; gap: 7px;
  & > svg { color: ${C.violet600}; flex-shrink: 0; }
`;
const SecSub = styled.span`font-size: 13px; font-weight: 600; color: ${C.slate400};`;
const InfoPre = styled.div`font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; color: ${C.slate500};`;

/* 편의시설 그리드 */
const FacGrid = styled.div`display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 8px;`;
const FacCell = styled.div`display: flex; flex-direction: column; align-items: center; gap: 6px; opacity: ${({ $on }) => ($on ? 1 : 0.38)};`;
const FacIconWrap = styled.div`
  width: 46px; height: 46px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; border: 1px solid ${C.slate200};
  background: ${({ $on }) => ($on ? "#f3efff" : C.slate100)};
  color: ${({ $on }) => ($on ? C.violet600 : C.slate400)};
`;
const FacLabel = styled.div`font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.2; color: ${C.slate500};`;

/* 코트 선택 카드 */
const CourtList = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const CourtCard = styled.div`
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px;
  border-radius: 14px; border: 1px solid ${C.slate200}; background: #fff;
`;
const CourtThumb = styled.div`
  width: 64px; height: 64px; flex-shrink: 0; border-radius: 12px; overflow: hidden;
  background: #1b1f27; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.45);
`;
const CourtThumbImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const CourtBody = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;`;
const CourtCName = styled.div`font-size: 15px; font-weight: 800; color: ${C.slate800};`;
const CourtCSub = styled.div`font-size: 12px; color: ${C.slate400};`;
const CourtCPrice = styled.div`font-size: 15px; font-weight: 800; color: ${C.violet600}; & small { font-size: 11.5px; font-weight: 600; color: ${C.slate400}; }`;
const CourtBadge = styled.span`
  flex-shrink: 0; align-self: center; padding: 7px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 800; white-space: nowrap; background: #efe9ff; color: ${C.violet600};
`;

/* 시설 사진 (2행 가로 스크롤) */
const PhotoGrid = styled.div`
  display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, 1fr);
  grid-auto-columns: calc((100% - 8px) / 2); gap: 8px; overflow-x: auto;
  scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const PhotoThumb = styled.img`width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 10px; scroll-snap-align: start; background: ${C.slate100};`;

/* 위치·교통 */
const AddrRow = styled.div`display: flex; align-items: center; gap: 8px;`;
const CopyBtn = styled.button`
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 11px; border-radius: 9px; cursor: pointer;
  border: 1px solid ${C.slate200}; background: #fff; color: ${C.slate500}; font-size: 12px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;
const PhoneLink = styled.a`display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; text-decoration: none; color: ${C.violet600};`;
const ParkRow = styled.div`font-size: 13px; font-weight: 600; line-height: 1.5; color: ${({ $off }) => ($off ? C.slate400 : C.slate500)};`;
const DirBox = styled.div`display: flex; flex-direction: column; gap: 4px; & > b { font-size: 12.5px; font-weight: 700; color: ${C.slate800}; }`;

/* 운영 시간 */
const HoursTable = styled.div`display: flex; flex-direction: column; border: 1px solid ${C.slate200}; border-radius: 12px; overflow: hidden;`;
const HoursRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; font-size: 13.5px;
  & + & { border-top: 1px solid ${C.slate200}; }
  & > span { color: ${C.slate500}; font-weight: 600; }
  & > b { font-weight: 700; color: ${({ $off }) => ($off ? C.red500 : C.slate800)}; }
`;

/* 사업자 정보 */
const HostCard = styled.div`display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 12px; background: ${C.slate100}; border: 1px solid ${C.slate200};`;
const HostName = styled.div`font-size: 14.5px; font-weight: 800; color: ${C.slate800};`;
const HostSub = styled.div`font-size: 12.5px; color: ${C.slate400};`;
const LegalNote = styled.p`margin: 8px 2px 0; font-size: 11.5px; line-height: 1.5; color: ${C.slate400};`;

/* 코트 공지·주의사항 */
const Pinned = styled.div`
  display: flex; align-items: flex-start; gap: 9px;
  background: #f3efff; border: 1px solid ${C.violet600}; border-radius: 12px; padding: 12px 13px;
  & > svg { color: ${C.violet600}; flex-shrink: 0; margin-top: 1px; }
`;
const PinTitle = styled.div`font-size: 13.5px; font-weight: 800; color: ${C.slate800};`;
const PinBody = styled.div`font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; color: ${C.slate500}; margin-top: 2px;`;
const NoticeList = styled.div`display: flex; flex-direction: column; border: 1px solid ${C.slate200}; border-radius: 12px; overflow: hidden;`;
const NoticeItem = styled.div`
  display: flex; flex-direction: column; gap: 3px; padding: 12px 14px;
  & + & { border-top: 1px solid ${C.slate200}; }
`;
const NtTitle = styled.div`font-size: 13.5px; font-weight: 700; color: ${C.slate800};`;
const NtBody = styled.div`font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; color: ${C.slate400};`;
const CautionItem = styled.div`
  display: flex; align-items: flex-start; gap: 8px; padding: 11px 14px;
  font-size: 13px; line-height: 1.5; color: ${C.slate500};
  & + & { border-top: 1px solid ${C.slate200}; }
`;
const Dot = styled.span`flex-shrink: 0; width: 5px; height: 5px; border-radius: 999px; margin-top: 7px; background: ${C.violet600};`;
