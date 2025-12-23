// src/pages/legal/TermsPage.jsx
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

export default function TermsPage() {
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
          <Title>서비스 이용약관</Title>
          <Meta>운영자: 할래말래컴퍼니 · 최근 업데이트: 2025-12-18</Meta>
        </Head>

        <Toc aria-label="목차">
          <strong>목차</strong>
          <ul>
            <li>
              <a href="#ch1">제1장 총칙</a>
            </li>
            <li>
              <a href="#ch2">제2장 회원</a>
            </li>
            <li>
              <a href="#ch3">제3장 서비스 이용</a>
            </li>
            <li>
              <a href="#ch4">제4장 기타</a>
            </li>
          </ul>
        </Toc>

        <Divider />

        <section id="ch1">
          <H2>제1장 총칙</H2>

          <H3>제1조 (목적)</H3>
          <P>
            본 약관은 할래말래컴퍼니(이하 “운영자”)가 제공하는 생활체육 경기
            매칭 플랫폼 “할래말래”(이하 “서비스”)의 이용과 관련하여 운영자와 이용자
            간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </P>

          <H3>제2조 (용어의 정의)</H3>
          <Ol>
            <li>이용자란 본 서비스를 이용하는 모든 자를 말합니다.</li>
            <li>회원이란 본 약관에 동의하고 회원가입을 완료한 자를 말합니다.</li>
            <li>비회원이란 회원가입 없이 제한된 기능을 이용하는 자를 말합니다.</li>
            <li>팀이란 경기를 목적으로 구성된 복수의 회원 집단을 말합니다.</li>
            <li>매칭이란 회원 또는 팀 간 경기 성사를 위해 서비스가 제공하는 중개 기능을 말합니다.</li>
            <li>콘텐츠란 서비스 내 게시되는 글, 이미지, 기록, 프로필 정보 등을 말합니다.</li>
          </Ol>

          <H3>제3조 (약관의 게시 및 개정)</H3>
          <Ol>
            <li>운영자는 본 약관을 서비스 화면에 게시합니다.</li>
            <li>
              관련 법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며, 변경 시
              사전 공지합니다.
            </li>
            <li>
              회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할
              수 있습니다.
            </li>
          </Ol>
        </section>

        <section id="ch2">
          <H2>제2장 회원</H2>

          <H3>제4조 (회원가입)</H3>
          <Ol>
            <li>회원가입은 이용자가 약관에 동의하고 필요한 정보를 입력함으로써 완료됩니다.</li>
            <li>허위 정보 기재, 타인 명의 도용 시 회원 자격이 제한될 수 있습니다.</li>
          </Ol>

          <H3>제5조 (회원 정보 관리)</H3>
          <P>
            회원은 계정 정보 및 개인정보를 스스로 관리할 책임이 있으며, 변경 사항이
            있을 경우 즉시 수정해야 합니다.
          </P>

          <H3>제6조 (회원 탈퇴 및 자격 상실)</H3>
          <Ol>
            <li>회원은 언제든지 탈퇴를 요청할 수 있습니다.</li>
            <li>약관 위반 시 운영자는 회원 자격을 제한 또는 상실시킬 수 있습니다.</li>
          </Ol>
        </section>

        <section id="ch3">
          <H2>제3장 서비스 이용</H2>

          <H3>제7조 (서비스의 제공)</H3>
          <Ol>
            <li>운영자는 회원에게 경기 매칭, 팀/개인 프로필 관리, 기록 조회 등의 서비스를 제공합니다.</li>
            <li>서비스는 운영상·기술상 필요에 따라 변경 또는 중단될 수 있습니다.</li>
          </Ol>

          <H3>제8조 (회원의 의무)</H3>
          <P>회원은 다음 행위를 하여서는 안 됩니다.</P>
          <Ul>
            <li>허위 정보 등록</li>
            <li>타인의 계정 도용</li>
            <li>불법·유해 콘텐츠 게시</li>
            <li>서비스 운영을 방해하는 행위</li>
            <li>공서양속에 반하는 행위</li>
            <li>경기 결과, 기록, 랭킹 등에 영향을 미치기 위해 허위 정보를 등록하거나 조작하는 행위</li>
          </Ul>

          <H3>제9조 (책임의 제한)</H3>
          <Ol>
            <li>
              운영자는 회원 간 경기 매칭을 중개하는 플랫폼으로, 경기의 실제 진행에
              직접 관여하지 않습니다.
            </li>
            <li>
              경기 과정에서 발생하는 분쟁, 사고, 손해에 대해 운영자는 책임을 지지
              않으며, 당사자 간 해결을 원칙으로 합니다.
            </li>
            <li>
              천재지변, 시스템 장애 등 불가항력 사유로 인한 서비스 중단에 대해
              운영자는 책임을 지지 않습니다.
            </li>
            <li>
              운영자는 회원이 서비스 내 정보를 신뢰하여 발생한 손해에 대해서도
              책임을 지지 않습니다.
            </li>
          </Ol>
        </section>

        <section id="ch4">
          <H2>제4장 기타</H2>

          <H3>제10조 (저작권)</H3>
          <P>
            서비스 내 콘텐츠의 저작권은 운영자 또는 해당 게시자에게 있으며, 무단
            복제·배포를 금지합니다.
          </P>

          <H3>제11조 (분쟁 해결)</H3>
          <P>
            서비스 이용 관련 불편 사항은 고객 문의를 통해 접수할 수 있으며, 운영자는
            신속한 해결을 위해 노력합니다.
          </P>

          <H3>제12조 (준거법 및 관할)</H3>
          <P>
            본 약관은 대한민국 법령을 준거법으로 하며, 분쟁 발생 시 운영자의 주소지를
            관할하는 법원을 전속 관할로 합니다.
          </P>
        </section>
      </Sheet>
    </Page>
  );
}
