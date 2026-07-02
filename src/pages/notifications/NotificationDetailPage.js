/* eslint-disable */
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { goBackOrHome } from "../../utils/navigation";
import { NOTIFICATIONS_BY_ID } from "../../mock/notificationsMock";
import { getNotice } from "../../services/noticesService";
import { getNotificationById } from "../../services/notificationService";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";
import { getNotiCategory } from "../../utils/notificationDefinitions";

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
  background: ${({ $color }) => $color || "#6b7280"};
`;

const ImportantLabel = styled.span`
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid #2563eb;
  color: #2563eb;
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
  const d = typeof iso?.toDate === "function" ? iso.toDate() : new Date(iso);
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

  const [data, setData] = useState(() => NOTIFICATIONS_BY_ID[notificationId] || null);
  const [loading, setLoading] = useState(() => !NOTIFICATIONS_BY_ID[notificationId]);

  // mock에 없으면 관리자 공지(notices)에서 불러온다
  useEffect(() => {
    const mock = NOTIFICATIONS_BY_ID[notificationId];
    if (mock) {
      setData(mock);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    // 1) 실제 알림(notifications) 문서를 id로 조회 → 있으면 제목/본문 표시
    // 2) 없으면 관리자 공지(notices)에서 조회
    (async () => {
      try {
        const noti = await getNotificationById(notificationId);
        if (!alive) return;
        if (noti) {
          setData({
            kind: noti.kind || "",
            title: noti.title,
            body: noti.body,
            createdAt: noti.createdAt,
            important: false,
          });
          return;
        }
        const n = await getNotice(notificationId);
        if (!alive) return;
        setData(
          n
            ? {
                kind: "notice",
                title: n.title,
                body: n.content,
                createdAt: n.createdAt,
                important: n.pinned,
              }
            : null
        );
      } catch (e) {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [notificationId]);

  const handleBack = () => {
    goBackOrHome(navigate);
  };

  if (loading) {
    return (
      <PageWrap>
        <FooterHint>불러오는 중…</FooterHint>
      </PageWrap>
    );
  }

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

  const cat = getNotiCategory(data.kind);

  return (
    <>
     
      <PageWrap>
      
        <MetaRow>
          <KindBadge $color={cat.color}>{cat.label}</KindBadge>
          <span>{formatTime(data.createdAt)}</span>
          {data.important && <ImportantLabel>중요</ImportantLabel>}
        </MetaRow>
        {data.title && <Title>{data.title}</Title>}
        <Body>{data.body}</Body>

        <FooterHint>
          이 알림은 하렐말레 서비스에서 발송된 안내입니다. 이벤트/매칭
          정보는 실제 페이지에서 변경될 수 있습니다.
        </FooterHint>
      </PageWrap>
    </>
  );
}
