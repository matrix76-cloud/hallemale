/* eslint-disable */
// src/hooks/useMatchRoomCounts.js
// ✅ 홈/카드용 매칭룸 카운트 (실시간)
// SSOT: match_requests.status
// - ongoing(조율중) = accepted + proposed
// - confirmed(확정) = confirmed
// - past(지난경기) = finished
// - actorClubId==clubId OR targetClubId==clubId (2개 onSnapshot 합치기)

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { hasMock, mockData } from "../dev/mockBus";
import { computeAttentionCounts } from "../utils/matchAttention";

const toStr = (v) => String(v || "").trim();

// 확정 전 '조율중'으로 묶이는 상태들.
// ⚠️ MatchRoomListPage 의 ADJUSTING_STATUSES 와 같은 값을 유지할 것 —
//    목록엔 보이는데 카운트는 0으로 뜨는 어긋남이 여기서 생긴다.
//    (awaiting_venue_approval = 구장주 승인 대기 + 승인 후 결제 대기)
const ADJUSTING_STATUSES = ["accepted", "proposed", "awaiting_venue_approval"];

function mergeDocsById(a, b) {
  const map = {};
  for (const x of a || []) {
    const id = toStr(x?.id);
    if (!id) continue;
    map[id] = x;
  }
  for (const x of b || []) {
    const id = toStr(x?.id);
    if (!id) continue;
    map[id] = x;
  }
  return Object.values(map);
}

// 확정 경기는 종료시각(시작 + 경기시간) 도달 시 '지난 경기'로 이동 (목록 페이지와 동일 기준)
function isEnded(r) {
  const start = r?.scheduledAt ? new Date(r.scheduledAt).getTime() : NaN;
  if (!Number.isFinite(start)) return false;
  const durMin = Number(r?.durationMin) > 0 ? Number(r.durationMin) : 120; // 기본 2시간
  return Date.now() >= start + durMin * 60 * 1000;
}

function countByStatus(rows) {
  let ongoing = 0;
  let confirmed = 0;
  let past = 0;
  let cancelled = 0;

  for (const r of rows || []) {
    const st = toStr(r?.status);
    if (ADJUSTING_STATUSES.includes(st)) ongoing += 1;
    else if (st === "confirmed") {
      if (isEnded(r)) past += 1; // 종료된 확정 경기 → 지난 경기
      else confirmed += 1;
    } else if (st === "finished") past += 1;
    else if (st === "cancelled") cancelled += 1;
  }

  return { ongoing, confirmed, past, cancelled };
}

export default function useMatchRoomCounts({ clubId, uid } = {}) {
  const myClubId = toStr(clubId);
  const myUid = toStr(uid);

  const [counts, setCounts] = useState({ ongoing: 0, confirmed: 0, past: 0, cancelled: 0 });
  const [attention, setAttention] = useState({ ongoing: 0, confirmed: 0, past: 0, cancelled: 0 });
  const [loading, setLoading] = useState(false);

  const aRef = useRef([]); // actor side docs
  const bRef = useRef([]); // target side docs

  useEffect(() => {
    if (!myClubId) {
      aRef.current = [];
      bRef.current = [];
      setCounts({ ongoing: 0, confirmed: 0, past: 0, cancelled: 0 });
      setAttention({ ongoing: 0, confirmed: 0, past: 0, cancelled: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);

    // 리뷰 보드 목업 — 실시간 구독 없이 목업 문서로 한 번 계산한다.
    if (hasMock("myMatchDocs")) {
      const merged = mockData("myMatchDocs");
      setCounts(countByStatus(merged));
      setAttention(computeAttentionCounts(merged, { myUid, myClubId }));
      setLoading(false);
      return;
    }

    const col = collection(db, "match_requests");

    // ✅ 홈에서 필요한 상태만 구독
    // awaiting_venue_approval 이 빠져 있으면 그 경기는 문서 자체가 안 내려와 조율중이 0으로 뜬다.
    const statusIn = [...ADJUSTING_STATUSES, "confirmed", "finished", "cancelled"];

    const qActor = query(col, where("actorClubId", "==", myClubId), where("status", "in", statusIn));
    const qTarget = query(col, where("targetClubId", "==", myClubId), where("status", "in", statusIn));

    const recompute = () => {
      const merged = mergeDocsById(aRef.current, bRef.current);
      setCounts(countByStatus(merged));
      setAttention(computeAttentionCounts(merged, { myUid, myClubId }));
      setLoading(false);
    };

    const unsubA = onSnapshot(
      qActor,
      (snap) => {
        aRef.current = (snap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => {
        console.warn("[useMatchRoomCounts] actor snapshot error:", err?.code, err?.message || err);
        aRef.current = [];
        recompute();
      }
    );

    const unsubB = onSnapshot(
      qTarget,
      (snap) => {
        bRef.current = (snap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => {
        console.warn("[useMatchRoomCounts] target snapshot error:", err?.code, err?.message || err);
        bRef.current = [];
        recompute();
      }
    );

    return () => {
      try {
        unsubA && unsubA();
      } catch (e) {}
      try {
        unsubB && unsubB();
      } catch (e) {}
    };
  }, [myClubId, myUid]);

  const value = useMemo(() => {
    return { counts, attention, loading, clubId: myClubId };
  }, [counts, attention, loading, myClubId]);

  return value;
}
