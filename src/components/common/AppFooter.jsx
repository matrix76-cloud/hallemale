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
  padding: 14px 16px 16px;
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
    email: "hallae@ilsaeng.com",
  },
  company = {
    operatorLine: "상호 일생 | 대표 한주성",
    bizNo: "사업자등록번호 225-06-57521",
    address:
      "주소 경기도 남양주시 화도읍 마석중앙로37번길 45, 504호-N141호(별나라프라자)",
  },
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

        <Copy>{copyright}</Copy>
      </Inner>
    </Wrap>
  );
}
