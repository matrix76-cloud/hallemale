// src/pages/legal/TermsPage.jsx
/* eslint-disable */
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { getLegalDoc } from "../../services/legalService";
import { LEGAL_DEFAULTS } from "../../data/legalDefaults";

const Page = styled.main`
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textNormal};
  display: flex;
  justify-content: center;
  padding: 28px 16px 80px;
`;

const Sheet = styled.div`
  position: relative;
  width: min(960px, 100%);
  display: grid;
  gap: 16px;
`;

const Head = styled.header`
  display: grid;
  gap: 6px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 700;
`;

const Meta = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
`;

const Toc = styled.nav`
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "#eef2ff"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#fbfcfe"};
  color: ${({ theme }) => theme.colors.textNormal};
  border-radius: 8px;
  padding: 12px;

  ul {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }

  a {
    color: ${({ theme }) => theme.colors.textStrong};
    text-underline-offset: 3px;
  }
`;

const H2 = styled.h2`
  margin: 10px 0 6px;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const H3 = styled.h3`
  margin: 10px 0 4px;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const P = styled.p`
  margin: 6px 0;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Ol = styled.ol`
  margin: 6px 0 6px 18px;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Ul = styled.ul`
  margin: 6px 0 6px 18px;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.divider : "#eef2ff"};
  margin: 4px 0;
`;

/* 닫기 버튼 */
const Body = styled.div`
  font-size: 14px;
  line-height: 1.85;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: pre-wrap;
  word-break: break-word;
`;

const Loading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function fmtYmd(d) {
  if (!d) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const CloseButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textNormal};

  &:hover {
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.border : "#e5e7eb"};
  }

  &:active {
    transform: translateY(1px);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export default function TermsPage() {
  const navigate = useNavigate();

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getLegalDoc("terms");
        if (!alive) return;
        if (data && (data.content || "").trim()) setDoc(data);
        else setDoc(null);
      } catch (e) {
        console.warn("[TermsPage] load failed:", e?.message || e);
        if (alive) setDoc(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <Page>
        <Sheet>
          <CloseButton type="button" onClick={handleClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </CloseButton>
          <Head>
            <Title>서비스 이용약관</Title>
          </Head>
          <Loading>불러오는 중…</Loading>
        </Sheet>
      </Page>
    );
  }

  if (doc) {
    return (
      <Page>
        <Sheet>
          <CloseButton type="button" onClick={handleClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </CloseButton>
          <Head>
            <Title>{doc.title || "서비스 이용약관"}</Title>
            <Meta>
              {doc.updatedAt ? `최근 업데이트: ${fmtYmd(doc.updatedAt)}` : ""}
            </Meta>
          </Head>
          <Divider />
          <Body>{doc.content}</Body>
        </Sheet>
      </Page>
    );
  }

  // 폴백: Firestore에 본문이 없을 때 기본 본문(LEGAL_DEFAULTS) 렌더
  return (
    <Page>
      <Sheet>
        <CloseButton type="button" onClick={handleClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 7l10 10M17 7L7 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </CloseButton>

        <Head>
          <Title>{LEGAL_DEFAULTS.terms.title}</Title>
        </Head>

        <Divider />

        <Body>{LEGAL_DEFAULTS.terms.content}</Body>
      </Sheet>
    </Page>
  );
}
