/* eslint-disable */
// src/pages/owner/components/VenueGateNotice.jsx
// 구장 미등록/심사중/반려를 막지 않고 '안내(인포)'로 보여주는 카드.
// 잠금 미리보기(LockedPreview) 앞면에 올라간다.
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { track } from "../../../utils/analytics";
import { FiMapPin, FiClock, FiAlertCircle, FiArrowRight, FiRefreshCw, FiMessageCircle } from "react-icons/fi";
import { PrimaryBtn, GhostBtn } from "./ownerUi";

const pop = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 20px;
  box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.28);
  padding: 30px 22px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  animation: ${pop} 0.35s ease-out both;
`;

const Badge = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: ${({ $tone, theme }) =>
    $tone === "pending"
      ? "linear-gradient(135deg, #f59e0b, #d97706)"
      : $tone === "rejected"
      ? "linear-gradient(135deg, #f43f5e, #e11d48)"
      : `linear-gradient(135deg, ${theme.colors.primary}, #7c3aed)`};
  box-shadow: 0 12px 26px -8px
    ${({ $tone, theme }) =>
      $tone === "pending"
        ? "rgba(217,119,6,0.6)"
        : $tone === "rejected"
        ? "rgba(225,29,72,0.6)"
        : "rgba(79,70,229,0.6)"};
`;

const Title = styled.div`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Desc = styled.div`
  font-size: 13.5px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: pre-line;
`;

const StatePill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${({ $tone }) => ($tone === "pending" ? "#fef3c7" : "#fee2e2")};
  color: ${({ $tone }) => ($tone === "pending" ? "#b45309" : "#b91c1c")};
`;

const Reject = styled.div`
  width: 100%;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(244,63,94,0.12)" : "#fef2f2")};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(244,63,94,0.3)" : "#fecaca")};
  border-radius: 12px;
  padding: 11px 13px;
  font-size: 12.5px;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fda4af" : "#b91c1c")};
  text-align: left;
  line-height: 1.5;
`;

const Btns = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 2px;
`;

const CtaBtn = styled(PrimaryBtn)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const RefreshBtn = styled(GhostBtn)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
`;

export default function VenueGateNotice({ venue, refresh }) {
  const navigate = useNavigate();
  const status = !venue ? "none" : venue.status;

  // 승인 게이트 노출 계측 — 미등록/심사중/반려 각 단계 유입량(공급 퍼널 데드엔드 정량화)
  useEffect(() => { track("owner_venue_gate_view", { status }); }, [status]);

  if (status === "pending") {
    return (
      <Card>
        <Badge $tone="pending"><FiClock size={36} /></Badge>
        <Title>구장 심사가 진행 중이에요</Title>
        <Desc>{`'${venue.name}'\n보통 영업일 1~2일 안에 승인돼요.\n승인되면 예약 관리가 열려요.`}</Desc>
        <StatePill $tone="pending"><FiClock size={13} /> 심사중</StatePill>
        <Btns>
          {refresh && (
            <RefreshBtn type="button" onClick={() => refresh()}>
              <FiRefreshCw size={15} /> 새로고침
            </RefreshBtn>
          )}
          <RefreshBtn type="button" onClick={() => navigate("/owner/inquiry")}>
            <FiMessageCircle size={15} /> 승인이 오래 걸리나요? 문의하기
          </RefreshBtn>
        </Btns>
      </Card>
    );
  }

  if (status === "rejected") {
    return (
      <Card>
        <Badge $tone="rejected"><FiAlertCircle size={36} /></Badge>
        <Title>등록이 반려되었어요</Title>
        <Desc>정보를 수정해 다시 신청해주세요.</Desc>
        {venue.rejectReason ? (
          <Reject>
            <strong>반려 사유</strong>
            <div style={{ marginTop: 4 }}>{venue.rejectReason}</div>
          </Reject>
        ) : null}
        <Btns>
          <CtaBtn type="button" onClick={() => navigate("/owner/onboarding")}>
            정보 수정하고 다시 신청 <FiArrowRight size={17} />
          </CtaBtn>
        </Btns>
      </Card>
    );
  }

  // 미등록
  return (
    <Card>
      <Badge $tone="none"><FiMapPin size={36} /></Badge>
      <Title>아직 등록한 구장이 없어요</Title>
      <Desc>{"구장을 등록하면\n예약을 받고 시간대·가격을 관리할 수 있어요."}</Desc>
      <Btns>
        <CtaBtn type="button" onClick={() => navigate("/owner/onboarding")}>
          구장 등록하기 <FiArrowRight size={17} />
        </CtaBtn>
      </Btns>
    </Card>
  );
}
