/* eslint-disable */
// src/services/adminCommunityService.js
// 관리자가 커뮤니티 게시글을 관리하는 서비스
// - 목록(숨김/공지 포함 전체) / 숨김 토글 / 공지 고정 토글 / 삭제
// Firestore: community_posts/{id} 에 hidden, hiddenAt, hiddenBy, pinned, pinnedAt 필드 사용

import { db } from "./firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteField,
  writeBatch,
} from "firebase/firestore";

import { getUserPublicMeta } from "./counterpartService";

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeString(v) {
  return String(v || "").trim();
}

function pickThumb(postData) {
  const imgs = postData?.media?.images;
  if (Array.isArray(imgs) && imgs.length > 0) return safeString(imgs[0]) || null;
  const legacy = postData?.image;
  if (legacy) return safeString(legacy) || null;
  return null;
}

function safeStats(postData) {
  const s = postData?.stats || {};
  return {
    views: Number(s.views || 0) || 0,
    commentsCount: Number(s.commentsCount || 0) || 0,
    likes: Number(s.likes || 0) || 0,
  };
}

/**
 * 어드민용 게시글 목록 (숨김/공지 포함 전체)
 * - 정렬: 공지 우선, 그 다음 createdAt desc
 */
export async function listAdminCommunityPosts() {
  const col = collection(db, "community_posts");
  const snap = await getDocs(query(col, orderBy("createdAt", "desc")));

  const raws = [];
  snap.forEach((d) => raws.push({ id: d.id, ...d.data() }));

  const uniqAuthors = Array.from(
    new Set(
      raws
        .map((p) => safeString(p.authorUid || p.authorId))
        .filter(Boolean)
    )
  );

  const metaByUid = {};
  for (const uid of uniqAuthors) {
    metaByUid[uid] = await getUserPublicMeta(uid);
  }

  const rows = raws.map((p) => {
    const authorUid = safeString(p.authorUid || p.authorId);
    const meta = metaByUid[authorUid] || { name: "", avatar: "" };
    const stats = safeStats(p);

    return {
      id: p.id,
      authorUid,
      authorName: safeString(meta.name) || "(이름없음)",
      authorAvatar: safeString(meta.avatar),
      title: safeString(p.title),
      content: safeString(p.content),
      thumb: pickThumb(p),
      images: Array.isArray(p?.media?.images) ? p.media.images : [],
      views: stats.views,
      likes: stats.likes,
      commentsCount: stats.commentsCount,
      hidden: !!p.hidden,
      hiddenAt: toDate(p.hiddenAt),
      hiddenBy: safeString(p.hiddenBy),
      pinned: !!p.pinned,
      pinnedAt: toDate(p.pinnedAt),
      createdAt: toDate(p.createdAt),
      updatedAt: toDate(p.updatedAt),
    };
  });

  // 공지 우선 → 최신순
  rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });

  return rows;
}

/**
 * 어드민용 게시글 상세 (댓글 포함)
 */
