/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { NOTIFICATIONS_BY_ID } from "../../mock/notificationsMock";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const KindBadge = styled.span`
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;

  ${({ kind }) => {
    if (kind === "notice") {
      return `background:#2563eb;`;
    }
    if (kind === "event") {
      return `background:#f97316;`;
    }
    if (kind === "match") {
      return `background:#22c55e;`;
    }
    return `background:#6b7280;`;
  }}
`;

const ImportantLabel = styled.span`
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid #f97316;
  color: #ea580c;
  font-size: 10px;
  font-weight: 600;
`;

const Body = styled.p`
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.text || "#111827"};
  white-space: pre-line;
`;

const FooterHint = styled.div`
  margin-top: 24px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${year}.${month}.${date} ${hour}:${min}`;
};

export default function NotificationDetailPage() {
  const navigate = useNavigate();
  const { notificationId } = useParams();

  const data = NOTIFICATIONS_BY_ID[notificationId];

  const handleBack = () => {
    navigate(-1);
  };

  if (!data) {
    return (
      <>

        <PageWrap>
          <Title>알림을 찾을 수 없습니다.</Title>
          <FooterHint>이미 삭제되었거나 잘못된 경로일 수 있습니다.</FooterHint>
        </PageWrap>
      </>
    );
  }

  const kindLabel =
    data.kind === "notice"
      ? "공지"
      : data.kind === "event"
      ? "이벤트"
      : data.kind === "match"
      ? "매칭"
      : "시스템";

  return (
    <>
     
      <PageWrap>
      
        <MetaRow>
          <KindBadge kind={data.kind}>{kindLabel}</KindBadge>
          <span>{formatTime(data.createdAt)}</span>
          {data.important && <ImportantLabel>중요</ImportantLabel>}
        </MetaRow>
        <Body>{data.body}</Body>

        <FooterHint>
          이 알림은 하렐말레 서비스에서 발송된 안내입니다. 이벤트/매칭
          정보는 실제 페이지에서 변경될 수 있습니다.
        </FooterHint>
      </PageWrap>
    </>
  );
}
