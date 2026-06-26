/* eslint-disable */
// src/layouts/components/NotificationBanner.jsx
// 인스타식 인앱 알림 배너 — 새 알림이 오면 화면 상단에서 슬라이드로 내려왔다 자동으로 사라짐
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { images, teamLogoSrc } from "../../utils/imageAssets";

const AUTO_DISMISS_MS = 4200;
const EXIT_MS = 280;

const slideIn = keyframes`
  from { transform: translateY(-130%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
`;
const slideOut = keyframes`
  from { transform: translateY(0);     opacity: 1; }
  to   { transform: translateY(-130%); opacity: 0; }
`;

const Wrap = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2000;
  display: flex;
  justify-content: center;
  padding: calc(8px + env(safe-area-inset-top)) 10px 0;
  pointer-events: none;
`;

const Card = styled.div`
  pointer-events: auto;
  width: 100%;
  max-width: 440px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 11px 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  cursor: pointer;
  animation: ${({ $leaving }) => ($leaving ? slideOut : slideIn)} ${EXIT_MS}ms
    ease forwards;
`;

const Icon = styled.div`
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const IconImg = styled.img`
  width: 100%;
  height: 100%;
  /* 팀 프로필 사진은 꽉 차게(cover), 앱 로고는 비율 유지(contain) */
  object-fit: ${({ $avatar }) => ($avatar ? "cover" : "contain")};
`;

const Texts = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Body = styled.div`
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.35;
  color: ${({ theme }) => theme.colors.textSub || theme.colors.textWeak};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CloseBtn = styled.button`
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 18px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
`;

export default function NotificationBanner({ banner, onOpen, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const exitTimerRef = useRef(null);

  // 새 배너(ts 변경)마다 타이머 리셋 → 일정 시간 후 슬라이드 아웃
  useEffect(() => {
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [banner?.ts]);

  // 슬라이드 아웃 애니메이션이 끝나면 실제로 닫음
  useEffect(() => {
    if (!leaving) return;
    exitTimerRef.current = setTimeout(() => onClose && onClose(), EXIT_MS);
    return () => clearTimeout(exitTimerRef.current);
  }, [leaving, onClose]);

  if (!banner) return null;

  const handleClose = (e) => {
    e.stopPropagation();
    setLeaving(true);
  };

  // 메시지(채팅) 알림: 상대팀 프로필 사진 → 없으면 기존 그룹 아이콘(teamPlaceholder).
  // 그 외 일반 알림: 앱 로고.
  const isChat = banner.kind === "chat";
  const iconSrc = isChat ? teamLogoSrc(banner.avatarUrl) : banner.avatarUrl || images.logo;
  const iconFills = isChat || !!banner.avatarUrl; // 사진·그룹아이콘은 꽉 차게(cover), 로고는 contain

  return (
    <Wrap>
      <Card
        $leaving={leaving}
        onClick={() => onOpen && onOpen(banner.deepLink)}
        role="button"
        aria-label={banner.title}
      >
        <Icon>
          <IconImg
            src={iconSrc}
            alt={iconFills ? banner.title : "할래말래"}
            $avatar={iconFills}
          />
        </Icon>
        <Texts>
          <Title>{banner.title}</Title>
          {banner.body && <Body>{banner.body}</Body>}
        </Texts>
        <CloseBtn onClick={handleClose} aria-label="닫기">
          ×
        </CloseBtn>
      </Card>
    </Wrap>
  );
}
