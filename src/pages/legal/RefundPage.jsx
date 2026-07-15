// src/pages/legal/RefundPage.jsx
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
  padding: calc(28px + env(safe-area-inset-top)) 16px 80px;
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

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.divider : "#eef2ff"};
  margin: 4px 0;
`;

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

function fmtYmd(d) {
  if (!d) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function RefundPage() {
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
        const data = await getLegalDoc("refund");
        if (!alive) return;
        if (data && (data.content || "").trim()) setDoc(data);
        else setDoc(null);
      } catch (e) {
        console.warn("[RefundPage] load failed:", e?.message || e);
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
            <Title>취소 및 환불 정책</Title>
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
            <Title>{doc.title || "취소 및 환불 정책"}</Title>
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
          <Title>{LEGAL_DEFAULTS.refund.title}</Title>
        </Head>

        <Divider />

        <Body>{LEGAL_DEFAULTS.refund.content}</Body>
      </Sheet>
    </Page>
  );
}
