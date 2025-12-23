/* eslint-disable */
// src/pages/team/TeamJoinRequestsPage.jsx
// ✅ 팀장: 참여요청(가입 신청) 목록
// - 페이지 내 헤더 없음(MainLayout에서 처리)

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { listPendingJoinRequestsForClub } from "../../services/joinRequestService";

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

export default function TeamJoinRequestsPage() {
  const nav = useNavigate();
  const { clubId } = useParams();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!clubId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await listPendingJoinRequestsForClub({ clubId, limitCount: 80 });
        if (!alive) return;
        setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [clubId]);

  const hasAny = (items || []).length > 0;

  const openDetail = (r) => {
    const requestId = r?.requestId || r?.id || "";
    if (!clubId || !requestId) return;
    nav(`/team/${clubId}/join-requests/${requestId}`);
  };

  return (
    <PageWrap>
      {loading ? (
        <Center>
          <Spinner size="lg" />
        </Center>
      ) : !hasAny ? (
        <EmptyText>대기중인 참여요청이 없습니다.</EmptyText>
      ) : (
        <List>
          {items.map((r) => {
            const snap = r?.playerSnapshot || {};
            const name = String(snap.nickname || "").trim() || "선수";
            const region =
              String(snap.region || "").trim() ||
              `${String(snap.regionSido || "").trim()}${snap.regionSido && snap.regionGu ? " " : ""}${String(
                snap.regionGu || ""
              ).trim()}`.trim() ||
              "지역 미지정";

            const msg = String(r?.message || "").trim();

            return (
              <RowBtn key={r.requestId || r.id} type="button" onClick={() => openDetail(r)}>
                <Left>
                  <AvatarWrap>
                    {snap.avatarUrl ? (
                      <AvatarImg src={snap.avatarUrl} alt={name} />
                    ) : (
                      <AvatarPlaceholder size={36} />
                    )}
                  </AvatarWrap>
                  <TextCol>
                    <TitleLine>
                      <TitleText>{name}</TitleText>
                      <StatusPill>대기중</StatusPill>
                    </TitleLine>
                    <SubText>{region}</SubText>
                    <BodyText>{msg || "팀에 참가하고 싶어요"}</BodyText>
                  </TextCol>
                </Left>
                <Meta>{formatTimeAny(r.createdAt)}</Meta>
              </RowBtn>
            );
          })}
        </List>
      )}
    </PageWrap>
  );
}

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors?.bg || "#f3f4f6"};
  padding: 14px 16px 80px;
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

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RowBtn = styled.button`
  width: 100%;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 14px;
  padding: 12px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
`;

const Left = styled.div`
  display: flex;
  gap: 10px;
  min-width: 0;
`;

const AvatarWrap = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  overflow: hidden;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
  display: grid;
  place-items: center;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TextCol = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TitleLine = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const TitleText = styled.div`
  font-size: 14px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusPill = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.12);
  color: #4f46e5;
  font-size: 11px;
  flex-shrink: 0;
`;

const SubText = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const BodyText = styled.div`
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Meta = styled.div`
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
`;
