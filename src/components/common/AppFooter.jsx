/* eslint-disable */
// src/components/common/AppFooter.jsx
// ✅ links에 "이벤트" 기본 추가

import React from "react";
import styled from "styled-components";
import { FiPhone, FiMail, FiClock } from "react-icons/fi";

const Wrap = styled.footer`
  width: 100%;
  background: ${({ theme }) => theme.colors?.footerBg || "#2f3134"};
  color: ${({ theme }) => theme.colors?.footerText || "rgba(255,255,255,0.86)"};
  /* 하단 고정 탭바(BottomTabBar)에 가려 잘리지 않도록 탭바 높이 + 안전영역만큼 여백 확보 */
  padding: 14px 16px
    calc(16px + ${({ theme }) => theme.layout?.bottomTabHeight || 60}px + env(safe-area-inset-bottom));
  box-sizing: border-box;
`;

const Inner = styled.div`
  width: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Brand = styled.div`
  font-size: 16px;
  letter-spacing: -0.02em;
`;

const LinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
`;

const LinkBtn = styled.button`
  background: transparent;
  border: 0;
  padding: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const LinkA = styled.a`
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const ContactRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
`;

const ContactItem = styled.div`
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);

  svg {
    opacity: 0.9;
  }
`;

const Card = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CardTitle = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
`;

const CardLine = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
  word-break: keep-all;
`;

const Disclaimer = styled.div`
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.58);
  word-break: keep-all;
`;

const Copy = styled.div`
  margin-top: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
`;

function renderLink(link, idx) {
  if (!link) return null;
  const key = link.key || `${link.label || "link"}_${idx}`;

  if (typeof link.onClick === "function") {
    return (
      <LinkBtn key={key} type="button" onClick={link.onClick}>
        {link.label || "링크"}
      </LinkBtn>
    );
  }

  if (link.href) {
    return (
      <LinkA
        key={key}
        href={link.href}
        target={link.target || "_self"}
        rel={
          link.rel || (link.target === "_blank" ? "noopener noreferrer" : undefined)
        }
      >
        {link.label || "링크"}
      </LinkA>
    );
  }

  return null;
}

export default function AppFooter({
  brand = "할래말래",
  links = [
    { label: "이벤트" },              // ✅ 추가
    { label: "고객센터" },
    { label: "이용약관" },
    { label: "개인정보처리방침" },
  ],
  contact = {
    phone: "070-8065-7687",
    email: "hallae@ilsaeng.com",
  },
  company = {
    operatorLine: "상호 일생 | 대표 한주성",
    bizNo: "사업자등록번호 225-06-57521",
    commerceNo: "통신판매업 신고번호 제2026-화도수-0449호",
    address:
      "주소 경기도 남양주시 화도읍 마석중앙로37번길 45, 504호-N141호(별나라프라자)",
  },
  disclaimer = "할래말래는 팀·선수 간 경기 매칭을 연결하는 중개 플랫폼 서비스입니다. 회사는 경기의 개최·진행 및 회원 간 거래·분쟁의 당사자가 아니며, 이에 대한 책임을 지지 않습니다.",
  copyright = "© 2026 할래말래. All rights reserved.",
}) {
  return (
    <Wrap>
      <Inner>
        <BrandRow>
          <Brand>{brand}</Brand>
        </BrandRow>

        <LinkRow>{(links || []).map(renderLink)}</LinkRow>

        <ContactRow>
          {contact?.phone && (
            <ContactItem>
              <FiPhone size={13} />
              <span>{contact.phone}</span>
            </ContactItem>
          )}

          {contact?.email && (
            <ContactItem>
              <FiMail size={13} />
              <span>이메일 {contact.email}</span>
            </ContactItem>
          )}

          {contact?.hours && (
            <ContactItem>
              <FiClock size={13} />
              <span>{contact.hours}</span>
            </ContactItem>
          )}
        </ContactRow>

        <Card>
          <CardTitle>{company?.operatorLine || "운영사 정보"}</CardTitle>
          {company?.bizNo && <CardLine>{company.bizNo}</CardLine>}
          {company?.address && <CardLine>{company.address}</CardLine>}
          {company?.ceo && <CardLine>{company.ceo}</CardLine>}
          {company?.commerceNo && <CardLine>{company.commerceNo}</CardLine>}
        </Card>

        {disclaimer && <Disclaimer>{disclaimer}</Disclaimer>}

        <Copy>{copyright}</Copy>
      </Inner>
    </Wrap>
  );
}
