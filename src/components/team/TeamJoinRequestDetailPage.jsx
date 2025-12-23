/* eslint-disable */
// src/pages/team/TeamJoinRequestDetailPage.jsx
// ✅ 팀장: 참여요청 상세 + 수락/거절

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { useAuth } from "../../hooks/useAuth";
import { acceptJoinRequest, getJoinRequestById, rejectJoinRequest } from "../../services/joinRequestService";

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatTimeAny(v) {
  const d = toDateSafe(v);
  if (!d) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${month}.${date} ${hour}:${min}`;
}

export default function TeamJoinRequestDetailPage() {
  const nav = useNavigate();
  const { clubId, requestId } = useParams();
  const { userDoc } = useAuth();
  const leaderUid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [req, setReq] = useState(null);

  useEffect(() => {
    if (!clubId || !requestId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const r = await getJoinRequestById({ clubId, requestId });
        if (!alive) return;
        setReq(r || null);
      } catch (e) {
        if (!alive) return;
        setReq(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [clubId, requestId]);

  const status = String(req?.status || "").trim();
  const isPending = status === "pending";

  const snap = req?.playerSnapshot || {};
  const name = String(snap.nickname || "").trim() || "선수";
  const region =
    String(snap.region || "").trim() ||
    `${String(snap.regionSido || "").trim()}${snap.regionSido && snap.regionGu ? " " : ""}${String(
      snap.regionGu || ""
    ).trim()}`.trim() ||
    "지역 미지정";
  const msg = String(req?.message || "").trim();

  const onAccept = async () => {
    if (!clubId || !requestId) return;
    if (!isPending) return;
    if (saving) return;

    const ok = window.confirm("이 참여요청을 수락하고 팀원으로 승인할까요?");
    if (!ok) return;

    setSaving(true);
    try {
      await acceptJoinRequest({ clubId, requestId, leaderUid });
      window.alert("수락했습니다. 팀원으로 추가되었습니다.");
      nav(`/team/${clubId}/manage`, { replace: true });
    } catch (e) {
      window.alert("수락에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const onReject = async () => {
    if (!clubId || !requestId) return;
    if (!isPending) return;
    if (saving) return;

    const ok = window.confirm("이 참여요청을 거절할까요?");
    if (!ok) return;

    setSaving(true);
    try {
      await rejectJoinRequest({ clubId, requestId, leaderUid });
      window.alert("거절했습니다.");
      nav(`/team/${clubId}/join-requests`, { replace: true });
    } catch (e) {
      window.alert("거절에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageWrap>
        <Center>
          <Spinner size="lg" />
        </Center>
      </PageWrap>
    );
  }

  if (!req) {
    return (
      <PageWrap>
        <EmptyText>참여요청 정보를 찾을 수 없습니다.</EmptyText>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <Top>
        <AvatarBox>
          {snap.avatarUrl ? <AvatarImg src={snap.avatarUrl} alt={name} /> : <AvatarPlaceholder size={52} />}
        </AvatarBox>

        <TopText>
          <TopTitle>{name}</TopTitle>
          <TopSub>{region}</TopSub>
          <TopMeta>{formatTimeAny(req.createdAt)}</TopMeta>
        </TopText>
      </Top>

      <Divider />

      <BlockTitle>요청 메시지</BlockTitle>
      <MessageBox>{msg || "팀에 참가하고 싶어요."}</MessageBox>

      <Divider />

      <BlockTitle>상태</BlockTitle>
      <StatusLine>
        <StatusPill $pending={isPending}>
          {status === "pending" ? "대기중" : status === "accepted" ? "수락함" : status === "rejected" ? "거절함" : status}
        </StatusPill>
      </StatusLine>

      {isPending ? (
        <BtnRow>
          <BtnGhost type="button" onClick={onReject} disabled={saving}>
            거절
          </BtnGhost>
          <BtnPrimary type="button" onClick={onAccept} disabled={saving}>
            {saving ? "처리 중..." : "수락하고 팀원 승인"}
          </BtnPrimary>
        </BtnRow>
      ) : (
        <BtnRow>
          <BtnGhost type="button" onClick={() => nav(`/team/${clubId}/join-requests`)}>
            목록으로
          </BtnGhost>
          <BtnPrimary type="button" onClick={() => nav(`/team/${clubId}/manage`)}>
            팀 관리
          </BtnPrimary>
        </BtnRow>
      )}
    </PageWrap>
  );
}

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors?.bg || "#f3f4f6"};
  padding: 14px 16px 90px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Center = styled.div`
  padding: 32px 0;
  display: flex;
  justify-content: center;
`;

const EmptyText = styled.div`
  margin-top: 32px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors?.muted || "#9ca3af"};
`;

const Top = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const AvatarBox = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 999px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  display: grid;
  place-items: center;
  flex-shrink: 0;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TopText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TopTitle = styled.div`
  font-size: 17px;
  color: #111827;
`;

const TopSub = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const TopMeta = styled.div`
  font-size: 12px;
  color: #9ca3af;
`;

const Divider = styled.div`
  height: 1px;
  background: #e5e7eb;
`;

const BlockTitle = styled.div`
  font-size: 13px;
  color: #111827;
  font-family: "GmarketSans";
`;

const MessageBox = styled.div`
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 14px;
  padding: 12px 12px;
  font-size: 13px;
  color: #111827;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const StatusLine = styled.div`
  display: flex;
  align-items: center;
`;

const StatusPill = styled.span`
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: ${({ $pending }) => ($pending ? "rgba(79,70,229,0.12)" : "#f3f4f6")};
  color: ${({ $pending }) => ($pending ? "#4f46e5" : "#6b7280")};
`;

const BtnRow = styled.div`
  margin-top: 10px;
  display: flex;
  gap: 10px;
`;

const BtnGhost = styled.button`
  flex: 1;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const BtnPrimary = styled.button`
  flex: 1;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: #4f46e5;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
