// src/services/favoriteService.js
/* eslint-disable */

import { db } from "./firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";

/**
 * ✅ SSOT
 * - users/{uid}.favoriteTeamIds: string[] (clubId)
 * - users/{uid}.favoritePlayerIds: string[] (userId)
 *
 * Optimistic을 위해 "현재 상태"를 인자로 받는 set 방식 제공
 */

export async function setFavoriteTeam({ uid, clubId, isFavorite }) {
  if (!uid) throw new Error("setFavoriteTeam: uid is required");
  if (!clubId) throw new Error("setFavoriteTeam: clubId is required");

  const ref = doc(db, "users", uid);

  const key = String(clubId);

  await updateDoc(ref, {
    favoriteTeamIds: isFavorite ? arrayUnion(key) : arrayRemove(key),
    updatedAt: serverTimestamp(),
  });

  return { uid, clubId: key, isFavorite: !!isFavorite };
}

export async function setFavoritePlayer({ uid, playerUid, isFavorite }) {
  if (!uid) throw new Error("setFavoritePlayer: uid is required");
  if (!playerUid) throw new Error("setFavoritePlayer: playerUid is required");

  const ref = doc(db, "users", uid);

  const key = String(playerUid);

  await updateDoc(ref, {
    favoritePlayerIds: isFavorite ? arrayUnion(key) : arrayRemove(key),
    updatedAt: serverTimestamp(),
  });

  return { uid, playerUid: key, isFavorite: !!isFavorite };
}
