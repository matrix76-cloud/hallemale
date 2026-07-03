/* eslint-disable */
// src/components/matchRoom/MatchRoomChat.jsx
// 매칭룸 임베드용 채팅 컴포넌트 (기획안 HTML 스타일 1:1)
// - chatService(DM) 그대로 재활용. props로 chatId/상대정보 받아 자체 구독·전송.
// - 색은 앱 색상 모드(theme.mode)에 맞춰 라이트/다크 자동 전환 (mrp).
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import {
  enterChat,
  listenChatRoom,
  listenChatMessages,
  sendTextMessage,
  sendImagesMessage,
} from "../../services/chatService";
import { mrp } from "./matchRoomPalette";
import AvatarPlaceholder from "../common/AvatarPlaceholder";

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
  font-size: 12px;
  text-align: center;
  color: ${({ theme }) => mrp(theme.mode).t3};
  background: ${({ theme }) => mrp(theme.mode).surface};
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).line};
  padding: 4px 11px;
  border-radius: 30px;
`;

/* 매칭 성사 시 안내 문구 위에 크게 보이는 이모지 (예: 🤝) */
const NoticeIcon = styled.div`
  align-self: center;
  font-size: 54px;
  line-height: 1;
  margin: 6px 0 2px;
  text-align: center;
`;

const DateDivider = styled(SysMsg)``;

/* 한 줄(아바타 + 말풍선) */
const Line = styled.div`
  max-width: 88%;
  display: flex;
  align-items: flex-end;
  gap: 7px;
  align-self: ${({ $me }) => ($me ? "flex-end" : "flex-start")};
`;

/* 상대 팀장 프로필 사진 (없으면 이니셜) */
const Avatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: flex-start;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => mrp(theme.mode).surface2};
  color: ${({ theme }) => mrp(theme.mode).puL};
  font-size: 13px;
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Bubble = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: ${({ $me }) => ($me ? "flex-end" : "flex-start")};
`;

/* 말풍선 + 시각(또는 읽음/시각)을 한 줄에: 말풍선 안쪽 하단 모서리에 시각 */
const BubbleInner = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;
  min-width: 0;
`;

/* 내 메시지: 읽음 + 시각을 말풍선 왼쪽에 세로로 */
const MetaCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
`;

const Read = styled.div`
  font-size: 10.5px;
  font-weight: 600;
  color: ${({ theme, $read }) =>
    $read ? mrp(theme.mode).puL : mrp(theme.mode).t3};
  padding: 0 2px;
`;

/* 상대: 팀명 · 팀장명 */
const Who = styled.div`
  font-size: 11.5px;
  font-weight: 600;
  color: ${({ theme }) => mrp(theme.mode).t2};
  padding: 0 4px;
`;

const Msg = styled.div`
  font-size: 13.5px;
  line-height: 1.5;
  padding: 9px 13px;
  border-radius: 15px;
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
  font-size: 10.5px;
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
  flex-shrink: 0;
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
  padding: 10px 15px;
  font-size: 14.5px;
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
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDate = (v) => {
  const d = toDate(v);
  return d
    ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`
    : "";
};
const toMs = (v) => {
  const d = toDate(v);
  return d ? d.getTime() : 0;
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
  opponentLeaderName = "",
  opponentAvatarUrl = "",
  otherUid = "",
  systemNotice = "",
  noticeIcon = "",
  pinnedCard = null,
  aboveInput = null,
}) {
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState(null);
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

  // 방 메타 구독 — 상대 lastReadAtBy 로 "읽음" 표시 계산
  useEffect(() => {
    if (!chatId) return;
    const unsub = listenChatRoom({ chatId, onChange: (r) => setRoom(r) });
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

  // 상대가 보낸 새 메시지가 도착하면 내 읽음시각 갱신 → 상대 화면에 "읽음" 반영
  useEffect(() => {
    if (!chatId || !myUid || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last?.fromUid && last.fromUid !== myUid && last.fromUid !== "system") {
      enterChat({ chatId, myUid }).catch(() => {});
    }
  }, [chatId, myUid, messages]);

  // 상대가 마지막으로 읽은 시각(ms) — 내 메시지가 이 시각 이하이면 "읽음"
  const oppReadMs = useMemo(() => {
    const by = room?.lastReadAtBy || {};
    const v = otherUid ? by[otherUid] : null;
    return toMs(v);
  }, [room, otherUid]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 메시지 변동/방 진입 시 항상 맨 아래(최신)로. 렌더·이미지 반영 타이밍까지 커버.
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [messages, chatId]);

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
        {!!systemNotice && !!noticeIcon && <NoticeIcon>{noticeIcon}</NoticeIcon>}
        {!!systemNotice && <SysMsg>{systemNotice}</SysMsg>}
        {pinnedCard}
        {rows.length === 0 && <SysMsg>대화를 시작해 보세요.</SysMsg>}

        {rows.map((row) => {
          if (row.type === "date") {
            return <DateDivider key={row.id}>{row.label}</DateDivider>;
          }
          // 시스템 메시지(라인업 확정 등)는 말풍선 대신 가운데 안내로 표시
          if (row.kind === "system") {
            return <SysMsg key={row.id}>{row.text}</SysMsg>;
          }
          const me = row.fromUid && row.fromUid === myUid;
          const imgs = Array.isArray(row.images) ? row.images.slice(0, 4) : [];
          const tm = fmtTime(row.createdAt);
          const isRead = me && oppReadMs > 0 && toMs(row.createdAt) <= oppReadMs;
          const whoLabel = [opponentName, opponentLeaderName]
            .map((s) => String(s || "").trim())
            .filter(Boolean)
            .join(" · ");
          const bubble = (
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
          );
          return (
            <Line key={row.id} $me={me}>
              {!me && (
                <Avatar>
                  {opponentAvatarUrl ? (
                    <img src={opponentAvatarUrl} alt={whoLabel || opponentName} />
                  ) : (
                    <AvatarPlaceholder size={34} />
                  )}
                </Avatar>
              )}
              <Bubble $me={me}>
                {!me && <Who>{whoLabel || opponentName}</Who>}
                <BubbleInner $me={me}>
                  {me && (
                    <MetaCol>
                      <Read $read={isRead}>{isRead ? "읽음" : "안읽음"}</Read>
                      <Tm>{tm}</Tm>
                    </MetaCol>
                  )}
                  {bubble}
                  {!me && <Tm>{tm}</Tm>}
                </BubbleInner>
              </Bubble>
            </Line>
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
          onFocus={() => {
            // 키보드가 올라온 뒤(애니메이션 후) 최신 메시지가 보이도록 맨 아래로 스크롤
            setTimeout(() => {
              const el = scrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }, 300);
          }}
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
