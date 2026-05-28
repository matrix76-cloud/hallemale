/* eslint-disable */
// src/pages/CommunityDetailPage.jsx
// 생활체육 매칭 — 커뮤니티 게시글 상세 페이지

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import {
  loadCommunityPostDetail,
  addCommunityComment,
  toggleCommunityLike,
  incrementCommunityPostViews,
} from "../../services/communityService";
import { createPostReport } from "../../services/postReportService";
import { blockAuthorAndHidePost } from "../../services/userBlockService";
import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";

/* =============== 레이아웃 =============== */

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors?.bg || "#ffffff"};
  padding: 12px 0 90px;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/* =============== 헤더 / 뒤로가기 =============== */

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BackButton = styled.button`
  border: none;
  background: none;
  padding: 4px 6px;
  font-size: 14px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};

  &:active {
    opacity: 0.7;
  }
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

/* =============== 게시글 카드 =============== */

const PostCard = styled.article`
  background: ${({ theme }) => theme.colors?.card || "#ffffff"};
  display: flex;
  flex-direction: column;
  gap: 10px;
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

const ChatBadge = styled.button`
  margin-left: auto;
  border: none;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : (theme.colors?.primarySoft || "#eef2ff")};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : (theme.colors?.primary || "#4f46e5")};

  &:active {
    opacity: 0.7;
  }
`;

const PostTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  line-height: 1.4;
`;

const PostContent = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors?.textNormal || "#111827"};
  white-space: pre-line;
`;

const PostImageBox = styled.div`
  margin-top: 4px;
  border-radius: 8px;
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

const PostMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
`;

const Dot = styled.span`
  &::before {
    content: "·";
    margin: 0 2px;
  }
`;

const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
`;

const LikeButton = styled.button`
  border: none;
  background: ${({ liked, theme }) =>
    liked
      ? theme.mode === "dark"
        ? "rgba(248,113,113,0.16)"
        : "#fee2e2"
      : theme.mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)"};
  color: ${({ liked, theme }) =>
    liked
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#b91c1c"
      : theme.colors?.textNormal || "#111827"};
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;

  &:active {
    opacity: 0.7;
  }
`;

const ActionText = styled.span`
  font-size: 11px;
  color: inherit;
`;

/* =============== 댓글 섹션 =============== */

const CommentSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CommentHeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CommentTitle = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

const CommentCount = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
`;

const CommentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  border-radius: 8px;
  padding: 6px 8px;
`;

const CommentAuthorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
`;

const CommentAuthorName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
`;

const CommentMeta = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors?.textWeak || "#9ca3af"};
`;

const CommentContent = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors?.textNormal || "#111827"};
  white-space: pre-line;
`;

const ReplyTag = styled.span`
  display: inline-block;
  margin-right: 4px;
  font-size: 10px;
  color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
`;

const ReplyIndent = styled.div`
  margin-left: 26px;
`;

/* =============== 댓글 입력 바 (목업용) =============== */

const CommentInputBar = styled.div`
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 8px 12px 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.card : "#f9fafb"};
  border-top: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.04)"};
  display: flex;
  gap: 8px;
`;

const CommentInput = styled.input`
  flex: 1;
  border-radius: 999px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.border : "rgba(0, 0, 0, 0.08)"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  padding: 8px 12px;
  font-size: 12px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  }
`;

const CommentSendButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ theme }) => theme.colors?.primary || "#4f46e5"};
  color: #ffffff;
  cursor: pointer;

  &:active {
    opacity: 0.8;
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

/* =============== 신고 =============== */

const ReportRow = styled.div`
  margin-top: 8px;
  padding: 0 4px 4px;
  display: flex;
  justify-content: center;
`;

const ReportLink = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors?.textWeak || "#6b7280"};
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
  padding: 8px 12px;

  &:hover {
    color: ${({ theme }) =>
      theme.mode === "dark" ? "#fca5a5" : theme.colors?.danger || "#b91c1c"};
  }
`;

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

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

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
      console.log("[CommunityDetailPage] detail:", detail, list);
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
      await addCommunityComment({ postId, authorUid: myUid, content: text });
      setCommentText("");
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

            {post.canChat && (
              <ChatBadge
                type="button"
                onClick={() => alert("채팅방 연결은 추후 연동 예정입니다.")}
              >
                1:1 채팅
              </ChatBadge>
            )}
          </AuthorRow>

          <PostTitle>{post.title}</PostTitle>

          {post.image && (
            <PostImageBox>
              <PostImage src={post.image} />
            </PostImageBox>
          )}

          <PostContent>{post.content}</PostContent>

          <PostMetaRow>
            <span>조회 {post.views}</span>
            <Dot />
            <span>좋아요 {post.likes}</span>
            <Dot />
            <span>댓글 {commentCount}</span>
          </PostMetaRow>

          <ActionsRow>
            <LikeButton
              type="button"
              liked={post.likedByMe}
              onClick={handleToggleLike}
              disabled={likeBusy}
            >
              <span>{post.likedByMe ? "♥" : "♡"}</span>
              <ActionText>좋아요</ActionText>
            </LikeButton>

            {post.isMine && (
              <>
                <LikeButton
                  type="button"
                  onClick={() => alert("수정 화면은 추후 구현 예정입니다.")}
                >
                  <ActionText>수정</ActionText>
                </LikeButton>
                <LikeButton
                  type="button"
                  onClick={() => alert("삭제 기능은 추후 구현 예정입니다.")}
                >
                  <ActionText>삭제</ActionText>
                </LikeButton>
              </>
            )}
          </ActionsRow>

          {!post.isMine && (
            <ReportRow>
              <ReportLink type="button" onClick={openReport}>
                🚩 신고 및 작성자 차단
              </ReportLink>
            </ReportRow>
          )}
        </PostCard>

        <CommentSection>
          <CommentHeaderRow>
            <CommentTitle>댓글</CommentTitle>
            <CommentCount>{commentCount}개</CommentCount>
          </CommentHeaderRow>

          <CommentList>
            {comments.map((cmt) => {
              const isReply = !!cmt.parentId;

              const content = (
                <CommentItem key={cmt.id}>
                  <CommentAvatar>
                    <AvatarImg src={cmt.authorAvatar} />
                  </CommentAvatar>

                  <CommentBubble>
                    <CommentAuthorRow>
                      <CommentAuthorName>{cmt.authorName}</CommentAuthorName>
                      <CommentMeta>{cmt.createdAt}</CommentMeta>
                    </CommentAuthorRow>

                    <CommentContent>
                      {isReply && <ReplyTag>↳ 답글</ReplyTag>}
                      {cmt.content}
                    </CommentContent>
                  </CommentBubble>
                </CommentItem>
              );

              if (isReply) {
                return <ReplyIndent key={cmt.id}>{content}</ReplyIndent>;
              }
              return content;
            })}
          </CommentList>
        </CommentSection>
      </Inner>

      <CommentInputBar>
        <CommentInput
          placeholder="댓글을 입력하세요"
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
        <CommentSendButton
          type="button"
          onClick={handleSubmitComment}
          disabled={!commentText.trim() || submittingComment}
        >
          {submittingComment ? "등록중" : "등록"}
        </CommentSendButton>
      </CommentInputBar>

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
