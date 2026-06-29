/* eslint-disable */
// src/hooks/useUnreadNotiCount.js
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { useClub } from "./useClub";
import { subscribeNotificationsForUser } from "../services/notificationService";
import { isLeaderOnlyMatchNoti } from "../utils/notificationDefinitions";

/**
 * ✅ 안읽은 알림 개수 (앱 우측 상단 벨 배지용)
 * - notifications/{id} 기준, targetIds array-contains myUid + clubId 매칭
 * - system 목업 제외(서비스에서 이미 제외)
 * - readBy[myUid] 없으면 unread
 */
export default function useUnreadNotiCount() {
  const { firebaseUser, userDoc } = useAuth();
  const { club, isTeamLeader } = useClub();

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const myClubId =
    club?.clubId || club?.id || userDoc?.clubId || userDoc?.activeTeamId || "";

  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }

    const unsub = subscribeNotificationsForUser(
      { uid, clubId: myClubId || "", limitCount: 60 },
      (rows) => {
        const c = (rows || [])
          // 팀장 아니면 팀장 전용 매칭 알림은 카운트 제외(알림창과 동일 기준)
          .filter((n) => isTeamLeader || !isLeaderOnlyMatchNoti(n))
          .filter((n) => !(n?.readBy && typeof n.readBy === "object" && n.readBy[uid]))
          .length;
        setCount(c);
      }
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [uid, myClubId, isTeamLeader]);

  return useMemo(() => Math.max(0, Number(count) || 0), [count]);
}
