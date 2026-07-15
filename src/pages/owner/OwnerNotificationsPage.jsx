/* eslint-disable */
// src/pages/owner/OwnerNotificationsPage.jsx
// 오너 알림함 — 예약요청 등 ownerUid로 온 알림 목록. 진입 시 자동 읽음 처리.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { LuBell, LuCalendarCheck } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import {
  subscribeNotificationsForUser,
  computeReadForUi,
  markNotificationsRead,
} from "../../services/notificationService";
import { Page, Card } from "./components/ownerUi";
import OwnerSpinner from "./components/OwnerSpinner";

function toDate(v) {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function timeAgo(d) {
  if (!d) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export default function OwnerNotificationsPage() {
  const navigate = useNavigate();
  const { uid, setActiveVenue } = useOwner();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    const unsub = subscribeNotificationsForUser({ uid }, (list) => {
      setItems(computeReadForUi({ items: list, uid }));
      setLoading(false);
    });
    return () => { try { unsub && unsub(); } catch (e) {} };
  }, [uid]);

  // 진입하면 안읽음 자동 읽음 처리
  useEffect(() => {
    if (!uid || !items.length) return;
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length) markNotificationsRead({ ids: unreadIds, uid }).catch(() => {});
    // eslint-disable-next-line
  }, [uid, items.length]);

  const openItem = (n) => {
    // 다구장: 이 알림이 가리키는 구장으로 활성 전환 → 알림→홈이 항상 해당 구장을 보여줌(데드엔드 방지)
    const vid = String(n?.meta?.venueId || (n?.linkType === "venue" ? n?.linkTargetId : "") || "");
    if (vid && setActiveVenue) setActiveVenue(vid);
    const link = n?.meta?.deepLink || (n?.linkType === "venue" ? "/owner/home" : "");
    if (link && link.startsWith("/owner")) navigate(link);
  };

  if (loading) return <OwnerSpinner label="불러오는 중…" />;

  if (!items.length) {
    return (
      <Page>
        <Empty>
          <LuBell size={40} />
          <div>아직 알림이 없어요.</div>
          <small>새 예약 요청이 오면 여기에 표시돼요.</small>
        </Empty>
      </Page>
    );
  }

  return (
    <Page>
      {items.map((n) => (
        <Item key={n.id} $unread={!n.read} onClick={() => openItem(n)}>
          <IconWrap><LuCalendarCheck size={18} /></IconWrap>
          <Body>
            <Title>{n.title || "알림"}</Title>
            {n.body && <Text>{n.body}</Text>}
            <Time>{timeAgo(toDate(n.createdAt))}</Time>
          </Body>
          {!n.read && <NewDot />}
        </Item>
      ))}
    </Page>
  );
}

const Item = styled(Card)`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  background: ${({ $unread, theme }) => ($unread ? (theme.mode === "dark" ? "rgba(124,92,201,0.12)" : "#f6f3ff") : theme.colors.card)};
  &:active { transform: translateY(1px); }
`;
const IconWrap = styled.div`
  width: 38px; height: 38px; flex-shrink: 0;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.22)" : "#efe9ff")};
  color: ${({ theme }) => theme.colors.primary};
`;
const Body = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;`;
const Title = styled.div`font-size: 14px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};`;
const Text = styled.div`font-size: 13px; line-height: 1.5; color: ${({ theme }) => theme.colors.textNormal};`;
const Time = styled.div`font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak}; margin-top: 2px;`;
const NewDot = styled.span`width: 8px; height: 8px; border-radius: 999px; background: #ef4444; flex-shrink: 0; margin-top: 6px;`;
const Empty = styled.div`
  padding: 80px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
  & > div { font-size: 15px; font-weight: 600; }
  & > small { font-size: 12.5px; }
  & > svg { color: ${({ theme }) => theme.colors.border}; }
`;
