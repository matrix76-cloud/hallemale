/* eslint-disable */
// src/pages/CommunityDetailPage.jsx
// 생활체육 매칭 — 커뮤니티 게시글 상세 페이지

import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { FiHeart, FiMessageCircle, FiMoreVertical, FiCornerUpLeft, FiSend } from "react-icons/fi";
import {
  loadCommunityPostDetail,
  addCommunityComment,
  toggleCommunityLike,
  toggleCommunityCommentLike,
  incrementCommunityPostViews,
  deleteCommunityPost,
  updateCommunityComment,
  deleteCommunityComment,
} from "../../services/communityService";
import { createPostReport } from "../../services/postReportService";
import { blockAuthorAndHidePost } from "../../services/userBlockService";
import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { images } from "../../utils/imageAssets";
import { getPlayerRankMap } from "../../services/rankingService";

/* 실제 프로필 사진만 사용 (기본 앱 로고/defaultAvatar는 '사진 없음'으로 처리) */
const realAvatar = (url) => {
  const u = String(url || "").trim();
  if (!u) return "";
  if (u === images.logo || u === images.defaultAvatar) return "";
  return u;
};

/* =============== 상대시간 헬퍼 =============== */

function timeAgo(ms) {
  if (!ms) return "";
  const diff = Date.now() - Number(ms);
  if (diff < 0) return "방금";
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return "방금";
  if (diff < h) return `${Math.floor(diff / m)}분 전`;
  if (diff < d) return `${Math.floor(diff / h)}시간 전`;
  if (diff < 2 * d) return "어제";
  if (diff < 7 * d) return `${Math.floor(diff / d)}일 전`;
  const date = new Date(Number(ms));
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

/* =============== 레이아웃 =============== */

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors?.bg || "#ffffff"};
  padding: 0 0 calc(90px + env(safe-area-inset-bottom));
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

/* =============== 게시글 카드 =============== */

const PostCard = styled.article`
  background: ${({ theme }) => theme.colors?.card || "#ffffff"};
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 16px 14px;
`;

const AuthorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#e5e7eb"};
  overflow: hidden;
  flex-shrink: 0;
`;

/* 1~3위 선수: 프로필 사진 위 왕관 (아바타는 overflow:hidden이라 밖에서 얹음) */
const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
`;

const CrownOver = styled.img`
  position: absolute;
  top: ${({ $sm }) => ($sm ? "-9px" : "-11px")};
  left: 50%;
  transform: translateX(-50%);
  width: ${({ $sm }) => ($sm ? "15px" : "18px")};
  height: ${({ $sm }) => ($sm ? "15px" : "18px")};
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18));
`;

const AvatarImg = styled.div`
  width: 100%;
  height: 100%;
  background-image: ${({ src }) => (src ? `url(${src})` : "none")};
  background-size: cover;
  background-position: center;
`;

/* 프로필 사진 없을 때: 사람 실루엣 아이콘 */
const AvatarFallback = styled(AvatarPlaceholder)`
  width: 100% !important;
  height: 100% !important;
`;

const AuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

/* 이름 + 팀 소속 한 줄 (이름 오른쪽에 팀명) */
const NameLine = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
`;

const AuthorName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

/* 소속 팀명 (이름 오른쪽 회색) */
const TeamTag = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
`;

const MetaText = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
`;

/* =============== 케밥 메뉴 =============== */

const KebabWrap = styled.div`
  margin-left: auto;
  position: relative;
`;

const KebabBtn = styled.button`
  border: none;
  background: none;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
  font-size: 20px;

  &:active {
    opacity: 0.6;
  }
`;

const MenuBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
`;

const Menu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1201;
  min-width: 120px;
  background: ${({ theme }) => theme.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme.colors?.border || "rgba(0,0,0,0.08)"};
  border-radius: 10px;
  box-shadow: ${({ theme }) =>
    theme.shadows?.card || "0 12px 32px rgba(15, 23, 42, 0.18)"};
  overflow: hidden;
  padding: 4px;
