/* eslint-disable */
// src/pages/settings/NotificationsPage.jsx
// ✅ system만 목업 / 나머지는 실데이터 (서비스에서 처리)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";

import {
  listNotificationsForUser,
  computeReadForUi,
  getSystemMockNotifications,
  markNotificationRead,
} from "../../services/notificationService";

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const EmptyText = styled.div`
  margin-top: 40px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: "GmarketSans";
`;

const List = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ItemCard = styled.button`
  width: 100%;
  border: none;
  border-radius: 16px;
  padding: 11px 13px;
  text-align: left;
  background: ${({ read }) => (read ? "#ffffff" : "#eef2ff")};
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
`;

const ItemTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const KindBadge = styled.span`
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;

  ${({ kind }) => {
    if (kind === "notice") return `background:#2563eb;`;
    if (kind === "event") return `background:#f97316;`;
    if (kind === "match") return `background:#22c55e;`;
    if (kind === "team") return `background:#7c3aed;`;
    return `background:#6b7280;`;
  }}
`;

const ItemTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: ${({ read }) => (read ? 500 : 700)};
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NewDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #ef4444;
  flex-shrink: 0;
`;

const ItemBody = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMetaRow = styled.div`
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const ImportantLabel = styled.span`
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid #f97316;
  color: #ea580c;
  font-size: 11px;
  font-weight: 600;
`;

function kindLabel(kind) {
  if (kind === "notice") return "공지";
  if (kind === "event") return "이벤트";
  if (kind === "match") return "매칭";
  if (kind === "team") return "팀";
  return "시스템";
}

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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const { club } = useClub();

  const uid = userDoc?.uid || userDoc?.id || "";
  const myClubId = club?.clubId || club?.id || userDoc?.clubId || userDoc?.activeTeamId || "";

  // ✅ system 목업용 local read
  const systemMocks = useMemo(() => getSystemMockNotifications(), []);
  const [localSystemRead, setLocalSystemRead] = useState(() =>
    systemMocks.reduce((acc, n) => {
      acc[n.id] = !!n.read;
      return acc;
    }, {})
  );

  const [loading, setLoading] = useState(false);
  const [realItems, setRealItems] = useState([]);

  useEffect(() => {
    if (!uid) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await listNotificationsForUser({
          uid,
          clubId: myClubId || "",
          limitCount: 60,
        });
        if (!alive) return;
        setRealItems(rows || []);
      } catch (e) {
        if (!alive) return;
        setRealItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid, myClubId]);

  const itemsWithRead = useMemo(() => {
    return computeReadForUi({
      items: realItems,
      uid,
      localSystemReadMap: localSystemRead,
    });
  }, [realItems, uid, localSystemRead]);

  const unreadList = itemsWithRead.filter((n) => !n.read);
  const readList = itemsWithRead.filter((n) => n.read);

  const handleClickItem = async (n) => {
    // 읽음 처리
    if (n._from === "mock") {
      setLocalSystemRead((prev) => ({ ...prev, [n.id]: true }));
    } else {
      try {
        await markNotificationRead({ notificationId: n.id, uid });
        setRealItems((prev) =>
          prev.map((x) =>
            x.id === n.id
              ? { ...x, readBy: { ...(x.readBy || {}), [uid]: new Date().toISOString() } }
              : x
          )
        );
      } catch (e) {}
    }

    navigate(`/notificationsdetail/${n.id}`);
  };

  const hasAny = itemsWithRead.length > 0;

  return (
    <PageWrap>
      {!hasAny && !loading && <EmptyText>아직 받은 알림이 없습니다.</EmptyText>}
      {loading && !hasAny && <EmptyText>불러오는 중…</EmptyText>}

      {hasAny && (
        <>
          {unreadList.length > 0 && (
            <>
              <SectionTitle>새 알림</SectionTitle>
              <List>
                {unreadList.map((n) => (
                  <ItemCard key={n.id} type="button" read={n.read} onClick={() => handleClickItem(n)}>
                    <ItemTopRow>
                      <KindBadge kind={n.kind}>{kindLabel(n.kind)}</KindBadge>
                      <ItemTitle read={n.read}>{n.title}</ItemTitle>
                      {!n.read && <NewDot />}
                    </ItemTopRow>
                    <ItemBody>{n.body}</ItemBody>
                    <ItemMetaRow>
                      <span>{formatTimeAny(n.createdAt)}</span>
                      {n.important && <ImportantLabel>중요</ImportantLabel>}
                    </ItemMetaRow>
                  </ItemCard>
                ))}
              </List>
            </>
          )}

          {readList.length > 0 && (
            <>
              <SectionTitle>지난 알림</SectionTitle>
              <List>
                {readList.map((n) => (
                  <ItemCard key={n.id} type="button" read={n.read} onClick={() => handleClickItem(n)}>
                    <ItemTopRow>
                      <KindBadge kind={n.kind}>{kindLabel(n.kind)}</KindBadge>
                      <ItemTitle read={n.read}>{n.title}</ItemTitle>
                    </ItemTopRow>
                    <ItemBody>{n.body}</ItemBody>
                    <ItemMetaRow>
                      <span>{formatTimeAny(n.createdAt)}</span>
                      {n.important && <ImportantLabel>중요</ImportantLabel>}
                    </ItemMetaRow>
                  </ItemCard>
                ))}
              </List>
            </>
          )}
        </>
      )}
    </PageWrap>
  );
}
