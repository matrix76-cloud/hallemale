/* eslint-disable */
// src/pages/matching/FinishedMatchesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import { images } from "../../utils/imageAssets";
import { listFinishedMatchesPage } from "../../services/matchRoomService";
import { useClub } from "../../hooks/useClub";

const toStr = (v) => String(v || "").trim();

const formatKoreanDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${month}.${date} (${day}) ${hour}:${min}`;
};

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 10px 0 24px;
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionCard = styled.div`
  background: #ffffff;
  border-radius: 8px;
  padding: 14px 14px 16px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MatchMetaTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 2px 0;
`;



const MatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TeamSide = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TeamSideRight = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`;

const TeamLogoWrap = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
  flex: 0 0 auto;
`;

const TeamLogo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Vs = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const ScoreHero = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  padding: 2px 0 0;
`;

const ScoreNum = styled.div`
  font-size: 30px;
  color: #111827;
  letter-spacing: -0.02em;
`;

const ScoreSep = styled.div`
  font-size: 18px;
  color: #9ca3af;
`;

const Thumb = styled.div`
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 8px;
  overflow: hidden;
  background: #e5e7eb;
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const ActionsRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
`;

const DetailBtn = styled.button`
  border: none;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary || "#2563eb"};
  color: #ffffff;
  font-size: 13px;
  padding: 10px 14px;
  cursor: pointer;
  white-space: nowrap;

  &:active {
    transform: translateY(1px);
  }
`;

const LoadMoreRow = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 4px;
`;

const LoadMoreBtn = styled.button`
  border: none;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary || "#2563eb"};
  color: #ffffff;
  font-size: 13px;
  padding: 10px 14px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const EmptyCard = styled.div`
  background: #ffffff;
  border-radius: 8px;
  padding: 18px 14px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  font-size: 13px;
  text-align: center;
`;

const ErrorCard = styled.div`
  background: #ffffff;
  border-radius: 8px;
  padding: 18px 14px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  color: #ef4444;
  font-size: 13px;
  line-height: 1.5;
`;

const MetaLine = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const MetaLineStrong = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
`;

export default function FinishedMatchesPage() {
  const nav = useNavigate();
  const { club } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();

  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const load = async ({ reset = false } = {}) => {
    if (busy) return;
    if (!reset && done) return;

    setBusy(true);
    setError("");

    try {
      const res = await listFinishedMatchesPage({
        pageSize: 16,
        cursor: reset ? null : cursor,
        clubId: myClubId,
        debugLog: false,
      });

      const nextRows = Array.isArray(res?.rows) ? res.rows : [];
      const nextCursor = res?.nextCursor || null;

      setRows((prev) => (reset ? nextRows : [...(prev || []), ...nextRows]));
      setCursor(nextCursor);

      if (!nextCursor || nextRows.length < 16) setDone(true);
    } catch (e) {
      setError(
        e?.code === "permission-denied"
          ? "권한 문제로 경기를 불러올 수 없습니다. (Firestore Rules 확인 필요)"
          : e?.message || "불러오기에 실패했습니다."
      );
      setDone(true);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClubId]);

  const viewRows = useMemo(() => {
    return (rows || []).map((r) => {
      const actorLogo = toStr(r?.actorTeam?.logoUrl) || images.logo;
      const targetLogo = toStr(r?.targetTeam?.logoUrl) || images.logo;

      const photoUrls = Array.isArray(r?.result?.photoUrls) ? r.result.photoUrls : [];
      const firstPhoto = photoUrls.length > 0 ? photoUrls[0] : "";

      const when = r?.scheduledAt ? formatKoreanDateTime(r.scheduledAt) : "";
      const where = toStr(r?.fieldAddress);

      const aName = toStr(r?.actorTeam?.name) || "팀";
      const tName = toStr(r?.targetTeam?.name) || "팀";

      const aScore = r?.actorScore != null ? String(r.actorScore) : "-";
      const tScore = r?.targetScore != null ? String(r.targetScore) : "-";

      return { ...r, actorLogo, targetLogo, firstPhoto, when, where, aName, tName, aScore, tScore };
    });
  }, [rows]);

  const openDetail = (id) => {
    if (!id) return;
    nav(`/match-roomdetail/${id}`);
  };

  return (
    <PageWrap>
      <Inner>
        {loading ? (
          <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner />
          </div>
        ) : null}

        {!loading && error ? <ErrorCard>{error}</ErrorCard> : null}

        {!loading && !error && viewRows.length === 0 ? (
          <EmptyCard>{myClubId ? "내 팀의 완료된 경기가 없습니다." : "완료된 경기가 없습니다."}</EmptyCard>
        ) : null}

        {viewRows.map((r) => (
          <SectionCard key={r.id}>
            {/* ✅ 날짜/구장 먼저 */}
            <MatchMetaTop>
              {r.when ? <MetaLineStrong>{r.when}</MetaLineStrong> : null}
              {r.where ? <MetaLine>구장: {r.where}</MetaLine> : null}

            </MatchMetaTop>

            {/* 팀 vs 팀 */}
            <MatchRow>
              <TeamSide>
                <TeamLogoWrap>
                  <TeamLogo src={r.actorLogo} alt={r.aName} />
                </TeamLogoWrap>
                <TeamName title={r.aName}>{r.aName}</TeamName>

    

              </TeamSide>

              <Vs>VS</Vs>

              <TeamSideRight>
                <TeamName title={r.tName} style={{ textAlign: "right" }}>
                  {r.tName}
                </TeamName>
                <TeamLogoWrap>
                  <TeamLogo src={r.targetLogo} alt={r.tName} />
                </TeamLogoWrap>
              </TeamSideRight>
            </MatchRow>

            {/* 점수 */}
            <ScoreHero>
              <ScoreNum>{r.aScore}</ScoreNum>
              <ScoreSep>:</ScoreSep>
              <ScoreNum>{r.tScore}</ScoreNum>
            </ScoreHero>

            {/* 대표 사진 */}
            {r.firstPhoto ? (
              <Thumb>
                <ThumbImg src={r.firstPhoto} alt="match" />
              </Thumb>
            ) : null}

            {/* ✅ 상세 버튼(여기로 들어간다는 걸 알게) */}
            <ActionsRow>
              <DetailBtn type="button" onClick={() => openDetail(r.id)}>
                상세내용 보기
              </DetailBtn>
            </ActionsRow>
          </SectionCard>
        ))}

        {!loading && !error && !done ? (
          <LoadMoreRow>
            <LoadMoreBtn type="button" onClick={() => load({ reset: false })} disabled={busy}>
              {busy ? "불러오는 중..." : "더 보기"}
            </LoadMoreBtn>
          </LoadMoreRow>
        ) : null}
      </Inner>
    </PageWrap>
  );
}
