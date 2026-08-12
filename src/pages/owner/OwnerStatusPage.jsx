/* eslint-disable */
// src/pages/owner/OwnerStatusPage.jsx
// 심사 현황 — pending(심사중) / rejected(반려, 재신청)
import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import OwnerSpinner from "./components/OwnerSpinner";
import { LuFileText, LuHourglass } from "react-icons/lu";
import { Page, Card, PrimaryBtn, GhostBtn, Badge, C } from "./components/ownerUi";
import { registerFlow, resolveOwnerType } from "../../constants/ownerType";

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 28px 16px 8px;
`;

const Emoji = styled.div`
  display: flex;
  justify-content: center;
  color: ${C.violet600};
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

/* 등록 절차 순서도 — 온보딩 인트로와 같은 표(constants/ownerType.registerFlow)를 쓴다.
   여기서는 "지금 3단계(심사)"를 칠해, 신청자가 남은 절차를 다시 물어보지 않게 한다. */
const Flow = styled.div`
  display: flex;
  flex-direction: column;
`;
const FlowItem = styled.div`
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: ${({ $last }) => ($last ? 0 : "14px")};
  opacity: ${({ $done }) => ($done ? 0.55 : 1)};

  &::before {
    content: "";
    display: ${({ $last }) => ($last ? "none" : "block")};
    position: absolute;
    left: 13px;
    top: 26px;
    bottom: 2px;
    width: 1px;
    background: ${C.slate200};
  }
`;
const FlowNo = styled.div`
  flex-shrink: 0;
  width: 27px;
  height: 27px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  font-weight: 800;
  border: 1px solid ${({ $on }) => ($on ? C.violet600 : C.slate200)};
  background: ${({ $on }) => ($on ? C.violet600 : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : C.slate400)};
`;
const FlowBody = styled.div`display: flex; flex-direction: column; gap: 2px; padding-top: 3px;`;
const FlowTitle = styled.div`font-size: 14px; font-weight: 700; color: ${C.slate800};`;
const FlowDesc = styled.div`font-size: 12.5px; color: ${C.slate500}; line-height: 1.5; word-break: keep-all;`;
const FlowHead = styled.div`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: ${C.slate400};
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
  const { loading, venue, userDoc, refresh } = useOwner();

  if (loading) return <OwnerSpinner label="심사 현황을 불러오는 중…" />;
  if (!venue) return <Navigate to="/owner/onboarding" replace />;
  if (venue.status === "approved") return <Navigate to="/owner/home" replace />;

  const isRejected = venue.status === "rejected";
  // 반려면 1단계(정보 입력)로 되돌아온 상태, 심사중이면 3단계에 있다.
  const flow = registerFlow(resolveOwnerType(userDoc, venue));
  const currentIdx = isRejected ? 0 : 2;

  return (
    <Page>
      <Hero>
        <Emoji>{isRejected ? <LuFileText size={46} /> : <LuHourglass size={46} />}</Emoji>
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

      <Card>
        <FlowHead>등록 절차</FlowHead>
        <Flow>
          {flow.map((f, i) => (
            <FlowItem key={i} $last={i === flow.length - 1} $done={i < currentIdx}>
              <FlowNo $on={i === currentIdx}>{i + 1}</FlowNo>
              <FlowBody>
                <FlowTitle>{f.title}</FlowTitle>
                <FlowDesc>{f.desc}</FlowDesc>
              </FlowBody>
            </FlowItem>
          ))}
        </Flow>
      </Card>

      {isRejected && venue.rejectReason && (
        <RejectBox>
          <strong>반려 사유</strong>
          <div style={{ marginTop: 6 }}>{venue.rejectReason}</div>
        </RejectBox>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        {/* 온보딩은 venue 가 있으면 그 값으로 프리필돼 "수정하고 다시 신청"이 된다 */}
        {isRejected && (
          <PrimaryBtn type="button" onClick={() => navigate("/owner/onboarding")}>
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
