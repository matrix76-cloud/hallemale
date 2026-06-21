/* eslint-disable */
// src/components/home/HomeUpcomingMatch.jsx
// 홈 상단: 다가오는(확정·미종료) 경기 카드
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiChevronRight } from "react-icons/fi";
import { loadMatchRoomListPageData } from "../../services/matchRoomService";
import { getTeamRankMap } from "../../services/teamRankingService";
import TeamAvatarPlaceholder from "../common/TeamAvatarPlaceholder";
import { images } from "../../utils/imageAssets";

const toStr = (v) => String(v || "").trim();

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}.${d.getDate()} (${dayNames[d.getDay()]}) ${hh}:${mm}`;
};

const formatDday = (iso) => {
  if (!iso) return "";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000);
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
};

const SectionWrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 가로 스와이프 (경기 2개 이상) */
const SlideRow = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: ${({ $multi }) => ($multi ? "auto" : "visible")};
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* 카드 그림자가 잘리지 않도록 살짝 여백 */
  margin: 0 -2px;
  padding: 2px;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Slide = styled.div`
  flex: 0 0 ${({ $multi }) => ($multi ? "88%" : "100%")};
  scroll-snap-align: start;
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  cursor: pointer;
  overflow: hidden;

  &:active {
    transform: translateY(1px);
  }
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 4px;
`;

const TopLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Dday = styled.span`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 800;
`;

const TopTime = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

const TeamsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 12px;
`;

const TeamSide = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: ${({ $reverse }) => ($reverse ? "flex-end" : "flex-start")};
`;

/* 1~3위: 로고 위에 겹쳐지는 왕관 (다른 카드와 동일) */
const LogoSlot = styled.div`
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
`;

const CrownImg = styled.img`
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  width: 23px;
  height: 23px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const LogoBox = styled.div`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textNormal};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: ${({ $align }) => $align || "left"};
`;

const TeamName = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamSub = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

const VsText = styled.span`
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const VenueRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 14px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 12.5px;
`;

const VenueText = styled.span`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Chevron = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function HomeUpcomingMatch({ clubId }) {
  const nav = useNavigate();
  const [matches, setMatches] = useState([]);
  const [rankMap, setRankMap] = useState(null);

  useEffect(() => {
    let alive = true;
    const cid = toStr(clubId);
    if (!cid) {
      setMatches([]);
      return;
    }

    (async () => {
      try {
        const [data, rmap] = await Promise.all([
          loadMatchRoomListPageData(cid),
          getTeamRankMap().catch(() => null),
        ]);
        if (!alive) return;

        const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
        const now = Date.now();

        const upcoming = rooms
          .filter((r) => toStr(r?.status) === "confirmed" && r?.scheduledAt)
          .map((r) => ({ ...r, _t: new Date(r.scheduledAt).getTime() }))
          .filter((r) => {
            const dur = Number(r?.durationMin) || 120;
            // 아직 끝나지 않은 확정 경기(시작 + 경기시간 > 현재)
            return Number.isFinite(r._t) && r._t + dur * 60000 > now;
          })
          .sort((a, b) => a._t - b._t);

        setMatches(upcoming);
        setRankMap(rmap || null);
      } catch (e) {
        console.warn("[HomeUpcomingMatch] load failed:", e?.message || e);
        if (alive) setMatches([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [clubId]);

  if (!matches.length) return null;

  const multi = matches.length > 1;

  const renderCard = (match) => {
    const myTeam = match.myTeam || {};
    const oppTeam = match.oppTeam || {};
    const myName = toStr(myTeam.name) || "우리팀";
    const oppName = toStr(oppTeam.name) || "상대팀";
    const myLogo = toStr(myTeam.logoUrl);
    const oppLogo = toStr(oppTeam.logoUrl);

    const myRank = rankMap ? rankMap.get(toStr(myTeam.clubId || myTeam.id)) : null;
    const oppRank = rankMap ? rankMap.get(toStr(oppTeam.clubId || oppTeam.id)) : null;

    const address = toStr(match.fieldAddress);

    return (
      <Card
        onClick={() => nav(`/match-roomdetail/${match.id}`)}
        role="button"
        tabIndex={0}
      >
        <TopRow>
          <TopLeft>
            <Dday>{formatDday(match.scheduledAt)}</Dday>
          </TopLeft>
          <TopTime>{formatDateTime(match.scheduledAt)}</TopTime>
        </TopRow>

        <TeamsRow>
          <TeamSide>
            <LogoSlot>
              {myRank && myRank <= 3 ? <CrownImg src={images.logo} alt={`${myRank}위`} /> : null}
              <LogoBox>
                {myLogo ? <LogoImg src={myLogo} alt={myName} /> : <TeamAvatarPlaceholder size={40} />}
              </LogoBox>
            </LogoSlot>
            <TeamText $align="left">
              <TeamName>{myName}</TeamName>
              <TeamSub>우리팀{myRank ? ` · ${myRank}위` : ""}</TeamSub>
            </TeamText>
          </TeamSide>

          <VsText>VS</VsText>

          <TeamSide $reverse>
            <TeamText $align="right">
              <TeamName>{oppName}</TeamName>
              <TeamSub>{oppRank ? `${oppRank}위` : "랭킹 정보 없음"}</TeamSub>
            </TeamText>
            <LogoSlot>
              {oppRank && oppRank <= 3 ? <CrownImg src={images.logo} alt={`${oppRank}위`} /> : null}
              <LogoBox>
                {oppLogo ? <LogoImg src={oppLogo} alt={oppName} /> : <TeamAvatarPlaceholder size={40} />}
              </LogoBox>
            </LogoSlot>
          </TeamSide>
        </TeamsRow>

        {address ? (
          <VenueRow>
            <FiMapPin size={14} />
            <VenueText>{address}</VenueText>
            <Chevron>
              <FiChevronRight size={16} />
            </Chevron>
          </VenueRow>
        ) : null}
      </Card>
    );
  };

  return (
    <SectionWrap>
      <SectionTitle>다가오는 경기{multi ? ` ${matches.length}` : ""}</SectionTitle>

      <SlideRow $multi={multi}>
        {matches.map((m) => (
          <Slide key={m.id} $multi={multi}>
            {renderCard(m)}
          </Slide>
        ))}
      </SlideRow>
    </SectionWrap>
  );
}
