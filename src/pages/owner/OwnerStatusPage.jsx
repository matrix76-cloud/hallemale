/* eslint-disable */
// src/pages/owner/OwnerStatusPage.jsx
// 심사 현황 — pending(심사중) / rejected(반려, 재신청)
import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import OwnerSpinner from "./components/OwnerSpinner";
import { Page, Card, PrimaryBtn, GhostBtn, Badge } from "./components/ownerUi";

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 28px 16px 8px;
`;

const Emoji = styled.div`
  font-size: 52px;
  line-height: 1;
`;

const Title = styled.div`
  font-size: 19px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Desc = styled.div`
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13.5px;
  & > span:first-child { color: ${({ theme }) => theme.colors.textWeak}; }
  & > span:last-child { color: ${({ theme }) => theme.colors.textStrong}; font-weight: 600; text-align: right; }
`;

const RejectBox = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  color: #b91c1c;
  line-height: 1.5;
`;

export default function OwnerStatusPage() {
  const navigate = useNavigate();
  const { loading, venue, refresh } = useOwner();

  if (loading) return <OwnerSpinner label="심사 현황을 불러오는 중…" />;
  if (!venue) return <Navigate to="/owner/register" replace />;
  if (venue.status === "approved") return <Navigate to="/owner/home" replace />;

  const isRejected = venue.status === "rejected";

  return (
    <Page>
      <Hero>
        <Emoji>{isRejected ? "📋" : "⏳"}</Emoji>
        <Title>{isRejected ? "등록이 반려되었어요" : "심사가 진행 중이에요"}</Title>
        <Desc>
          {isRejected
            ? "아래 사유를 확인하고 정보를 수정해 다시 신청해주세요."
            : "관리자가 제출하신 구장 정보를 검토하고 있어요.\n승인되면 예약 관리를 시작할 수 있어요."}
        </Desc>
      </Hero>

      <Card>
        <InfoRow>
          <span>구장명</span>
          <span>{venue.name || "-"}</span>
        </InfoRow>
        <InfoRow>
          <span>주소</span>
          <span>{venue.address || "-"}</span>
        </InfoRow>
        <InfoRow>
          <span>예약 대상(코트)</span>
          <span>{venue.courts?.length || 0}개</span>
        </InfoRow>
        <InfoRow>
          <span>심사 상태</span>
          <span>
            <Badge $tone={venue.status}>
              {isRejected ? "반려" : "심사중"}
            </Badge>
          </span>
        </InfoRow>
      </Card>

      {isRejected && venue.rejectReason && (
        <RejectBox>
          <strong>반려 사유</strong>
          <div style={{ marginTop: 6 }}>{venue.rejectReason}</div>
        </RejectBox>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        {isRejected && (
          <PrimaryBtn type="button" onClick={() => navigate("/owner/register")}>
            정보 수정하고 다시 신청
          </PrimaryBtn>
        )}
        <GhostBtn type="button" onClick={() => refresh()}>
          새로고침
        </GhostBtn>
      </div>
    </Page>
  );
}
