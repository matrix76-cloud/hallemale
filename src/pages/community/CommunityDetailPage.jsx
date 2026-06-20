/* eslint-disable */
// src/pages/CommunityDetailPage.jsx
// 생활체육 매칭 — 커뮤니티 게시글 상세 페이지

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
} from "../../services/communityService";
import { createPostReport } from "../../services/postReportService";
import { blockAuthorAndHidePost } from "../../services/userBlockService";
import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";

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
  padding: 0 0 90px;
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

/* 본문 ↔ 댓글 구분 회색 띠 */
const SectionBand = styled.div`
  height: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0, 0, 0, 0.35)" : "#eceef1"};
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

const AvatarImg = styled.div`
  width: 100%;
  height: 100%;
  background-image: ${({ src }) => (src ? `url(${src})` : "none")};
  background-size: cover;
  background-position: center;
`;

const AuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AuthorName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
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
  padding: 8px 12px 12px;
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

  const inputRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  // 케밥 메뉴
  const [menuOpen, setMenuOpen] = useState(false);

  // 답글 대상 { id(root), authorName }
  const [replyTo, setReplyTo] = useState(null);

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

  const handleToggleLike = async () => {
    if (!myUid) {
      alert("로그인 후 이용해주세요.");
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
      alert("좋아요 처리에 실패했습니다.");
    } finally {
      setLikeBusy(false);
    }
  };

  const handleToggleCommentLike = async (cmt) => {
    if (!myUid) {
      alert("로그인 후 이용해주세요.");
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

  const openReport = () => {
    if (!myUid) {
      alert("로그인 후 이용해주세요.");
      return;
    }
    if (post?.isMine) {
      alert("본인 게시글은 신고할 수 없습니다.");
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
      alert("신고 사유를 입력해주세요.");
      return;
    }
    if (!post || !myUid) return;
    setReportBusy(true);
    try {
      // 1) 관리자에게 신고 접수
      await createPostReport({
        postId: post.id,
        postTitle: post.title,
        postAuthorUid: post.authorId,
        postAuthorNickname: post.authorName,
        reporterUid: String(myUid),
        reporterNickname: String(userDoc?.nickname || userDoc?.name || ""),
        reason,
      });
      // 2) 즉시 본인 피드에서 해당 작성자 + 게시글 숨김 (Apple Guideline 1.2)
      await blockAuthorAndHidePost({
        myUid: String(myUid),
        targetUid: post.authorId,
        postId: post.id,
      });
      setReportOpen(false);
      setReportReason("");
      alert(
        "신고가 접수되었습니다.\n해당 게시글과 작성자의 글은 회원님 피드에서 즉시 숨겨졌으며,\n관리자가 검토 후 조치합니다."
      );
      nav(-1);
    } catch (e) {
      console.error("[CommunityDetailPage] report failed", e);
      alert(e?.message || "신고 접수에 실패했습니다.");
    } finally {
      setReportBusy(false);
    }
  };

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    if (!myUid) {
      alert("로그인 후 이용해주세요.");
      return;
    }
    if (submittingComment) return;
    setSubmittingComment(true);
    try {
      await addCommunityComment({
        postId,
        authorUid: myUid,
        content: text,
        parentId: replyTo?.id || null,
      });
      setCommentText("");
      setReplyTo(null);
      await reload();
    } catch (e) {
      console.error("[CommunityDetailPage] comment failed:", e?.message || e);
      alert("댓글 등록에 실패했습니다.");
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
            <RetryButton type="button" onClick={() => nav(-1)}>
              뒤로
            </RetryButton>
          </div>
        </ErrorBox>
      </PageWrap>
    );
  }

  const commentCount = comments.length;

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
      <CommentAvatar>
        <AvatarImg src={cmt.authorAvatar} />
      </CommentAvatar>

      <CommentBubble>
        <CommentTopRow>
          <CommentAuthorName>{cmt.authorName}</CommentAuthorName>
          <CommentTime>{timeAgo(cmt.createdAtMs) || cmt.createdAt}</CommentTime>
        </CommentTopRow>

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
        </CommentActions>
      </CommentBubble>
    </CommentItem>
  );

  return (
    <PageWrap>
      <Inner>
        <PostCard>
          <AuthorRow>
            <Avatar>
              <AvatarImg src={post.authorAvatar} />
            </Avatar>

            <AuthorInfo>
              <AuthorName>{post.authorName}</AuthorName>
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
                            alert("수정 화면은 추후 구현 예정입니다.");
                          }}
                        >
                          수정
                        </MenuItem>
                        <MenuItem
                          type="button"
                          $danger
                          onClick={() => {
                            setMenuOpen(false);
                            alert("삭제 기능은 추후 구현 예정입니다.");
                          }}
                        >
                          삭제
                        </MenuItem>
                      </>
                    ) : (
                      <MenuItem
                        type="button"
                        $danger
                        onClick={() => {
                          setMenuOpen(false);
                          openReport();
                        }}
                      >
                        신고
                      </MenuItem>
                    )}
                  </Menu>
                </>
              )}
            </KebabWrap>
          </AuthorRow>

          <PostTitle>{post.title}</PostTitle>

          <PostContent>{post.content}</PostContent>

          {post.image && (
            <PostImageBox>
              <PostImage src={post.image} />
            </PostImageBox>
          )}

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

        <SectionBand />

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
            <ReportTitle>게시글 신고 및 작성자 차단</ReportTitle>
            <ReportSub>
              {`신고하시면 이 게시글과 작성자의 모든 글이\n회원님 피드에서 즉시 숨겨집니다.\n관리자가 24시간 이내 검토 후 조치합니다.\n허위 신고 시 서비스 이용이 제한될 수 있습니다.`}
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
                {reportBusy ? "전송중…" : "신고 및 차단"}
              </ReportBtn>
            </ReportActions>
          </ReportModal>
        </ReportOverlay>
      )}
    </PageWrap>
  );
}