export async function loadAdminCommunityPostDetail(postId) {
  const pid = safeString(postId);
  if (!pid) return { post: null, comments: [] };

  const ref = doc(db, "community_posts", pid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { post: null, comments: [] };

  const data = snap.data() || {};
  const authorUid = safeString(data.authorUid || data.authorId);
  const meta = authorUid ? await getUserPublicMeta(authorUid) : { name: "", avatar: "" };
  const stats = safeStats(data);

  const post = {
    id: snap.id,
    authorUid,
    authorName: safeString(meta.name) || "(이름없음)",
    authorAvatar: safeString(meta.avatar),
    title: safeString(data.title),
    content: safeString(data.content),
    images: Array.isArray(data?.media?.images) ? data.media.images : [],
    thumb: pickThumb(data),
    views: stats.views,
    likes: stats.likes,
    commentsCount: stats.commentsCount,
    hidden: !!data.hidden,
    hiddenAt: toDate(data.hiddenAt),
    hiddenBy: safeString(data.hiddenBy),
    pinned: !!data.pinned,
    pinnedAt: toDate(data.pinnedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };

  const cCol = collection(db, "community_posts", pid, "comments");
  const cs = await getDocs(query(cCol, orderBy("createdAt", "asc")));

  const cRaws = [];
  cs.forEach((d) => cRaws.push({ id: d.id, ...d.data() }));

  const cAuthors = Array.from(
    new Set(
      cRaws
        .map((c) => safeString(c.authorUid || c.authorId))
        .filter(Boolean)
    )
  );

  const cMeta = {};
  for (const uid of cAuthors) {
    cMeta[uid] = await getUserPublicMeta(uid);
  }

  const comments = cRaws.map((c) => {
    const cAuthorUid = safeString(c.authorUid || c.authorId);
    const cm = cMeta[cAuthorUid] || { name: "", avatar: "" };
    return {
      id: c.id,
      authorUid: cAuthorUid,
      authorName: safeString(cm.name) || "(이름없음)",
      authorAvatar: safeString(cm.avatar),
      content: safeString(c.content),
      parentId: c.parentId ? safeString(c.parentId) : null,
      likes: Number(c?.stats?.likes || 0) || 0,
      createdAt: toDate(c.createdAt),
    };
  });

  return { post, comments };
}

/**
 * 게시글 숨김 토글
 */
export async function setCommunityPostHidden({ postId, hidden, byAdmin = "admin" }) {
  const pid = safeString(postId);
  if (!pid) throw new Error("postId가 비어있습니다.");

  const ref = doc(db, "community_posts", pid);
  if (hidden) {
    await updateDoc(ref, {
      hidden: true,
      hiddenAt: serverTimestamp(),
      hiddenBy: safeString(byAdmin) || "admin",
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      hidden: false,
      hiddenAt: deleteField(),
      hiddenBy: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  return { postId: pid, hidden: !!hidden };
}

/**
 * 게시글 공지 고정 토글
 */
export async function setCommunityPostPinned({ postId, pinned, byAdmin = "admin" }) {
  const pid = safeString(postId);
  if (!pid) throw new Error("postId가 비어있습니다.");

  const ref = doc(db, "community_posts", pid);
  if (pinned) {
    await updateDoc(ref, {
      pinned: true,
      pinnedAt: serverTimestamp(),
      pinnedBy: safeString(byAdmin) || "admin",
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      pinned: false,
      pinnedAt: deleteField(),
      pinnedBy: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  return { postId: pid, pinned: !!pinned };
}

/**
 * 어드민이 게시글 삭제 (하드 삭제)
 * - 댓글 서브컬렉션도 함께 삭제 (배치)
 */
export async function deleteCommunityPostByAdmin({ postId }) {
  const pid = safeString(postId);
  if (!pid) throw new Error("postId가 비어있습니다.");

  // 댓글 일괄 삭제
  try {
    const cs = await getDocs(collection(db, "community_posts", pid, "comments"));
    if (!cs.empty) {
      const batch = writeBatch(db);
      cs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn("[adminCommunity] delete comments failed:", e?.message || e);
  }

  // 좋아요 서브컬렉션도 정리
  try {
    const ls = await getDocs(collection(db, "community_posts", pid, "likes"));
    if (!ls.empty) {
      const batch = writeBatch(db);
      ls.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn("[adminCommunity] delete likes failed:", e?.message || e);
  }

  await deleteDoc(doc(db, "community_posts", pid));
  return { postId: pid };
}

/**
 * 어드민이 댓글 삭제
 */
export async function deleteCommunityCommentByAdmin({ postId, commentId }) {
  const pid = safeString(postId);
  const cid = safeString(commentId);
  if (!pid || !cid) throw new Error("postId/commentId가 비어있습니다.");

  await deleteDoc(doc(db, "community_posts", pid, "comments", cid));

  // commentsCount 감소 (best-effort)
  try {
    const ref = doc(db, "community_posts", pid);
    const snap = await getDoc(ref);
    const cur = Number(snap.data()?.stats?.commentsCount || 0) || 0;
    const next = Math.max(0, cur - 1);
    await updateDoc(ref, {
      "stats.commentsCount": next,
      updatedAt: serverTimestamp(),
    });
  } catch {}

  return { postId: pid, commentId: cid };
}
