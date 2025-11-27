import React from "react";
import styled from "styled-components";

const StyledButton = styled.button`
  width: ${({ fullWidth }) => (fullWidth ? "100%" : "auto")};
  padding: 10px 16px;
  border-radius: 999px;
  border: none;
  font-size: 14px;
  font-weight: 500;
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
