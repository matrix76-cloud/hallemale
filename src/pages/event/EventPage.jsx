/* eslint-disable */
// src/pages/event/EventPage.jsx
// 이벤트 팝업 상세 페이지 — 팝업의 본문/이미지를 큰 화면으로 보여줌
// URL: /event/:id

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import Spinner from "../../components/common/Spinner";

const Page = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  padding-bottom: 100px;
`;

const Hero = styled.div`
  width: 100%;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

const HeroImg = styled.img`
  width: 100%;
  display: block;
`;

const Content = styled.div`
  padding: 18px 18px 24px;
`;

const Title = styled.h1`
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.3;
`;

const Body = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
`;

const LinkBtn = styled.button`
  margin-top: 22px;
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;

const State = styled.div`
  padding: 60px 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function EventPage() {
  const nav = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (!id) throw new Error("id가 없습니다.");
        const snap = await getDoc(doc(db, "event_popups", id));
        if (!alive) return;
        if (!snap.exists()) {
          setErr("이벤트를 찾을 수 없습니다.");
          setData(null);
        } else {
          setData({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "불러올 수 없습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleLinkClick = () => {
    const url = String(data?.linkUrl || "").trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank");
      return;
    }
    nav(url);
  };

  return (
    <Page>
      {loading ? (
        <Spinner />
      ) : err ? (
        <State>{err}</State>
      ) : !data ? (
        <State>이벤트가 없습니다.</State>
      ) : (
        <>
          {data.imageUrl ? (
            <Hero>
              <HeroImg src={data.imageUrl} alt={data.title || ""} />
            </Hero>
          ) : null}

          <Content>
            <Title>{data.title || "이벤트"}</Title>
            <Body>{data.body || ""}</Body>

            {String(data.linkUrl || "").trim() ? (
              <LinkBtn type="button" onClick={handleLinkClick}>
                {data.linkLabel || "자세히 보기"}
              </LinkBtn>
            ) : null}
          </Content>
        </>
      )}
    </Page>
  );
}
