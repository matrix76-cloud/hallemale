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
import { FiHeart, FiMessageCircle, FiEdit3, FiUsers, FiAward } from "react-icons/fi";
import EmptyState from "../../components/common/EmptyState";

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORIES = [
  { key: "free", label: "자유", Icon: FiMessageCircle },
  { key: "recruit", label: "상대모집", Icon: FiUsers },
  { key: "review", label: "경기후기", Icon: FiAward },
];

/* =============== 레이아웃 =============== */

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  padding: 8px 0 90px;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
`;

const SearchWrap = styled.div`
  margin-top: 6px;
`;

/* =============== 카테고리 탭 =============== */

const TabBar = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 12px 4px;
  max-width: 480px;
  margin: 0 auto;
`;

const TabButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid
    ${({ theme, $active }) =>
      $active
        ? theme.colors.primary
        : theme.mode === "dark"
        ? theme.colors.border
        : "rgba(0,0,0,0.10)"};
  background: ${({ theme, $active }) =>
    $active
      ? theme.mode === "dark"
        ? "rgba(124,92,255,0.18)"
        : "#eef2ff"
      : theme.mode === "dark"
      ? theme.colors.surface
      : "#ffffff"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textNormal};

  &:active {
    transform: translateY(1px);
  }
`;

const TabBadge = styled.span`
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.danger || "#ef4444"};
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
`;

/* =============== 구분 라인 =============== */

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0, 0, 0, 0.06)"};
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
  bottom: 90px;
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
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  padding: 0;

  &:active {
    opacity: 0.85;
  }
`;

const PostRow = styled.div`
  padding: 14px 12px;
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
  const [activeCat, setActiveCat] = useState("free");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErrText("");

      try {
        const data = await loadCommunityList({ myUid, limitCount: 50 });
        if (!alive) return;
        setPosts(data.posts || []);
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

  // 상대모집 탭: 최근 24시간 내 새 글 존재 여부 → N 뱃지
  const recruitHasNew = useMemo(() => {
    const now = Date.now();
    return (posts || []).some(
      (p) =>
        String(p.category || "free") === "recruit" &&
        p.createdAtMs &&
        now - p.createdAtMs < DAY_MS
    );
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const key = String(q || "").trim().toLowerCase();

    return (posts || [])
      .filter((p) => String(p.category || "free") === activeCat)
      .filter((p) => {
        if (!key) return true;
        const title = String(p.title || "").toLowerCase();
        const content = String(p.content || "").toLowerCase();
        const author = String(p.authorName || "").toLowerCase();
        return title.includes(key) || content.includes(key) || author.includes(key);
      });
  }, [posts, q, activeCat]);

  const handleClickPost = (postId) => () => {
    navigate(`/communitypost/${postId}`);
  };

  const handleClickWrite = () => {
    navigate("/community/write");
  };

  const hasPosts = filteredPosts && filteredPosts.length > 0;

  const renderPost = (post) => {
    const hasImage = !!post.image;

    return (
      <CardBtn onClick={handleClickPost(post.id)}>
        <PostRow>
          <PostBody>
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
      <TabBar>
        {CATEGORIES.map(({ key, label, Icon }) => (
          <TabButton
            key={key}
            type="button"
            $active={activeCat === key}
            onClick={() => setActiveCat(key)}
          >
            <Icon />
            {label}
            {key === "recruit" && recruitHasNew && <TabBadge>N</TabBadge>}
          </TabButton>
        ))}
      </TabBar>

      <Inner>
        <SearchWrap>
          <FilterSearchBar value={q} onChange={setQ} placeholder="제목/내용/작성자 검색" showFilter={false} />
        </SearchWrap>

        {loading ? (
          <LoadingBox>불러오는 중…</LoadingBox>
        ) : errText ? (
          <ErrorBox>{errText}</ErrorBox>
        ) : hasPosts ? (
          filteredPosts.map((post, index) => (
            <React.Fragment key={post.id}>
              {renderPost(post)}
              {index !== filteredPosts.length - 1 && <Divider />}
            </React.Fragment>
          ))
        ) : (
          <EmptyState text={String(q || "").trim() ? "검색 결과가 없습니다." : "아직 등록된 게시글이 없습니다."} />
        )}
      </Inner>

      <FloatingWriteButton type="button" onClick={handleClickWrite}>
        <FiEdit3 />
        글쓰기
      </FloatingWriteButton>
    </PageWrap>
  );
}
