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
  increment,
  setDoc,
  deleteDoc,
  where,
} from "firebase/firestore";

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { getUserPublicMeta } from "./counterpartService";
import { getMyBlockList } from "./userBlockService";

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

  // 게시글 목록과 내 차단/숨김 목록을 병렬 조회 (서로 의존 없음)
  const [snap, { blockedUids: myBlockedUids, hiddenPostIds: myHiddenPostIds }] =
    await Promise.all([getDocs(q), getMyBlockList(myUid)]);
  const blockedSet = new Set(myBlockedUids);
  const hiddenSet = new Set(myHiddenPostIds);

  const raws = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    if (data.hidden) return; // 어드민이 숨김 처리한 글 제외
    if (hiddenSet.has(d.id)) return; // 내가 신고/숨김한 게시글
    const authorUid = String(data.authorUid || data.authorId || "").trim();
    if (authorUid && blockedSet.has(authorUid)) return; // 내가 차단한 작성자
    raws.push({ id: d.id, ...data });
  });

  const uniqAuthorUids = Array.from(
    new Set(raws.map((p) => String(p.authorUid || p.authorId || "").trim()).filter(Boolean))
  );

  // 작성자 메타는 캐시 + 병렬 조회 (순차 await 시 글 수만큼 round-trip 발생)
  const metaByUid = {};
  await Promise.all(
    uniqAuthorUids.map(async (uid) => {
      metaByUid[uid] = await getUserPublicMeta(uid);
    })
  );

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
      authorTeamName: meta.teamName || "",
      authorClubId: meta.clubId || "",
      canChat: !!(myUid && authorUid && String(myUid) !== String(authorUid)),
      category: String(p.category || "free"),
      title: String(p.title || "").trim(),
      content: String(p.content || "").trim(),
      image: pickThumb(p),
      pinned: !!p.pinned,
      createdAt: formatKST(createdAt),
      createdAtMs: (() => {
        const d = toDate(createdAt);
        return d ? d.getTime() : 0;
      })(),
      views: stats.views,
      commentsCount: stats.commentsCount,
      likes: stats.likes,
    };
  });

  // 공지 우선 → 최신순
  posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.createdAtMs || 0) - (a.createdAtMs || 0);
  });

  // ✅ 페이지네이션 커서 (마지막 원문서) + 더 있음 여부
  const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { posts, cursor: lastDoc, hasMore: snap.size >= take };
}

