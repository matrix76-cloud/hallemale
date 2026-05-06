/* eslint-disable */
// src/pages/admin/AdminCommunityPostDetailPage.jsx
// 어드민 - 커뮤니티 게시글 상세
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  loadAdminCommunityPostDetail,
  setCommunityPostHidden,
  setCommunityPostPinned,
  deleteCommunityPostByAdmin,
  deleteCommunityCommentByAdmin,
} from "../../services/adminCommunityService";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const BackBtn = styled.button`
  height: 32px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 14px;
  cursor: pointer;
  background: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2";
    }
    if ($variant === "primary") return theme?.colors?.primary || "#4f46e5";
    return theme?.colors?.card || "#ffffff";
  }};
  color: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "#fca5a5" : "#b91c1c";
    }
    if ($variant === "primary") return "#ffffff";
    return theme?.colors?.textStrong || "#111827";
  }};
  ${({ $variant, theme }) => {
    if ($variant === "danger") {
      const c = theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca";
      return `border-color: ${c};`;
    }
    if ($variant === "primary") return "border-color: transparent;";
    return "";
  }}

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const PostHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PostTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  ${({ $tone, theme }) => {
    if ($tone === "pin") {
      return theme?.mode === "dark"
        ? `background: rgba(99,102,241,0.18); color: #c7d2fe;`
        : `background: #eef2ff; color: #4338ca;`;
    }
    if ($tone === "hide") {
      return theme?.mode === "dark"
        ? `background: rgba(148,163,184,0.16); color: #cbd5e1;`
        : `background: #f1f5f9; color: #64748b;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(16,185,129,0.16); color: #6ee7b7;`
      : `background: #ecfdf5; color: #047857;`;
  }}
`;

const MetaRow = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  flex-wrap: wrap;
`;

const Avatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: #e5e7eb url(${({ $src }) => $src || ""}) center/cover no-repeat;
  flex-shrink: 0;
`;

const AuthorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AuthorName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const AuthorMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`;

const Stats = styled.div`
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Body = styled.div`
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Images = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
`;

const ImgBox = styled.a`
  display: block;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  background: #f1f5f9 url(${({ $src }) => $src || ""}) center/cover no-repeat;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const CommentRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.divider || "#f3f4f6"};
  align-items: flex-start;

  &:last-child {
    border-bottom: none;
  }
`;

const CommentBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CommentMeta = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const CommentName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const CommentText = styled.div`
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const CommentActions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const SmallDelBtn = styled.button`
  height: 26px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 0 8px;
  cursor: pointer;
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2"};
  color: ${({ theme }) => (theme?.mode === "dark" ? "#fca5a5" : "#b91c1c")};
`;

const EmptyComments = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  padding: 20px 0;
  text-align: center;
`;

const ErrorText = styled.div`
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: #b91c1c;
`;

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminCommunityPostDetailPage() {
  const navigate = useNavigate();
  const { postId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { post: p, comments: cs } = await loadAdminCommunityPostDetail(postId);
      if (!p) {
        setErr("게시글을 찾을 수 없습니다.");
        setPost(null);
        setComments([]);
        return;
      }
      setPost(p);
      setComments(Array.isArray(cs) ? cs : []);
    } catch (e) {
      console.error("[AdminCommunityPostDetailPage] load failed", e);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePin = async () => {
    if (!post) return;
    setBusy(true);
    try {
      await setCommunityPostPinned({ postId: post.id, pinned: !post.pinned });
      await load();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const toggleHide = async () => {
    if (!post) return;
    setBusy(true);
    try {
      await setCommunityPostHidden({ postId: post.id, hidden: !post.hidden });
      await load();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    if (!window.confirm(`이 게시글을 삭제하시겠습니까?\n\n"${post.title}"\n\n댓글/좋아요까지 모두 사라지고 복구할 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteCommunityPostByAdmin({ postId: post.id });
      navigate("/admin/community/posts", { replace: true });
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "삭제에 실패했습니다.");
      setBusy(false);
    }
  };

  const handleDeleteComment = async (c) => {
    if (!post || !c?.id) return;
    if (!window.confirm("이 댓글을 삭제하시겠습니까?")) return;
    setBusy(true);
    try {
      await deleteCommunityCommentByAdmin({ postId: post.id, commentId: c.id });
      await load();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Card><AdminLoading /></Card>
      </Page>
    );
  }

  if (err || !post) {
    return (
      <Page>
        <TopRow>
          <BackBtn type="button" onClick={() => navigate(-1)}>← 목록으로</BackBtn>
        </TopRow>
        <Card>
          <ErrorText>{err || "게시글을 찾을 수 없습니다."}</ErrorText>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <TopRow>
        <BackBtn type="button" onClick={() => navigate("/admin/community/posts")}>← 목록으로</BackBtn>
        <ActionRow>
          <Btn type="button" $variant={post.pinned ? "primary" : undefined} onClick={togglePin} disabled={busy}>
            {post.pinned ? "공지 해제" : "공지로 고정"}
          </Btn>
          <Btn type="button" onClick={toggleHide} disabled={busy}>
            {post.hidden ? "숨김 해제" : "숨김 처리"}
          </Btn>
          <Btn type="button" $variant="danger" onClick={handleDeletePost} disabled={busy}>
            삭제
          </Btn>
        </ActionRow>
      </TopRow>

      <Card>
        <PostHeader>
          <PostTitle>
            {post.pinned && <Pill $tone="pin">공지</Pill>}
            {post.hidden && <Pill $tone="hide">숨김</Pill>}
            {post.title || "(제목없음)"}
          </PostTitle>
          <MetaRow>
            <span>작성: {fmtYmdHm(post.createdAt)}</span>
            {post.updatedAt && post.createdAt && post.updatedAt.getTime() !== post.createdAt.getTime() && (
              <span>수정: {fmtYmdHm(post.updatedAt)}</span>
            )}
          </MetaRow>
        </PostHeader>

        <AuthorRow>
          <Avatar $src={post.authorAvatar} />
          <div>
            <AuthorName>{post.authorName}</AuthorName>
            <AuthorMeta>{post.authorUid || "-"}</AuthorMeta>
          </div>
        </AuthorRow>

        <Stats>
          <span>👀 조회 {post.views}</span>
          <span>❤ 좋아요 {post.likes}</span>
          <span>💬 댓글 {post.commentsCount}</span>
        </Stats>

        {post.content && <Body>{post.content}</Body>}

        {post.images?.length > 0 && (
          <Images>
            {post.images.map((url, i) => (
              <ImgBox
                key={`${url}-${i}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                $src={url}
              />
            ))}
          </Images>
        )}
      </Card>

      <Card>
        <Section>
          <SectionTitle>댓글 ({comments.length})</SectionTitle>
          {comments.length === 0 ? (
            <EmptyComments>댓글이 없습니다.</EmptyComments>
          ) : (
            comments.map((c) => (
              <CommentRow key={c.id}>
                <Avatar $src={c.authorAvatar} style={{ width: 28, height: 28 }} />
                <CommentBody>
                  <CommentMeta>
                    <CommentName>{c.authorName}</CommentName>
                    <span>{fmtYmdHm(c.createdAt)}</span>
                    {c.parentId && <span>↪ 답글</span>}
                  </CommentMeta>
                  <CommentText>{c.content}</CommentText>
                </CommentBody>
                <CommentActions>
                  <SmallDelBtn type="button" onClick={() => handleDeleteComment(c)} disabled={busy}>
                    삭제
                  </SmallDelBtn>
                </CommentActions>
              </CommentRow>
            ))
          )}
        </Section>
      </Card>
    </Page>
  );
}
