/* eslint-disable */
// src/services/communityService.js
// 생활체육 매칭 — 커뮤니티 서비스(실데이터)
// - pages에서는 이 서비스만 호출 (DB 직접 접근 금지)

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  startAfter,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { getUserPublicMeta } from "./counterpartService";

function toDate(tsOrIso) {
  if (!tsOrIso) return null;
  if (typeof tsOrIso === "string") {
    const d = new Date(tsOrIso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (tsOrIso?.toDate && typeof tsOrIso.toDate === "function") return tsOrIso.toDate();
  const d = new Date(tsOrIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatKST(when) {
  const d = toDate(when);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function pickThumb(postData) {
  const imgs = postData?.media?.images;
  if (Array.isArray(imgs) && imgs.length > 0) return String(imgs[0] || "").trim() || null;
  const legacy = postData?.image;
  if (legacy) return String(legacy || "").trim() || null;
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

/* =========================
   목록/상세 로더
   ========================= */

export async function loadCommunityList({
  myUid = "",
  limitCount = 30,
  cursor = null,
} = {}) {
  const take = Math.max(1, Math.min(50, Number(limitCount) || 30));

  const baseCol = collection(db, "community_posts");

  let q = query(baseCol, orderBy("createdAt", "desc"), fsLimit(take));
  if (cursor) {
    q = query(baseCol, orderBy("createdAt", "desc"), startAfter(cursor), fsLimit(take));
  }

  const snap = await getDocs(q);

  const raws = [];
  snap.forEach((d) => raws.push({ id: d.id, ...d.data() }));

  const uniqAuthorUids = Array.from(
    new Set(raws.map((p) => String(p.authorUid || p.authorId || "").trim()).filter(Boolean))
  );

  const metaByUid = {};
  for (const uid of uniqAuthorUids) {
    metaByUid[uid] = await getUserPublicMeta(uid);
  }

  const posts = raws.map((p) => {
    const authorUid = String(p.authorUid || p.authorId || "").trim();
    const meta = metaByUid[authorUid] || { name: "상대", avatar: "" };

    const stats = safeStats(p);
    const createdAt = p.createdAt || p.updatedAt || null;

    return {
      id: p.id,
      authorId: authorUid,
      authorName: meta.name || "상대",
      authorAvatar: meta.avatar || "",
      canChat: !!(myUid && authorUid && String(myUid) !== String(authorUid)),
      title: String(p.title || "").trim(),
      content: String(p.content || "").trim(),
      image: pickThumb(p),
      createdAt: formatKST(createdAt),
      views: stats.views,
      commentsCount: stats.commentsCount,
      likes: stats.likes,
    };
  });

  return { posts };
}

export async function loadCommunityPostDetail(postId, { myUid = "" } = {}) {
  if (!postId) return { post: null, comments: [] };

  const ref = doc(db, "community_posts", String(postId));
  const snap = await getDoc(ref);

  if (!snap.exists()) return { post: null, comments: [] };

  const data = snap.data() || {};
  const authorUid = String(data.authorUid || data.authorId || "").trim();
  const authorMeta = authorUid ? await getUserPublicMeta(authorUid) : { name: "상대", avatar: "" };

  const stats = safeStats(data);

  const createdAt = data.createdAt || null;
  const updatedAt = data.updatedAt || null;

  const likedByMe = false;

  const post = {
    id: snap.id,
    authorId: authorUid,
    authorName: authorMeta.name || "상대",
    authorAvatar: authorMeta.avatar || "",
    canChat: !!(myUid && authorUid && String(myUid) !== String(authorUid)),

    title: String(data.title || "").trim(),
    content: String(data.content || "").trim(),
    image: pickThumb(data),

    createdAt: formatKST(createdAt),
    updatedAt: updatedAt ? formatKST(updatedAt) : "",

    views: stats.views,
    likes: stats.likes,
    likedByMe,

    commentsCount: stats.commentsCount,

    isMine: !!(myUid && authorUid && String(myUid) === String(authorUid)),
    canEdit: !!(myUid && authorUid && String(myUid) === String(authorUid)),
    canDelete: !!(myUid && authorUid && String(myUid) === String(authorUid)),
  };

  const cCol = collection(db, "community_posts", snap.id, "comments");
  const cq = query(cCol, orderBy("createdAt", "asc"), fsLimit(200));
  const cs = await getDocs(cq);

  const commentRaws = [];
  cs.forEach((d) => commentRaws.push({ id: d.id, ...d.data() }));

  const uniqCommentAuthors = Array.from(
    new Set(commentRaws.map((c) => String(c.authorUid || c.authorId || "").trim()).filter(Boolean))
  );

  const cMetaByUid = {};
  for (const uid of uniqCommentAuthors) {
    cMetaByUid[uid] = await getUserPublicMeta(uid);
  }

  const comments = commentRaws.map((c) => {
    const cAuthorUid = String(c.authorUid || c.authorId || "").trim();
    const cm = cMetaByUid[cAuthorUid] || { name: "상대", avatar: "" };

    return {
      id: c.id,
      postId: snap.id,
      parentId: c.parentId ? String(c.parentId) : null,
      authorId: cAuthorUid,
      authorName: cm.name || "상대",
      authorAvatar: cm.avatar || "",
      content: String(c.content || "").trim(),
      createdAt: formatKST(c.createdAt || null),
      likes: Number(c?.stats?.likes || 0) || 0,
      likedByMe: false,
      isMine: !!(myUid && cAuthorUid && String(myUid) === String(cAuthorUid)),
      canEdit: !!(myUid && cAuthorUid && String(myUid) === String(cAuthorUid)),
      canDelete: !!(myUid && cAuthorUid && String(myUid) === String(cAuthorUid)),
    };
  });

  return { post, comments };
}

/* =========================
   글쓰기 (텍스트 + 이미지 1장)
   ========================= */


function safeExt(file) {
  const name = String(file?.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = name.slice(dot + 1).replace(/[^a-z0-9]/g, "");
  return ext ? `.${ext}` : "";
}

function buildPostImagePath({ authorUid, postId, file } = {}) {
  const ext = safeExt(file) || ".jpg";
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `community_posts/${authorUid}/${yyyy}/${mm}/${postId}_${rand}${ext}`;
}

async function uploadPostImage({ authorUid, postId, file } = {}) {
  const storage = getStorage();
  const path = buildPostImagePath({ authorUid, postId, file });
  const storageRef = sRef(storage, path);

  const snap = await uploadBytes(storageRef, file, {
    contentType: file?.type || "image/jpeg",
  });

  const url = await getDownloadURL(snap.ref);

  return { url, path, contentType: String(file?.type || "image/jpeg") };
}

export async function createCommunityPost({
  myUid,
  title,
  content,
  imageFiles = [], // ✅ File[]
} = {}) {
  const uid = String(myUid || "").trim();
  if (!uid) throw new Error("createCommunityPost: myUid is required");

  const t = String(title || "").trim();
  const c = String(content || "").trim();

  if (!t) throw new Error("createCommunityPost: title is required");
  if (!c) throw new Error("createCommunityPost: content is required");

  const picked = Array.isArray(imageFiles) ? imageFiles.slice(0, 4) : [];

  // 1) post doc 먼저 만들기
  const refDoc = await addDoc(collection(db, "community_posts"), {
    authorUid: uid,
    title: t,
    content: c,
    media: { images: [] },
    stats: { views: 0, commentsCount: 0, likes: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const postId = refDoc.id;

  // 2) 이미지 업로드(있으면)
  if (picked.length > 0) {
    const urls = [];

    for (const f of picked) {
      if (!f || !String(f?.type || "").startsWith("image/")) continue;
      const up = await uploadPostImage({ authorUid: uid, postId, file: f });
      urls.push(up.url);
    }

    if (urls.length > 0) {
      await updateDoc(doc(db, "community_posts", postId), {
        media: { images: urls },
        updatedAt: serverTimestamp(),
      });
    }
  }

  return { postId };
}
