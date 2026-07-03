// src/theme/GlobalStyle.jsx
/* eslint-disable */
import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`

  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 400;
    src: url("/fonts/Pretendard-Regular.woff2") format("woff2");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 500;
    src: url("/fonts/Pretendard-Medium.woff2") format("woff2");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 600;
    src: url("/fonts/Pretendard-SemiBold.woff2") format("woff2");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 700;
    src: url("/fonts/Pretendard-Bold.woff2") format("woff2");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 800;
    src: url("/fonts/Pretendard-ExtraBold.woff2") format("woff2");
    font-display: swap;
  }
  @font-face {
    font-family: "Pretendard";
    font-style: normal;
    font-weight: 900;
    src: url("/fonts/Pretendard-Black.woff2") format("woff2");
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

  /* #root 를 유일한 스크롤 컨테이너로 지정.
     이렇게 해야 TopHeader 의 position:sticky 가 실제 스크롤러(#root)를 기준으로
     잡혀서 상단에 고정된다. (body/window 스크롤이면 sticky 가 깨져 헤더가 같이 올라감) */
  #root {
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  html {
    -webkit-text-size-adjust: 100%;
  }

  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont,
      system-ui, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    background: ${({ theme }) => theme.colors.bg || "#ffffff"};
    color: ${({ theme }) => theme.colors.textStrong || "#111111"};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing:-0.025em;
    transition: background 0.2s ease, color 0.2s ease;
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
