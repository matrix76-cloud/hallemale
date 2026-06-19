/* eslint-disable */
// src/pages/settings/FAQPage.jsx
import React, { useState } from "react";
import styled from "styled-components";
import { FiChevronDown } from "react-icons/fi";

const FAQS = [
  // 계정 / 프로필
  {
    q: "로그인은 어떻게 진행하나요?",
    a: "할래말래는 카카오 계정을 통한 간편 로그인을 지원합니다. 최초 로그인 시 계정이 자동으로 생성되며, 별도의 가입 절차 없이 카카오 로그인만으로 서비스를 이용하실 수 있습니다. 닉네임 등 프로필 정보는 로그인 후 내정보에서 직접 설정하실 수 있습니다.",
  },
  {
    q: "앱은 어떻게 구성되어 있나요?",
    a: "하단 탭은 홈, 매칭관리, 커뮤니티, 내정보의 네 가지 메뉴로 구성됩니다. 매칭과 경기 관리는 매칭관리, 게시글 작성과 열람은 커뮤니티, 프로필·팀·설정 관리는 내정보에서 이용하실 수 있습니다.",
  },
  {
    q: "프로필에는 어떤 정보를 설정할 수 있나요?",
    a: "내정보의 ‘내프로필 설정’에서 프로필 사진, 닉네임, 활동 지역, 주 포지션(가드·포워드·센터), 실력 수준(입문·아마추어·중급·상급·프로), 키·몸무게, 한 줄 소개를 등록하실 수 있습니다. 필수 항목은 아니지만, 정보를 충실히 입력할수록 매칭 및 팀 합류에 유리합니다.",
  },
  {
    q: "닉네임은 어떻게 변경하나요?",
    a: "최초 로그인 시에는 닉네임이 설정되어 있지 않습니다. 내정보의 ‘내프로필 설정’에서 원하는 닉네임을 등록하실 수 있으며, 이후 언제든지 변경하실 수 있습니다.",
  },

  // 팀
  {
    q: "팀은 어떻게 생성하나요?",
    a: "내정보의 ‘팀 생성’ 메뉴에서 생성하실 수 있습니다. 팀 로고 등록(선택), 팀 이름·활동 지역·소개·태그 입력, 입력 내용 확인의 순서로 진행되며, 팀을 생성한 회원은 자동으로 팀장으로 지정됩니다.",
  },
  {
    q: "팀에는 어떻게 가입하나요?",
    a: "두 가지 방법을 제공합니다. 첫째, 팀장이 보낸 초대를 수락하는 방법, 둘째, 가입을 원하는 팀에 참여요청을 보내고 팀장의 승인을 받는 방법입니다. 초대가 수락되거나 참여요청이 승인되면 즉시 해당 팀의 팀원으로 등록됩니다.",
  },
  {
    q: "받은 초대와 참여요청은 어디에서 확인하나요?",
    a: "내정보 화면에서 확인하실 수 있습니다. 팀원에게는 ‘받은 초대’, 팀장에게는 ‘참여요청’ 메뉴가 제공되며, 새로 접수된 항목이 있을 경우 숫자 배지로 안내됩니다.",
  },
  {
    q: "팀장은 어떤 기능을 이용할 수 있나요?",
    a: "팀장은 내정보의 ‘팀 관리’에서 팀 정보와 로고를 수정하고 팀원을 관리할 수 있습니다. 또한 ‘팀장 권한 이임’을 통해 다른 팀원에게 팀장 권한을 위임할 수 있습니다.",
  },
  {
    q: "팀에서 탈퇴하려면 어떻게 하나요?",
    a: "내정보의 ‘팀 탈퇴’ 메뉴를 통해 탈퇴하실 수 있습니다. 다만 팀장은 곧바로 탈퇴할 수 없으며, 먼저 ‘팀장 권한 이임’으로 다른 팀원에게 권한을 위임한 후 탈퇴가 가능합니다.",
  },

  // 매칭
  {
    q: "매칭은 어떻게 신청하나요?",
    a: "매칭을 원하는 상대 팀의 프로필에서 매칭을 신청하실 수 있습니다. 우리 팀의 출전 라인업을 선택한 뒤 상대 팀의 라인업을 지정하여 신청하면, 상대 팀에 신청 알림이 전달되며 상대 팀이 수락하면 매칭이 성사됩니다.",
  },
  {
    q: "매칭 진행 상황은 어디에서 확인하나요?",
    a: "매칭관리 탭에서 확인하실 수 있습니다. 신청·수락·거절·취소 등 매칭 상태가 정리되어 표시되며, 상태 변경 시 알림으로도 안내해 드립니다.",
  },
  {
    q: "매칭 성사 후 일정과 장소는 어떻게 정하나요?",
    a: "매칭이 성사되면 해당 매칭 전용 공간인 ‘매칭룸’이 생성됩니다. 매칭룸에서 상대 팀과 채팅으로 협의하고 ‘구장 정하기’ 기능을 통해 경기 장소와 일정을 확정하실 수 있습니다.",
  },

  // 커뮤니티 / 랭킹 / 기록
  {
    q: "커뮤니티는 어떻게 이용하나요?",
    a: "커뮤니티 탭에서 다른 회원의 게시글을 열람하고 직접 게시글을 작성하실 수 있습니다. 본인이 작성한 게시글은 내정보의 ‘내가 쓴 게시글’에서 모아 확인하실 수 있습니다.",
  },
  {
    q: "팀과 선수 순위도 확인할 수 있나요?",
    a: "네, 팀 전체순위와 선수 전체순위를 제공합니다. 랭킹 화면에서 다른 팀과 선수들의 순위를 확인하실 수 있습니다.",
  },
  {
    q: "내 경기 기록은 어디에서 확인하나요?",
    a: "내정보의 ‘개인 활동 경기’와 ‘매칭된 경기’ 메뉴에서 경기 내역을 확인하실 수 있습니다.",
  },

  // 알림 / 설정
  {
    q: "알림은 어떤 경우에 발송되나요?",
    a: "매칭 신청·수락·거절·취소, 신규 채팅 메시지, 팀 초대, 참여요청 승인·거절 등 주요 활동이 발생할 때 알림이 발송됩니다. 수신한 알림은 알림 화면에서 모아 확인하실 수 있습니다.",
  },
  {
    q: "알림이 수신되지 않습니다.",
    a: "먼저 휴대폰 설정에서 할래말래의 알림(푸시) 권한이 허용되어 있는지 확인해 주시기 바랍니다. 권한이 비활성화된 경우 알림을 받으실 수 없습니다. 그래도 수신되지 않는다면 앱을 최신 버전으로 업데이트한 후 다시 확인해 주시기 바랍니다.",
  },
  {
    q: "다크 모드를 지원하나요?",
    a: "네, 내정보의 ‘화면 모드’에서 라이트 모드와 다크 모드를 전환하실 수 있습니다.",
  },

  // 문의 / 탈퇴
  {
    q: "문의는 어디로 접수하나요?",
    a: "내정보의 ‘1:1 문의’를 통해 접수하실 수 있습니다. 계정/로그인, 매칭/경기, 팀, 신고/이용제재, 오류/버그, 기타 중 카테고리를 선택하고 제목과 내용을 작성해 주시면 됩니다. 접수하신 문의와 답변은 문의 내역에서 확인하실 수 있습니다.",
  },
  {
    q: "회원 탈퇴는 어떻게 하나요?",
    a: "내정보의 ‘회원탈퇴’ 메뉴에서 진행하실 수 있습니다. 탈퇴 시 계정 정보와 프로필, 인증 정보가 영구적으로 삭제되며 복구할 수 없으므로 신중하게 결정해 주시기 바랍니다.",
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
      <Desc>궁금하신 항목을 선택하시면 자세한 안내를 확인하실 수 있습니다.</Desc>

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
