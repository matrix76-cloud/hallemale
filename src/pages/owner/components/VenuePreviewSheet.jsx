/* eslint-disable */
// src/pages/owner/components/VenuePreviewSheet.jsx
// 구장주가 저장 전/후에 "사용자에게 보이는 상세페이지"를 그대로 미리 보는 시트.
// (사용자앱 /venue-book/:id 는 사용자 인증 게이트 뒤라 owner가 직접 못 들어감 → 자체 재현)
import React from "react";
import styled from "styled-components";
import { LuX, LuMapPin, LuPhone, LuStar } from "react-icons/lu";
import { FacilityIcon } from "../../venue/facilityIcons";
import { C } from "./od";

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
const Body = styled.div`flex: 1; overflow-y: auto; display: flex; flex-direction: column;`;

const Hero = styled.div`
  width: 100%; aspect-ratio: 16 / 10; background: ${C.slate100};
  background-size: cover; background-position: center;
  display: flex; align-items: center; justify-content: center; color: ${C.slate400}; font-size: 13px;
`;
const Sec = styled.div`padding: 16px; display: flex; flex-direction: column; gap: 10px; border-bottom: 8px solid ${C.slate100};
  &:last-child { border-bottom: none; }`;
const Name = styled.div`font-size: 20px; font-weight: 800; color: ${C.slate800};`;
const Tags = styled.div`display: flex; align-items: center; gap: 6px; flex-wrap: wrap;`;
const Tag = styled.span`border: 1px solid ${C.slate200}; color: ${C.slate500}; border-radius: 999px; padding: 3px 10px; font-size: 11.5px; font-weight: 700;`;
const SportTag = styled.span`background: ${C.violet50}; color: ${C.violet600}; border-radius: 999px; padding: 3px 10px; font-size: 11.5px; font-weight: 800;`;
const ParkLine = styled.div`font-size: 12.5px; font-weight: 600; color: ${C.slate500};`;
const KwRow = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const Kw = styled.span`font-size: 12px; font-weight: 600; color: ${C.slate400};`;
const Addr = styled.div`font-size: 13px; color: ${C.slate500}; display: flex; align-items: center; gap: 5px;`;
const Price = styled.div`font-size: 16px; font-weight: 800; color: ${C.violet600};`;
const SecTit = styled.div`font-size: 14.5px; font-weight: 800; color: ${C.slate800};`;
const Pre = styled.div`font-size: 13px; color: ${C.slate500}; line-height: 1.6; white-space: pre-wrap;`;
const Facs = styled.div`display: flex; flex-wrap: wrap; gap: 8px;`;
const Fac = styled.span`display: inline-flex; align-items: center; gap: 5px; border: 1px solid ${C.slate200}; color: ${C.slate800}; border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; & > svg { color: ${C.violet600}; }`;
const CourtRow = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-bottom: 1px solid ${C.slate200}; &:last-child { border-bottom: none; }`;
const CourtName = styled.div`font-size: 14px; font-weight: 700; color: ${C.slate800};`;
const CourtSub = styled.div`font-size: 12px; color: ${C.slate500};`;
const CourtPrice = styled.div`font-size: 14px; font-weight: 800; color: ${C.slate800};`;
const BizRow = styled.div`font-size: 12.5px; color: ${C.slate500}; line-height: 1.6;`;
const Legal = styled.div`font-size: 11.5px; color: ${C.slate400}; line-height: 1.5; margin-top: 6px;`;
const Phone = styled.div`display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; color: ${C.violet600};`;
const Foot = styled.div`flex-shrink: 0; padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid ${C.slate200};`;
const BookBtn = styled.div`height: 50px; border-radius: 12px; background: ${C.violet600}; color: #fff; font-size: 15.5px; font-weight: 800; display: flex; align-items: center; justify-content: center;`;

