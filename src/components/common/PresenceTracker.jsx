/* eslint-disable */
// src/components/common/PresenceTracker.jsx
// 로그인한 회원이 앱을 켜 두는 동안 주기적으로 접속 기록을 남긴다(services/presenceService.js).
// 화면을 그리지 않는다 — App.js 에 한 번만 매달아 두고 쓴다.
//
// 언제 보내나:
//   · 로그인 직후 1회 (이번 페이지 로드의 세션 시작)
//   · 이후 HEARTBEAT_MS 마다
//   · 탭이 다시 보일 때 (백그라운드에 있던 동안은 안 보낸다)
//   · 화면 이동 시 — 단 마지막 전송에서 MIN_GAP_MS 는 지나야 한다
//
// 안 보내는 경우:
//   · 비로그인
//   · 어드민 세션(adminClaim) — 어드민은 회원이 아니라 접속자 수에 섞이면 안 된다
//   · 탭이 백그라운드 — 켜 두고 잊은 창이 며칠씩 "접속중"으로 남는 걸 막는다

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { sendHeartbeat, HEARTBEAT_MS } from "../../services/presenceService";

// 화면 이동이 잦아도 이 간격 안에서는 다시 보내지 않는다(쓰기 비용 방어).
const MIN_GAP_MS = 20 * 1000;

export default function PresenceTracker() {
  const { userDoc, firebaseUser, isLoggedIn } = useAuth();
  const location = useLocation();

  // ⚠️ 문서 id 는 반드시 "로그인 uid"(firebaseUser.uid) 다.
  //    userDoc.uid 는 전화번호로 통합된 대표 계정의 uid 라 로그인 uid 와 다를 수 있고,
  //    그걸로 쓰면 규칙(presence/{uid} 는 request.auth.uid 본인만)에 걸려 통합 계정
  //    사용자 전원이 접속 기록을 못 남긴다.
  const uid = firebaseUser?.uid || "";
  const isAdminSession = userDoc?.adminClaim === true;
  const active = !!isLoggedIn && !!uid && !isAdminSession;

  // 최신 값을 인터벌 콜백이 읽을 수 있게 ref 로 들고 있는다
  // (state 를 의존성에 넣으면 화면 이동마다 인터벌이 재생성된다).
  const infoRef = useRef({ uid: "", nickname: "", profileUid: "", route: "" });
  infoRef.current = {
    uid,
    nickname: userDoc?.nickname || "",
    // 통합 계정이면 대표 계정 uid — 어드민이 회원 목록과 대조할 때 쓴다(로그인 uid 와 다를 수 있다).
    profileUid: userDoc?.uid || userDoc?.id || "",
    route: location.pathname,
  };

  const lastSentRef = useRef(0);
  // 이번 페이지 로드에서 아직 한 번도 안 보냈으면 다음 전송이 "세션 시작"이다.
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      // 로그아웃하면 다음 로그인이 새 세션이 되도록 되돌린다.
      sessionStartedRef.current = false;
      return;
    }

    let cancelled = false;

    const beat = async (force) => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!force && now - lastSentRef.current < MIN_GAP_MS) return;
      lastSentRef.current = now;

      const isNewSession = !sessionStartedRef.current;
      sessionStartedRef.current = true;
      try {
        await sendHeartbeat({ ...infoRef.current, isNewSession });
      } catch (e) {
        // 접속 기록 실패가 앱 사용을 막으면 안 된다. 다음 주기에 다시 시도된다.
        console.warn("[presence] heartbeat failed:", e?.message || e);
      }
    };

    beat(true);
    const timer = setInterval(() => beat(true), HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") beat(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  // 화면 이동 — 어느 화면을 보고 있는지 갱신(간격 제한 있음)
  useEffect(() => {
    if (!active) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const now = Date.now();
    if (now - lastSentRef.current < MIN_GAP_MS) return;
    lastSentRef.current = now;
    sessionStartedRef.current = true;
    sendHeartbeat({ ...infoRef.current, isNewSession: false }).catch(() => {});
  }, [active, location.pathname]);

  return null;
}
