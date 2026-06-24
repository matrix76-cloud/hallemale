/* eslint-disable */
// src/hooks/useAutoReadNotifications.js
// ✅ 알림창을 거치지 않고, 알림이 가리키는 화면에 직접 들어가면 자동 읽음 처리
// - 안읽은 알림을 구독하고, 현재 경로가 그 알림의 목적지와 맞으면 readBy 기록
// - 알림창(/notifications)에서의 읽음은 기존 클릭 처리에 맡김(여기선 대상 제외)

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "./useAuth";
import { useClub } from "./useClub";
import {
  subscribeNotificationsForUser,
  markNotificationsRead,
} from "../services/notificationService";
import { resolveNotiRoute, notiRouteMatchesPath } from "../utils/notiRoute";

export default function useAutoReadNotifications() {
  const { firebaseUser, userDoc } = useAuth();
  const { club } = useClub();
  const location = useLocation();

  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";
  const myClubId =
    club?.clubId || club?.id || userDoc?.clubId || userDoc?.activeTeamId || "";

  // 최신값을 ref로 보관 (구독 콜백의 stale closure 방지)
  const uidRef = useRef(uid);
  const pathRef = useRef(location.pathname || "");
  const unreadRef = useRef([]);
  const requestedRef = useRef(new Set()); // 이미 읽음요청 보낸 id (중복 호출 방지)

  uidRef.current = uid;
  pathRef.current = location.pathname || "";

  // 현재 화면과 매칭되는 안읽은 알림을 읽음 처리
  const markMatching = () => {
    const u = uidRef.current;
    const path = pathRef.current;
    if (!u || !path) return;

    const toMark = unreadRef.current
      .filter((n) => !requestedRef.current.has(n.id))
      .filter((n) => notiRouteMatchesPath(resolveNotiRoute(n), path))
      .map((n) => n.id);

    if (toMark.length === 0) return;

    toMark.forEach((id) => requestedRef.current.add(id));
    markNotificationsRead({ ids: toMark, uid: u });
  };

  // 안읽은 알림 구독
  useEffect(() => {
    if (!uid) {
      unreadRef.current = [];
      return;
    }
    const unsub = subscribeNotificationsForUser(
      { uid, clubId: myClubId || "", limitCount: 60 },
      (rows) => {
        unreadRef.current = (rows || []).filter(
          (n) => !(n?.readBy && typeof n.readBy === "object" && n.readBy[uid])
        );
        // 읽음요청 캐시 정리(목록에서 사라진 id 제거)
        const stillUnread = new Set(unreadRef.current.map((n) => n.id));
        requestedRef.current.forEach((id) => {
          if (!stillUnread.has(id)) requestedRef.current.delete(id);
        });
        markMatching();
      }
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, myClubId]);

  // 경로가 바뀔 때마다 매칭 검사
  useEffect(() => {
    markMatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
