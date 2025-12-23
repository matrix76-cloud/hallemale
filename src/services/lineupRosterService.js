/* eslint-disable */
// src/services/lineupRosterService.js
// ✅ 라인업 멤버(유저) 상세 로드 서비스
// - memberIds(uid 배열)로 users/{uid} 문서를 병렬 getDoc
// - 페이지에서 DB 직접 접근 금지: 여기서만 Firestore 접근

import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = toStr(x);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function pickUserProfile(uid, data) {
  const d = data || {};
  return {
    userId: toStr(uid),
    nickname: toStr(d.nickname || d.name || ""),
    photoUrl: toStr(d.photoUrl || d.avatarUrl || d.profileImageUrl || ""),
    heightCm: typeof d.heightCm === "number" ? d.heightCm : null,
    weightKg: typeof d.weightKg === "number" ? d.weightKg : null,
    mainPosition: toStr(d.mainPosition || d.position || ""),
    skillLevel: toStr(d.skillLevel || ""),
  };
}

export async function fetchLineupRosterProfiles(memberIds = []) {
  const ids = uniqStrings(memberIds);
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
          return {
            userId: uid,
            nickname: "",
            photoUrl: "",
            heightCm: null,
            weightKg: null,
            mainPosition: "",
            skillLevel: "",
            _missing: true,
          };
        }
        return { ...pickUserProfile(uid, snap.data() || {}), _missing: false };
      } catch (e) {
        return {
          userId: uid,
          nickname: "",
          photoUrl: "",
          heightCm: null,
          weightKg: null,
          mainPosition: "",
          skillLevel: "",
          _missing: true,
          _error: true,
        };
      }
    })
  );

  // 순서 유지(ids 순)
  return results;
}
