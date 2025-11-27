import React from "react";
import styled from "styled-components";

const Wrap = styled.section`
  margin-bottom: 8px;
  padding: 12px 12px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
`;

const Title = styled.span`
  font-weight: 600;
`;

const Link = styled.button`
  border: none;
  background: transparent;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
`;

const Box = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function HomeNotificationPreview() {
  // TODO: 나중에 useNotifications()로 실제 알림 데이터 연결
  return (
    <Wrap>
      <Header>
        <Title>알림</Title>
        <Link>전체 보기</Link>
      </Header>
      <Box>새로운 매칭 요청이나 경기 결과가 여기 표시됩니다.</Box>
    </Wrap>
  );
}
