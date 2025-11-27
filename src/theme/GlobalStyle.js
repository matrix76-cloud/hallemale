// src/theme/GlobalStyle.jsx
/* eslint-disable */
import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  body {
    /* 메인: Open Sans, 보조: Pretendard */
    font-family: 'Open Sans', 'Pretendard', -apple-system, BlinkMacSystemFont,
      system-ui, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 400;
    background: ${({ theme }) => theme.colors.bg || "#ffffff"};
    color: ${({ theme }) => theme.colors.text || "#111111"};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  img {
    max-width: 100%;
    display: block;
  }

  button {
    font-family: inherit;
  }

  input, textarea {
    font-family: inherit;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`;

export default GlobalStyle;
