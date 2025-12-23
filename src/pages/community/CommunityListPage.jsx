/* eslint-disable */
// src/pages/CommunityListPage.jsx
// ✅ 좋아요 표시: react-icons (FiHeart)로 메타에 추가

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { loadCommunityList } from "../../services/communityService";
import { useAuth } from "../../hooks/useAuth";
import FilterSearchBar from "../../components/common/FilterSearchBar";
import { FiHeart } from "react-icons/fi"; // ✅ 추가
import TodayMatchesStripFlat from "../../components/community/TodayMatchesStripFlat";
import { MOCK_TODAY_MATCHES_FLAT } from "../../mock/mockTodayMatchesFlat";

const HERO_BY_COMMENTS = 15;
const HERO_BY_VIEWS = 300;

const HALF_BY_COMMENTS = 5;
const HALF_BY_VIEWS = 100;

/* =============== 레이아웃 =============== */

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors?.bg || "#ffffff"};
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

/* =============== 구분 라인 =============== */

const Divider = styled.div`
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
`;

/* =============== 상태 =============== */

const EmptyBox = styled.div`
  margin-top: 40px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors?.muted || "#9ca3af"};
`;

const LoadingBox = styled(EmptyBox)``;

const ErrorBox = styled(EmptyBox)`
  color: #b91c1c;
  white-space: pre-line;
`;

/* =============== 글쓰기 플로팅 버튼 =============== */

const FloatingWriteButton = styled.button`
  position: fixed;
  right: 18px;
  bottom: 90px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: ${({ theme }) => theme.colors?.primary};
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25px;
  color: ${({ theme }) => theme.colors?.bg || "#111827"};
  cursor: pointer;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 3px 8px rgba(15, 23, 42, 0.12);
  }
`;

/* =============== 공용 메타/텍스트 =============== */

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
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

const LikeMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const LikeIcon = styled(FiHeart)`
  font-size: 12px;
`;

const TitleText = styled.div`
  font-size: ${({ $big }) => ($big ? "17px" : "15px")};
  font-weight: ${({ $big }) => ($big ? 700 : 600)};
  color: #111;
  line-height: 1.45;
  word-break: break-word;
`;

const Snippet = styled.div`
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.55;
  color: #4b5563;
  display: -webkit-box;
  -webkit-line-clamp: ${({ $lines }) => $lines || 2};
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

/* =============== 카드 3종 =============== */

const CardBtn = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  margin :10px 0px;

  &:active {
    opacity: 0.85;
  }
`;

/* ----- Level 1: compact ----- */
const CompactRow = styled.div`
  padding: 15px 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const CompactThumb = styled.div`
  flex: 0 0 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: #e5e7eb;
`;

const ThumbImg = styled.div`
  width: 100%;
  height: 100%;
  background-image: ${({ src }) => `url(${src})`};
  background-size: cover;
  background-position: center;
`;

const CompactBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

/* ----- Level 2: half image ----- */

const HalfRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: stretch;

  flex-direction: ${({ $reverse }) => ($reverse ? "row-reverse" : "row")};
`;



const HalfMedia = styled.div`
  flex: 0 0 46%;
  max-width: 46%;
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
  height: 102px;
`;

const HalfMediaImg = styled.div`
  width: 100%;
  height: 100%;
  background-image: ${({ src }) => `url(${src})`};
  background-size: cover;
  background-position: center;
`;

const HalfBody = styled.div`
  flex: 1;
  min-width: 0;
  padding-top: 2px;
`;

/* ----- Level 3: hero ----- */
const HeroWrap = styled.div`
  padding: 14px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeroMedia = styled.div`
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: #e5e7eb;
  height: 190px;
`;

const HeroMediaImg = styled.div`
  width: 100%;
  height: 100%;
  background-image: ${({ src }) => `url(${src})`};
  background-size: cover;
  background-position: center;
`;

const HeroBody = styled.div`
  padding: 0 2px;
`;

/* ----- 텍스트 히어로(이미지 없는데 레벨2/3) ----- */
const TextHero = styled.div`
  padding: 14px 0;
