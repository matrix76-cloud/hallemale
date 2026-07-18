/* eslint-disable */
// src/pages/owner/components/OwnerNotifBell.jsx
// 헤더 우측 알림 벨 — 오너 uid로 온 알림(예약요청 등) 안읽음 개수 배지.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { LuBell } from "react-icons/lu";
import { useOwner } from "../../../context/OwnerContext";
import { subscribeNotificationsForUser, computeReadForUi } from "../../../services/notificationService";
import { NOTI_AUDIENCE } from "../../../utils/notificationDefinitions";
import { C } from "./od";

export default function OwnerNotifBell({ onClick }) {
  const { uid } = useOwner();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!uid) { setUnread(0); return; }
    // ✅ 구장 관련 알림만 카운트 (사용자앱 알림이 구장주 배지에 잡히던 문제)
    const unsub = subscribeNotificationsForUser({ uid, audience: NOTI_AUDIENCE.OWNER }, (items) => {
      const withRead = computeReadForUi({ items, uid });
      setUnread(withRead.filter((x) => !x.read).length);
    });
    return () => { try { unsub && unsub(); } catch (e) {} };
  }, [uid]);

  return (
    <BellBtn type="button" onClick={onClick} aria-label="알림">
      <LuBell size={22} />
      {unread > 0 && <Dot>{unread > 9 ? "9+" : unread}</Dot>}
    </BellBtn>
  );
}

const BellBtn = styled.button`
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: ${C.slate800};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const Dot = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`;
