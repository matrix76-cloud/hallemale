/* eslint-disable */
// src/pages/chat/ChatRoomPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useParams } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import {
  enterChat,
  listenChatMessages,
  getChatRoom,
  sendTextMessage,
  sendImagesMessage,
} from "../../services/chatService";
import { getUserPublicMeta, getOtherUidFromRoom } from "../../services/counterpartService";

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
`;

const MessagesWrap = styled.div`
  flex: 1;
  padding: 12px 12px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DateDivider = styled.div`
  margin: 10px auto;
  padding: 6px 14px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 12px;
`;

const OpponentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  justify-content: flex-start;
  margin-top: 4px;
`;

const OpponentAvatarCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const AvatarMini = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  background: #e5e7eb;
`;

const OpponentName = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textStrong};
  max-width: 60px;
  text-align: center;
  word-break: keep-all;
`;

const OpponentBubbleCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
`;

const OpponentBubble = styled.div`
  max-width: 72%;
  padding: 8px 12px;
  border-radius: 18px;
  border-bottom-left-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-line;
  background: #f3f4f6;
  color: #111827;
`;

const OpponentTime = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const MyRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
`;

const MyBubbleCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  max-width: 80%;
`;

const MyBubble = styled.div`
  padding: 8px 12px;
  border-radius: 18px;
  border-bottom-right-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-line;
  background: #e7efff;
  color: #111827;
`;

const MyMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MyLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MyTime = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
`;

const ImgItem = styled.img`
  width: 180px;
  max-width: 52vw;
  height: auto;
  border-radius: 12px;
  object-fit: cover;
  background: #e5e7eb;
`;

const ImgItemSmall = styled.img`
  width: 140px;
  max-width: 46vw;
  height: auto;
  border-radius: 12px;
  object-fit: cover;
  background: #e5e7eb;
`;

const InputBar = styled.div`
  padding: 8px 12px 12px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PlusButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: #e5e7eb;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  cursor: pointer;
`;

const Input = styled.input`
  flex: 1;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  background: #ffffff;

  &::placeholder {
    color: ${({ theme }) => theme.colors.muted || "#b0b0b0"};
  }
`;

const SendButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  background: ${({ theme, disabled }) =>
    disabled ? "#d1d5db" : theme.colors.primary || "#2563eb"};
  color: #ffffff;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
`;

const HiddenFile = styled.input`
  display: none;
`;

const formatDate = (isoOrTs) => {
  const d =
    typeof isoOrTs === "string"
      ? new Date(isoOrTs)
      : isoOrTs?.toDate
      ? isoOrTs.toDate()
      : new Date(isoOrTs);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  return `${month}월 ${date}일`;
};

