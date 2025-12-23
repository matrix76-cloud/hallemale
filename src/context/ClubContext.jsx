/* eslint-disable */
// src/context/ClubContext.jsx
// ✅ SSOT: users/{uid}.activeTeamId
// - userDoc.activeTeamId에 의존하지 않고, users/{uid}를 onSnapshot으로 구독해서 즉시 반영
// - activeTeamId 없으면: (팀장) clubs.ownerUid==uid 1회 조회 → users.activeTeamId 세팅
// - activeTeamId 있으면: clubs/{id} 로드 + members 로드
// - members: clubs/{clubId}/members 서브컬렉션

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

const ClubContext = createContext(null);

/* ===================== helpers ===================== */

function logGroup(title, payload) {
  try {
    console.groupCollapsed(title);
    console.log(payload);
    console.groupEnd();
  } catch (e) {}
}

async function loadClubById(clubId) {
  if (!clubId) return null;
  const snap = await getDoc(doc(db, "clubs", clubId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadClubMembers(clubId) {
  if (!clubId) return [];
  const ref = collection(db, "clubs", clubId, "members");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function findOwnedClubId(uid) {
  if (!uid) return "";
  const q = query(collection(db, "clubs"), where("ownerUid", "==", uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return "";
  return snap.docs[0].id;
}

async function ensureActiveTeamId({ uid, activeTeamId }) {
  if (activeTeamId) return activeTeamId;

  // ✅ 팀이 아직 지정 안 됐으면 "찾아서" 세팅 (팀장 기준: ownerUid)
  const ownedClubId = await findOwnedClubId(uid);
  if (!ownedClubId) return "";

  await setDoc(doc(db, "users", uid), { activeTeamId: ownedClubId }, { merge: true });
  return ownedClubId;
}

/* ===================== provider ===================== */

export function ClubProvider({ children }) {
  const { userDoc } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  // ✅ users/{uid}에서 바로 구독해서 가져오는 activeTeamId (진짜 SSOT)
  const [activeTeamId, setActiveTeamId] = useState("");

  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 중복 호출 방지
  const bootRef = useRef({ key: "", running: false });

  // ✅ users/{uid} 구독: activeTeamId 즉시 반영
  useEffect(() => {
    if (!uid) {
      setActiveTeamId("");
      setClub(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const next = (data?.activeTeamId || "").trim();

        logGroup("[ClubContext] users snapshot", {
          uid,
          exists: snap.exists(),
          activeTeamId: next || "",
        });

        setActiveTeamId(next || "");
        setLoading(false);
      },
      (err) => {
        logGroup("[ClubContext] users snapshot ERROR", {
          uid,
          message: err?.message || String(err),
          code: err?.code,
        });
        setActiveTeamId("");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  const refreshClub = async (reason = "effect") => {
    logGroup("[ClubContext] refreshClub: called", { reason, uid, activeTeamId });

    if (!uid) {
      setClub(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const bootKey = `${uid}:${activeTeamId || "none"}`;
    if (bootRef.current.running && bootRef.current.key === bootKey) {
      logGroup("[ClubContext] refreshClub: skipped (already running)", { bootKey });
      return;
    }

    bootRef.current = { key: bootKey, running: true };
    setLoading(true);

    try {
      const teamId = await ensureActiveTeamId({ uid, activeTeamId });

      logGroup("[ClubContext] refreshClub: resolved teamId", {
        uid,
        activeTeamId,
        teamId,
      });

      if (!teamId) {
        setClub(null);
        setMembers([]);
        return;
      }

      const c = await loadClubById(teamId);
      if (!c) {
        logGroup("[ClubContext] refreshClub: club doc missing", { teamId });
        setClub(null);
        setMembers([]);
        return;
      }

      setClub(c);

      const ms = await loadClubMembers(teamId);
      setMembers(ms);

      logGroup("[ClubContext] refreshClub: done", {
        teamId,
        clubName: c?.name || "",
        membersCount: ms.length,
      });
    } catch (e) {
      logGroup("[ClubContext] refreshClub: ERROR", {
        message: e?.message || String(e),
        code: e?.code,
        stack: e?.stack,
      });
      setClub(null);
      setMembers([]);
    } finally {
      setLoading(false);
      bootRef.current.running = false;
    }
  };

  const refreshMembers = async () => {
    if (!club?.id) {
      setMembers([]);
      return;
    }
    const ms = await loadClubMembers(club.id);
    setMembers(ms);
  };

  // ✅ activeTeamId가 바뀌면 즉시 club 로드
  useEffect(() => {
    refreshClub("effect(uid/activeTeamId)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, activeTeamId]);

  // ✅ 팀장 판정: "팀이 있을 때만" + club.ownerUid === uid
  const isTeamLeader = useMemo(() => {
    if (!uid) return false;
    if (!activeTeamId) return false;
    const ownerUid = club?.ownerUid || "";
    return !!ownerUid && ownerUid === uid;
  }, [uid, activeTeamId, club]);

  const value = {
    club,
    members,
    loading,
    isTeamLeader,
    activeTeamId, // (디버그/표시용) 필요하면 사용
    refreshClub: () => refreshClub("manual"),
    refreshMembers,
  };

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClubContext() {
  return useContext(ClubContext);
}
