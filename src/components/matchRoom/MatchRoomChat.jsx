/* eslint-disable */
// src/components/matchRoom/MatchRoomChat.jsx
// 매칭룸 임베드용 채팅 컴포넌트 (기획안 HTML 스타일 1:1)
// - chatService(DM) 그대로 재활용. props로 chatId/상대정보 받아 자체 구독·전송.
// - 색은 앱 색상 모드(theme.mode)에 맞춰 라이트/다크 자동 전환 (mrp).
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import {
  enterChat,
  listenChatMessages,
  sendTextMessage,
  sendImagesMessage,
} from "../../services/chatService";
import { mrp } from "./matchRoomPalette";

const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => mrp(theme.mode).bg2};
`;

const ChatScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 12px;

  &::-webkit-scrollbar {
    width: 0;
  }
`;

const SysMsg = styled.div`
  align-self: center;
  font-size: 9.5px;
  text-align: center;
  color: ${({ theme }) => mrp(theme.mode).t3};
  background: ${({ theme }) => mrp(theme.mode).surface};
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).line};
  padding: 4px 11px;
  border-radius: 30px;
`;

const DateDivider = styled(SysMsg)``;

const Bubble = styled.div`
  max-width: 78%;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-self: ${({ $me }) => ($me ? "flex-end" : "flex-start")};
  align-items: ${({ $me }) => ($me ? "flex-end" : "flex-start")};
`;

const Who = styled.div`
  font-size: 9px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  padding: 0 4px;
`;

const Msg = styled.div`
  font-size: 11.5px;
  line-height: 1.45;
  padding: 8px 11px;
  border-radius: 14px;
  white-space: pre-line;
  word-break: break-word;
  ${({ theme, $me }) => {
    const c = mrp(theme.mode);
    return $me
      ? `
        background: ${c.bubbleMeBg};
        border-top-right-radius: 3px;
        color: #fff;
      `
      : `
        background: ${c.surface};
        border: 0.5px solid ${c.line};
        border-top-left-radius: 3px;
        color: ${c.t1};
      `;
  }}
`;

const Tm = styled.div`
  font-size: 8.5px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  padding: 0 4px;
`;

const ImgGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, minmax(0, 1fr));
  gap: 5px;
  margin-top: 4px;
`;

const Img = styled.img`
  width: 100%;
  border-radius: 10px;
  object-fit: cover;
  background: ${({ theme }) => mrp(theme.mode).surface2};
`;

const InputBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 0.5px solid ${({ theme }) => mrp(theme.mode).line};
  background: ${({ theme }) => mrp(theme.mode).bg2};
`;

const Plus = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: ${({ theme }) => mrp(theme.mode).surface2};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: ${({ theme }) => mrp(theme.mode).puL};
  flex-shrink: 0;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Field = styled.input`
  flex: 1;
  min-width: 0;
  background: ${({ theme }) => mrp(theme.mode).surface};
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).line};
  border-radius: 30px;
  padding: 8px 14px;
  font-size: 11.5px;
  color: ${({ theme }) => mrp(theme.mode).t1};
  outline: none;

  &::placeholder {
    color: ${({ theme }) => mrp(theme.mode).t3};
  }
`;

const Send = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: ${({ theme, disabled }) =>
    disabled ? mrp(theme.mode).surface2 : mrp(theme.mode).pu};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: ${({ theme, disabled }) => (disabled ? mrp(theme.mode).t3 : "#fff")};
  flex-shrink: 0;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
`;

const HiddenFile = styled.input`
  display: none;
`;

const toDate = (v) => {
  const d =
    typeof v === "string"
      ? new Date(v)
      : v?.toDate
      ? v.toDate()
      : new Date(v);
  return Number.isNaN(d?.getTime?.()) ? null : d;
};
const fmtDate = (v) => {
  const d = toDate(v);
  return d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : "";
};
const fmtTime = (v) => {
  const d = toDate(v);
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

/**
 * @param {string} chatId         DM 채팅방 id (uidA__uidB) — 부모가 getOrCreateDmRoom으로 확보해 전달
 * @param {string} myUid          내 uid
 * @param {string} opponentName   상대 표시명 (상대 팀명 등)
 * @param {string} [systemNotice] 상단 시스템 메시지 (예: "패스트브레이가 매칭을 수락했어요")
 */
export default function MatchRoomChat({
  chatId,
  myUid,
  opponentName = "상대팀",
  systemNotice = "",
  pinnedCard = null,
  aboveInput = null,
}) {
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

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
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const rows = useMemo(() => {
    const arr = [];
    let lastDate = "";
    (messages || []).forEach((m) => {
      const d = fmtDate(m.createdAt);
      if (d && d !== lastDate) {
        arr.push({ type: "date", id: `date-${d}-${m.id}`, label: d });
        lastDate = d;
      }
      arr.push({ type: "msg", ...m });
    });
    return arr;
  }, [messages]);

  const handleSendText = async () => {
    if (!chatId || !myUid) return;
    const v = String(text || "").trim();
    if (!v) return;
    try {
      setSending(true);
      await sendTextMessage({ chatId, fromUid: myUid, text: v });
      setText("");
    } catch (e) {
      alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  const handlePickImages = () => {
    if (sending || !myUid || !fileRef.current) return;
    fileRef.current.value = "";
    fileRef.current.click();
  };

  const handleFilesSelected = async (e) => {
    if (!chatId || !myUid) return;
    const files = Array.from(e.target.files || []).filter((f) =>
      (f?.type || "").startsWith("image/")
    );
    const picked = files.slice(0, 4);
    if (!picked.length) return;
    try {
      setSending(true);
      await sendImagesMessage({
        chatId,
        fromUid: myUid,
        text: String(text || "").trim(),
        files: picked,
      });
      setText("");
    } catch (e2) {
      alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  const disabled = !chatId;

  return (
    <Wrap>
      <ChatScroll ref={scrollRef}>
        {!!systemNotice && <SysMsg>{systemNotice}</SysMsg>}
        {pinnedCard}
        {rows.length === 0 && <SysMsg>대화를 시작해 보세요.</SysMsg>}

        {rows.map((row) => {
          if (row.type === "date") {
            return <DateDivider key={row.id}>{row.label}</DateDivider>;
          }
          const me = row.fromUid && row.fromUid === myUid;
          const imgs = Array.isArray(row.images) ? row.images.slice(0, 4) : [];
          return (
            <Bubble key={row.id} $me={me}>
              {!me && <Who>{opponentName}</Who>}
              <Msg $me={me}>
                {!!row.text && <div>{row.text}</div>}
                {imgs.length > 0 && (
                  <ImgGrid $cols={imgs.length === 1 ? 1 : 2}>
                    {imgs.map((img, i) => (
                      <Img key={`${row.id}-img-${i}`} src={img.url} alt="img" />
                    ))}
                  </ImgGrid>
                )}
              </Msg>
              <Tm>{fmtTime(row.createdAt)}</Tm>
            </Bubble>
          );
        })}
      </ChatScroll>

      {aboveInput}

      <InputBar>
        <HiddenFile
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
        />
        <Plus type="button" onClick={handlePickImages} disabled={sending || disabled}>
          ＋
        </Plus>
        <Field
          placeholder={disabled ? "채팅을 준비하는 중…" : "메시지 입력…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending || disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendText();
            }
          }}
        />
        <Send
          type="button"
          onClick={handleSendText}
          disabled={sending || disabled || !String(text || "").trim()}
        >
          ➤
        </Send>
      </InputBar>
    </Wrap>
  );
}
