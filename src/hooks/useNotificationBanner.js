/* eslint-disable */
// src/hooks/useNotificationBanner.js
// 내 알림(notifications)을 실시간 구독해서, 새로 들어온 알림이 있으면
// 화면 상단에 인앱 배너(UIContext.showBanner)를 띄운다. (인스타식 푸시 배너)
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUIActions } from "./useUI";
import { subscribeNotificationsForUser } from "../services/notificationService";
import { resolveNotiRoute } from "../utils/notiRoute";

const MAX_AGE_MS = 120000; // 2분 — 오래된(백필) 알림은 배너로 띄우지 않음

function toMillis(v) {
  if (!v) return 0;
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function useNotificationBanner({ uid, clubId } = {}) {
  const { showBanner } = useUIActions();
  const location = useLocation();

  // 콜백 안에서 항상 최신 경로/함수를 보도록 ref로 보관
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const showBannerRef = useRef(showBanner);
  showBannerRef.current = showBanner;

  // 이미 본(=마운트 시점에 존재했거나 한번 처리한) 알림 id
  const seenRef = useRef(new Set());
  const initedRef = useRef(false);

  useEffect(() => {
    if (!uid) return;

    seenRef.current = new Set();
    initedRef.current = false;

    const unsub = subscribeNotificationsForUser({ uid, clubId }, (list) => {
      // 첫 스냅샷: 기존 알림은 모두 "이미 본 것"으로 기록만 하고 배너는 안 띄움
      if (!initedRef.current) {
        for (const n of list) if (n?.id) seenRef.current.add(n.id);
        initedRef.current = true;
        return;
      }

      // 새 알림만 추출 (list는 최신순 정렬)
      const fresh = [];
      for (const n of list) {
        if (!n?.id || seenRef.current.has(n.id)) continue;
        seenRef.current.add(n.id);
        fresh.push(n);
      }
      if (!fresh.length) return;

      // 한 번에 여러 개여도 가장 최신 1개만 배너로 (나머지는 알림 목록에서 확인)
      const n = fresh[0];

      if (String(n.actorUid || "") === String(uid)) return; // 내가 만든 알림은 제외
      if (n.readBy && n.readBy[uid]) return; // 이미 읽음
      if (Date.now() - toMillis(n.createdAt) > MAX_AGE_MS) return; // 오래된 알림

      // deepLink는 알림 종류에 따라 meta.deepLink(채팅/결제독촉 등) 또는 최상위 deepLink
      // (buildNotificationDoc 기반 매칭요청/수락/거절/취소)에 들어 있음 — 둘 다 확인
      // 실제 라우트로 보정한 뒤 비교/전달 (예: /chats/match_X → /match-roomdetail/X)
      const deepLink = resolveNotiRoute(n) || "";
      // 이미 해당 화면(예: 그 채팅방)에 있으면 배너 생략
      // ⚠️ 단순 startsWith는 "/chat"이 "/chats"(채팅목록)까지 매칭해 오탐 → 세그먼트 단위로 비교
      const curPath = pathRef.current || "";
      if (deepLink && (curPath === deepLink || curPath.startsWith(deepLink + "/"))) return;

      showBannerRef.current({
        id: n.id,
        title: n.title || "새 알림",
        body: n.body || "",
        deepLink,
        kind: n.prefsCategory || n.kind || "",
        // 메시지 알림: 상대 팀 프로필 사진을 배너 아이콘으로 사용
        avatarUrl: n?.meta?.actorTeamLogoUrl || "",
      });
    });

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [uid, clubId]);
}