export default function VenuePreviewSheet({ venue, onClose }) {
  if (!venue) return null;
  const photos = (venue.photos?.length ? venue.photos : venue.imageUrl ? [venue.imageUrl] : []).filter(Boolean);
  const hero = photos[0] || "";
  const courts = venue.courts || [];
  const prices = courts.map((c) => Number(c.pricePerHour) || 0).filter((p) => p > 0);
  const priceLabel = venue.cost === "free"
    ? "무료"
    : prices.length ? `시간당 ${Math.min(...prices).toLocaleString()}원~` : "가격 문의";
  const biz = venue.business || {};
  const phone = venue.phone || venue.contactPhone || "";

  return (
    <Overlay onClick={onClose}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <Bar>
          <BarTitle>👀 사용자에게 보이는 상세페이지</BarTitle>
          <CloseBtn type="button" onClick={onClose}><LuX size={20} /></CloseBtn>
        </Bar>

        <Body>
          <Hero style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
            {hero ? "" : "등록된 사진 없음"}
          </Hero>

          <Sec>
            <Name>{venue.name || "구장 이름"}</Name>
            <Tags>
              {venue.rating ? <Tag><LuStar size={11} style={{ verticalAlign: -1 }} /> {Number(venue.rating).toFixed(1)}</Tag> : null}
              {(venue.sportTypes || []).map((s) => <SportTag key={s}>{s}</SportTag>)}
              <Tag>{venue.type === "outdoor" ? "실외" : "실내"}</Tag>
              <Tag>{venue.cost === "free" ? "무료" : "유료"}</Tag>
              {venue.region ? <Tag>{venue.region}</Tag> : null}
            </Tags>
            {(venue.address) && <Addr><LuMapPin size={13} /> {venue.address} {venue.addressDetail}</Addr>}
            <ParkLine>🅿️ {venue.parking?.available
              ? `주차 가능 · ${venue.parking.fee === "paid" ? "유료" : "무료"}${venue.parking.info ? ` · ${venue.parking.info}` : ""}`
              : "주차 불가"}</ParkLine>
            {venue.directions ? <Pre><b style={{ color: C.slate800 }}>찾아오는 길</b>{"\n"}{venue.directions}</Pre> : null}
            {(venue.keywords || []).length > 0 && (
              <KwRow>{venue.keywords.map((k) => <Kw key={k}>#{k}</Kw>)}</KwRow>
            )}
            <Price>{priceLabel}</Price>
          </Sec>

          {venue.description && (
            <Sec>
              <SecTit>구장 소개</SecTit>
              <Pre>{venue.description}</Pre>
            </Sec>
          )}

          {(venue.facilities || []).length > 0 && (
            <Sec>
              <SecTit>편의시설</SecTit>
              <Facs>
                {venue.facilities.map((f) => (
                  <Fac key={f}><FacilityIcon name={f} size={15} /> {f}</Fac>
                ))}
              </Facs>
            </Sec>
          )}

          {courts.length > 0 && (
            <Sec>
              <SecTit>코트 · 요금</SecTit>
              {courts.map((c) => (
                <CourtRow key={c.id}>
                  <div>
                    <CourtName>{c.name}</CourtName>
                    <CourtSub>{c.type === "outdoor" ? "실외" : "실내"} · {c.slotMinutes || 60}분 단위{c.surface ? ` · ${c.surface}` : ""}</CourtSub>
                  </div>
                  <CourtPrice>{Number(c.pricePerHour) > 0 ? `${Number(c.pricePerHour).toLocaleString()}원` : (venue.cost === "free" ? "무료" : "-")}</CourtPrice>
                </CourtRow>
              ))}
            </Sec>
          )}

          {venue.rules && (
            <Sec>
              <SecTit>이용 안내</SecTit>
              <Pre>{venue.rules}</Pre>
            </Sec>
          )}
          {venue.refundPolicy && (
            <Sec>
              <SecTit>취소·노쇼 안내</SecTit>
              <Pre>{venue.refundPolicy}</Pre>
            </Sec>
          )}

          {(biz.bizName || biz.ownerName || phone || (biz.status === "verified" && biz.bizNo)) && (
            <Sec>
              <SecTit>사업자 정보</SecTit>
              {(biz.bizName || venue.bizName) && <BizRow>상호 {biz.bizName || venue.bizName}</BizRow>}
              {(biz.ownerName || venue.ownerName) && <BizRow>대표자 {biz.ownerName || venue.ownerName}</BizRow>}
              {biz.status === "verified" && biz.bizNo && <BizRow>사업자등록번호 {biz.bizNo}</BizRow>}
              {venue.salesReport?.number && <BizRow>통신판매업 신고 {venue.salesReport.number}</BizRow>}
              {phone && <Phone><LuPhone size={13} /> {phone}</Phone>}
              <Legal>할래말래는 통신판매중개자로서 통신판매의 당사자가 아니며, 구장 예약·이용 및 환불에 대한 책임은 판매자(구장 사업자)에게 있습니다.</Legal>
            </Sec>
          )}

          <div style={{ height: 8 }} />
        </Body>

        <Foot>
          <BookBtn>{priceLabel === "무료" ? "예약하기" : `${priceLabel} · 예약하기`}</BookBtn>
        </Foot>
      </Sheet>
    </Overlay>
  );
}
