/* eslint-disable */
// src/pages/venue/VenueDetailPage.jsx
// 제휴 구장 상세 페이지 (정보 보기 전용 — "선택" 버튼은 시트 카드에 있음)
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { goBackOrHome } from "../../utils/navigation";
import { IoArrowBack } from "react-icons/io5";
import { FiMapPin } from "react-icons/fi";
import { getVenueById } from "../../services/venuesService";
import Spinner from "../../components/common/Spinner";

export default function VenueDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getVenueById(id)
      .then((v) => {
        if (cancelled) return;
        if (!v) setError("구장 정보를 찾을 수 없습니다.");
        setVenue(v);
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn("[VenueDetailPage] load failed", e);
        setError("구장 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Page>
      <Header>
        <BackBtn type="button" onClick={() => goBackOrHome(navigate)} aria-label="뒤로">
          <IoArrowBack size={22} />
        </BackBtn>
        <HeaderTitle>구장 상세</HeaderTitle>
        <HeaderSpace />
      </Header>

      {loading ? (
        <CenterWrap>
          <Spinner size="lg" />
        </CenterWrap>
      ) : error || !venue ? (
        <CenterWrap>{error || "구장 정보를 찾을 수 없습니다."}</CenterWrap>
      ) : (
        <Content>
          <HeroBox>
            {venue.imageUrl ? (
              <HeroImg src={venue.imageUrl} alt={venue.name} />
            ) : (
              <HeroPh>🏟️</HeroPh>
            )}
          </HeroBox>

          <Section>
            <NameRow>
              <Name>{venue.name}</Name>
            </NameRow>
            <BadgeRow>
              <Badge $tone={venue.type}>
                {venue.type === "outdoor" ? "실외" : "실내"}
              </Badge>
              <Badge $tone={venue.cost}>
                {venue.cost === "paid" ? "유료" : "무료"}
              </Badge>
            </BadgeRow>
          </Section>

          <Section>
            <SectionTitle style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <FiMapPin size={14} />주소
            </SectionTitle>
            <Address>
              {venue.address}
              {venue.addressDetail ? ` ${venue.addressDetail}` : ""}
            </Address>
            {venue.lat != null && venue.lng != null && (
              <Coords>
                좌표: {venue.lat.toFixed(5)}, {venue.lng.toFixed(5)}
              </Coords>
            )}
          </Section>

          {venue.memo ? (
            <Section>
              <SectionTitle>📝 안내</SectionTitle>
              <Memo>{venue.memo}</Memo>
            </Section>
          ) : null}
        </Content>
      )}
    </Page>
  );
}

/* ===== styled ===== */

const Page = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: ${({ theme }) => theme.colors.card};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  position: sticky;
  top: 0;
  z-index: 10;
`;

const BackBtn = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"};
  }
`;

const HeaderTitle = styled.div`
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const HeaderSpace = styled.div`
  width: 40px;
  height: 40px;
`;

const CenterWrap = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 40px 0;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  padding-bottom: 40px;
`;

const HeroBox = styled.div`
  width: 100%;
  aspect-ratio: 16 / 10;
  background: ${({ theme }) => theme.colors.surface};
  display: grid;
  place-items: center;
  overflow: hidden;
`;

const HeroImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const HeroPh = styled.div`
  font-size: 48px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Section = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Name = styled.h1`
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.3;
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
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
  font-size: 11.5px;
  font-weight: 700;
`;

const Address = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.5;
`;

const Coords = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Memo = styled.div`
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.textNormal};
  line-height: 1.6;
  white-space: pre-wrap;
`;
