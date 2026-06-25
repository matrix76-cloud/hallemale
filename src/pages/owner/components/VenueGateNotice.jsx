/* eslint-disable */
// src/pages/owner/components/VenueGateNotice.jsx
// 구장 미등록/심사중/반려 상태를 막지 않고 '안내(인포)'로 보여주는 카드.
// 승인 전이면 각 탭 상단/본문에 이걸 띄운다.
import React from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Card, PrimaryBtn, GhostBtn, Badge } from "./ownerUi";

const Wrap = styled(Card)`
  align-items: center;
  text-align: center;
  gap: 14px;
  padding: 28px 18px;
`;
const Emoji = styled.div`font-size: 46px; line-height: 1;`;
const Title = styled.div`
  font-size: 17px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const Desc = styled.div`
  font-size: 13.5px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: pre-line;
`;
const Reject = styled.div`
  width: 100%;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  color: #b91c1c;
  text-align: left;
  line-height: 1.5;
`;
const Btns = styled.div`width: 100%; display: flex; flex-direction: column; gap: 10px;`;

/**
 * @param {object|null} venue
 * @param {function} [refresh]
 */
export default function VenueGateNotice({ venue, refresh }) {
  const navigate = useNavigate();

  // 미등록
  if (!venue) {
    return (
      <Wrap>
        <Emoji>🏟️</Emoji>
        <Title>아직 등록한 구장이 없어요</Title>
        <Desc>{"구장을 등록하면 예약을 받고\n시간대·가격을 관리할 수 있어요."}</Desc>
        <Btns>
          <PrimaryBtn type="button" onClick={() => navigate("/owner/register")}>
            구장 등록하기
          </PrimaryBtn>
        </Btns>
      </Wrap>
    );
  }

  // 심사중
  if (venue.status === "pending") {
    return (
      <Wrap>
        <Emoji>⏳</Emoji>
        <Title>구장 심사가 진행 중이에요</Title>
        <Desc>{`'${venue.name}'\n관리자 승인 후 예약 관리를 시작할 수 있어요.`}</Desc>
        <Badge $tone="pending">심사중</Badge>
        <Btns>
          {refresh && (
            <GhostBtn type="button" onClick={() => refresh()}>새로고침</GhostBtn>
          )}
        </Btns>
      </Wrap>
    );
  }

  // 반려
  if (venue.status === "rejected") {
    return (
      <Wrap>
        <Emoji>📋</Emoji>
        <Title>등록이 반려되었어요</Title>
        <Desc>정보를 수정해 다시 신청해주세요.</Desc>
        {venue.rejectReason ? (
          <Reject>
            <strong>반려 사유</strong>
            <div style={{ marginTop: 4 }}>{venue.rejectReason}</div>
          </Reject>
        ) : null}
        <Btns>
          <PrimaryBtn type="button" onClick={() => navigate("/owner/register")}>
            정보 수정하고 다시 신청
          </PrimaryBtn>
        </Btns>
      </Wrap>
    );
  }

  return null;
}
