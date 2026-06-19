/* eslint-disable */
// src/components/common/EventPopupModal.jsx
// 사용자 진입 시 활성 이벤트 팝업이 있으면 모달로 표시
// - "오늘 그만보기" → localStorage(popup.dismissed.{id})로 저장 (날짜 기준)
// - "이벤트 바로 가기" → linkUrl로 이동 (있을 때만)
// - 어드민 영역(/admin/*)에서는 동작 안 함

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { listVisibleEventPopups } from "../../services/eventPopupsService";
import { useAuth } from "../../hooks/useAuth";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Card = styled.div`
  width: min(360px, 100%);
  background: ${({ theme }) => theme.colors.card};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
`;

const ImageBox = styled.div`
  width: 100%;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  display: grid;
  place-items: center;
`;

const Image = styled.img`
  width: 100%;
  display: block;
`;

const TextWrap = styled.div`
  padding: 16px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.3;
`;

const Body = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ButtonRow = styled.div`
  display: flex;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Btn = styled.button`
  flex: 1;
  height: 48px;
  border: none;
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.primary : "transparent"};
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme.colors.textNormal};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:not(:last-child) {
    border-right: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:active {
    opacity: 0.85;
  }
`;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dismissedToday(id) {
  try {
    const k = `popup.dismissed.${id}`;
    const v = window.localStorage.getItem(k);
    return v === todayStr();
  } catch (e) {
    return false;
  }
}

function dismissForToday(id) {
  try {
    window.localStorage.setItem(`popup.dismissed.${id}`, todayStr());
  } catch (e) {}
}

export default function EventPopupModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [popup, setPopup] = useState(null);
  const [closed, setClosed] = useState(false);

  const pathname = String(location.pathname || "");
  const isAdminPath = pathname.startsWith("/admin");
  // 스플래시(/) · 인증 화면에서는 표시 안 함 → 로그인 후 홈 등 실제 화면에서만
  const isSplashPath = pathname === "/" || pathname === "/index.html";
  const isAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/find-") ||
    pathname.startsWith("/link-phone");

  // 로그인 완료 + 어드민/인증/스플래시가 아닌 실제 화면에서만 노출
  const blocked = isAdminPath || isAuthPath || isSplashPath || authLoading || !isLoggedIn;

  useEffect(() => {
    if (blocked) return;

    let alive = true;
    (async () => {
      try {
        const rows = await listVisibleEventPopups();
        if (!alive) return;
        const next = (rows || []).find((r) => !dismissedToday(r.id));
        if (next) setPopup(next);
      } catch (e) {
        console.warn("[EventPopupModal] fetch failed:", e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [blocked, pathname]);

  if (blocked) return null;
  if (!popup || closed) return null;

  const handleDismissToday = () => {
    dismissForToday(popup.id);
    setClosed(true);
  };

  const handleClose = () => {
    setClosed(true);
  };

  const handleGoEvent = () => {
    setClosed(true);
    const url = String(popup.linkUrl || "").trim();
    if (!url) {
      navigate(`/event/${popup.id}`);
      return;
    }
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank");
      return;
    }
    navigate(url);
  };

  const showLinkBtn = true; // 항상 "이벤트 바로 가기" 버튼 표시 (linkUrl 비어있으면 /event/{id}로 이동)

  return (
    <Overlay onClick={handleClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        {popup.imageUrl ? (
          <ImageBox>
            <Image src={popup.imageUrl} alt={popup.title} />
          </ImageBox>
        ) : null}

        {(popup.title || popup.body) && (
          <TextWrap>
            {popup.title ? <Title>{popup.title}</Title> : null}
            {popup.body ? <Body>{popup.body}</Body> : null}
          </TextWrap>
        )}

        <ButtonRow>
          <Btn type="button" onClick={handleDismissToday}>
            오늘 그만보기
          </Btn>
          {showLinkBtn ? (
            <Btn type="button" $primary onClick={handleGoEvent}>
              {popup.linkLabel || "이벤트 바로 가기"}
            </Btn>
          ) : (
            <Btn type="button" onClick={handleClose}>
              닫기
            </Btn>
          )}
        </ButtonRow>
      </Card>
    </Overlay>
  );
}
