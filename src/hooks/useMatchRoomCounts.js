/* eslint-disable */
// src/hooks/useMatchRoomCounts.js
// ✅ 홈/카드용 매칭룸 카운트 (실시간)
// SSOT: match_requests.status
// - ongoing(조율중) = accepted + proposed
// - confirmed(확정) = confirmed
// - actorClubId==clubId OR targetClubId==clubId (2개 onSnapshot 합치기)

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

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

function countByStatus(rows) {
  let ongoing = 0;
  let confirmed = 0;

  for (const r of rows || []) {
    const st = toStr(r?.status);
    if (st === "accepted" || st === "proposed") ongoing += 1;
    else if (st === "confirmed") confirmed += 1;
  }

  return { ongoing, confirmed };
}

export default function useMatchRoomCounts({ clubId } = {}) {
  const myClubId = toStr(clubId);

  const [counts, setCounts] = useState({ ongoing: 0, confirmed: 0 });
  const [loading, setLoading] = useState(false);

  const aRef = useRef([]); // actor side docs
  const bRef = useRef([]); // target side docs

  useEffect(() => {
    if (!myClubId) {
      aRef.current = [];
      bRef.current = [];
      setCounts({ ongoing: 0, confirmed: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);

    const col = collection(db, "match_requests");

    // ✅ 홈에서는 필요한 상태만 구독 (pending은 매칭관리)
    const statusIn = ["accepted", "proposed", "confirmed"];

    const qActor = query(
      col,
      where("actorClubId", "==", myClubId),
      where("status", "in", statusIn)
    );

    const qTarget = query(
      col,
      where("targetClubId", "==", myClubId),
      where("status", "in", statusIn)
    );

    const recompute = () => {
      const merged = mergeDocsById(aRef.current, bRef.current);
      setCounts(countByStatus(merged));
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
  }, [myClubId]);

  const value = useMemo(() => {
    return { counts, loading, clubId: myClubId };
  }, [counts, loading, myClubId]);

  return value;
}