`;

const MenuItem = styled.button`
  width: 100%;
  border: none;
  background: none;
  text-align: left;
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: ${({ $danger, theme }) =>
    $danger
      ? theme.mode === "dark"
        ? "#fca5a5"
        : theme.colors?.danger || "#b91c1c"
      : theme.colors?.textStrong || "#111827"};

  &:active {
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"};
  }
`;

/* =============== 게시글 본문 =============== */

const PostTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  line-height: 1.4;
`;

const PostContent = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors?.textNormal || "#111827"};
  white-space: pre-line;
`;

const PostImageBox = styled.div`
  margin-top: 2px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#e5e7eb"};
  max-height: 280px;
`;

const PostImage = styled.div`
  width: 100%;
  padding-top: 66%;
  background-image: ${({ src }) => (src ? `url(${src})` : "none")};
  background-size: cover;
  background-position: center;
`;

/* 여러 장: 1장=풀 / 2장 이상=2열(4장이면 2열2줄) */
const PostImageGrid = styled.div`
  margin-top: 2px;
  display: grid;
  gap: 6px;
  grid-template-columns: ${({ $count }) => ($count === 1 ? "1fr" : "1fr 1fr")};
`;

const PostImageCell = styled.div`
  position: relative;
  width: 100%;
  padding-top: ${({ $count }) => ($count === 1 ? "62%" : "100%")};
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#e5e7eb"};
`;

const PostImageCellInner = styled.div`
  position: absolute;
  inset: 0;
  background-image: ${({ src }) => (src ? `url(${src})` : "none")};
  background-size: cover;
  background-position: center;
`;

/* =============== 게시글 액션 (하트 / 댓글수) =============== */

const PostStats = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.colors?.border || "rgba(0, 0, 0, 0.08)"};
`;

const StatBtn = styled.button`
  border: none;
  background: none;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: ${({ as }) => (as === "div" ? "default" : "pointer")};
  font-size: 14px;
  font-weight: 500;
  color: ${({ $active, theme }) =>
    $active
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#ef4444"
      : theme.colors?.textWeak || "#6b7280"};

  svg {
    width: 18px;
    height: 18px;
  }

  &:active {
    opacity: 0.7;
  }

  &:disabled {
    cursor: default;
  }
`;

/* =============== 댓글 섹션 =============== */

const CommentSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 0;
`;

const CommentHeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CommentTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

const CommentCount = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
`;

const CommentEmpty = styled.div`
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors?.textWeak || "#9ca3af"};
`;

const CommentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CommentItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

const CommentAvatar = styled(Avatar)`
  width: 26px;
  height: 26px;
`;

const CommentBubble = styled.div`
  flex: 1;
  min-width: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#f9fafb"};
  border-radius: 10px;
  padding: 8px 10px;
`;

const CommentTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
`;

const CommentAuthorName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

const CommentTime = styled.span`
  margin-left: auto;
  font-size: 10px;
  color: ${({ theme }) => theme.colors?.textWeak || "#9ca3af"};
`;

const CommentContent = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors?.textNormal || "#111827"};
  white-space: pre-line;
`;

const CommentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
`;

const CmtActionBtn = styled.button`
  border: none;
  background: none;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: ${({ $active, theme }) =>
    $active
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#ef4444"
      : theme.colors?.textWeak || "#6b7280"};

  svg {
    width: 14px;
    height: 14px;
  }

  &:active {
    opacity: 0.7;
  }
`;

const ReplyIndent = styled.div`
  margin-left: 34px;
`;

/* 댓글 인라인 수정 */
const CommentEditArea = styled.textarea`
  width: 100%;
  min-height: 54px;
  margin: 2px 0 4px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.12)"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.card : "#ffffff"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  }
`;

/* =============== 하단 입력 바 =============== */

const BottomBar = styled.div`
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.card : "#f9fafb"};
  border-top: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.04)"};
`;

const ReplyContext = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 0;
  font-size: 11px;
  color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
`;

const ReplyCancel = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  padding: 0;
  font-size: 11px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
