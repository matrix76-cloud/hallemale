/* eslint-disable */
// src/hooks/useUnreadChatCount.js
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./useAuth";

/**
 * ✅ 안읽은 채팅 "방" 개수
 * - chatRooms/{chatId} 기준
 * - 내가 보낸 메시지는 unread로 치지 않음
 * - lastReadAtBy[myUid] < lastMessageAt 이면 unread
 *
 * 배지 정책:
 * - 방 단위 count(= DM 리스트에서 빨간 뱃지)
 */
export default function useUnreadChatCount() {
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!myUid) {
      setCount(0);
      return;
    }

    try {
      const qRooms = query(
        collection(db, "chatRooms"),
        where("participantUids", "array-contains", String(myUid))
      );

      const unsub = onSnapshot(
        qRooms,
        (snap) => {
          let c = 0;

          snap.forEach((docSnap) => {
            const r = docSnap.data() || {};
            if ((r.type || "dm") !== "dm") return;

            const lastAt = r.lastMessageAt || null;
            const lastFrom = String(r.lastMessageFromUid || "").trim();

            if (!lastAt) return;                // 메시지 없으면 unread 없음
            if (!lastFrom) return;
            if (lastFrom === String(myUid)) return; // 내가 마지막 보낸 거면 unread 아님

            const readMap = r.lastReadAtBy || {};
            const readAt = readMap?.[String(myUid)] || null;

            const lastDate =
              lastAt?.toDate && typeof lastAt.toDate === "function"
                ? lastAt.toDate()
                : new Date(lastAt);

            const readDate =
              readAt?.toDate && typeof readAt.toDate === "function"
                ? readAt.toDate()
                : readAt
                ? new Date(readAt)
                : null;

            if (!readDate) {
              c += 1;
              return;
            }

            if (lastDate.getTime() > readDate.getTime()) {
              c += 1;
            }
          });

          setCount(c);
        },
        (err) => {
          console.error("[useUnreadChatCount] snapshot error", {
            code: err?.code,
            message: err?.message,
          });
          setCount(0);
        }
      );

      return () => {
        try {
          unsub && unsub();
        } catch (e) {}
      };
    } catch (e) {
      console.error("[useUnreadChatCount] init error", e?.message || e);
      setCount(0);
    }
  }, [myUid]);

  return useMemo(() => Math.max(0, Number(count) || 0), [count]);
}
