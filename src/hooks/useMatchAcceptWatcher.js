/* eslint-disable */
// src/hooks/useMatchAcceptWatcher.js
// 내가 "보낸" 매칭 요청이 상대팀에 의해 수락되면(pending→accepted) 실시간 감지하여,
// 신청한(보낸) 팀도 수락한 팀과 동일하게 매칭룸 "매칭 성사" 축하 화면으로 자동 이동시킨다.
// - match_requests.actorClubId == 내 팀  (단일 equality → 별도 색인 불필요, status는 클라이언트 필터)
// - 최초 스냅샷의 accepted 건은 기준선으로만 기록(앱 켤 때 과거 수락 건으로 축하 안 띄움)
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { useClub } from "./useClub";

export default function useMatchAcceptWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { club } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();

  const baselineRef = useRef(null);        // 최초 스냅샷 accepted matchId 집합(기준선)
  const handledRef = useRef(new Set());    // 이미 축하 이동한 matchId

  // 최신 경로를 effect 재구독 없이 참조하기 위한 ref
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!myClubId) return;

    baselineRef.current = null;

    const qy = query(
      collection(db, "match_requests"),
      where("actorClubId", "==", myClubId)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const acceptedIds = snap.docs
          .filter((d) => String(d.data()?.status || "") === "accepted")
          .map((d) => d.id);

        // 최초 스냅샷: 이미 수락된 건은 기준선으로만 기록 (축하 X)
        if (baselineRef.current === null) {
          baselineRef.current = new Set(acceptedIds);
          return;
        }

        for (const id of acceptedIds) {
          if (baselineRef.current.has(id) || handledRef.current.has(id)) continue;
          baselineRef.current.add(id);
          handledRef.current.add(id);

          // 이미 해당 매칭룸이면 중복 이동 방지
          if (pathRef.current.includes(`/match-roomdetail/${id}`)) continue;

          // 수락한 팀과 동일한 "매칭 성사" 축하 화면으로 이동
          navigate(`/match-roomdetail/${id}`, { state: { celebrateAccepted: true } });
          break; // 한 번에 하나만
        }
      },
      (err) => {
        console.warn("[useMatchAcceptWatcher] snapshot error:", err?.message || err);
      }
    );

    return () => unsub();
  }, [myClubId, navigate]);
}
