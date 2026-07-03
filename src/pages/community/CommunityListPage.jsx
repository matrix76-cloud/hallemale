/* eslint-disable */
// src/pages/community/CommunityListPage.jsx
// ✅ 카테고리 탭(자유/상대모집/경기후기)으로 필터링
// ✅ 상대모집 탭: 최근 24시간 내 새 글 있으면 N 뱃지
// ✅ 글 메타: ♥좋아요 · 💬댓글 · 작성자 · 시간(상대시간)
// ✅ 글쓰기: 우하단 "✏️ 글쓰기" 알약 버튼

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { loadCommunityList } from "../../services/communityService";
import { useAuth } from "../../hooks/useAuth";
import FilterSearchBar from "../../components/common/FilterSearchBar";
import { FiHeart, FiMessageCircle, FiEdit3 } from "react-icons/fi";
import EmptyState from "../../components/common/EmptyState";
import HomeHeroBanner from "../../components/home/HomeHeroBanner";
import { images } from "../../utils/imageAssets";

// 프로필 사진(실제 업로드본) 보유 여부 — 기본 로고/기본아바타는 '없음'으로 처리
const hasProfilePhoto = (u) => {
  const a = String(u?.avatarUrl || "").trim();
  return !!a && a !== images.logo && a !== images.defaultAvatar;
};

// 커뮤니티 배너는 어드민 등록분만 노출 (기본 fallback 없음)
const COMMUNITY_BANNER_FALLBACK = [];

/* =============== 레이아웃 =============== */

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  padding: 0 0 90px;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
`;

const SearchWrap = styled.div`
  margin-top: 6px;
  padding: 0 12px;
`;

/* 검색바 아래 게시글 리스트: 페이지보다 살짝 진한 회색 → 흰 카드가 또렷하게 구분됨 */
const ListContainer = styled.div`
  margin-top: 10px;
  min-height: 60vh;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#eef0f4"};
`;

/* 게시글 수 + 정렬 토글 */
const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
`;

const PostCount = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};

  b {
    color: ${({ theme }) => theme.colors.textStrong};
    font-weight: 700;
  }
`;

const SortToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SortBtn = styled.button`
  border: none;
  cursor: pointer;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.textStrong : theme.colors.textWeak};
`;

/* 카드 리스트 */
const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px 16px;
`;

const MoreButton = styled.button`
  margin: 4px 12px 20px;
  height: 46px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

/* HOT 뱃지 */
const HotBadge = styled.span`
  display: inline-block;
  margin-bottom: 3px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: ${({ theme }) => theme.colors.danger || "#ef4444"};
`;

/* =============== 상태 =============== */

const EmptyBox = styled.div`
  margin-top: 40px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LoadingBox = styled(EmptyBox)``;

const ErrorBox = styled(EmptyBox)`
  color: ${({ theme }) => (theme.mode === "dark" ? "#fca5a5" : "#b91c1c")};
  white-space: pre-line;
`;

/* =============== 글쓰기 플로팅 버튼 =============== */

const FloatingWriteButton = styled.button`
  position: fixed;
  right: 18px;
  bottom: calc(90px + env(safe-area-inset-bottom));
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

/* =============== 게시글 행 =============== */

const CardBtn = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "rgba(15, 23, 42, 0.08)"};
  border-radius: 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
  box-shadow: ${({ theme }) =>
    theme.mode === "dark" ? "none" : "0 1px 3px rgba(15, 23, 42, 0.05)"};
  cursor: pointer;
  text-align: left;
  padding: 0;

  &:active {
    opacity: 0.85;
  }
`;

const PostRow = styled.div`
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const PostBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const TitleText = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Snippet = styled.div`
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const MetaRow = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  svg {
    font-size: 13px;
  }
`;

const MetaAuthor = styled.span`
  color: ${({ theme }) => theme.colors.textNormal};
  font-weight: 600;
`;

const Dot = styled.span`
  &::before {
    content: "·";
    margin: 0 4px;
  }
`;

const RightThumb = styled.div`
  flex: 0 0 76px;
  width: 76px;
  height: 76px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const ThumbImg = styled.div`
  width: 100%;
  height: 100%;
  background-image: ${({ src }) => `url(${src})`};
  background-size: cover;
  background-position: center;
`;

/* =============== 헬퍼 =============== */

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

