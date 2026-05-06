/* eslint-disable */
// src/components/common/VenuePickerSheet.jsx
// 할래말래 제휴 구장 선택 시트
// - 마운트 시 listActiveVenues() 호출
// - 카드 본문 클릭 → /venues/:id 상세 페이지
// - 카드의 "선택" 버튼 클릭 → onPick({...}) → onClose
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { listActiveVenues } from "../../services/venuesService";

export default function VenuePickerSheet({
  open,
  onClose,
  onPick,
  title = "할래말래 제휴구장",
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listActiveVenues()
      .then((rows) => {
        if (!cancelled) setVenues(rows);
      })
      .catch((e) => {
        console.warn("[VenuePickerSheet] load failed", e);
        if (!cancelled) setVenues([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow || "";
      document.body.style.touchAction = prevTouchAction || "";
    };
  }, [open]);

  const handlePick = (v, e) => {
    e?.stopPropagation();
    onPick?.({
      id: v.id,
      name: v.name,
      address:
        v.address + (v.addressDetail ? ` ${v.addressDetail}` : "") || v.address,
      lat: v.lat,
      lng: v.lng,
      imageUrl: v.imageUrl,
    });
    onClose?.();
  };

  const handleViewDetail = (v) => {
    onClose?.();
    navigate(`/venues/${v.id}`);
  };

  if (!open) return null;

  return (
    <Overlay role="dialog" aria-modal="true" onClick={onClose}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <SheetTop>
          <SheetTitle>🏟️ {title}</SheetTitle>
          <CloseBtn type="button" onClick={onClose} aria-label="close">
            <FiX size={18} />
          </CloseBtn>
        </SheetTop>

        <SheetBody>
          {loading ? (
            <Empty>구장 목록을 불러오는 중…</Empty>
          ) : venues.length === 0 ? (
            <Empty>등록된 제휴구장이 없습니다.</Empty>
          ) : (
            <List>
              {venues.map((v) => (
                <Card key={v.id}>
                  <CardMain
                    type="button"
                    onClick={() => handleViewDetail(v)}
                    aria-label={`${v.name} 상세 보기`}
                  >
                    <Thumb>
                      {v.imageUrl ? (
                        <ThumbImg src={v.imageUrl} alt={v.name} />
                      ) : (
                        <ThumbPh>🏟️</ThumbPh>
                      )}
                    </Thumb>
                    <CardBody>
                      <Name>{v.name}</Name>
                      <Address>
                        {v.address}
                        {v.addressDetail ? ` ${v.addressDetail}` : ""}
                      </Address>
                      <BadgeRow>
                        <Badge $tone={v.type}>
                          {v.type === "outdoor" ? "실외" : "실내"}
                        </Badge>
                        <Badge $tone={v.cost}>
                          {v.cost === "paid" ? "유료" : "무료"}
                        </Badge>
                      </BadgeRow>
                    </CardBody>
                  </CardMain>
                  <PickBtn type="button" onClick={(e) => handlePick(v, e)}>
                    선택
                  </PickBtn>
                </Card>
              ))}
            </List>
          )}
        </SheetBody>
      </Sheet>
    </Overlay>
  );
}

/* ===== styled ===== */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0, 0, 0, 0.65)" : "rgba(17, 24, 39, 0.55)"};
  z-index: 9998;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 14px 14px;
  box-sizing: border-box;
  overflow: hidden;
  touch-action: none;
`;

const Sheet = styled.div`
  width: 100%;
  max-width: 460px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 12px;
  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? "0 18px 46px rgba(0, 0, 0, 0.55)"
      : "0 18px 46px rgba(0, 0, 0, 0.22)"};
  overflow: hidden;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
`;

const SheetTop = styled.div`
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const SheetTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CloseBtn = styled.button`
  border: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)"};
  color: ${({ theme }) => theme.colors.textStrong};
  width: 30px;
  height: 30px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const SheetBody = styled.div`
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
`;

const Empty = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Card = styled.div`
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.card};
  width: 100%;
`;

const CardMain = styled.button`
  flex: 1;
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 12px;
  align-items: center;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  min-width: 0;

  &:hover {
    opacity: 0.85;
  }
  &:active {
    transform: translateY(1px);
  }
`;

const PickBtn = styled.button`
  flex-shrink: 0;
  align-self: center;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 700;
  padding: 0 14px;
  height: 36px;
  border-radius: 999px;
  cursor: pointer;

  &:hover {
    opacity: 0.92;
  }
  &:active {
    transform: translateY(1px);
  }
`;

const Thumb = styled.div`
  width: 96px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  display: grid;
  place-items: center;
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ThumbPh = styled.div`
  font-size: 24px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const Name = styled.div`
  font-size: 13.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Address = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ $tone, theme }) => {
    const dark = theme.mode === "dark";
    if ($tone === "indoor") return dark ? "rgba(59,130,246,0.18)" : "#dbeafe";
    if ($tone === "outdoor") return dark ? "rgba(34,197,94,0.18)" : "#dcfce7";
    if ($tone === "free") return dark ? "rgba(234,179,8,0.18)" : "#fef3c7";
    if ($tone === "paid") return dark ? "rgba(239,68,68,0.18)" : "#fee2e2";
    return "transparent";
  }};
  color: ${({ $tone, theme }) => {
    const dark = theme.mode === "dark";
    if ($tone === "indoor") return dark ? "#93c5fd" : "#1d4ed8";
    if ($tone === "outdoor") return dark ? "#86efac" : "#15803d";
    if ($tone === "free") return dark ? "#fde68a" : "#a16207";
    if ($tone === "paid") return dark ? "#fca5a5" : "#b91c1c";
    return theme.colors.textNormal;
  }};
  font-size: 11px;
  font-weight: 600;
`;
