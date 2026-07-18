/* eslint-disable */
// src/utils/notiRoute.js
// 알림 → 이동할 화면(deepLink) 해석 (NotificationsPage / 자동읽음 훅 공용)

// - 1) 명시적 deepLink(top-level 우선, 없으면 meta) + 라우트 불일치 보정
// - 2) deepLink 없으면 종류(kind)·식별자 기반 폴백 (깨진 상세 페이지 방지)
export function resolveNotiRoute(n) {
  const raw = String(n?.deepLink || n?.meta?.deepLink || "").trim();
  if (raw) {
    const s = raw.startsWith("/") ? raw : `/${raw}`;
    if (s === "/chat" || s === "/chats") return "/chats";
    if (s.startsWith("/chat/") || s.startsWith("/chats/")) {
      const cid = s.slice(s.startsWith("/chats/") ? "/chats/".length : "/chat/".length);
      // 매칭룸 채팅(match_{roomId})은 매칭룸 상세페이지로 연결
      if (cid.startsWith("match_")) return `/match-roomdetail/${cid.slice("match_".length)}`;
      return `/chats/${cid}`;
    }
    if (s.startsWith("/matchroom/")) return `/match-roomdetail/${s.slice("/matchroom/".length)}`;
    if (s.startsWith("/community/")) return `/communitypost/${s.slice("/community/".length)}`;
    // 팀 초대/참여요청 → 내정보 요청 화면
    if (s.startsWith("/clubs/")) {
      const rest = s.slice("/clubs/".length); // "{clubId}/manage" 또는 "{clubId}"
      const clubId = rest.split("/")[0];
      if (rest.endsWith("/manage")) return "/my/team-invites";        // 받은 초대
      return clubId ? `/team/${clubId}/join-requests` : "/my/team-invites"; // 참여요청
    }
    return s;
  }

  // deepLink 없음 → 종류별 폴백
  const kind = String(n?.kind || "").trim();
  const sub = String(n?.subType || n?.type || "").toUpperCase();
  const clubId = String(n?.clubId || n?.meta?.clubId || "").trim();
  const matchId = String(
    n?.matchId || n?.meta?.matchId || (n?.linkType === "match" ? n?.linkTargetId : "") || ""
  ).trim();
  const chatId = String(
    n?.meta?.chatId || (n?.linkType === "chat" ? n?.linkTargetId : "") || ""
  ).trim();
  const reqId = String(n?.meta?.joinRequestId || "").trim();

  if (kind === "chat") {
    if (chatId.startsWith("match_")) return `/match-roomdetail/${chatId.slice("match_".length)}`;
    return chatId ? `/chats/${chatId}` : "/chats";
  }
  if (kind === "match") return matchId ? `/match-roomdetail/${matchId}` : "/matchingmanage";
  if (kind === "team") {
    if (sub.includes("JOIN_REQUEST") && sub.includes("CREATED") && clubId)
      return reqId ? `/team/${clubId}/join-requests/${reqId}` : `/team/${clubId}/join-requests`;
    if (sub.includes("INVITE") && !sub.includes("ACCEPTED") && !sub.includes("REJECTED"))
      return "/my/team-invites";
    return "/my";
  }
  if (kind === "notice") return "/notifications";
  return "";
}

/**
 * 알림이 가리키는 화면(notiRoute)에 현재 사용자가 도착했는지 판정.
 * - 정확히 같으면 매칭
 * - 충분히 구체적인 리스트 경로(세그먼트 2개 이상)에 머무르면 그 하위 상세 알림도 매칭
 *   (예: /team/{id}/join-requests 에 들어가면 .../join-requests/{reqId} 알림도 읽음)
 */
export function notiRouteMatchesPath(notiRoute, currentPath) {
  // deepLink엔 쿼리(?celebrate=accepted)·해시가 붙어 있을 수 있는데 비교 대상인
  // location.pathname엔 절대 없다 → 경로 부분만 떼어 비교 (쿼리는 이동 시엔 필요하므로 보존)
  const route = String(notiRoute || "").trim().split(/[?#]/)[0];
  const path = String(currentPath || "").trim().split(/[?#]/)[0];
  if (!route || !path) return false;
  // 알림창 자신/미해석 경로는 자동읽음 대상 아님 (알림창에선 클릭으로 처리)
  if (route === "/notifications") return false;
  if (route === path) return true;

  const segs = path.split("/").filter(Boolean).length;
  if (segs >= 2 && route.startsWith(path + "/")) return true;

  // 알림 목적지의 하위 화면에 있어도 도착한 것으로 본다
  // (예: /match-roomdetail/{id} 알림 ↔ /match-roomdetail/{id}/venue 체류)
  const routeSegs = route.split("/").filter(Boolean).length;
  if (routeSegs >= 2 && path.startsWith(route + "/")) return true;

  return false;
}
