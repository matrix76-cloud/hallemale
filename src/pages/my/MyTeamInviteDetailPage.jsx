/* eslint-disable */
// src/pages/my/MyTeamInviteDetailPage.jsx
// ✅ 초대 상세 + 수락/거절
// - 페이지 내 헤더 없음(MainLayout에서 처리)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../services/firebase";
import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { acceptClubInvite, getClubInviteById, rejectClubInvite } from "../../services/inviteService";

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

export default function MyTeamInviteDetailPage() {
  const nav = useNavigate();
  const { clubId, inviteId } = useParams();
  const { userDoc } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [invite, setInvite] = useState(null);
  const [club, setClub] = useState(null);

  useEffect(() => {
    if (!clubId || !inviteId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const inv = await getClubInviteById({ clubId, inviteId });
        if (!alive) return;
        setInvite(inv);

        try {
          const cs = await getDoc(doc(db, "clubs", clubId));
          if (!alive) return;
          setClub(cs.exists() ? cs.data() : null);
        } catch (e2) {
          if (!alive) return;
          setClub(null);
        }
      } catch (e) {
        if (!alive) return;
        setInvite(null);
        setClub(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [clubId, inviteId]);

  const status = String(invite?.status || "").trim();
  const isPending = status === "pending";

  const teamName = club?.name || "팀";
  const teamRegion = club?.region || "지역 미지정";
  const logoUrl = club?.logoUrl || "";

  const msg = useMemo(() => String(invite?.message || "").trim(), [invite?.message]);

  const onAccept = async () => {
    if (!uid) return;
    if (!isPending) return;
    if (saving) return;

    const ok = window.confirm("이 초대를 수락하고 팀에 가입할까요?");
    if (!ok) return;

    setSaving(true);
    try {
      await acceptClubInvite({ clubId, inviteId, uid });
      window.alert("팀에 가입했어요.");
      nav("/my", { replace: true });
    } catch (e) {
      window.alert("수락에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const onReject = async () => {
    if (!uid) return;
    if (!isPending) return;
    if (saving) return;

    const ok = window.confirm("이 초대를 거절할까요?");
    if (!ok) return;

    setSaving(true);
    try {
      await rejectClubInvite({ clubId, inviteId, uid });
      window.alert("거절했습니다.");
      nav("/my/team-invites", { replace: true });
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

  if (!invite) {
    return (
      <PageWrap>
        <EmptyText>초대 정보를 찾을 수 없습니다.</EmptyText>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <Top>
        <LogoBox>
          {logoUrl ? <LogoImg src={logoUrl} alt="logo" /> : <AvatarPlaceholder size={52} />}
        </LogoBox>

        <TopText>
          <TopTitle>{teamName}</TopTitle>
          <TopSub>{teamRegion}</TopSub>
          <TopMeta>{formatTimeAny(invite.createdAt)}</TopMeta>
        </TopText>
      </Top>

      <Divider />

      <BlockTitle>초대 메시지</BlockTitle>
      <MessageBox>{msg || "팀에서 초대가 도착했어요. 함께 뛰어요!"}</MessageBox>

      <Divider />

      <BlockTitle>상태</BlockTitle>
      <StatusLine>
        <StatusPill $pending={isPending}>
          {status === "pending"
            ? "대기중"
            : status === "accepted"
            ? "수락함"
            : status === "rejected"
            ? "거절함"
            : status}
        </StatusPill>
      </StatusLine>

      {isPending ? (
        <BtnRow>
          <BtnGhost type="button" onClick={onReject} disabled={saving}>
            거절
          </BtnGhost>
          <BtnPrimary type="button" onClick={onAccept} disabled={saving}>
            {saving ? "처리 중..." : "수락하고 가입"}
          </BtnPrimary>
        </BtnRow>
      ) : (
        <BtnRow>
          <BtnGhost type="button" onClick={() => nav("/my/team-invites")}>
            목록으로
          </BtnGhost>
          <BtnPrimary type="button" onClick={() => nav(`/team/${clubId}`)}>
            팀 보기
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

const LogoBox = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  display: grid;
  place-items: center;
  flex-shrink: 0;
`;

const LogoImg = styled.img`
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
