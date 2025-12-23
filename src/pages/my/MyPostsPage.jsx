// src/pages/my/MyPostsPage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/**
 * 내가 쓴 게시글 목록 페이지 (더미 데이터 기반)
 */

const dummyPosts = [
  {
    id: "post-1",
    title: "우리팀 21:18 승리! 다음에도 잘부탁드립니다. 덕소독수리 화이팅!",
    createdAt: "2025.11.14 15:30",
    replyCount: 8,
    likeCount: 13,
    viewCount: 120,
  },
  {
    id: "post-2",
    title: "주말 오후 픽업게임 인원 모집합니다 (강동구 / 4시)",
    createdAt: "2025.11.10 18:20",
    replyCount: 5,
    likeCount: 21,
    viewCount: 210,
  },
  {
    id: "post-3",
    title: "센터 연습 같이 하실 분? 풋워크 위주로 연습해요",
    createdAt: "2025.11.02 09:10",
    replyCount: 2,
    likeCount: 7,
    viewCount: 80,
  },
];

export default function MyPostsPage() {
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);

  const handleClickPost = (id) => {
    // TODO: 실제 게시글 상세 라우트로 이동
    console.log("go post detail:", id);
  };

  return (
    <PageWrap>



      <Inner>
        {dummyPosts.length === 0 ? (
          <EmptyWrap>아직 작성한 게시글이 없습니다.</EmptyWrap>
        ) : (
          <PostList>
            {dummyPosts.map((p) => (
              <PostCard
                key={p.id}
                type="button"
                onClick={() => handleClickPost(p.id)}
              >
                <PostTitle>{p.title}</PostTitle>
                <PostMetaRow>
                  <MetaLeft>{p.createdAt}</MetaLeft>
                  <MetaRight>
                    댓글 {p.replyCount} · 좋아요 {p.likeCount} · 조회 {p.viewCount}
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
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
`;

const HeaderBar = styled.div`
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  color: #4b5563;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const HeaderRightPlaceholder = styled.div`
  width: 24px;
`;

const Inner = styled.div`
  padding: 0 14px 20px;
`;

const EmptyWrap = styled.div`
  margin-top: 20px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
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
  border-radius: 18px;
  background: #ffffff;
  padding: 10px 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const MetaLeft = styled.div``;
const MetaRight = styled.div``;
