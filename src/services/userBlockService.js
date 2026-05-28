/* eslint-disable */
// src/services/userBlockService.js
// 사용자가 다른 사용자/게시글을 차단·숨김 처리하는 서비스
// - 신고와 함께 호출되어 신고 즉시 본인 피드에서 콘텐츠가 보이지 않도록 함
// - Apple App Store Guideline 1.2 대응

import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

const COL = "user_blocks";

function docRef(myUid) {
  return doc(db, COL, String(myUid));
}

/**
 * 내가 차단한 사용자 / 숨긴 게시글 목록 조회
 * 반환: { blockedUids: string[], hiddenPostIds: string[] }
 */
export async function getMyBlockList(myUid) {
  const uid = String(myUid || "").trim();
  if (!uid) return { blockedUids: [], hiddenPostIds: [] };
  try {
    const snap = await getDoc(docRef(uid));
    if (!snap.exists()) return { blockedUids: [], hiddenPostIds: [] };
    const d = snap.data() || {};
    return {
      blockedUids: Array.isArray(d.blockedUids) ? d.blockedUids.map(String) : [],
      hiddenPostIds: Array.isArray(d.hiddenPostIds) ? d.hiddenPostIds.map(String) : [],
    };
  } catch (e) {
    console.warn("[userBlockService] getMyBlockList failed:", e?.message || e);
    return { blockedUids: [], hiddenPostIds: [] };
  }
}

/**
 * 작성자 + 게시글 동시 차단 (신고와 함께 호출)
 * - blockedUids에 targetUid 추가 → 그 사용자의 모든 게시글/댓글 본인 피드에서 숨김
 * - hiddenPostIds에 postId 추가 → 해당 게시글도 명시적으로 숨김
 */
export async function blockAuthorAndHidePost({ myUid, targetUid, postId } = {}) {
  const me = String(myUid || "").trim();
  const target = String(targetUid || "").trim();
  const pid = String(postId || "").trim();
  if (!me) throw new Error("blockAuthorAndHidePost: myUid is required");

  const payload = {
    myUid: me,
    updatedAt: serverTimestamp(),
  };
  if (target && target !== me) payload.blockedUids = arrayUnion(target);
  if (pid) payload.hiddenPostIds = arrayUnion(pid);

  await setDoc(docRef(me), payload, { merge: true });
}

/** 사용자 차단 해제 */
export async function unblockUser({ myUid, targetUid } = {}) {
  const me = String(myUid || "").trim();
  const target = String(targetUid || "").trim();
  if (!me || !target) return;
  await setDoc(
    docRef(me),
    {
      blockedUids: arrayRemove(target),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** 게시글 숨김 해제 */
export async function unhidePost({ myUid, postId } = {}) {
  const me = String(myUid || "").trim();
  const pid = String(postId || "").trim();
  if (!me || !pid) return;
  await setDoc(
    docRef(me),
    {
      hiddenPostIds: arrayRemove(pid),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
