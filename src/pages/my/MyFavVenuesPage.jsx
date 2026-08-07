/* eslint-disable */
// src/pages/my/MyFavVenuesPage.jsx
// 찜한 구장 목록 — users.favVenueIds 를 읽어 구장 카드로 보여준다. 탭 시 구장 상세로.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getVenue } from "../../services/ownerVenueService";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { FiMapPin } from "react-icons/fi";
import { calcDisplayPrice, DISPLAY_PRICE_NOTE } from "../../constants/payments";
import { courtUnitPrice, isPerPerson } from "../../services/ownerVenueService";

// 표시 금액은 실제 결제 총액(구장 이용료 + 플랫폼 이용료) — 순차공개 가격책정 금지.
// 인원제 코트는 단가가 "1인 시간당"이라 뜻이 달라진다 → 모드도 같이 돌려준다.
function minPrice(v) {
  let best = null;
  for (const c of v?.courts || []) {
    const p = courtUnitPrice(c);
    if (p > 0 && (best == null || p < best.p)) best = { p: calcDisplayPrice(p), perPerson: isPerPerson(c) };
  }
  return best;
}

export default function MyFavVenuesPage() {
  const nav = useNavigate();
  const { userDoc } = useAuth();
  const [venues, setVenues] = useState(null); // null = 로딩 중

  const favIds = useMemo(
    () =>
      Array.isArray(userDoc?.favVenueIds)
        ? userDoc.favVenueIds.map((x) => String(x || "").trim()).filter(Boolean)
        : [],
    [userDoc?.favVenueIds]
  );

  useEffect(() => {
    let alive = true;
    if (favIds.length === 0) {
      setVenues([]);
      return;
    }
    setVenues(null);
    Promise.all(
      favIds.map((id) =>
        getVenue(id)
          .then((v) => (v ? { ...v, id: v.id || id } : null))
          .catch(() => null)
      )
    ).then((list) => {
      // 반려·비활성(노출 중지)된 구장은 제외 — 탭 시 이용 불가한 상세로 들어가지 않도록
      if (alive) setVenues(list.filter((v) => v && v.status !== "rejected" && v.active !== false));
    });
    return () => {
      alive = false;
    };
  }, [favIds]);

  if (venues === null) {
    return (
      <Wrap>
        <Center>
          <Spinner />
        </Center>
      </Wrap>
    );
  }

  return (
    <Wrap>
      {venues.length === 0 ? (
        <EmptyState
          text="아직 찜한 구장이 없어요."
          sub="구장 목록에서 하트를 눌러 담아보세요."
          actionLabel="구장 둘러보기"
          onAction={() => nav("/venues")}
        />
      ) : (
        <List>
          {venues.map((v) => {
            const p = minPrice(v);
            const img = v.imageUrl || (Array.isArray(v.photos) ? v.photos[0] : "");
            return (
              <Card key={v.id} type="button" onClick={() => nav(`/venue-book/${v.id}`)}>
                <Thumb>
                  {img ? <ThumbImg src={img} alt={v.name} /> : <FiMapPin size={20} />}
                </Thumb>
                <Info>
                  <Name>{v.name || "구장"}</Name>
                  <Addr>
                    <FiMapPin size={12} /> {v.address || ""}
                  </Addr>
                  {p != null ? (
                    <Price>
                      {p.perPerson ? "1인 " : ""}{p.p.toLocaleString()}원~ / 시간
                      {DISPLAY_PRICE_NOTE ? ` · ${DISPLAY_PRICE_NOTE}` : ""}
                    </Price>
                  ) : null}
                </Info>
              </Card>
            );
          })}
        </List>
      )}
    </Wrap>
  );
}

const Wrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  padding: 14px 16px calc(24px + env(safe-area-inset-bottom));
`;

const Center = styled.div`
  min-height: 50vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Card = styled.button`
  width: 100%;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  &:active { transform: translateY(1px); }
`;

const Thumb = styled.div`
  width: 64px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const Name = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Addr = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Price = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
`;
