import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: 16px 16px 24px;
`;

export default function PageContainer({ children }) {
  return <Wrap>{children}</Wrap>;
}
