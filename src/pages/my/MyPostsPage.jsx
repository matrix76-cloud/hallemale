// src/pages/my/MyPostsPage.jsx
/* eslint-disable */
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { listMyCommunityPosts } from "../../services/communityService";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

export default function MyPostsPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!myUid) {
      setPosts([]);
      setLoading(false);
      return () => {};
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const { posts: list } = await listMyCommunityPosts({ uid: myUid, limitCount: 50 });
        if (!alive) return;
        setPosts(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "내 게시글을 불러오지 못했습니다.");
        setPosts([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [myUid]);

  const handleClickPost = (id) => {
    if (!id) return;
    navigate(`/communitypost/${id}`);
  };

  return (
    <PageWrap>
      <Inner>
        {loading ? (
          <CenterBox>
            <Spinner />
          </CenterBox>
        ) : error ? (
          <EmptyWrap>{error}</EmptyWrap>
        ) : posts.length === 0 ? (
          <EmptyState
            text="아직 작성한 게시글이 없습니다."
            sub="첫 글을 남기고 팀원들과 소통해보세요."
            actionLabel="글쓰러 가기"
            onAction={() => navigate("/community/write")}
          />
        ) : (
          <PostList>
            {posts.map((p) => (
              <PostCard key={p.id} type="button" onClick={() => handleClickPost(p.id)}>
                <PostTitle>{p.title || "(제목 없음)"}</PostTitle>
                <PostMetaRow>
                  <MetaLeft>{typeof p.createdAt === "string" ? p.createdAt : ""}</MetaLeft>
                  <MetaRight>
                    댓글 {p.commentsCount || 0} · 좋아요 {p.likes || 0} · 조회 {p.views || 0}
                  </MetaRight>
                </PostMetaRow>
              </PostCard>
            ))}
          </PostList>
        )}
      </Inner>
    </PageWrap>
  );
}

/* ============ styled ============ */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 14px 20px;
`;

const CenterBox = styled.div`
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EmptyWrap = styled.div`
  margin-top: 20px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const PostList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
`;

const PostCard = styled.button`
  width: 100%;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  padding: 10px 12px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  text-align: left;
`;

const PostTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const PostMetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MetaLeft = styled.div``;
const MetaRight = styled.div``;
