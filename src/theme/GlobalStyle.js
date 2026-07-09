// src/theme/GlobalStyle.jsx
/* eslint-disable */
import { createGlobalStyle } from "styled-components";

// @font-face 는 public/fonts/pretendard.css 로 옮겼다 (scripts/subset-fonts.py 가 생성).
// 굵기당 통짜 770KB 대신 상용 2,350자 subset(약 205KB) + 나머지 ext 로 나눠, 일반 화면은
// subset 만 받는다. index.html 이 해당 CSS 를 <link> 로 로드한다.
const GlobalStyle = createGlobalStyle`

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
