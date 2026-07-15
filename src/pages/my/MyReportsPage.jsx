/* eslint-disable */
// src/pages/my/MyReportsPage.jsx
// 내정보 > 내가 신고한 내역 (팀/선수)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { listMyTeamReports } from "../../services/teamReportService";
import { listMyUserReports } from "../../services/userReportService";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

const toStr = (v) => String(v || "").trim();

const STATUS_LABEL = { pending: "검토중", resolved: "처리완료", rejected: "반려" };

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 14px 16px calc(32px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
`;

const Tab = styled.button`
  flex: 1;
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ theme, $on }) => ($on ? "#fff" : theme.colors.textStrong)};
  font-size: 13px;
  font-weight: 700;
  padding: 10px;
  border-radius: 999px;
  cursor: pointer;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Card = styled.button`
  text-align: left;
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const TypeChip = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#4f46e5")};
`;

const TargetName = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusChip = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  background: ${({ $status }) =>
    $status === "resolved" ? "#dcfce7" : $status === "rejected" ? "#f1f5f9" : "#fef3c7"};
  color: ${({ $status }) =>
    $status === "resolved" ? "#16a34a" : $status === "rejected" ? "#475569" : "#b45309"};
`;

const Reason = styled.div`
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: pre-line;
  word-break: break-word;
`;

const DateText = styled.div`
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LoadingCenter = styled.div`
  flex: 1;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

function fmtDate(d) {
  if (!d) return "";
  const dt = typeof d?.toDate === "function" ? d.toDate() : d;
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}.${dt.getMonth() + 1}.${dt.getDate()}`;
}

export default function MyReportsPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);

  const [loading, setLoading] = useState(true);
  const [teamReports, setTeamReports] = useState([]);
  const [playerReports, setPlayerReports] = useState([]);
  const [tab, setTab] = useState("all"); // all | team | player

  useEffect(() => {
    let alive = true;
    if (!myUid) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [teams, players] = await Promise.all([
          listMyTeamReports(myUid),
          listMyUserReports(myUid),
        ]);
        if (!alive) return;
        setTeamReports(Array.isArray(teams) ? teams : []);
        setPlayerReports(Array.isArray(players) ? players : []);
      } catch (e) {
        console.warn("[MyReportsPage] load failed:", e?.message || e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [myUid]);

  const rows = useMemo(() => {
    const merged =
      tab === "team" ? teamReports : tab === "player" ? playerReports : [...teamReports, ...playerReports];
    return [...merged].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }, [tab, teamReports, playerReports]);

  const goTarget = (r) => {
    if (!r?.targetId) return;
    if (r.type === "team") navigate(`/team/${r.targetId}`);
    else navigate(`/player/${r.targetId}`);
  };

  if (loading) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Tabs>
        <Tab $on={tab === "all"} onClick={() => setTab("all")}>
          전체 {teamReports.length + playerReports.length}
        </Tab>
        <Tab $on={tab === "team"} onClick={() => setTab("team")}>
          팀 {teamReports.length}
        </Tab>
        <Tab $on={tab === "player"} onClick={() => setTab("player")}>
          선수 {playerReports.length}
        </Tab>
      </Tabs>

      {rows.length === 0 ? (
        <EmptyState text="신고한 내역이 없습니다." />
      ) : (
        <List>
          {rows.map((r) => (
            <Card key={`${r.type}-${r.id}`} type="button" onClick={() => goTarget(r)}>
              <TopRow>
                <NameRow>
                  <TypeChip>{r.type === "team" ? "팀" : "선수"}</TypeChip>
                  <TargetName>{r.targetName || (r.type === "team" ? "팀" : "선수")}</TargetName>
                </NameRow>
                <StatusChip $status={r.status}>{STATUS_LABEL[r.status] || "검토중"}</StatusChip>
              </TopRow>
              {r.reason && <Reason>{r.reason}</Reason>}
              <DateText>{fmtDate(r.createdAt)} 신고</DateText>
            </Card>
          ))}
        </List>
      )}
    </Wrap>
  );
}
