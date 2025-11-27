import React from "react";
import styled from "styled-components";

const Wrap = styled.section`
  margin-bottom: 16px;
  padding: 12px 12px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
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

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Row = styled.div`
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.colors.textNormal};
`;

export default function HomeRankingPreview() {
  // TODO: 나중에 clubService.fetchTopClubs()로 교체
  const mock = [
    { name: "청춘호랑이", stat: "12승 6패 · 승률 66.7%" },
    { name: "덕소독수리", stat: "10승 6패 · 승률 62.5%" },
    { name: "LI 이언", stat: "9승 6패 · 승률 60.0%" }
  ];

  return (
    <Wrap>
      <Header>
        <Title>팀 랭킹 Top 3</Title>
        <Link>전체 보기</Link>
      </Header>
      <List>
        {mock.map((item, idx) => (
          <Row key={item.name}>
            <span>
              {idx + 1}위 · {item.name}
            </span>
            <span>{item.stat}</span>
          </Row>
        ))}
      </List>
    </Wrap>
  );
}
