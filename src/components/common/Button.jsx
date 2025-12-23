import React from "react";
import styled from "styled-components";

const StyledButton = styled.button`
  width: ${({ fullWidth }) => (fullWidth ? "100%" : "auto")};
  padding: 16px 16px;
  border-radius: 999px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  background: ${({ variant, theme }) =>
    variant === "secondary" ? theme.colors.primaryWeak : theme.colors.primary};
  color: ${({ variant, theme }) =>
    variant === "secondary" ? theme.colors.primary : "#FFFFFF"};
`;

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  ...rest
}) {
  return (
    <StyledButton variant={variant} fullWidth={fullWidth} {...rest}>
      {children}
    </StyledButton>
  );
}
