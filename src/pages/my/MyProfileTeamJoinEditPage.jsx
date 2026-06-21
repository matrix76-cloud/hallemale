/* eslint-disable */
// src/pages/my/MyProfileTeamJoinEditPage.jsx
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { getClubForPickerRow } from "../../services/teamService";
import TeamSelectModal from "../../components/team/TeamSelectModal";

export default function MyProfileTeamJoinEditPage() {
  const nav = useNavigate();
  const { userDoc, refreshUser } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const joinReq = userDoc?.joinRequest || null;
  const joinReqStatus = String(joinReq?.status || "").trim();
  const isJoinPending = joinReqStatus === "pending";
  const hasTeam = !!(userDoc?.activeTeamId || userDoc?.clubId);

  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [pendingClubRow, setPendingClubRow] = useState(null);

  useEffect(() => {
    if (!uid || !isJoinPending) {
      setPendingClubRow(null);
      return;
    }
    const clubId = joinReq?.clubId || "";
    if (!clubId) return;

    let alive = true;
    (async () => {
      try {
        const row = await getClubForPickerRow(clubId);
        if (!alive) return;
        setPendingClubRow(row || null);
      } catch (e) {
        if (!alive) return;
        setPendingClubRow(null);
      }
    })();
    return () => { alive = false; };
  }, [uid, isJoinPending, joinReq?.clubId]);

  const formatJoinAt = (tsLike) => {
    try {
      if (!tsLike) return "";
      const d =
        typeof tsLike?.toDate === "function"
          ? tsLike.toDate()
          : tsLike instanceof Date
          ? tsLike
          : null;
      if (!d) return "";
      return d.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (e) { return ""; }
  };

  const handleSubmitted = async () => {
    setTeamPickerOpen(false);
    try { await refreshUser?.(); } catch (e) {}
    window.alert("팀에 가입 신청을 보냈습니다.");
  };

  return (
    <Page>
      <Card>
        <Header>
          <BackBtn type="button" onClick={() => nav(-1)} aria-label="뒤로">‹</BackBtn>
          <Title>팀 가입 신청</Title>
        </Header>

        <Desc>관심 있는 팀에 가입 신청을 할 수 있어요. 한 번에 한 팀만 선택할 수 있습니다.</Desc>

        {hasTeam ? (
          <Hint>이미 소속된 팀이 있어 가입 신청이 필요하지 않습니다.</Hint>
        ) : isJoinPending ? (
          <>
            <TeamSummaryRow>
              <TeamLeft>
                <TeamLogoWrap>
                  <img
                    src={teamLogoSrc(pendingClubRow?.logoUrl)}
                    alt="team"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = images.teamPlaceholder;
                    }}
                  />
                </TeamLogoWrap>
                <TeamSummaryText>
                  <TeamNameStrong>{pendingClubRow?.name || "팀"}</TeamNameStrong>
                  {" · "}
                  {pendingClubRow?.regionLabel || "지역 미지정"}
                  {" · "}
                  {(pendingClubRow?.totalMatches ?? 0)}경기 · 승률 {(pendingClubRow?.winRatePercent ?? 0)}%
                </TeamSummaryText>
              </TeamLeft>
              <PendingBadge>신청 중</PendingBadge>
            </TeamSummaryRow>

            <JoinStatusText>
              {formatJoinAt(joinReq?.createdAt)
                ? <>신청일시: {formatJoinAt(joinReq?.createdAt)}</>
                : <>팀에 가입 신청 중입니다.</>}
            </JoinStatusText>
          </>
        ) : (
          <>
            <TeamSummaryRow>
              <TeamSummaryText>선택된 팀이 없습니다. 팀을 선택해 주세요.</TeamSummaryText>
              <TeamSelectButton type="button" onClick={() => setTeamPickerOpen(true)}>
                팀 선택
              </TeamSelectButton>
            </TeamSummaryRow>

            {joinReqStatus === "rejected" ? (
              <JoinStatusText $tone="danger">
                이전 신청이 거절되었습니다. 다른 팀을 선택해 다시 신청할 수 있어요.
              </JoinStatusText>
            ) : null}
          </>
        )}

        <ActionsRow>
          <GhostButton type="button" onClick={() => nav(-1)}>닫기</GhostButton>
        </ActionsRow>
      </Card>

      <TeamSelectModal
        open={teamPickerOpen && !isJoinPending}
        onClose={() => setTeamPickerOpen(false)}
        onSubmitted={handleSubmitted}
      />
    </Page>
  );
}

const Page = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.card};
  padding: 16px 14px 32px;
  display: flex;
  justify-content: center;
`;

const Card = styled.div`
  width: 100%;
  max-width: 520px;
  padding-left: 8px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Header = styled.div`
  margin-left: -8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BackBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Desc = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Hint = styled.div`
  padding: 12px 14px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const TeamSummaryRow = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const TeamLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
`;

const TeamLogoWrap = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.border};
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const TeamSummaryText = styled.div`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamNameStrong = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const PendingBadge = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  flex-shrink: 0;
`;

const TeamSelectButton = styled.button`
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
  white-space: nowrap;
`;

const JoinStatusText = styled.div`
  font-size: 11px;
  color: ${({ $tone, theme }) =>
    $tone === "danger" ? theme.colors.danger : theme.colors.primary};
`;

const ActionsRow = styled.div`
  margin-top: 8px;
  display: flex;
  gap: 10px;
`;

const GhostButton = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
`;
