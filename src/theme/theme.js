// src/theme/theme.js

const theme = {
  colors: {
    primary: "#346EF6",      // 메인 블루
    primaryWeak: "#5E8EFF",  // 연한 블루
    bg: "#F3F4F6",           // 기본 배경
    card: "#FFFFFF",         // 카드/폼 배경
    textStrong: "#111827",   // 진한 텍스트
    textNormal: "#374151",
    textWeak: "#9CA3AF",
    accent: "#0FA464",       // 포인트 그린 (완료 등)
    danger: "#DC2626",
    border: "#E5E7EB"
  },

  // 폰트 사이즈 스케일
  fontSizes: {
    caption: 11,      // 아주 작은 설명, 라벨
    bodySm: 12,
    body: 13,         // 기본 본문
    bodyLg: 14,
    titleSm: 16,      // 섹션 타이틀
    title: 18,        // 페이지 타이틀
    titleLg: 22,      // 온보딩 큰 타이틀
    display: 26       // 정말 크게 쓸 때
  },

  // 폰트 weight 통일
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },

  lineHeights: {
    tight: 1.15,
    normal: 1.4,
    relaxed: 1.6
  },

  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    pill: 999
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32
  },

  shadows: {
    card: "0 6px 16px rgba(15, 23, 42, 0.08)"
  },

  layout: {
    bottomTabHeight: 60,
    maxWidth: 480
  }
};

export default theme;
