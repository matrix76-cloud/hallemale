/* eslint-disable */
// src/pages/settings/FAQPage.jsx
// 답변 원본은 Firestore csFaq (services/csFaqService). 카카오톡 챗봇 스킬 서버도 같은 곳을 읽는다.
// → 문구 수정은 어드민 > CS 답변 관리에서 하고, 이 화면은 렌더만 한다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { FiChevronDown } from "react-icons/fi";
import { listCsFaq } from "../../services/csFaqService";

export default function FAQPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listCsFaq("user");
      if (!alive) return;
      setItems(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (idx) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <PageWrap>
      <Title>자주 묻는 질문</Title>
      <Desc>궁금하신 항목을 선택하시면 자세한 안내를 확인하실 수 있습니다.</Desc>

      {loading ? (
        <Empty>불러오는 중…</Empty>
      ) : !items.length ? (
        <Empty>등록된 질문이 없습니다.</Empty>
      ) : (
        <List>
          {items.map((item, idx) => {
            const open = openIndex === idx;
            return (
              <Item key={item.id || idx}>
                <QuestionRow type="button" onClick={() => toggle(idx)}>
                  <QuestionText>{item.q}</QuestionText>
                  <Chevron $open={open}>
                    <FiChevronDown size={18} />
                  </Chevron>
                </QuestionRow>

                {open && (
                  <Answer>
                    {item.a}
                  </Answer>
                )}
              </Item>
            );
          })}
        </List>
      )}
    </PageWrap>
  );
}

/* ================= styled ================= */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#ffffff"};
  padding: 14px 14px 24px;
`;

const Title = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  margin-bottom: 4px;
`;

const Desc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak || "#6b7280"};
  margin-bottom: 10px;
`;

const Empty = styled.div`
  padding: 28px 4px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak || "#9ca3af"};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled.div`
  border-bottom: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.divider : "#f3f4f6"};

  &:last-child {
    border-bottom: none;
  }
`;

const QuestionRow = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  padding: 14px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
`;

const QuestionText = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  line-height: 1.4;
`;

const Chevron = styled.div`
  color: ${({ theme }) => theme.colors.textWeak || "#9ca3af"};
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
  transition: transform 180ms ease;
`;

const Answer = styled.div`
  padding: 0 4px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal || "#4b5563"};
  line-height: 1.6;
`;