`;

const TextHeroBox = styled.div`
  border-radius: 16px;
  padding: 14px 14px 16px;
  background: linear-gradient(135deg, #eef2ff 0%, #f3f4f6 60%, #ffffff 100%);
  border: 1px solid rgba(0, 0, 0, 0.04);
`;


const TopArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SearchBarMock = styled.div`
  height: 44px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #e5e7eb;
`;


function getLevel(post) {
  const views = Number(post?.views || 0);
  const comments = Number(post?.commentsCount || 0);

  if (comments >= HERO_BY_COMMENTS || views >= HERO_BY_VIEWS) return 3;
  if (comments >= HALF_BY_COMMENTS || views >= HALF_BY_VIEWS) return 2;
  return 1;
}

function buildMetaText(post) {
  const likes = Number(post?.likes || 0);

  return (
    <MetaRow>
      <span>{post.authorName}</span>
      <Dot />
      <span>{post.createdAt}</span>
      <Dot />
      <span>조회 {post.views}</span>
      <Dot />
      <span>댓글 {post.commentsCount}</span>

       <>
          <Dot />
          <LikeMeta>
            <LikeIcon />
            {likes}
          </LikeMeta>
        </>
    </MetaRow>
  );
}

export default function CommunityListPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errText, setErrText] = useState("");
  const [q, setQ] = useState("");

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

        setErrText(
          [String(e?.message || "목록을 불러올 수 없습니다."), hint]
            .filter(Boolean)
            .join("\n")
        );
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

  const filteredPosts = useMemo(() => {
    const key = String(q || "").trim().toLowerCase();
    if (!key) return posts;

    return (posts || []).filter((p) => {
      const title = String(p.title || "").toLowerCase();
      const content = String(p.content || "").toLowerCase();
      const author = String(p.authorName || "").toLowerCase();
      return title.includes(key) || content.includes(key) || author.includes(key);
    });
  }, [posts, q]);

  const handleClickPost = (postId) => () => {
    navigate(`/communitypost/${postId}`);
  };

  const handleClickWrite = () => {
    navigate("/community/write");
  };

  const hasPosts = filteredPosts && filteredPosts.length > 0;

  const renderPost = (post) => {
    const level = getLevel(post);
    const hasImage = !!post.image;

    if (level === 3) {
      if (hasImage) {
        return (
          <CardBtn onClick={handleClickPost(post.id)}>
            <HeroWrap>
              <HeroMedia>
                <HeroMediaImg src={post.image} />
              </HeroMedia>
              <HeroBody>
                <TitleText $big>{post.title}</TitleText>
                <Snippet $lines={2}>{post.content}</Snippet>
                <div style={{ marginTop: 8 }}>{buildMetaText(post)}</div>
              </HeroBody>
            </HeroWrap>
          </CardBtn>
        );
      }

      return (
        <CardBtn onClick={handleClickPost(post.id)}>
          <TextHero>
            <TextHeroBox>
              <TitleText $big>{post.title}</TitleText>
              <Snippet $lines={3}>{post.content}</Snippet>
              <div style={{ marginTop: 10 }}>{buildMetaText(post)}</div>
            </TextHeroBox>
          </TextHero>
        </CardBtn>
      );
    }

    if (level === 2) {
      if (hasImage) {
        return (
          <CardBtn onClick={handleClickPost(post.id)}>
            <HalfRow $reverse>
              <HalfMedia>
                <HalfMediaImg src={post.image} />
              </HalfMedia>
              <HalfBody>
                <TitleText>{post.title}</TitleText>
                <div style={{ marginTop: 8 }}>{buildMetaText(post)}</div>
              </HalfBody>
            </HalfRow>
          </CardBtn>
        );
      }

      return (
        <CardBtn onClick={handleClickPost(post.id)}>
          <TextHero>
            <TextHeroBox>
              <TitleText>{post.title}</TitleText>
              <Snippet $lines={2}>{post.content}</Snippet>
              <div style={{ marginTop: 8 }}>{buildMetaText(post)}</div>
            </TextHeroBox>
          </TextHero>
        </CardBtn>
      );
    }


    return (
      <CardBtn onClick={handleClickPost(post.id)}>
        <CompactRow>
          {hasImage && (
            <CompactThumb>
              <ThumbImg src={post.image} />
            </CompactThumb>
          )}

          <CompactBody>
            <TitleText>{post.title}</TitleText>
            <div style={{ marginTop: 6 }}>{buildMetaText(post)}</div>
          </CompactBody>
        </CompactRow>
      </CardBtn>
    );
  };

  return (
    <PageWrap>

         <TopArea>

        <TodayMatchesStripFlat
          data={MOCK_TODAY_MATCHES_FLAT}
          initialKey="featured"
          onItemClick={(it) => {
            // 나중에: it.landingUrl 열기 or 내부 라우팅
            // console.log(it);
          }}
        />
      </TopArea>

      <Inner>
        <SearchWrap>
          <FilterSearchBar
            value={q}
            onChange={setQ}
            placeholder="제목/내용/작성자 검색"
            showFilter={false}
          />
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
          <EmptyBox>
            {String(q || "").trim()
              ? "검색 결과가 없습니다."
              : "아직 등록된 게시글이 없습니다."}
          </EmptyBox>
        )}
      </Inner>

      <FloatingWriteButton type="button" onClick={handleClickWrite}>
        +
      </FloatingWriteButton>
    </PageWrap>
  );
}
