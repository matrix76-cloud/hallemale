/* eslint-disable */
// src/pages/admin/AdminChatRoomDetailPage.jsx
// 어드민 - 채팅방 상세 (메시지 모니터링)
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  loadAdminChatRoomDetail,
  setChatRoomLocked,
  deleteChatMessageByAdmin,
  deleteChatRoomByAdmin,
} from "../../services/adminChatService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const BackBtn = styled.button`
  height: 32px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 14px;
  cursor: pointer;
  background: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2";
    }
    if ($variant === "warn") {
      return theme?.mode === "dark" ? "rgba(245,158,11,0.16)" : "#fffbeb";
    }
    return theme?.colors?.card || "#ffffff";
  }};
  color: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "#fca5a5" : "#b91c1c";
    }
    if ($variant === "warn") {
      return theme?.mode === "dark" ? "#fbbf24" : "#92400e";
    }
    return theme?.colors?.textStrong || "#111827";
  }};
  ${({ $variant, theme }) => {
    if ($variant === "danger") {
      const c = theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca";
      return `border-color: ${c};`;
    }
    if ($variant === "warn") {
      const c = theme?.mode === "dark" ? "rgba(245,158,11,0.45)" : "#fde68a";
      return `border-color: ${c};`;
    }
    return "";
  }}
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const InfoTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  ${({ $tone, theme }) => {
    if ($tone === "lock") {
      return theme?.mode === "dark"
        ? `background: rgba(248,113,113,0.16); color: #fca5a5;`
        : `background: #fef2f2; color: #b91c1c;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(16,185,129,0.16); color: #6ee7b7;`
      : `background: #ecfdf5; color: #047857;`;
  }}
`;

const InfoMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
`;

const ParticipantsRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Avatar = styled.div`
  width: ${({ $size }) => $size || 32}px;
  height: ${({ $size }) => $size || 32}px;
  border-radius: 999px;
  background: #e5e7eb url(${({ $src }) => $src || ""}) center/cover no-repeat;
  flex-shrink: 0;
`;

const ParticipantPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px;
`;

const MsgRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
`;

const MsgBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MsgMeta = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const MsgName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const MsgText = styled.div`
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const MsgImages = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
`;

const MsgImg = styled.a`
  display: block;
  width: 110px;
  height: 110px;
  border-radius: 8px;
  background: #f1f5f9 url(${({ $src }) => $src || ""}) center/cover no-repeat;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;

const MsgActions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const SmallDelBtn = styled.button`
  height: 26px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 0 8px;
  cursor: pointer;
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2"};
  color: ${({ theme }) => (theme?.mode === "dark" ? "#fca5a5" : "#b91c1c")};
`;

const EmptyMsg = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  padding: 30px 0;
  text-align: center;
`;

const ErrorText = styled.div`
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: #b91c1c;
`;

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminChatRoomDetailPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { room: r, messages: ms } = await loadAdminChatRoomDetail(chatId);
      if (!r) {
        setErr("채팅방을 찾을 수 없습니다.");
        setRoom(null);
        setMessages([]);
        return;
      }
      setRoom(r);
      setMessages(Array.isArray(ms) ? ms : []);
    } catch (e) {
      console.error("[AdminChatRoomDetailPage] load failed", e);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  const participantMap = useMemo(() => {
    const m = {};
    (room?.participants || []).forEach((p) => {
      if (p?.uid) m[p.uid] = p;
    });
    return m;
  }, [room]);

  const toggleLock = async () => {
    if (!room) return;
    let reason = "";
    if (!room.locked) {
      reason = window.prompt("잠금 사유를 입력해주세요. (어드민 기록용)", "") || "";
      if (reason === null) return;
    }
    setBusy(true);
    try {
      await setChatRoomLocked({
        chatId: room.id,
        locked: !room.locked,
        reason: String(reason || ""),
      });
      await load();
    } catch (e) {
      console.error(e);
      showAlert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room) return;
    const names = (room.participants || []).map((p) => p.name).join(", ");
    if (!await showConfirm(`이 채팅방을 삭제하시겠습니까?\n\n참여자: ${names}\n\n메시지까지 모두 사라지고 복구할 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteChatRoomByAdmin({ chatId: room.id });
      navigate("/admin/chat/list", { replace: true });
    } catch (e) {
      console.error(e);
      showAlert(e?.message || "삭제에 실패했습니다.");
      setBusy(false);
    }
  };

  const handleDeleteMessage = async (m) => {
    if (!room || !m?.id) return;
    if (!await showConfirm("이 메시지를 삭제하시겠습니까?")) return;
    setBusy(true);
    try {
      await deleteChatMessageByAdmin({ chatId: room.id, messageId: m.id });
      await load();
    } catch (e) {
      console.error(e);
      showAlert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Card><AdminLoading /></Card>
      </Page>
    );
  }

  if (err || !room) {
    return (
      <Page>
        <TopRow>
          <BackBtn type="button" onClick={() => navigate("/admin/chat/list")}>← 목록으로</BackBtn>
        </TopRow>
        <Card>
          <ErrorText>{err || "채팅방을 찾을 수 없습니다."}</ErrorText>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <TopRow>
        <BackBtn type="button" onClick={() => navigate("/admin/chat/list")}>← 목록으로</BackBtn>
        <ActionRow>
          <Btn type="button" $variant="warn" onClick={toggleLock} disabled={busy}>
            {room.locked ? "잠금 해제" : "방 잠금"}
          </Btn>
          <Btn type="button" $variant="danger" onClick={handleDeleteRoom} disabled={busy}>
            방 삭제
          </Btn>
        </ActionRow>
      </TopRow>

      <Card>
        <InfoTitle>
          채팅방 정보
          {room.locked ? <Pill $tone="lock">잠금</Pill> : <Pill>활성</Pill>}
        </InfoTitle>
        <ParticipantsRow>
          {(room.participants || []).map((p) => (
            <ParticipantPill key={p.uid}>
              <Avatar $src={p.avatar} $size={26} />
              <span>{p.name}</span>
            </ParticipantPill>
          ))}
        </ParticipantsRow>
        <InfoMeta>
          <span>방 ID: {room.id}</span>
          <span>유형: {room.type}</span>
          <span>생성: {fmtYmdHm(room.createdAt)}</span>
          {room.lastMessageAt && <span>마지막 메시지: {fmtYmdHm(room.lastMessageAt)}</span>}
          {room.locked && room.lockedReason && (
            <span style={{ color: "#b91c1c" }}>잠금 사유: {room.lockedReason}</span>
          )}
        </InfoMeta>
      </Card>

      <Card>
        <InfoTitle>메시지 ({messages.length})</InfoTitle>
        <Messages>
          {messages.length === 0 ? (
            <EmptyMsg>메시지가 없습니다.</EmptyMsg>
          ) : (
            messages.map((m) => {
              const author = participantMap[m.fromUid] || {
                name: "(이름없음)",
                avatar: "",
              };
              return (
                <MsgRow key={m.id}>
                  <Avatar $src={author.avatar} $size={32} />
                  <MsgBody>
                    <MsgMeta>
                      <MsgName>{author.name}</MsgName>
                      <span>{fmtYmdHm(m.createdAt)}</span>
                      {m.kind && m.kind !== "text" && <span>· {m.kind}</span>}
                    </MsgMeta>
                    {m.text && <MsgText>{m.text}</MsgText>}
                    {m.images?.length > 0 && (
                      <MsgImages>
                        {m.images.map((img, i) => {
                          const url = typeof img === "string" ? img : img?.url || "";
                          if (!url) return null;
                          return (
                            <MsgImg
                              key={`${url}-${i}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              $src={url}
                            />
                          );
                        })}
                      </MsgImages>
                    )}
                  </MsgBody>
                  <MsgActions>
                    <SmallDelBtn type="button" onClick={() => handleDeleteMessage(m)} disabled={busy}>
                      삭제
                    </SmallDelBtn>
                  </MsgActions>
                </MsgRow>
              );
            })
          )}
        </Messages>
      </Card>
    </Page>
  );
}