export async function loadCommunityPostDetail(postId, { myUid = "" } = {}) {
  if (!postId) return { post: null, comments: [] };

  const ref = doc(db, "community_posts", String(postId));

  // 게시글 문서와 내 차단/숨김 목록을 병렬 조회 (서로 의존 없음)
  const [snap, { blockedUids: myBlockedUids, hiddenPostIds: myHiddenPostIds }] =
    await Promise.all([getDoc(ref), getMyBlockList(myUid)]);

  if (!snap.exists()) return { post: null, comments: [] };

  const data = snap.data() || {};
  const authorUid = String(data.authorUid || data.authorId || "").trim();

  // 내가 신고/차단한 사용자·게시글이면 상세 진입 차단 (Apple Guideline 1.2)
  const blockedSet = new Set(myBlockedUids);
  const hiddenSet = new Set(myHiddenPostIds);
  if (hiddenSet.has(String(postId)) || (authorUid && blockedSet.has(authorUid))) {
    return { post: null, comments: [], blocked: true };
  }

  const authorMeta = authorUid ? await getUserPublicMeta(authorUid) : { name: "상대", avatar: "" };

  const stats = safeStats(data);

  const createdAt = data.createdAt || null;
  const updatedAt = data.updatedAt || null;

  // ✅ 내 좋아요 여부 실제 조회 (하드코딩 false 버그 수정)
  let likedByMe = false;
  if (myUid) {
    try {
      likedByMe = (await getDoc(doc(db, "community_posts", snap.id, "likes", String(myUid)))).exists();
    } catch (e) {}
  }

  const post = {
    id: snap.id,
    authorId: authorUid,
    authorName: authorMeta.name || "상대",
    authorAvatar: authorMeta.avatar || "",
    authorTeamName: authorMeta.teamName || "",
    authorClubId: authorMeta.clubId || "",
    canChat: !!(myUid && authorUid && String(myUid) !== String(authorUid)),

    category: String(data.category || "free"),
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
  cs.forEach((d) => {
    const cd = d.data() || {};
    const cAuthor = String(cd.authorUid || cd.authorId || "").trim();
    if (cAuthor && blockedSet.has(cAuthor)) return; // 내가 차단한 사용자 댓글 숨김
    commentRaws.push({ id: d.id, ...cd });
  });

  const uniqCommentAuthors = Array.from(
    new Set(commentRaws.map((c) => String(c.authorUid || c.authorId || "").trim()).filter(Boolean))
  );

  const cMetaByUid = {};
  await Promise.all(
    uniqCommentAuthors.map(async (uid) => {
      cMetaByUid[uid] = await getUserPublicMeta(uid);
    })
  );

  // ✅ 댓글별 내 좋아요 여부 실제 조회 (하드코딩 false 버그 수정)
  const myCommentLikes = {};
  if (myUid) {
    await Promise.all(
      commentRaws.map(async (c) => {
        try {
          myCommentLikes[c.id] = (
            await getDoc(doc(db, "community_posts", snap.id, "comments", c.id, "likes", String(myUid)))
          ).exists();
        } catch (e) {
          myCommentLikes[c.id] = false;
        }
      })
    );
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
      authorTeamName: cm.teamName || "",
      authorClubId: cm.clubId || "",
      content: String(c.content || "").trim(),
      createdAt: formatKST(c.createdAt || null),
      createdAtMs: (() => {
        const d = toDate(c.createdAt || null);
        return d ? d.getTime() : 0;
      })(),
      likes: Number(c?.stats?.likes || 0) || 0,
      likedByMe: !!myCommentLikes[c.id],
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
  category = "free", // ✅ 자유(free) / 상대모집(recruit) / 경기후기(review)
  imageFiles = [], // ✅ File[]
} = {}) {
  const uid = String(myUid || "").trim();
  if (!uid) throw new Error("createCommunityPost: myUid is required");

  const t = String(title || "").trim();
  const c = String(content || "").trim();

  if (!t) throw new Error("createCommunityPost: title is required");
  if (!c) throw new Error("createCommunityPost: content is required");

  const cat = ["free", "recruit", "review"].includes(String(category))
    ? String(category)
    : "free";

  const picked = Array.isArray(imageFiles) ? imageFiles.slice(0, 4) : [];

  // 1) post doc 먼저 만들기
  const refDoc = await addDoc(collection(db, "community_posts"), {
    authorUid: uid,
    title: t,
    content: c,
    category: cat,
    media: { images: [] },
    stats: { views: 0, commentsCount: 0, likes: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const postId = refDoc.id;

  // 2) 이미지 업로드(있으면) — 여러 장을 병렬 업로드 (순차 시 장수만큼 누적 지연)
  if (picked.length > 0) {
    const validFiles = picked.filter(
      (f) => f && String(f?.type || "").startsWith("image/")
    );
    const uploaded = await Promise.all(
      validFiles.map((f) => uploadPostImage({ authorUid: uid, postId, file: f }))
    );
    const urls = uploaded.map((up) => up.url);

    if (urls.length > 0) {
      await updateDoc(doc(db, "community_posts", postId), {
        media: { images: urls },
        updatedAt: serverTimestamp(),
      });
    }
  }

  return { postId };
}

/**
 * ✅ 게시글 수정 (본인만)
 */
export async function updateCommunityPost({ postId, myUid, title, content, category } = {}) {
  const pid = String(postId || "").trim();
  const uid = String(myUid || "").trim();
  if (!pid) throw new Error("updateCommunityPost: postId is required");
  if (!uid) throw new Error("updateCommunityPost: myUid is required");

  const ref = doc(db, "community_posts", pid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("게시글을 찾을 수 없어요.");
  const data = snap.data() || {};
  const author = String(data.authorUid || data.authorId || "").trim();
  if (author !== uid) throw new Error("본인 글만 수정할 수 있어요.");

  const patch = { updatedAt: serverTimestamp() };
  if (title != null) {
    const t = String(title).trim();
    if (!t) throw new Error("제목을 입력해 주세요.");
    patch.title = t;
  }
  if (content != null) {
    const c = String(content).trim();
    if (!c) throw new Error("내용을 입력해 주세요.");
    patch.content = c;
  }
  if (category != null && ["free", "recruit", "review"].includes(String(category))) {
    patch.category = String(category);
  }

  await updateDoc(ref, patch);
  return { ok: true, postId: pid };
}

/**
 * ✅ 게시글 삭제 (본인만)
 */
export async function deleteCommunityPost({ postId, myUid } = {}) {
  const pid = String(postId || "").trim();
  const uid = String(myUid || "").trim();
  if (!pid) throw new Error("deleteCommunityPost: postId is required");
  if (!uid) throw new Error("deleteCommunityPost: myUid is required");

  const ref = doc(db, "community_posts", pid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: true };
  const data = snap.data() || {};
  const author = String(data.authorUid || data.authorId || "").trim();
  if (author !== uid) throw new Error("본인 글만 삭제할 수 있어요.");

  await deleteDoc(ref);
  return { ok: true };
}

/* =========================
   댓글 / 좋아요 (+ 알림)
   ========================= */

async function notifyPostAuthor({ postId, post, actorUid, kind, body }) {
  try {
    const authorUid = String(post?.authorUid || post?.authorId || "").trim();
    if (!authorUid || authorUid === String(actorUid)) return;

    await addDoc(collection(db, "notifications"), {
      kind: "community",
      subType: kind,
      type: kind,
      title:
        kind === "community_comment"
          ? "내 글에 댓글이 달렸어요"
          : "내 글이 좋아요를 받았어요",
      body: String(body || "").slice(0, 140),
      targetType: "USER",
      targetIds: [authorUid],
      actorUid: String(actorUid || ""),
      linkType: "community",
      linkTargetId: postId,
      meta: { postId, deepLink: `/community/${postId}` },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "community",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[community] notifyPostAuthor failed:", e?.message || e);
  }
}

export async function addCommunityComment({ postId, authorUid, content, parentId = null } = {}) {
  const pid = String(postId || "").trim();
  const uid = String(authorUid || "").trim();
  const txt = String(content || "").trim();
  if (!pid) throw new Error("addCommunityComment: postId is required");
  if (!uid) throw new Error("addCommunityComment: authorUid is required");
  if (!txt) throw new Error("addCommunityComment: content is required");

  const postRef = doc(db, "community_posts", pid);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error("post not found");
  const post = postSnap.data() || {};

  const cRef = await addDoc(collection(db, "community_posts", pid, "comments"), {
    authorUid: uid,
    content: txt,
    parentId: parentId ? String(parentId) : null,
    createdAt: serverTimestamp(),
    stats: { likes: 0 },
  });

  try {
    await updateDoc(postRef, {
      "stats.commentsCount": increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {}

  await notifyPostAuthor({
    postId: pid,
    post,
    actorUid: uid,
    kind: "community_comment",
    body: txt,
  });

  return { commentId: cRef.id };
}

export async function toggleCommunityLike({ postId, uid } = {}) {
  const pid = String(postId || "").trim();
  const u = String(uid || "").trim();
  if (!pid) throw new Error("toggleCommunityLike: postId is required");
  if (!u) throw new Error("toggleCommunityLike: uid is required");

  const postRef = doc(db, "community_posts", pid);
  const likeRef = doc(db, "community_posts", pid, "likes", u);

  const [postSnap, likeSnap] = await Promise.all([getDoc(postRef), getDoc(likeRef)]);
  if (!postSnap.exists()) throw new Error("post not found");
  const post = postSnap.data() || {};

  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, {
      "stats.likes": increment(-1),
      updatedAt: serverTimestamp(),
    });
    return { liked: false };
  }

  await setDoc(likeRef, { uid: u, createdAt: serverTimestamp() });
  await updateDoc(postRef, {
    "stats.likes": increment(1),
    updatedAt: serverTimestamp(),
  });

  await notifyPostAuthor({
    postId: pid,
    post,
    actorUid: u,
    kind: "community_like",
    body: String(post?.title || "내 글에 좋아요가 눌렸어요"),
  });

  return { liked: true };
}

export async function toggleCommunityCommentLike({ postId, commentId, uid } = {}) {
  const pid = String(postId || "").trim();
  const cid = String(commentId || "").trim();
  const u = String(uid || "").trim();
  if (!pid) throw new Error("toggleCommunityCommentLike: postId is required");
  if (!cid) throw new Error("toggleCommunityCommentLike: commentId is required");
  if (!u) throw new Error("toggleCommunityCommentLike: uid is required");

  const cRef = doc(db, "community_posts", pid, "comments", cid);
  const likeRef = doc(db, "community_posts", pid, "comments", cid, "likes", u);

  const [cSnap, likeSnap] = await Promise.all([getDoc(cRef), getDoc(likeRef)]);
  if (!cSnap.exists()) throw new Error("comment not found");

  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(cRef, { "stats.likes": increment(-1) });
    return { liked: false };
  }

  await setDoc(likeRef, { uid: u, createdAt: serverTimestamp() });
  await updateDoc(cRef, { "stats.likes": increment(1) });
  return { liked: true };
}

/**
 * ✅ 내가 쓴 게시글 목록
 * - community_posts where authorUid == uid
 * - createdAt desc 정렬 (인덱스 필요할 수 있음)
 */
export async function listMyCommunityPosts({ uid, limitCount = 50 } = {}) {
  const u = String(uid || "").trim();
  if (!u) return { posts: [] };

  const take = Math.max(1, Math.min(100, Number(limitCount) || 50));
  const col = collection(db, "community_posts");

  let snap;
  try {
    snap = await getDocs(query(col, where("authorUid", "==", u), orderBy("createdAt", "desc"), fsLimit(take)));
  } catch (e) {
    // 복합 인덱스 누락 시 fallback: 정렬은 클라에서 처리
    snap = await getDocs(query(col, where("authorUid", "==", u), fsLimit(take)));
  }

  const raws = [];
  snap.forEach((d) => raws.push({ id: d.id, ...d.data() }));

  raws.sort((a, b) => {
    const ad = toDate(a?.createdAt)?.getTime() || 0;
    const bd = toDate(b?.createdAt)?.getTime() || 0;
    return bd - ad;
  });

  const posts = raws.map((p) => {
    const stats = safeStats(p);
    return {
      id: p.id,
      title: String(p.title || "").trim(),
      content: String(p.content || "").trim(),
      image: pickThumb(p),
      createdAt: formatKST(p.createdAt),
      views: stats.views,
      commentsCount: stats.commentsCount,
      likes: stats.likes,
    };
  });

  return { posts };
}

/**
 * ✅ 게시글 조회수 +1
 * - 세션 단위 중복 방지(sessionStorage) — 같은 세션에서 같은 글을 여러번 열어도 1회만 증가
 */
export async function incrementCommunityPostViews(postId) {
  const pid = String(postId || "").trim();
  if (!pid) return { ok: false };

  try {
    const key = "halle.viewedPosts";
    const raw = typeof window !== "undefined" ? window.sessionStorage?.getItem(key) : null;
    const seen = raw ? JSON.parse(raw) : [];
    if (Array.isArray(seen) && seen.includes(pid)) {
      return { ok: true, skipped: true };
    }

    await updateDoc(doc(db, "community_posts", pid), {
      "stats.views": increment(1),
    });

    try {
      const next = Array.isArray(seen) ? [...seen, pid].slice(-200) : [pid];
      window.sessionStorage?.setItem(key, JSON.stringify(next));
    } catch (e) {}

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
