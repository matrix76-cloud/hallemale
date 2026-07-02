/* eslint-disable */
// src/pages/settings/NotificationsPage.jsx
// ✅ 전부 실데이터 (목업 없음)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";

import {
  subscribeNotificationsForUser,
  computeReadForUi,
  markNotificationRead,
} from "../../services/notificationService";
import { subscribePublishedNotices } from "../../services/noticesService";
import { resolveNotiRoute } from "../../utils/notiRoute";
import { isLeaderOnlyMatchNoti, getNotiCategory } from "../../utils/notificationDefinitions";
import EmptyState from "../../components/common/EmptyState";

// 관리자 공지(notices)는 서버 readBy가 없어 읽음 표시를 로컬에 보관
const NOTICE_READ_KEY = "noti_read_notices";
function loadNoticeRead() {
  try {
    return JSON.parse(localStorage.getItem(NOTICE_READ_KEY) || "{}");
  } catch {
    return {};
  }
}

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const EmptyText = styled.div`
  margin-top: 40px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const List = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ItemCard = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 8px;
  padding: 11px 13px;
  text-align: left;
  background: ${({ read, theme }) =>
    read
      ? theme.colors.card
      : theme.mode === "dark"
      ? "rgba(99, 102, 241, 0.12)"
      : "#eef2ff"};
  box-shadow: ${({ theme }) => theme.shadows.card};
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
  background: ${({ $color }) => $color || "#6b7280"};
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
  color: ${({ theme }) => theme.colors.textNormal};
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
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ImportantLabel = styled.span`
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : "#2563eb"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#2563eb")};
  font-size: 11px;
  font-weight: 600;
`;

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
  const { club, isTeamLeader } = useClub();

  const uid = userDoc?.uid || userDoc?.id || "";
  const myClubId = club?.clubId || club?.id || userDoc?.clubId || userDoc?.activeTeamId || "";

  const [loading, setLoading] = useState(false);
  const [realItems, setRealItems] = useState([]);

  // 관리자 공지(notices, published=true)
  const [notices, setNotices] = useState([]);
  const [noticeRead, setNoticeRead] = useState(loadNoticeRead);

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    // 실시간 구독 — 알림이 추가/삭제되면 즉시 반영
    const unsub = subscribeNotificationsForUser(
      { uid, clubId: myClubId || "", limitCount: 60 },
      (rows) => {
        setRealItems(rows || []);
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [uid, myClubId]);

  // 관리자가 올린 공지를 알림창에도 노출
  useEffect(() => {
    const unsub = subscribePublishedNotices(
      (rows) => setNotices(rows || []),
      { limitCount: 100 }
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const itemsWithRead = useMemo(() => {
    // 현재 팀장이 아니면 팀장 전용 매칭 알림(요청 등)은 숨김 → 강등 시 옛 팀장 알림 자동 리셋
    const visibleReal = isTeamLeader
      ? realItems
      : (realItems || []).filter((n) => !isLeaderOnlyMatchNoti(n));
    const real = computeReadForUi({ items: visibleReal, uid });

    const noticeItems = (notices || []).map((n) => ({
      id: n.id,
      kind: "notice",
      title: n.title,
      body: n.content,
      createdAt: n.createdAt,
      important: !!n.pinned,
      _from: "notice",
      read: !!noticeRead[n.id],
    }));

    return [...real, ...noticeItems].sort((a, b) => {
      const ta = toDateSafe(a.createdAt)?.getTime() || 0;
      const tb = toDateSafe(b.createdAt)?.getTime() || 0;
      return tb - ta;
    });
  }, [realItems, uid, notices, noticeRead, isTeamLeader]);

  const unreadList = itemsWithRead.filter((n) => !n.read);
  const readList = itemsWithRead.filter((n) => n.read);

  const handleClickItem = async (n) => {
    // 관리자 공지: 로컬 읽음 처리 후 상세로 이동
    if (n._from === "notice") {
      setNoticeRead((prev) => {
        const next = { ...prev, [n.id]: true };
        try {
          localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      navigate(`/notificationsdetail/${n.id}`);
      return;
    }

    // 읽음 처리
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

    // 매칭 수락 알림: 조율중 매칭룸으로 이동하며 "매칭 성사" 축하 애니메이션 표시
    const isMatchAccepted =
      String(n?.key || "").toUpperCase() === "MATCH_ACCEPTED" ||
      String(n?.subType || "").toLowerCase() === "matchaccepted";
    const acceptedMatchId = String(n?.matchId || n?.meta?.matchId || "").trim();
    if (isMatchAccepted && acceptedMatchId) {
      navigate(`/match-roomdetail/${acceptedMatchId}`, {
        state: { celebrateAccepted: true },
      });
      return;
    }

    // 알림에 맞는 화면으로 이동 (deepLink). 없으면 상세 페이지로 폴백.
    const route = resolveNotiRoute(n);
    navigate(route || `/notificationsdetail/${n.id}`);
  };

  const hasAny = itemsWithRead.length > 0;

  return (
    <PageWrap>
      {!hasAny && !loading && <EmptyState text="아직 받은 알림이 없습니다." />}
      {loading && !hasAny && <EmptyText>불러오는 중…</EmptyText>}

      {hasAny && (
        <>
          {unreadList.length > 0 && (
            <>
              <SectionTitle>새 알림</SectionTitle>
              <List>
                {unreadList.map((n) => {
                  const cat = getNotiCategory(n.kind);
                  return (
                  <ItemCard key={n.id} type="button" read={n.read} onClick={() => handleClickItem(n)}>
                    <ItemTopRow>
                      <KindBadge $color={cat.color}>{cat.label}</KindBadge>
                      <ItemTitle read={n.read}>{n.title}</ItemTitle>
                      {!n.read && <NewDot />}
                    </ItemTopRow>
                    <ItemBody>{n.body}</ItemBody>
                    <ItemMetaRow>
                      <span>{formatTimeAny(n.createdAt)}</span>
                      {n.important && <ImportantLabel>중요</ImportantLabel>}
                    </ItemMetaRow>
                  </ItemCard>
                  );
                })}
              </List>
            </>
          )}

          {readList.length > 0 && (
            <>
              <SectionTitle>지난 알림</SectionTitle>
              <List>
                {readList.map((n) => {
                  const cat = getNotiCategory(n.kind);
                  return (
                  <ItemCard key={n.id} type="button" read={n.read} onClick={() => handleClickItem(n)}>
                    <ItemTopRow>
                      <KindBadge $color={cat.color}>{cat.label}</KindBadge>
                      <ItemTitle read={n.read}>{n.title}</ItemTitle>
                    </ItemTopRow>
                    <ItemBody>{n.body}</ItemBody>
                    <ItemMetaRow>
                      <span>{formatTimeAny(n.createdAt)}</span>
                      {n.important && <ImportantLabel>중요</ImportantLabel>}
                    </ItemMetaRow>
                  </ItemCard>
                  );
                })}
              </List>
            </>
          )}
        </>
      )}
    </PageWrap>
  );
}
