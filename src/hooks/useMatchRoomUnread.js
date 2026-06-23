/* eslint-disable */
// src/hooks/useMatchRoomUnread.js
// ✅ 매칭룸 "안 읽은 메시지 수 + 마지막 메시지" (실시간)
// - match_requests(actor/target) 실시간 구독 → 조율중(accepted/proposed)/확정(confirmed·미종료) 방 추적
// - 각 방의 chatRooms/match_{id} 문서(lastReadAtBy/lastMessage*) + messages(최근 100) 실시간 구독
// - unread = 내 lastReadAt 이후 도착한 "상대(나·시스템 제외)" 메시지 수
// - 메시지가 없지만 제안/확정 등 반응이 필요한 방은 최소 1로 카운트(기존 '반응 필요' 동작 유지)
// 반환: { counts: { ongoing, confirmed }, byRoom: { [roomId]: { unread, lastMessageText, lastMessageAt } } }

import { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

const tsMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

const isEnded = (r) => {
  const start = r?.scheduledAt ? new Date(r.scheduledAt).getTime() : NaN;
  if (!Number.isFinite(start)) return false;
  const dur = Number(r?.durationMin) > 0 ? Number(r.durationMin) : 120;
  return Date.now() >= start + dur * 60 * 1000;
};

const categoryOf = (d) => {
  const st = toStr(d?.status);
  if (st === "accepted" || st === "proposed") return "ongoing";
  if (st === "confirmed" && !isEnded(d)) return "confirmed";
  return null;
};

export default function useMatchRoomUnread({ clubId, uid } = {}) {
  const myClubId = toStr(clubId);
  const myUid = toStr(uid);
  const [state, setState] = useState({ counts: { ongoing: 0, confirmed: 0 }, byRoom: {} });

  useEffect(() => {
    if (!myClubId || !myUid) {
      setState({ counts: { ongoing: 0, confirmed: 0 }, byRoom: {} });
      return;
    }

    let aDocs = {}; // actor side match docs by id
    let bDocs = {}; // target side match docs by id
    const roomSubs = {}; // roomId -> { unsubMsgs, unsubRoom }
    const chat = {}; // roomId -> { msgs, lastReadAt, lastMessageText, lastMessageAt }

    const computeRoomUnread = (id) => {
      const c = chat[id];
      if (!c) return 0;
      const lastRead = c.lastReadAt || 0;
      const msgs = c.msgs || [];
      return msgs.filter((m) => {
        const from = toStr(m.fromUid);
        return tsMs(m.createdAt) > lastRead && from && from !== myUid && from !== "system";
      }).length;
    };

    const publish = () => {
      const merged = { ...aDocs, ...bDocs };
      let ongoing = 0;
      let confirmed = 0;
      const byRoom = {};
      Object.keys(merged).forEach((id) => {
        const d = merged[id];
        const cat = categoryOf(d);
        if (!cat) return;
        const unread = computeRoomUnread(id);
        const needsAttn = tsMs(d.lastActivityAt) > tsMs(d.lastSeenBy?.[myUid]) ? 1 : 0;
        const badge = Math.max(unread, needsAttn);
        byRoom[id] = {
          unread,
          lastMessageText: chat[id]?.lastMessageText || "",
          lastMessageAt: chat[id]?.lastMessageAt || null,
        };
        if (cat === "ongoing") ongoing += badge;
        else confirmed += badge;
      });
      setState({ counts: { ongoing, confirmed }, byRoom });
    };

    const reconcile = () => {
      const merged = { ...aDocs, ...bDocs };
      const relevant = new Set(Object.keys(merged).filter((id) => categoryOf(merged[id])));

      // 새 방 구독 추가
      relevant.forEach((id) => {
        if (roomSubs[id]) return;
        const chatId = `match_${id}`;
        chat[id] = chat[id] || {};

        const unsubMsgs = onSnapshot(
          query(collection(db, "chatRooms", chatId, "messages"), orderBy("createdAt", "desc"), limit(100)),
          (snap) => {
            const msgs = [];
            snap.forEach((m) => msgs.push(m.data() || {}));
            chat[id].msgs = msgs;
            publish();
          },
          () => {
            chat[id].msgs = [];
            publish();
          }
        );

        const unsubRoom = onSnapshot(
          doc(db, "chatRooms", chatId),
          (snap) => {
            const data = snap.exists() ? snap.data() || {} : {};
            chat[id].lastReadAt = tsMs(data?.lastReadAtBy?.[myUid]);
            chat[id].lastMessageText = toStr(data?.lastMessageText);
            chat[id].lastMessageAt = data?.lastMessageAt || null;
            publish();
          },
          () => {
            publish();
          }
        );

        roomSubs[id] = { unsubMsgs, unsubRoom };
      });

      // 더 이상 관련 없는 방 구독 해제
      Object.keys(roomSubs).forEach((id) => {
        if (relevant.has(id)) return;
        try { roomSubs[id].unsubMsgs(); } catch (e) {}
        try { roomSubs[id].unsubRoom(); } catch (e) {}
        delete roomSubs[id];
        delete chat[id];
      });
    };

    const col = collection(db, "match_requests");
    const statusIn = ["accepted", "proposed", "confirmed"];

    const unsubA = onSnapshot(
      query(col, where("actorClubId", "==", myClubId), where("status", "in", statusIn)),
      (snap) => {
        aDocs = {};
        snap.forEach((d) => { aDocs[d.id] = { id: d.id, ...d.data() }; });
        reconcile();
        publish();
      },
      () => { aDocs = {}; reconcile(); publish(); }
    );

    const unsubB = onSnapshot(
      query(col, where("targetClubId", "==", myClubId), where("status", "in", statusIn)),
      (snap) => {
        bDocs = {};
        snap.forEach((d) => { bDocs[d.id] = { id: d.id, ...d.data() }; });
        reconcile();
        publish();
      },
      () => { bDocs = {}; reconcile(); publish(); }
    );

    return () => {
      try { unsubA(); } catch (e) {}
      try { unsubB(); } catch (e) {}
      Object.values(roomSubs).forEach((s) => {
        try { s.unsubMsgs(); } catch (e) {}
        try { s.unsubRoom(); } catch (e) {}
      });
    };
  }, [myClubId, myUid]);

  return state;
}