const formatTime = (isoOrTs) => {
  const d =
    typeof isoOrTs === "string"
      ? new Date(isoOrTs)
      : isoOrTs?.toDate
      ? isoOrTs.toDate()
      : new Date(isoOrTs);
  if (Number.isNaN(d.getTime())) return "";
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${hour}:${min}`;
};

export default function ChatRoomPage() {
  const { chatId } = useParams();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(true);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [otherUid, setOtherUid] = useState("");
  const [opponentMeta, setOpponentMeta] = useState({ name: "상대", avatar: "" });

  useEffect(() => {
    let alive = true;

    async function loadRoom() {
      if (!chatId) return;
      try {
        setLoadingRoom(true);
        const r = await getChatRoom({ chatId });
        if (!alive) return;
        setRoom(r || null);

        const ou = getOtherUidFromRoom({ myUid, room: r });
        setOtherUid(String(ou || ""));
      } catch (e) {
        if (!alive) return;
        setRoom(null);
        setOtherUid("");
      } finally {
        if (!alive) return;
        setLoadingRoom(false);
      }
    }

    loadRoom();
    return () => {
      alive = false;
    };
  }, [chatId, myUid]);

  useEffect(() => {
    if (!otherUid) return;
    let alive = true;

    (async () => {
      const meta = await getUserPublicMeta(otherUid);
      if (!alive) return;
      setOpponentMeta(meta);
    })();

    return () => {
      alive = false;
    };
  }, [otherUid]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = listenChatMessages({
      chatId,
      onChange: (list) => setMessages(list || []),
      limitCount: 200,
    });
    return () => {
      try {
        unsub && unsub();
      } catch (e) {}
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !myUid) return;
    enterChat({ chatId, myUid }).catch(() => {});
  }, [chatId, myUid]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const rows = useMemo(() => {
    const arr = [];
    let lastDate = "";
    (messages || []).forEach((m) => {
      const d = formatDate(m.createdAt);
      if (d && d !== lastDate) {
        arr.push({ type: "date", id: `date-${d}-${m.id}`, label: d });
        lastDate = d;
      }
      arr.push({ type: "msg", ...m });
    });
    return arr;
  }, [messages]);

  const handleSendText = async () => {
    if (!chatId) return;

    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }

    const v = String(text || "").trim();
    if (!v) return;

    try {
      setSending(true);
      await sendTextMessage({ chatId, fromUid: myUid, text: v });
      setText("");
    } catch (e) {
      console.warn("[ChatRoom] sendText failed:", e?.message || e);
      alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  const handlePickImages = () => {
    if (sending) return;

    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!fileRef.current) return;
    fileRef.current.value = "";
    fileRef.current.click();
  };

  const handleFilesSelected = async (e) => {
    if (!chatId) return;

    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }

    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const onlyImages = files.filter((f) => (f?.type || "").startsWith("image/"));
    const picked = onlyImages.slice(0, 4);
    if (!picked.length) return;

    try {
      setSending(true);
      const v = String(text || "").trim();
      await sendImagesMessage({ chatId, fromUid: myUid, text: v, files: picked });
      setText("");
    } catch (e2) {
      console.warn("[ChatRoom] sendImages failed:", e2?.message || e2);
      alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  if (loadingRoom) {
    return (
      <PageWrap>
        <MessagesWrap ref={scrollRef}>
          <DateDivider>불러오는 중…</DateDivider>
        </MessagesWrap>
        <InputBar>
          <PlusButton type="button" disabled>
            +
          </PlusButton>
          <Input placeholder="메시지 입력" disabled />
          <SendButton type="button" disabled>
            전송
          </SendButton>
        </InputBar>
      </PageWrap>
    );
  }

  if (!room) {
    return (
      <PageWrap>
        <MessagesWrap ref={scrollRef}>
          <DateDivider>채팅방을 찾을 수 없습니다.</DateDivider>
        </MessagesWrap>
        <InputBar>
          <PlusButton type="button" disabled>
            +
          </PlusButton>
          <Input placeholder="메시지 입력" disabled />
          <SendButton type="button" disabled>
            전송
          </SendButton>
        </InputBar>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <MessagesWrap ref={scrollRef}>
        {rows.length === 0 && <DateDivider>대화를 시작해 보세요.</DateDivider>}

        {rows.map((row) =>
          row.type === "date" ? (
            <DateDivider key={row.id}>{row.label}</DateDivider>
          ) : row.fromUid && row.fromUid !== myUid ? (
            <OpponentRow key={row.id}>
              <OpponentAvatarCol>
                <AvatarMini src={opponentMeta.avatar} alt={opponentMeta.name} />
                <OpponentName>{opponentMeta.name}</OpponentName>
              </OpponentAvatarCol>

              <OpponentBubbleCol>
                <OpponentBubble>
                  {!!row.text && <div>{row.text}</div>}
                  {Array.isArray(row.images) && row.images.length > 0 && (
                    <ImageGrid>
                      {row.images.slice(0, 4).map((img, idx) =>
                        row.images.length === 1 ? (
                          <ImgItem key={`${row.id}-img-${idx}`} src={img.url} alt="img" />
                        ) : (
                          <ImgItemSmall key={`${row.id}-img-${idx}`} src={img.url} alt="img" />
                        )
                      )}
                    </ImageGrid>
                  )}
                </OpponentBubble>
                <OpponentTime>{formatTime(row.createdAt)}</OpponentTime>
              </OpponentBubbleCol>
            </OpponentRow>
          ) : (
            <MyRow key={row.id}>
              <MyBubbleCol>
                <MyBubble>
                  {!!row.text && <div>{row.text}</div>}
                  {Array.isArray(row.images) && row.images.length > 0 && (
                    <ImageGrid>
                      {row.images.slice(0, 4).map((img, idx) =>
                        row.images.length === 1 ? (
                          <ImgItem key={`${row.id}-img-${idx}`} src={img.url} alt="img" />
                        ) : (
                          <ImgItemSmall key={`${row.id}-img-${idx}`} src={img.url} alt="img" />
                        )
                      )}
                    </ImageGrid>
                  )}
                </MyBubble>
                <MyMetaRow>
                  <MyTime>{formatTime(row.createdAt)}</MyTime>
                  <MyLabel>나</MyLabel>
                </MyMetaRow>
              </MyBubbleCol>
            </MyRow>
          )
        )}
      </MessagesWrap>

      <InputBar>
        <HiddenFile ref={fileRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} />
        <PlusButton type="button" onClick={handlePickImages} disabled={sending}>
          +
        </PlusButton>
        <Input
          placeholder="메시지 입력"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendText();
            }
          }}
        />
        <SendButton type="button" onClick={handleSendText} disabled={sending || !String(text || "").trim()}>
          전송
        </SendButton>
      </InputBar>
    </PageWrap>
  );
}