export default function CommunityListPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errText, setErrText] = useState("");
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState("latest"); // "latest" | "popular"
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErrText("");

      try {
        const data = await loadCommunityList({ myUid, limitCount: 30 });
        if (!alive) return;
        setPosts(data.posts || []);
        setCursor(data.cursor || null);
        setHasMore(!!data.hasMore);
      } catch (e) {
        console.error("[CommunityListPage] load failed:", e?.code, e?.message, e);
        if (!alive) return;

        const hint =
          e?.code === "failed-precondition"
            ? "Firestore 인덱스가 필요합니다."
            : e?.code === "permission-denied"
            ? "권한(보안 규칙) 문제입니다."
            : "";

        setErrText([String(e?.message || "목록을 불러올 수 없습니다."), hint].filter(Boolean).join("\n"));
        setPosts([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [myUid]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await loadCommunityList({ myUid, limitCount: 30, cursor });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...(data.posts || []).filter((p) => !seen.has(p.id))];
      });
      setCursor(data.cursor || null);
      setHasMore(!!data.hasMore);
    } catch (e) {
      console.warn("[CommunityListPage] loadMore failed:", e?.message || e);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredPosts = useMemo(() => {
    const key = String(q || "").trim().toLowerCase();

    return (posts || [])
      .filter((p) => {
        if (!key) return true;
        const title = String(p.title || "").toLowerCase();
        const content = String(p.content || "").toLowerCase();
        const author = String(p.authorName || "").toLowerCase();
        return title.includes(key) || content.includes(key) || author.includes(key);
      });
  }, [posts, q]);

  // 정렬: 최신순 | 인기순(좋아요+댓글)
  const sortedPosts = useMemo(() => {
    const score = (p) => Number(p.likes || 0) + Number(p.commentsCount || 0);
    const arr = [...filteredPosts];
    if (sortMode === "popular") {
      arr.sort((a, b) => score(b) - score(a));
    } else {
      arr.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
    }
    return arr;
  }, [filteredPosts, sortMode]);

  const handleClickPost = (postId) => () => {
    navigate(`/communitypost/${postId}`);
  };

  const handleClickWrite = () => {
    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!hasProfilePhoto(userDoc)) {
      alert("커뮤니티 글 작성을 위해 먼저 프로필 사진을 등록해주세요.");
      navigate("/my/profile/edit");
      return;
    }
    navigate("/community/write");
  };

  const hasPosts = filteredPosts && filteredPosts.length > 0;

  const renderPost = (post) => {
    const hasImage = !!post.image;
    const isHot = Number(post.likes || 0) + Number(post.commentsCount || 0) >= 10;

    return (
      <CardBtn key={post.id} onClick={handleClickPost(post.id)}>
        <PostRow>
          <PostBody>
            {isHot && <HotBadge>HOT</HotBadge>}
            <TitleText>{post.title}</TitleText>
            {post.content ? <Snippet>{post.content}</Snippet> : null}
            <MetaRow>
              <MetaItem>
                <FiHeart />
                {Number(post.likes || 0)}
              </MetaItem>
              <MetaItem>
                <FiMessageCircle />
                {Number(post.commentsCount || 0)}
              </MetaItem>
              <span>
                <MetaAuthor>{post.authorName}</MetaAuthor>
                <Dot />
                {timeAgo(post.createdAtMs)}
              </span>
            </MetaRow>
          </PostBody>

          {hasImage && (
            <RightThumb>
              <ThumbImg src={post.image} />
            </RightThumb>
          )}
        </PostRow>
      </CardBtn>
    );
  };

  return (
    <PageWrap>
      <HomeHeroBanner
        placement="community"
        fallback={COMMUNITY_BANNER_FALLBACK}
        slideHeight="84px"
        rounded
      />

      <Inner>
        <SearchWrap>
          <FilterSearchBar value={q} onChange={setQ} placeholder="제목/내용/작성자 검색" showFilter={false} />
        </SearchWrap>

        <ListContainer>
          <ListHeader>
            <PostCount>
              게시글 <b>{filteredPosts.length}</b>
            </PostCount>
            <SortToggle>
              <SortBtn
                type="button"
                $active={sortMode === "latest"}
                onClick={() => setSortMode("latest")}
              >
                최신순
              </SortBtn>
              <SortBtn
                type="button"
                $active={sortMode === "popular"}
                onClick={() => setSortMode("popular")}
              >
                인기순
              </SortBtn>
            </SortToggle>
          </ListHeader>

          {loading ? (
            <LoadingBox>불러오는 중…</LoadingBox>
          ) : errText ? (
            <ErrorBox>{errText}</ErrorBox>
          ) : hasPosts ? (
            <>
              <CardList>{sortedPosts.map((post) => renderPost(post))}</CardList>
              {!String(q || "").trim() && hasMore && (
                <MoreButton type="button" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "불러오는 중…" : "더보기"}
                </MoreButton>
              )}
            </>
          ) : (
            <EmptyState text={String(q || "").trim() ? "검색 결과가 없습니다." : "아직 등록된 게시글이 없습니다."} />
          )}
        </ListContainer>
      </Inner>

      <FloatingWriteButton type="button" onClick={handleClickWrite}>
        <FiEdit3 />
        글쓰기
      </FloatingWriteButton>
    </PageWrap>
  );
}
