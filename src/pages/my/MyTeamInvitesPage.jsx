/* eslint-disable */
// src/pages/my/MyTeamInvitesPage.jsx
// ✅ 받은 초대 리스트
// - 페이지 내 헤더 없음(MainLayout에서 처리)
// - SSOT: invites(collectionGroup) where toUid == uid
// - pending 우선 표시, 나머지는 지난 초대

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { useAuth } from "../../hooks/useAuth";
import { db } from "../../services/firebase";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { listMyReceivedInvites } from "../../services/inviteService";

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

export default function MyTeamInvitesPage() {
  const nav = useNavigate();
  const { userDoc } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [clubMap, setClubMap] = useState({}); // clubId -> { name, region, logoUrl }

  useEffect(() => {
    if (!uid) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await listMyReceivedInvites({ uid, limitCount: 80 });
        if (!alive) return;

        setItems(Array.isArray(rows) ? rows : []);

        const clubIds = Array.from(
          new Set((rows || []).map((x) => String(x?.clubId || "").trim()).filter(Boolean))
        );

        const nextMap = {};
        await Promise.all(
          clubIds.map(async (cid) => {
            try {
              const snap = await getDoc(doc(db, "clubs", cid));
              if (!snap.exists()) return;
              const c = snap.data() || {};
              nextMap[cid] = {
                name: c.name || "",
                region: c.region || "",
                logoUrl: c.logoUrl || "",
              };
            } catch (e) {}
          })
        );

        if (!alive) return;
        setClubMap(nextMap);
      } catch (e) {
        if (!alive) return;
        setItems([]);
        setClubMap({});
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid]);

  const pendingList = useMemo(
    () => (items || []).filter((x) => String(x?.status || "") === "pending"),
    [items]
  );
  const pastList = useMemo(
    () => (items || []).filter((x) => String(x?.status || "") !== "pending"),
    [items]
  );

  const openDetail = (inv) => {
    const clubId = String(inv?.clubId || "").trim();
    const inviteId = inv?.id || "";
    if (!clubId || !inviteId) return;
    nav(`/my/team-invites/${clubId}/${inviteId}`);
  };

  const hasAny = (items || []).length > 0;

  return (
    <PageWrap>
      {loading ? (
        <Center>
          <Spinner size="lg" />
        </Center>
      ) : !hasAny ? (
        <EmptyText>받은 초대가 없습니다.</EmptyText>
      ) : (
        <>
          {pendingList.length > 0 ? (
            <>
              <SectionTitle>대기중 초대</SectionTitle>
              <List>
                {pendingList.map((inv) => {
                  const clubId = String(inv?.clubId || "").trim();
                  const club = clubMap[clubId] || {};
                  const msg = String(inv?.message || "").trim();
                  const fromUid = String(inv?.fromUid || "").trim();

                  return (
                    <RowBtn key={inv.id} type="button" onClick={() => openDetail(inv)}>
                      <Left>
                        <LogoWrap>
                          {club.logoUrl ? <LogoImg src={club.logoUrl} alt="logo" /> : <AvatarPlaceholder size={36} />}
                        </LogoWrap>
                        <TextCol>
                          <TitleLine>
                            <TitleText>{club.name || "팀 초대"}</TitleText>
                            <StatusPill>대기중</StatusPill>
                          </TitleLine>
                          <SubText>{club.region || "지역 미지정"}</SubText>
                          <BodyText>{msg || `팀에서 초대가 도착했어요. (from: ${fromUid.slice(0, 6)}…)`}</BodyText>
                        </TextCol>
                      </Left>
                      <Meta>{formatTimeAny(inv.createdAt)}</Meta>
                    </RowBtn>
                  );
                })}
              </List>
            </>
          ) : null}

          {pastList.length > 0 ? (
            <>
              <SectionTitle>지난 초대</SectionTitle>
              <List>
                {pastList.map((inv) => {
                  const clubId = String(inv?.clubId || "").trim();
                  const club = clubMap[clubId] || {};
                  const msg = String(inv?.message || "").trim();
                  const status = String(inv?.status || "").trim();

                  return (
                    <RowBtn key={inv.id} type="button" onClick={() => openDetail(inv)}>
                      <Left>
                        <LogoWrap>
                          {club.logoUrl ? <LogoImg src={club.logoUrl} alt="logo" /> : <AvatarPlaceholder size={36} />}
                        </LogoWrap>
                        <TextCol>
                          <TitleLine>
                            <TitleText>{club.name || "팀 초대"}</TitleText>
                            <PastPill>{status === "accepted" ? "수락함" : status === "rejected" ? "거절함" : status}</PastPill>
                          </TitleLine>
                          <SubText>{club.region || "지역 미지정"}</SubText>
                          <BodyText>{msg || "초대 메시지"}</BodyText>
                        </TextCol>
                      </Left>
                      <Meta>{formatTimeAny(inv.createdAt)}</Meta>
                    </RowBtn>
                  );
                })}
              </List>
            </>
          ) : null}
        </>
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

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  font-family: "GmarketSans";
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

const LogoWrap = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  overflow: hidden;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
  display: grid;
  place-items: center;
`;

const LogoImg = styled.img`
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

const PastPill = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
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
