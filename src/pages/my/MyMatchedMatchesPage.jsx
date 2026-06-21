// src/pages/my/MyMatchedMatchesPage.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { teamLogoSrc } from "../../utils/imageAssets";
import { useClub } from "../../hooks/useClub";
import { loadMatchRoomListPageData } from "../../services/matchRoomService";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

/**
 * 매칭된 경기 목록 페이지
 * - 내 팀이 참여한 모든 매칭 경기 (status accepted/proposed/confirmed/finished/cancelled)
 */

const formatDateTime = (iso) => {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}.${mm}.${dd} (${day})`, time: `${hh}:${mi}` };
};

const statusLabelTone = (status) => {
  if (status === "accepted" || status === "proposed") return { label: "매칭 신청중", tone: "pending" };
  if (status === "confirmed") return { label: "확정", tone: "confirmed" };
  if (status === "finished") return { label: "종료", tone: "finished" };
  if (status === "cancelled") return { label: "취소", tone: "cancelled" };
  return { label: "미정", tone: "default" };
};

export default function MyMatchedMatchesPage() {
  const navigate = useNavigate();
  const { club } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    if (!myClubId) {
      setRooms([]);
      setLoading(false);
      return () => {};
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const { rooms: list } = await loadMatchRoomListPageData(myClubId);
        if (!alive) return;
        setRooms(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "매칭된 경기를 불러오지 못했습니다.");
        setRooms([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [myClubId]);

  const view = useMemo(() => {
    return (rooms || []).map((r) => {
      const { date, time } = formatDateTime(r.scheduledAt);
      const { label: statusLabel, tone } = statusLabelTone(r.status);
      const score = r.myScore != null && r.oppScore != null ? `${r.myScore} : ${r.oppScore}` : "-";
      return {
        id: r.id,
        myTeamName: r?.myTeam?.name || "내 팀",
        myLogo: teamLogoSrc(r?.myTeam?.logoUrl),
        oppTeamName: r?.oppTeam?.name || "상대 팀",
        oppLogo: teamLogoSrc(r?.oppTeam?.logoUrl),
        date,
        time,
        place: r.fieldAddress || "-",
        status: r.status,
        statusLabel,
        tone,
        score,
      };
    });
  }, [rooms]);

  const handleClickMatch = (id) => {
    if (!id) return;
    navigate(`/match-roomdetail/${id}`);
  };

  return (
    <PageWrap>
      <Inner>
        {loading ? (
          <CenterBox>
            <Spinner />
          </CenterBox>
        ) : error ? (
          <EmptyWrap>{error}</EmptyWrap>
        ) : view.length === 0 ? (
          <EmptyState text="아직 매칭된 경기 기록이 없습니다." />
        ) : (
          <MatchList>
            {view.map((m) => (
              <MatchCard key={m.id} type="button" onClick={() => handleClickMatch(m.id)}>
                <TopRow>
                  <TeamRow>
                    <TeamSide>
                      <TeamLogoWrap>
                        <TeamLogo src={m.myLogo} alt={m.myTeamName} />
                      </TeamLogoWrap>
                      <TeamName>{m.myTeamName}</TeamName>
                    </TeamSide>
                    <VsText>VS</VsText>
                    <TeamSide style={{ justifyContent: "flex-end" }}>
                      <TeamName style={{ textAlign: "right" }}>{m.oppTeamName}</TeamName>
                      <TeamLogoWrap>
                        <TeamLogo src={m.oppLogo} alt={m.oppTeamName} />
                      </TeamLogoWrap>
                    </TeamSide>
                  </TeamRow>
                </TopRow>

                <MiddleRow>
                  <InfoCol>
                    <InfoLabel>경기 일시</InfoLabel>
                    <InfoValue>
                      {m.date} {m.time}
                    </InfoValue>
                  </InfoCol>
                  <InfoCol>
                    <InfoLabel>장소</InfoLabel>
                    <InfoValue>{m.place}</InfoValue>
                  </InfoCol>
                </MiddleRow>

                <BottomRow>
                  <StatusBadge tone={m.tone}>{m.statusLabel}</StatusBadge>
                  <ResultRight>
                    <ResultLabel>결과</ResultLabel>
                    <ResultValue>{m.status === "finished" ? m.score : "-"}</ResultValue>
                  </ResultRight>
                </BottomRow>
              </MatchCard>
            ))}
          </MatchList>
        )}
      </Inner>
    </PageWrap>
  );
}

/* ============ styled ============ */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 14px 20px;
`;

const CenterBox = styled.div`
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EmptyWrap = styled.div`
  margin-top: 20px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const MatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
`;

const MatchCard = styled.button`
  width: 100%;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  padding: 10px 12px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  text-align: left;
`;

const TopRow = styled.div``;

const TeamRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
`;

const TeamSide = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TeamLogoWrap = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const TeamLogo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const VsText = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const MiddleRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 4px;
`;

const InfoCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const InfoLabel = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 2px;
`;

const InfoValue = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const BottomRow = styled.div`
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StatusBadge = styled.div`
  min-width: 60px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;

  ${({ tone, theme }) => {
    const isDark = theme.mode === "dark";
    if (tone === "pending")
      return isDark
        ? `background:rgba(245,158,11,0.18);color:#fbbf24;`
        : `background:#fef3c7;color:#b45309;`;
    if (tone === "confirmed")
      return isDark
        ? `background:rgba(34,197,94,0.18);color:#86efac;`
        : `background:#dcfce7;color:#166534;`;
    if (tone === "finished")
      return isDark
        ? `background:rgba(255,255,255,0.06);color:${theme.colors.textNormal};`
        : `background:#e5e7eb;color:#111827;`;
    if (tone === "cancelled")
      return isDark
        ? `background:rgba(248,113,113,0.16);color:#fca5a5;`
        : `background:#fee2e2;color:#b91c1c;`;
    return isDark
      ? `background:rgba(255,255,255,0.06);color:${theme.colors.textWeak};`
      : `background:#e5e7eb;color:#4b5563;`;
  }}
`;

const ResultRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
`;

const ResultLabel = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ResultValue = styled.div`
  color: ${({ theme }) => theme.colors.textStrong};
`;
