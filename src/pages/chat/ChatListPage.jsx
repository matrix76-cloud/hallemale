/* eslint-disable */
// src/pages/chat/ChatListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { listMyChatRooms } from "../../services/chatService";
import { getUserPublicMeta, getOtherUidFromRoom } from "../../services/counterpartService";
import Spinner from "../../components/common/Spinner";

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 8px 16px 24px;
  display: flex;
  flex-direction: column;
`;

const EmptyText = styled.div`
  margin-top: 40px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const ErrorText = styled.div`
  margin-top: 16px;
  font-size: 13px;
  color: #b91c1c;
  line-height: 1.5;
  white-space: pre-line;
`;

const List = styled.div`
  margin-top: 4px;
  display: flex;
  flex-direction: column;
`;

const RoomRow = styled.button`
  width: 100%;
  border: none;
  border-bottom: 1px solid #e5e7eb;
  background: transparent;
  padding: 12px 0;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;

  &:last-of-type {
    border-bottom: none;
  }

  &:active {
    transform: translateY(1px);
  }
`;

const AvatarWrap = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
  flex-shrink: 0;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const RoomText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const TopRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const NameLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PlayerName = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamPill = styled.div`
  padding: 2px 8px 2px 4px;
  border-radius: 999px;
  background: #eef2ff;
  color: #1d4ed8;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
`;

const TeamLogoMini = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 999px;
  object-fit: cover;
  background: #e5e7eb;
  flex-shrink: 0;
`;

const TeamPillText = styled.span`
  max-width: 110px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RightMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  padding-top: 1px;
`;

const DateText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const TimeText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const LastMessage = styled.div`
  font-size: 13px;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const toDate = (tsOrIso) => {
  if (!tsOrIso) return null;
  if (typeof tsOrIso === "string") {
    const d = new Date(tsOrIso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (tsOrIso?.toDate && typeof tsOrIso.toDate === "function") return tsOrIso.toDate();
  const d = new Date(tsOrIso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateShort = (tsOrIso) => {
  const d = toDate(tsOrIso);
  if (!d) return "";
  const now = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  const isSameYear = y === now.getFullYear();
  if (!isSameYear) {
    return `${String(y).slice(-2)}.${String(m).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
};

const formatTime = (tsOrIso) => {
  const d = toDate(tsOrIso);
  if (!d) return "";
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${hour}:${min}`;
};

export default function ChatListPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [roomsRaw, setRoomsRaw] = useState([]);
  const [metaByUid, setMetaByUid] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoadErr("");

      if (!myUid) {
        setRoomsRaw([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const list = await listMyChatRooms({ myUid });
        if (!alive) return;
        setRoomsRaw(list || []);
      } catch (err) {
        console.error("[ChatListPage] listMyChatRooms failed", {
          code: err?.code,
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
        });

        if (!alive) return;

        setRoomsRaw([]);

        const hint =
          err?.code === "failed-precondition"
            ? "Firestore 인덱스가 필요합니다. 콘솔의 에러 링크로 들어가서 인덱스 생성하세요."
            : err?.code === "permission-denied"
            ? "권한(보안 규칙) 문제입니다. chatRooms 읽기 권한 확인이 필요합니다."
            : "";

        setLoadErr([String(err?.message || "채팅 목록을 불러올 수 없습니다."), hint].filter(Boolean).join("\n"));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [myUid]);

  const otherUidsUniq = useMemo(() => {
    const otherUids = (roomsRaw || [])
      .map((r) => getOtherUidFromRoom({ myUid, room: r }))
      .filter(Boolean);
    return Array.from(new Set(otherUids));
  }, [roomsRaw, myUid]);

  useEffect(() => {
    let alive = true;

    async function loadMetas() {
      if (!myUid) {
        setMetaByUid({});
        setMetaLoading(false);
        return;
      }

      if (!otherUidsUniq.length) {
        setMetaByUid({});
        setMetaLoading(false);
        return;
      }

      setMetaLoading(true);
      try {
        const next = {};
        for (const uid of otherUidsUniq) {
          next[uid] = await getUserPublicMeta(uid);
        }
        if (!alive) return;
        setMetaByUid(next);
      } catch (err) {
        console.error("[ChatListPage] getUserPublicMeta failed", {
          code: err?.code,
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
        });
        if (!alive) return;
        setMetaByUid({});
      } finally {
        if (!alive) return;
        setMetaLoading(false);
      }
    }

    loadMetas();

    return () => {
      alive = false;
    };
  }, [otherUidsUniq, myUid]);

  const rooms = useMemo(() => {
    return (roomsRaw || [])
      .filter((r) => (r?.type || "dm") === "dm")
      .map((r) => {
        const otherUid = getOtherUidFromRoom({ myUid, room: r });
        const meta = metaByUid[otherUid] || { name: "상대", avatar: "", teamName: "", teamLogo: "" };

        const stamp = r.lastMessageAt || r.createdAt || null;

        return {
          ...r,
          id: r.id,
          otherUid,
          counterpartName: meta.name,
          avatar: meta.avatar,
          teamName: meta.teamName || "",
          teamLogo: meta.teamLogo || "",
          stamp,
        };
      })
      .sort((a, b) => {
        const ad = toDate(a.stamp) || new Date(0);
        const bd = toDate(b.stamp) || new Date(0);
        return bd.getTime() - ad.getTime();
      });
  }, [roomsRaw, metaByUid, myUid]);

  const handleClickRoom = (chatId) => {
    navigate(`/chats/${chatId}`);
  };

  const metaReady = useMemo(() => {
    if (!otherUidsUniq.length) return true;
    if (metaLoading) return false;
    for (const uid of otherUidsUniq) {
      if (!metaByUid?.[uid]) return false;
    }
    return true;
  }, [otherUidsUniq, metaByUid, metaLoading]);

  if (loading || !metaReady) {
    return (
      <PageWrap>
        <Spinner />
      </PageWrap>
    );
  }

  if (loadErr) {
    return (
      <PageWrap>
        <EmptyText>채팅 목록을 불러오지 못했어요.</EmptyText>
        <ErrorText>{loadErr}</ErrorText>
      </PageWrap>
    );
  }

  if (!rooms.length) {
    return (
      <PageWrap>
        <EmptyText>아직 시작된 채팅이 없습니다.</EmptyText>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <List>
        {rooms.map((room) => (
          <RoomRow key={room.id} type="button" onClick={() => handleClickRoom(room.id)}>
            <AvatarWrap>
              <AvatarImg src={room.avatar} alt={room.counterpartName || "상대"} />
            </AvatarWrap>

            <RoomText>
              <TopRow>
                <NameLeft>
                  <PlayerName>{room.counterpartName}</PlayerName>

                  {!!room.teamName && (
                    <TeamPill>
                      {!!room.teamLogo && <TeamLogoMini src={room.teamLogo} alt={room.teamName} />}
                      <TeamPillText>{room.teamName}</TeamPillText>
                    </TeamPill>
                  )}
                </NameLeft>

                <RightMeta>
                  <DateText>{formatDateShort(room.stamp)}</DateText>
                  <TimeText>{formatTime(room.stamp)}</TimeText>
                </RightMeta>
              </TopRow>

              <LastMessage>{room.lastMessageText || "채팅을 시작해보세요."}</LastMessage>
            </RoomText>
          </RoomRow>
        ))}
      </List>
    </PageWrap>
  );
}
