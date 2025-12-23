// src/pages/legal/PrivacyPage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

const Page = styled.main`
  min-height: 100dvh;
  background: #f3f4f6;
  color: #111827;
  display: flex;
  justify-content: center;
  padding: 28px 16px 80px;
`;

const Sheet = styled.div`
  position: relative;
  width: min(960px, 100%);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
  padding: 22px;
  display: grid;
  gap: 16px;
`;

const Head = styled.header`
  display: grid;
  gap: 6px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  color: #111827;
  font-family: "GmarketSans";
`;

const Meta = styled.div`
  color: #6b7280;
  font-size: 12px;
`;

const Toc = styled.nav`
  border: 1px solid #eef2ff;
  background: #fbfcfe;
  border-radius: 12px;
  padding: 12px;

  ul {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }

  a {
    color: #111827;
    text-underline-offset: 3px;
  }
`;

const H2 = styled.h2`
  margin: 10px 0 6px;
  font-size: 18px;
  color: #111827;
`;

const H3 = styled.h3`
  margin: 10px 0 4px;
  font-size: 16px;
  color: #111827;
`;

const P = styled.p`
  margin: 6px 0;
  line-height: 1.75;
  color: #111827;
`;

const Ol = styled.ol`
  margin: 6px 0 6px 18px;
  line-height: 1.75;
  color: #111827;
`;

const Ul = styled.ul`
  margin: 6px 0 6px 18px;
  line-height: 1.75;
  color: #111827;
`;

const Divider = styled.div`
  height: 1px;
  background: #eef2ff;
  margin: 4px 0;
`;

/* 닫기 버튼 */
const CloseButton = styled.button`
  position: absolute;
  top: 14px;
  right: 16px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
  color: #4b5563;

  &:hover {
    background: #e5e7eb;
  }

  &:active {
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
    transform: translateY(1px);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export default function PrivacyPage() {
  const navigate = useNavigate();

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  return (
    <Page>
      <Sheet>
        <CloseButton type="button" onClick={handleClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 7l10 10M17 7L7 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </CloseButton>

        <Head>
          <Title>개인정보처리방침</Title>
          <Meta>운영자: 할래말래컴퍼니 · 최근 업데이트: 2025-12-18</Meta>
        </Head>

        <Toc aria-label="목차">
          <strong>목차</strong>
          <ul>
            <li>
              <a href="#p1">1. 개인정보의 수집 및 이용</a>
            </li>
            <li>
              <a href="#p2">2. 개인정보의 제3자 제공</a>
            </li>
            <li>
              <a href="#p3">3. 이용자의 권리 및 행사 방법</a>
            </li>
            <li>
              <a href="#p4">4. 개인정보의 안전성 확보 조치</a>
            </li>
            <li>
              <a href="#p5">5. 개인정보처리방침의 변경</a>
            </li>
          </ul>
        </Toc>

        <Divider />

        <section id="p1">
          <H2>1. 개인정보의 수집 및 이용</H2>
          <P>운영자는 서비스 제공을 위해 아래와 같은 개인정보를 수집·이용합니다.</P>

          <H3>① 수집 목적</H3>
          <Ul>
            <li>회원 가입 및 본인 식별</li>
            <li>서비스 제공 및 운영</li>
            <li>매칭 관련 안내 및 공지 전달</li>
            <li>문의 및 분쟁 대응</li>
          </Ul>

          <H3>② 수집 항목</H3>
          <Ul>
            <li>필수: 이메일, 전화번호, 닉네임, 비밀번호</li>
            <li>선택: 프로필 정보(포지션, 활동 지역, 팀 정보 등), 서비스 이용 기록</li>
          </Ul>

          <H3>③ 보유 및 이용 기간</H3>
          <Ul>
            <li>회원 탈퇴 시 즉시 삭제</li>
            <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관</li>
          </Ul>
        </section>

        <section id="p2">
          <H2>2. 개인정보의 제3자 제공</H2>
          <P>
            운영자는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만,
            법령에 의한 요청이 있는 경우에는 예외로 합니다.
          </P>
        </section>

        <section id="p3">
          <H2>3. 이용자의 권리 및 행사 방법</H2>
          <P>
            이용자는 언제든지 자신의 개인정보에 대해 열람, 수정, 삭제를 요청할 수
            있습니다. 관련 요청은 서비스 내 문의 기능을 통해 접수할 수 있습니다.
          </P>
        </section>

        <section id="p4">
          <H2>4. 개인정보의 안전성 확보 조치</H2>
          <P>
            운영자는 개인정보 보호를 위해 암호화, 접근 통제 등 합리적인 보호 조치를
            시행합니다.
          </P>
        </section>

        <section id="p5">
          <H2>5. 개인정보처리방침의 변경</H2>
          <P>
            본 방침의 내용이 변경될 경우, 운영자는 변경 사항을 서비스 내 공지사항을
            통해 사전에 안내합니다.
          </P>
        </section>
      </Sheet>
    </Page>
  );
}
