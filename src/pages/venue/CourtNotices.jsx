/* eslint-disable */
// src/pages/venue/CourtNotices.jsx
// 구장주가 코트별로 등록한 공지(notices)·주의사항(cautions)을 사용자에게 노출.
// VenueBookingPage(구장 개요) / CourtBookingPage(코트 상세) 공용.
//  - pinned 공지: 상단 강조 배너 (구장주 화면 "핀하면 상단 고정" 의도)
//  - 일반 공지: 공지사항 섹션
//  - cautions: 주의사항 섹션
import React from "react";
import styled from "styled-components";
import { FiBell, FiAlertTriangle } from "react-icons/fi";

export default function CourtNotices({ court }) {
  const notices = Array.isArray(court?.notices) ? court.notices : [];
  const cautions = (Array.isArray(court?.cautions) ? court.cautions : []).filter(Boolean);
  const has = (n) => n && (n.title || n.body);
  const pinned = notices.filter((n) => n.pinned && has(n));
  const normal = notices.filter((n) => !n.pinned && has(n));
  if (!pinned.length && !normal.length && !cautions.length) return null;

  return (
    <>
      {pinned.map((n) => (
        <Pinned key={n.id}>
          <FiBell size={16} />
          <div>
            {n.title ? <PinTitle>{n.title}</PinTitle> : null}
            {n.body ? <PinBody>{n.body}</PinBody> : null}
          </div>
        </Pinned>
      ))}

      {normal.length > 0 && (
        <Section>
          <SecTitle><FiBell size={17} />공지사항</SecTitle>
          <List>
            {normal.map((n) => (
              <NoticeItem key={n.id}>
                {n.title ? <NtTitle>{n.title}</NtTitle> : null}
                {n.body ? <NtBody>{n.body}</NtBody> : null}
              </NoticeItem>
            ))}
          </List>
        </Section>
      )}

      {cautions.length > 0 && (
        <Section>
          <SecTitle><FiAlertTriangle size={17} />주의사항</SecTitle>
          <List>
            {cautions.map((c, i) => (
              <CautionItem key={i}><Dot />{c}</CautionItem>
            ))}
          </List>
        </Section>
      )}
    </>
  );
}

/* ---------- styles (사용자앱 테마 사용) ---------- */
const Pinned = styled.div`
  display: flex; align-items: flex-start; gap: 9px;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.16)" : "#f3efff")};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 12px; padding: 12px 13px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; margin-top: 1px; }
`;
const PinTitle = styled.div`font-size: 13.5px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const PinBody = styled.div`font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; color: ${({ theme }) => theme.colors.textNormal}; margin-top: 2px;`;

const Section = styled.div`display: flex; flex-direction: column; gap: 13px;`;
const SecTitle = styled.div`
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex; align-items: center; gap: 7px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; }
`;
const List = styled.div`
  display: flex; flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 12px; overflow: hidden;
`;
const NoticeItem = styled.div`
  display: flex; flex-direction: column; gap: 3px; padding: 12px 14px;
  & + & { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
`;
const NtTitle = styled.div`font-size: 13.5px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong};`;
const NtBody = styled.div`font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; color: ${({ theme }) => theme.colors.textWeak};`;
const CautionItem = styled.div`
  display: flex; align-items: flex-start; gap: 8px; padding: 11px 14px;
  font-size: 13px; line-height: 1.5; color: ${({ theme }) => theme.colors.textNormal};
  & + & { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
`;
const Dot = styled.span`
  flex-shrink: 0; width: 5px; height: 5px; border-radius: 999px; margin-top: 7px;
  background: ${({ theme }) => theme.colors.primary};
`;
