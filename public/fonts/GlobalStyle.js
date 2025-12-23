// src/styles/GlobalStyle.js
import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  /* Pretendard 로컬 폰트 등록 (woff) */
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

  * {
    box-sizing: border-box;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100%;
  }

  body {
    font-family: ${({ theme }) => theme.fontFamily.base};
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.bg};
  }

  button, input, textarea {
    font-family: ${({ theme }) => theme.fontFamily.base};
  }
`;

export default GlobalStyle;
