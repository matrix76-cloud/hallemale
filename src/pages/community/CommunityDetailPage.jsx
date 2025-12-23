/* eslint-disable */
// src/pages/CommunityDetailPage.jsx
// 생활체육 매칭 — 커뮤니티 게시글 상세 페이지

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { loadCommunityPostDetail } from "../../services/communityService";
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
  color: ${({ theme }) => theme.colors?.text || "#111827"};

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
  background: #ffffff;
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
  background: #e5e7eb;
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
  color: ${({ theme }) => theme.colors?.muted || "#6b7280"};
`;

const ChatBadge = styled.button`
  margin-left: auto;
  border: none;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  background: ${({ theme }) => theme.colors?.primarySoft || "#eef2ff"};
  color: ${({ theme }) => theme.colors?.primary || "#4f46e5"};

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
  color: ${({ theme }) => theme.colors?.text || "#111827"};
  white-space: pre-line;
`;

const PostImageBox = styled.div`
  margin-top: 4px;
  border-radius: 10px;
  overflow: hidden;
  background: #e5e7eb;
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
  color: ${({ theme }) => theme.colors?.muted || "#6b7280"};
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
  background: ${({ liked }) => (liked ? "#fee2e2" : "rgba(0,0,0,0.04)")};
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
  color: ${({ theme }) => theme.colors?.text || "#111827"};
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
  color: ${({ theme }) => theme.colors?.muted || "#6b7280"};
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
  background: #f9fafb;
  border-radius: 10px;
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
  color: ${({ theme }) => theme.colors?.muted || "#9ca3af"};
`;

const CommentContent = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors?.text || "#111827"};
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
  background: #f9fafb;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  gap: 8px;
`;

const CommentInput = styled.input`
  flex: 1;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
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
  color: ${({ theme }) => theme.colors?.muted || "#6b7280"};
  padding: 24px 12px;
`;

const RetryButton = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;

  &:active {
    opacity: 0.8;
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
              onClick={() => alert("좋아요 토글은 추후 API 연동 예정입니다.")}
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
        <CommentInput placeholder="댓글을 입력하세요 (목업)" />
        <CommentSendButton
          type="button"
          onClick={() => alert("댓글 작성은 추후 API 연동 예정입니다.")}
        >
          등록
        </CommentSendButton>
      </CommentInputBar>
    </PageWrap>
  );
}