`;

const CommentInput = styled.input`
  flex: 1;
  border-radius: 999px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.08)"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  padding: 10px 14px;
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  }
`;

const SendIconBtn = styled.button`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  color: #ffffff;
  cursor: pointer;

  svg {
    width: 18px;
    height: 18px;
  }

  &:active {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

/* =============== 로딩/에러 =============== */

const CenterBox = styled.div`
  min-height: calc(100vh - 90px);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ErrorBox = styled.div`
  min-height: calc(100vh - 90px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
  padding: 24px 12px;
`;

const RetryButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors?.border || "rgba(0, 0, 0, 0.08)"};
  background: ${({ theme }) => theme.colors?.card || "#fff"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;

  &:active {
    opacity: 0.8;
  }
`;

/* =============== 신고 모달 =============== */

const ReportOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
`;

const ReportModal = styled.div`
  width: min(440px, 92vw);
  background: ${({ theme }) => theme.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "transparent"};
  border-radius: 12px;
  padding: 18px 18px 16px;
  box-shadow: ${({ theme }) =>
    theme.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
`;

const ReportTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  margin-bottom: 4px;
`;

const ReportSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
  margin-bottom: 12px;
  line-height: 1.5;
  white-space: pre-line;
`;

const ReportTextarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  }
`;

const ReportActions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const ReportBtn = styled.button`
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors?.border || "#e5e7eb"};
  background: ${({ $danger, theme }) =>
    $danger
      ? theme.mode === "dark"
        ? "rgba(248,113,113,0.18)"
        : "#fef2f2"
      : theme.colors?.card || "#ffffff"};
  color: ${({ $danger, theme }) =>
    $danger
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#b91c1c"
      : theme.colors?.textStrong || "#111827"};
  ${({ $danger, theme }) =>
    $danger
      ? `border-color: ${
          theme.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"
        };`
      : ""}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/* =============== 컴포넌트 =============== */

export default function CommunityDetailPage() {
  const nav = useNavigate();
  const { postId } = useParams();

  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  // 사용자(작성자/댓글) 클릭 → 선수 프로필 상세
  const goPlayer = (uid) => {
    const id = String(uid || "").trim();
    if (id) nav(`/player/${id}`);
  };

  const inputRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);

  // 선수 전체 랭킹(userId→등수) — 1~3위면 프로필 사진 위 왕관
  const [playerRankMap, setPlayerRankMap] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  // 케밥 메뉴
  const [menuOpen, setMenuOpen] = useState(false);

  // 답글 대상 { id(root), authorName }
  const [replyTo, setReplyTo] = useState(null);

  // 내 댓글 인라인 수정
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // 신고 모달
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { post: detail, comments: list } = await loadCommunityPostDetail(postId, { myUid });
      setPost(detail || null);
      setComments(list || []);
    } catch (e) {
      console.error("[CommunityDetailPage] load failed:", e?.code, e?.message, e);
      setPost(null);
      setComments([]);
      setLoadError("게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await reload();
    })();
    return () => {
      alive = false;
    };
  }, [postId, myUid]);

  // ✅ 게시글 진입 시 조회수 +1 (세션당 1회)
  useEffect(() => {
    if (!postId) return;
    incrementCommunityPostViews(postId).catch(() => {});
  }, [postId]);

  // 선수 전체 랭킹 로드 (1~3위 왕관 표시용)
  useEffect(() => {
    let alive = true;
    getPlayerRankMap()
      .then((m) => { if (alive) setPlayerRankMap(m); })
      .catch(() => { if (alive) setPlayerRankMap(null); });
    return () => { alive = false; };
  }, []);

  const handleToggleLike = async () => {
    if (!myUid) {
      showAlert("로그인 후 이용해주세요.");
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const prev = post;
    const nextLiked = !post.likedByMe;
    setPost({
      ...post,
      likedByMe: nextLiked,
      likes: Math.max(0, (post.likes || 0) + (nextLiked ? 1 : -1)),
    });
    try {
      await toggleCommunityLike({ postId, uid: myUid });
    } catch (e) {
      console.error("[CommunityDetailPage] like failed:", e?.message || e);
      setPost(prev);
      showAlert("좋아요 처리에 실패했습니다.");
    } finally {
      setLikeBusy(false);
    }
  };

  const handleToggleCommentLike = async (cmt) => {
    if (!myUid) {
      showAlert("로그인 후 이용해주세요.");
      return;
    }
    const nextLiked = !cmt.likedByMe;
    setComments((prev) =>
      prev.map((c) =>
        c.id === cmt.id
          ? {
              ...c,
              likedByMe: nextLiked,
              likes: Math.max(0, (c.likes || 0) + (nextLiked ? 1 : -1)),
            }
          : c
      )
    );
    try {
      await toggleCommunityCommentLike({ postId, commentId: cmt.id, uid: myUid });
    } catch (e) {
      console.error("[CommunityDetailPage] comment like failed:", e?.message || e);
      setComments((prev) =>
        prev.map((c) =>
          c.id === cmt.id
            ? { ...c, likedByMe: cmt.likedByMe, likes: cmt.likes }
            : c
        )
      );
    }
  };

  const startReply = (cmt) => {
    setReplyTo({
      id: cmt.parentId || cmt.id,
      authorName: cmt.authorName,
    });
    inputRef.current?.focus();
  };

  const startEditComment = (cmt) => {
    setEditingId(cmt.id);
    setEditText(cmt.content || "");
  };

  const cancelEditComment = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEditComment = async (cmt) => {
    const txt = String(editText || "").trim();
    if (!txt) return;
    if (txt === cmt.content) {
      cancelEditComment();
      return;
    }
    const prev = comments;
    setComments((p) => p.map((c) => (c.id === cmt.id ? { ...c, content: txt } : c)));
    cancelEditComment();
    try {
      await updateCommunityComment({ postId, commentId: cmt.id, myUid, content: txt });
    } catch (e) {
      console.error("[CommunityDetailPage] comment edit failed:", e?.message || e);
      setComments(prev);
      showAlert(e?.message || "댓글 수정에 실패했습니다.");
    }
  };

  const handleDeleteComment = async (cmt) => {
    if (!await showConfirm("이 댓글을 삭제할까요?")) return;
    const prev = comments;
    setComments((p) => p.filter((c) => c.id !== cmt.id));
    try {
      await deleteCommunityComment({ postId, commentId: cmt.id, myUid });
    } catch (e) {
      console.error("[CommunityDetailPage] comment delete failed:", e?.message || e);
      setComments(prev);
      showAlert(e?.message || "댓글 삭제에 실패했습니다.");
    }
  };

  const openReport = () => {
    if (!myUid) {
      showAlert("로그인 후 이용해주세요.");
      return;
    }
    if (post?.isMine) {
      showAlert("본인 게시글은 신고할 수 없습니다.");
      return;
    }
    setReportReason("");
    setReportOpen(true);
  };

  const closeReport = () => {
    if (reportBusy) return;
    setReportOpen(false);
    setReportReason("");
  };

  const handleSubmitReport = async () => {
    const reason = String(reportReason || "").trim();
    if (!reason) {
      showAlert("신고 사유를 입력해주세요.");
      return;
    }
    if (!post || !myUid) return;
    setReportBusy(true);
    try {
      // 관리자에게 신고 접수 (신고만 — 차단은 별도 메뉴에서 처리)
      await createPostReport({
        postId: post.id,
        postTitle: post.title,
        postAuthorUid: post.authorId,
        postAuthorNickname: post.authorName,
        reporterUid: String(myUid),
        reporterNickname: String(userDoc?.nickname || userDoc?.name || ""),
        reason,
      });
      setReportOpen(false);
      setReportReason("");
      showAlert("신고가 접수되었습니다.\n관리자가 검토 후 조치합니다.");
    } catch (e) {
      console.error("[CommunityDetailPage] report failed", e);
      showAlert(e?.message || "신고 접수에 실패했습니다.");
    } finally {
      setReportBusy(false);
    }
  };

  // 작성자 차단 — 해당 작성자의 게시글/댓글을 본인 피드에서 숨김 (신고와 분리)
  const handleBlock = async () => {
    if (!myUid) {
      showAlert("로그인 후 이용해주세요.");
      return;
    }
    if (post?.isMine) {
      showAlert("본인은 차단할 수 없습니다.");
      return;
    }
    if (!post) return;
    const who = post.authorName ? `'${post.authorName}'님` : "이 작성자";
    if (
      !await showConfirm(
        `${who}을 차단할까요?\n차단하면 이 작성자의 게시글과 댓글이\n회원님 피드에서 더 이상 보이지 않습니다.`
      )
    )
      return;
    try {
      await blockAuthorAndHidePost({
        myUid: String(myUid),
        targetUid: post.authorId,
        postId: post.id,
      });
      showAlert("차단했습니다.\n이 작성자의 글은 회원님 피드에서 숨겨집니다.");
      if (window.history.length > 1) nav(-1);
      else nav("/community", { replace: true });
    } catch (e) {
      console.error("[CommunityDetailPage] block failed", e);
      showAlert(e?.message || "차단에 실패했습니다.");
    }
  };

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    if (!myUid) {
      showAlert("로그인 후 이용해주세요.");
      return;
    }
    if (submittingComment) return;

    // 낙관적 추가: 서버 응답을 기다리지 않고 즉시 화면에 댓글 표시 (등록 후 전체 재조회 제거)
    const tempId = `temp-${Date.now()}`;
    const parentId = replyTo?.id || null;
    const prevReplyTo = replyTo;
    const optimistic = {
      id: tempId,
      postId,
      parentId,
      authorId: myUid,
      authorName: userDoc?.nickname || userDoc?.name || "나",
      authorAvatar: userDoc?.avatarUrl || "",
      content: text,
      createdAt: "",
      createdAtMs: Date.now(),
      likes: 0,
      likedByMe: false,
      isMine: true,
      canEdit: true,
      canDelete: true,
    };

    setComments((prev) => [...prev, optimistic]);
    setCommentText("");
    setReplyTo(null);
    setSubmittingComment(true);

    try {
      const { commentId } = await addCommunityComment({
        postId,
        authorUid: myUid,
        content: text,
        parentId,
      });
      // 임시 id → 실제 id 교체
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, id: commentId } : c))
      );
    } catch (e) {
      console.error("[CommunityDetailPage] comment failed:", e?.message || e);
      // 롤백: 낙관적 댓글 제거 + 입력값/답글대상 복원
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentText(text);
      setReplyTo(prevReplyTo);
      showAlert("댓글 등록에 실패했습니다.");
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <PageWrap>
        <CenterBox>
          <Spinner />
        </CenterBox>
      </PageWrap>
    );
  }

  if (!post) {
    return (
      <PageWrap>
        <ErrorBox>
          <div>{loadError || "게시글이 존재하지 않습니다."}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <RetryButton type="button" onClick={reload}>
              다시 시도
            </RetryButton>
            <RetryButton type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/community", { replace: true }))}>
              뒤로
            </RetryButton>
          </div>
        </ErrorBox>
      </PageWrap>
    );
  }

  const commentCount = comments.length;
  const postRank = playerRankMap?.get(String(post.authorId || "")) || null;

  // 댓글 트리: 최상위 댓글 + parentId로 묶인 답글
  const rootComments = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parentId) {
      (acc[c.parentId] = acc[c.parentId] || []).push(c);
    }
    return acc;
  }, {});

  const renderComment = (cmt, replyCount) => (
    <CommentItem>
      <AvatarWrap
        onClick={() => goPlayer(cmt.authorId)}
        style={{ cursor: "pointer" }}
      >
        {(() => {
          const cRank = playerRankMap?.get(String(cmt.authorId || "")) || null;
          return cRank && cRank <= 3 ? (
            <CrownOver $sm src={images.logo} alt={`${cRank}위`} />
          ) : null;
        })()}
        <CommentAvatar>
          {realAvatar(cmt.authorAvatar) ? (
            <AvatarImg src={realAvatar(cmt.authorAvatar)} />
          ) : (
            <AvatarFallback />
          )}
        </CommentAvatar>
      </AvatarWrap>

      <CommentBubble>
        <CommentTopRow>
          <CommentAuthorName
            onClick={() => goPlayer(cmt.authorId)}
            style={{ cursor: "pointer" }}
          >
            {cmt.authorName}
          </CommentAuthorName>
          {cmt.authorTeamName ? <TeamTag>{cmt.authorTeamName}</TeamTag> : null}
          <CommentTime>{timeAgo(cmt.createdAtMs) || cmt.createdAt}</CommentTime>
        </CommentTopRow>

        {editingId === cmt.id ? (
          <>
            <CommentEditArea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
            />
            <CommentActions>
              <CmtActionBtn type="button" onClick={() => saveEditComment(cmt)}>
                저장
              </CmtActionBtn>
              <CmtActionBtn type="button" onClick={cancelEditComment}>
                취소
              </CmtActionBtn>
            </CommentActions>
          </>
        ) : (
          <>
            <CommentContent>{cmt.content}</CommentContent>

            <CommentActions>
              <CmtActionBtn
                type="button"
                $active={cmt.likedByMe}
                onClick={() => handleToggleCommentLike(cmt)}
              >
                <FiHeart style={{ fill: cmt.likedByMe ? "currentColor" : "none" }} />
                <span>{cmt.likes || 0}</span>
              </CmtActionBtn>

              <CmtActionBtn type="button" onClick={() => startReply(cmt)}>
                <FiCornerUpLeft />
                <span>{replyCount > 0 ? `답글 ${replyCount}` : "답글"}</span>
              </CmtActionBtn>

              {cmt.isMine && !String(cmt.id).startsWith("temp-") && (
                <>
                  <CmtActionBtn type="button" onClick={() => startEditComment(cmt)}>
                    수정
                  </CmtActionBtn>
                  <CmtActionBtn type="button" onClick={() => handleDeleteComment(cmt)}>
                    삭제
                  </CmtActionBtn>
                </>
              )}
            </CommentActions>
          </>
        )}
      </CommentBubble>
    </CommentItem>
  );

  return (
    <PageWrap>
      <Inner>
        <PostCard>
          <AuthorRow>
            <AvatarWrap
              onClick={() => goPlayer(post.authorId)}
              style={{ cursor: "pointer" }}
            >
              {postRank && postRank <= 3 ? (
                <CrownOver src={images.logo} alt={`${postRank}위`} />
              ) : null}
              <Avatar>
                {realAvatar(post.authorAvatar) ? (
                  <AvatarImg src={realAvatar(post.authorAvatar)} />
                ) : (
                  <AvatarFallback />
                )}
              </Avatar>
            </AvatarWrap>

            <AuthorInfo>
              <NameLine onClick={() => goPlayer(post.authorId)}>
                <AuthorName>{post.authorName}</AuthorName>
                {post.authorTeamName ? <TeamTag>{post.authorTeamName}</TeamTag> : null}
              </NameLine>
              <MetaText>{post.createdAt}</MetaText>
            </AuthorInfo>

            <KebabWrap>
              <KebabBtn
                type="button"
                aria-label="더보기"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <FiMoreVertical />
              </KebabBtn>

              {menuOpen && (
                <>
                  <MenuBackdrop onClick={() => setMenuOpen(false)} />
                  <Menu>
                    {post.isMine ? (
                      <>
                        <MenuItem
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            nav("/community/write", {
                              state: {
                                editPostId: post.id,
                                initTitle: post.title,
                                initContent: post.content,
                                initCategory: post.category || "free",
                              },
                            });
                          }}
                        >
                          수정
                        </MenuItem>
                        <MenuItem
                          type="button"
                          $danger
                          onClick={async () => {
                            setMenuOpen(false);
                            if (!await showConfirm("이 게시글을 삭제할까요?")) return;
                            try {
                              await deleteCommunityPost({ postId: post.id, myUid });
                              showAlert("삭제했어요.");
                              nav("/community", { replace: true });
                            } catch (e) {
                              showAlert(e?.message || "삭제에 실패했어요.");
                            }
                          }}
                        >
                          삭제
                        </MenuItem>
                      </>
                    ) : (
                      <>
                        <MenuItem
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            openReport();
                          }}
                        >
                          신고
                        </MenuItem>
                        <MenuItem
                          type="button"
                          $danger
                          onClick={() => {
                            setMenuOpen(false);
                            handleBlock();
                          }}
                        >
                          차단
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </>
              )}
            </KebabWrap>
          </AuthorRow>

          <PostTitle>{post.title}</PostTitle>

          <PostContent>{post.content}</PostContent>

          {Array.isArray(post.images) && post.images.length > 0 ? (
            <PostImageGrid $count={post.images.length}>
              {post.images.map((src, i) => (
                <PostImageCell key={`${i}-${src}`} $count={post.images.length}>
                  <PostImageCellInner src={src} />
                </PostImageCell>
              ))}
            </PostImageGrid>
          ) : post.image ? (
            <PostImageBox>
              <PostImage src={post.image} />
            </PostImageBox>
          ) : null}

          <PostStats>
            <StatBtn
              type="button"
              $active={post.likedByMe}
              onClick={handleToggleLike}
              disabled={likeBusy}
            >
              <FiHeart style={{ fill: post.likedByMe ? "currentColor" : "none" }} />
              <span>{post.likes || 0}</span>
            </StatBtn>

            <StatBtn as="div">
              <FiMessageCircle />
              <span>{commentCount}</span>
            </StatBtn>
          </PostStats>
        </PostCard>

        <CommentSection>
          <CommentHeaderRow>
            <CommentTitle>댓글</CommentTitle>
            <CommentCount>{commentCount}</CommentCount>
          </CommentHeaderRow>

          {commentCount === 0 && (
            <CommentEmpty>첫 댓글을 남겨보세요</CommentEmpty>
          )}

          <CommentList>
            {rootComments.map((cmt) => {
              const replies = repliesByParent[cmt.id] || [];
              return (
                <React.Fragment key={cmt.id}>
                  {renderComment(cmt, replies.length)}
                  {replies.map((rep) => (
                    <ReplyIndent key={rep.id}>
                      {renderComment(rep, 0)}
                    </ReplyIndent>
                  ))}
                </React.Fragment>
              );
            })}
          </CommentList>
        </CommentSection>
      </Inner>

      <BottomBar>
        {replyTo && (
          <ReplyContext>
            <span>↳ {replyTo.authorName}님에게 답글</span>
            <ReplyCancel type="button" onClick={() => setReplyTo(null)}>
              취소
            </ReplyCancel>
          </ReplyContext>
        )}
        <InputRow>
          <CommentInput
            ref={inputRef}
            placeholder={
              replyTo
                ? `${replyTo.authorName}님에게 답글 남기기`
                : `${post.authorName}님에게 댓글 남기기`
            }
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent?.isComposing) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            disabled={submittingComment}
          />
          <SendIconBtn
            type="button"
            aria-label="댓글 등록"
            onClick={handleSubmitComment}
            disabled={!commentText.trim() || submittingComment}
          >
            <FiSend />
          </SendIconBtn>
        </InputRow>
      </BottomBar>

      {reportOpen && (
        <ReportOverlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReport();
          }}
        >
          <ReportModal onClick={(e) => e.stopPropagation()}>
            <ReportTitle>게시글 신고</ReportTitle>
            <ReportSub>
              {`신고 사유를 입력해주세요.\n관리자가 24시간 이내 검토 후 조치합니다.\n허위 신고 시 서비스 이용이 제한될 수 있습니다.\n\n작성자의 글을 안 보이게 하려면 '차단'을 이용해주세요.`}
            </ReportSub>

            <ReportTextarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="예: 욕설/비방, 음란성, 광고/스팸, 사기 의심 등"
              disabled={reportBusy}
              autoFocus
            />

            <ReportActions>
              <ReportBtn type="button" onClick={closeReport} disabled={reportBusy}>
                취소
              </ReportBtn>
              <ReportBtn
                type="button"
                $danger
                onClick={handleSubmitReport}
                disabled={reportBusy || !reportReason.trim()}
              >
                {reportBusy ? "전송중…" : "신고"}
              </ReportBtn>
            </ReportActions>
          </ReportModal>
        </ReportOverlay>
      )}
    </PageWrap>
  );
}
