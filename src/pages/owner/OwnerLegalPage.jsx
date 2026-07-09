/* eslint-disable */
// src/pages/owner/OwnerLegalPage.jsx
// 구장 관리자 앱 약관·정책 뷰어 — Firestore(legal_documents) 우선, 없으면 LEGAL_DEFAULTS 폴백.
// 동의 게이트/로그인 화면에서도 열려야 하므로 OwnerLayout 밖의 공개 라우트로 둔다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { getLegalDoc } from "../../services/legalService";
import { LEGAL_DEFAULTS } from "../../data/legalDefaults";
import { C } from "./components/od";

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${C.white};
  max-width: 448px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
`;

const Header = styled.header`
  height: 54px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: ${C.violet600};
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #fff;
`;

const BackBtn = styled.button`
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  font-size: 24px;
  color: #fff;
  cursor: pointer;
`;

const Body = styled.main`
  flex: 1;
  padding: 20px 18px calc(32px + env(safe-area-inset-bottom));
  font-size: 13.5px;
  line-height: 1.85;
  color: ${C.slate800};
  white-space: pre-wrap;
  word-break: break-word;
`;

const Meta = styled.div`
  font-size: 12px;
  color: ${C.slate500};
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid ${C.slate200};
`;

const Loading = styled.div`
  padding: 48px 0;
  text-align: center;
  font-size: 13px;
  color: ${C.slate500};
`;

function fmtYmd(d) {
  if (!d) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function OwnerLegalPage({ type = "owner_terms" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [remote, setRemote] = useState(null);

  const fallback = LEGAL_DEFAULTS[type] || { title: "약관", content: "" };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await getLegalDoc(type);
        if (!alive) return;
        setRemote(data && (data.content || "").trim() ? data : null);
      } catch (e) {
        if (alive) setRemote(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [type]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/owner/login");
  };

  const title = remote?.title || fallback.title;
  const content = remote?.content || fallback.content;

  return (
    <Wrap>
      <Header>
        <BackBtn type="button" onClick={handleBack} aria-label="뒤로">‹</BackBtn>
        <HeaderTitle>{title}</HeaderTitle>
      </Header>
      {loading ? (
        <Loading>불러오는 중…</Loading>
      ) : (
        <Body>
          {remote?.updatedAt && <Meta>최근 업데이트: {fmtYmd(remote.updatedAt)}</Meta>}
          {content}
        </Body>
      )}
    </Wrap>
  );
}
