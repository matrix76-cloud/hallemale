/* eslint-disable */
// src/pages/settings/FAQPage.jsx
import React, { useState } from "react";
import styled from "styled-components";
import { FiChevronDown } from "react-icons/fi";

const FAQS = [
  {
    q: "회원가입은 어떻게 하나요?",
    a: "이메일과 비밀번호로 간단하게 회원가입할 수 있어요. 가입 후에는 프로필을 설정하면 매칭과 팀 활동이 더 쉬워져요.",
  },
  {
    q: "팀은 어떻게 생성하나요?",
    a: "마이페이지에서 ‘팀 생성’을 눌러 팀 이름과 지역을 입력하면 팀을 만들 수 있어요. 팀을 만든 사람은 자동으로 팀장이 됩니다.",
  },
  {
    q: "팀에 초대받았는데 어디서 확인하나요?",
    a: "마이페이지 > ‘받은 초대’ 메뉴에서 팀 초대를 확인하고 수락하거나 거절할 수 있어요.",
  },
  {
    q: "팀장은 어떤 권한을 가지나요?",
    a: "팀장은 팀 정보 관리, 팀원 초대, 참여요청 승인/거절 등의 권한을 가집니다.",
  },
  {
    q: "팀 탈퇴는 어떻게 하나요?",
    a: "마이페이지 > 팀 정보 설정에서 ‘팀 탈퇴’를 할 수 있어요. 단, 팀장은 다른 팀원에게 권한을 넘긴 후 탈퇴할 수 있어요.",
  },
  {
    q: "매칭 알림은 언제 오나요?",
    a: "매칭 신청, 수락, 거절, 확정 등의 상태 변경 시 매칭 알림이 전송돼요. 알림 설정에서 끄거나 켤 수 있어요.",
  },
  {
    q: "채팅 알림을 끌 수 있나요?",
    a: "네, 알림 설정에서 채팅 알림을 개별적으로 끌 수 있어요.",
  },
  {
    q: "알림이 오지 않아요.",
    a: "알림 설정에서 전체 알림 및 해당 카테고리가 켜져 있는지 확인해 주세요. 앱 알림 권한도 함께 확인해 주세요.",
  },
  {
    q: "프로필 정보는 꼭 입력해야 하나요?",
    a: "필수는 아니지만, 포지션·실력·지역 정보를 입력하면 매칭 성공률이 높아져요.",
  },
  {
    q: "문의사항이 있으면 어디로 연락하나요?",
    a: "현재는 고객센터 기능을 준비 중이에요. 추후 업데이트를 통해 문의 기능이 제공될 예정이에요.",
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <PageWrap>
      <Card>
        <Title>자주 묻는 질문</Title>
        <Desc>궁금한 내용을 눌러서 확인해 보세요.</Desc>

        <List>
          {FAQS.map((item, idx) => {
            const open = openIndex === idx;
            return (
              <Item key={idx}>
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
      </Card>
    </PageWrap>
  );
}

/* ================= styled ================= */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 14px 14px 24px;
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px 14px;
`;

const Title = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  margin-bottom: 4px;
`;

const Desc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  margin-bottom: 10px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled.div`
  border-bottom: 1px solid #f3f4f6;

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
  color: #9ca3af;
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
  transition: transform 180ms ease;
`;

const Answer = styled.div`
  padding: 0 4px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#4b5563"};
  line-height: 1.6;
`;
