import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: 16px max(16px, env(safe-area-inset-left))
    calc(24px + env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-right));
`;

export default function PageContainer({ children }) {
  return <Wrap>{children}</Wrap>;
}
