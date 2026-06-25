/* eslint-disable */
// src/pages/venue/VenueListPage.jsx
// 구장 예약 — 예약 가능한 구장(승인+코트보유) 목록
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiMapPin, FiChevronRight } from "react-icons/fi";
import { listBookableVenues } from "../../services/ownerVenueService";
import Spinner from "../../components/common/Spinner";
import { FacilityIcon } from "./facilityIcons";

const Wrap = styled.div`display: flex; flex-direction: column; gap: 12px;`;
const Center = styled.div`min-height: 40vh; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;`;
const Card = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  display: flex;
  flex-direction: column;
  &:active { transform: translateY(1px); }
`;
const Cover = styled.div`
  width: 100%;
  aspect-ratio: 3 / 2;
  background: ${({ theme }) => theme.colors.surface};
  position: relative;
  overflow: hidden;
`;
const CoverImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
`;
const NoImg = styled.div`width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: ${({ theme }) => theme.colors.textWeak}; font-size: 13px;`;
const PriceTag = styled.div`
  position: absolute; left: 10px; bottom: 10px;
  background: rgba(0,0,0,0.62); color: #fff; padding: 5px 11px; border-radius: 999px;
  font-size: 12px; font-weight: 700;
`;
const Body = styled.div`padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px;`;
const TopRow = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 8px;`;
const Name = styled.div`font-size: 16px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const Addr = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak}; display: flex; align-items: center; gap: 4px;`;
const Meta = styled.div`display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px;`;
const Pill = styled.span`
  font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 999px;
  background: ${({ theme }) => theme.colors.surface}; border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textNormal};
`;

function minPrice(v) {
  const prices = (v.courts || []).map((c) => Number(c.pricePerHour) || 0).filter((n) => n > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

export default function VenueListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get("match") || "";
  const suffix = matchId ? `?match=${matchId}` : "";
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBookableVenues()
      .then((rows) => { if (!cancelled) setVenues(rows); })
      .catch((e) => { console.warn("[VenueListPage] load failed", e); if (!cancelled) setVenues([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Center><Spinner size="lg" /></Center>;
  if (venues.length === 0) {
    return <Center><FiMapPin size={30} /><div>예약 가능한 구장이 아직 없어요.</div></Center>;
  }

  return (
    <Wrap>
      {venues.map((v) => {
        const mp = minPrice(v);
        return (
          <Card key={v.id} type="button" onClick={() => navigate(`/venue-book/${v.id}${suffix}`)}>
            <Cover>
              {v.imageUrl ? <CoverImg src={v.imageUrl} alt={v.name} /> : <NoImg>사진 없음</NoImg>}
              {mp != null && <PriceTag>{mp.toLocaleString()}원~ / 시간</PriceTag>}
            </Cover>
            <Body>
              <TopRow>
                <Name>{v.name}</Name>
                <FiChevronRight size={20} color="#9ca3af" />
              </TopRow>
              <Addr><FiMapPin size={13} /> {v.address}</Addr>
              <Meta>
                <Pill>{v.type === "outdoor" ? "실외" : "실내"}</Pill>
                <Pill>코트 {v.courts?.length || 0}개</Pill>
                {v.facilities?.slice(0, 3).map((f) => (
                  <Pill key={f}><FacilityIcon name={f} size={13} /> {f}</Pill>
                ))}
              </Meta>
            </Body>
          </Card>
        );
      })}
    </Wrap>
  );
}
