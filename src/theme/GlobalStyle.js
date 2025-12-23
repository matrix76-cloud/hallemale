// src/theme/GlobalStyle.jsx
/* eslint-disable */
import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`

  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 400;
    src: url("/fonts/Pretendard-Regular.woff") format("woff");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 500;
    src: url("/fonts/Pretendard-Medium.woff") format("woff");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 600;
    src: url("/fonts/Pretendard-SemiBold.woff") format("woff");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 700;
    src: url("/fonts/Pretendard-Bold.woff") format("woff");
    font-display: swap;
  }

  @font-face {
  font-family: "GmarketSans";
  font-style: normal;
  font-weight: 300;
  src: url("/fonts/GmarketSansLight.woff2") format("woff2");
  font-display: swap;
  }
  @font-face {
    font-family: "GmarketSans";
    font-style: normal;
    font-weight: 500;
    src: url("/fonts/GmarketSansMedium.woff2") format("woff2");
    font-display: swap;
  }
  @font-face {
    font-family: "GmarketSans";
    font-style: normal;
    font-weight: 700;
    src: url("/fonts/GmarketSansBold.woff2") format("woff2");
    font-display: swap;
  }
    
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
    font-family:  'Pretendard', -apple-system, BlinkMacSystemFont,
      system-ui, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 400;
    background: ${({ theme }) => theme.colors.bg || "#ffffff"};
    color: ${({ theme }) => theme.colors.text || "#111111"};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing:-0.025em;
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
