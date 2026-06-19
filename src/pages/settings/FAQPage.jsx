/* eslint-disable */
// src/pages/settings/FAQPage.jsx
import React, { useState } from "react";
import styled from "styled-components";
import { FiChevronDown } from "react-icons/fi";

const FAQS = [
  // 계정 / 로그인
  {
    q: "로그인은 어떻게 하나요?",
    a: "할래말래는 카카오 계정으로 간편하게 로그인할 수 있어요. 처음 로그인하면 자동으로 계정이 만들어지고 임시 닉네임도 부여돼요. 별도의 복잡한 가입 절차 없이 카카오 로그인 한 번이면 바로 시작할 수 있습니다.",
  },
  {
    q: "닉네임은 어떻게 바꾸나요?",
    a: "처음 가입하면 닉네임이 자동으로 만들어져요. 마이페이지 > 프로필 수정에서 원하는 닉네임으로 언제든지 변경할 수 있어요.",
  },
  {
    q: "프로필에는 어떤 정보를 입력하나요?",
    a: "프로필 사진, 닉네임, 활동 지역, 주 포지션(가드·포워드·센터), 실력 수준(입문·아마추어·중급·상급·프로), 키·몸무게, 한 줄 소개 등을 설정할 수 있어요. 필수는 아니지만 정보를 채울수록 매칭이 잡히거나 팀에 합류할 때 더 유리해요.",
  },

  // 팀
  {
    q: "팀은 어떻게 만드나요?",
    a: "팀 만들기는 3단계로 진행돼요. ① 팀 로고 이미지 등록(선택) → ② 팀 이름·활동 지역·한 줄 소개·태그 입력 → ③ 입력 내용 확인 후 생성. 팀을 만든 사람이 자동으로 팀장이 됩니다.",
  },
  {
    q: "팀에는 어떻게 들어가나요?",
    a: "두 가지 방법이 있어요. ① 팀장이 보낸 초대를 수락하기, ② 들어가고 싶은 팀에 가입을 신청하고 팀장이 승인하기. 둘 중 어느 쪽이든 수락/승인되면 곧바로 그 팀의 팀원이 됩니다.",
  },
  {
    q: "팀 초대나 가입 신청 결과는 어디서 확인하나요?",
    a: "초대가 오거나 신청이 승인·거절되면 알림으로 알려드려요. 초대·가입 관련 내역은 초대함(받은 초대) 메뉴에서 확인하고 수락하거나 거절할 수 있어요.",
  },
  {
    q: "팀장은 어떤 권한을 가지나요?",
    a: "팀장은 팀 정보·로고 수정, 팀원 초대, 가입 신청 승인/거절, 팀원 내보내기(강퇴), 팀 삭제 권한을 가져요.",
  },
  {
    q: "팀에서 나가려면 어떻게 하나요?",
    a: "일반 팀원은 팀 정보 화면에서 ‘팀 탈퇴’로 나갈 수 있어요. 단, 팀장은 팀원이 남아 있는 동안에는 바로 탈퇴할 수 없어요. 팀을 정리하려면 팀원이 모두 빠진 뒤 팀장이 팀을 삭제하면 됩니다.",
  },

  // 매칭
  {
    q: "매칭은 어떻게 신청하나요?",
    a: "우리 팀과 출전할 라인업을 고른 뒤, 상대 팀과 상대 라인업을 선택해 매칭을 신청해요. 신청을 보내면 상대 팀에게 매칭 신청 알림이 전달됩니다.",
  },
  {
    q: "매칭을 신청한 뒤 어떻게 진행되나요?",
    a: "상대 팀이 신청을 수락하거나 거절해요. 수락되면 매칭이 성사되고, 거절되면 신청이 종료돼요. 신청·수락·거절·취소 등 진행 상황은 매칭 관리 화면과 알림으로 확인할 수 있어요.",
  },

  // 채팅
  {
    q: "상대 팀이나 다른 사람과 어떻게 대화하나요?",
    a: "매칭이 잡히면 그 매칭 전용 채팅방(매칭룸)에서 상대 팀과 약속을 정할 수 있어요. 또 선수·팀 프로필에서 ‘대화하기’를 누르면 1:1 채팅방이 만들어져 개별로 연락할 수 있습니다.",
  },

  // 알림
  {
    q: "어떤 경우에 알림이 오나요?",
    a: "매칭 신청·수락·거절·취소, 새 채팅 메시지, 팀 초대, 가입 신청의 수락/거절, 팀원 강퇴나 팀 해체 등 주요 활동이 있을 때 알림을 보내드려요.",
  },
  {
    q: "알림이 오지 않아요.",
    a: "먼저 휴대폰 설정에서 할래말래 앱의 알림(푸시) 권한이 켜져 있는지 확인해 주세요. 권한이 꺼져 있으면 알림을 받을 수 없어요. 그래도 오지 않으면 앱을 최신 버전으로 업데이트한 뒤 다시 확인해 주세요.",
  },

  // 문의
  {
    q: "문의는 어디로 하나요?",
    a: "마이페이지의 1:1 문의에서 보낼 수 있어요. 계정/로그인, 매칭/경기, 팀, 신고/이용제재, 오류/버그, 기타 중 카테고리를 고르고 제목과 내용을 적어 보내면 돼요. 보낸 문의와 답변은 문의 내역에서 확인할 수 있습니다.",
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (idx) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <PageWrap>
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
