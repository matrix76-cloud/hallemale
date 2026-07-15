// src/theme/theme.js

const sharedTokens = {
  fontSizes: {
    caption: 11,
    bodySm: 12,
    body: 13,
    bodyLg: 14,
    titleSm: 16,
    title: 18,
    titleLg: 22,
    display: 26,
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.15,
    normal: 1.4,
    relaxed: 1.6,
  },
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  layout: {
    bottomTabHeight: 60,
    maxWidth: 480,
  },
};

export const lightTheme = {
  mode: "light",
  ...sharedTokens,
  colors: {
    primary: "#4f46e5",
    primaryWeak: "#5c55e8ff",
    bg: "#f9fafb",
    card: "#FFFFFF",
    surface: "#FFFFFF",
    textStrong: "#111827",
    textNormal: "#374151",
    textWeak: "#6b7280",
    // 별칭(레거시 참조 호환): 일부 컴포넌트가 존재하지 않던 text/textSub/muted 를 참조해
    // 다크모드에서 하드코딩 폴백(#111827 등)이 떠 글씨가 안 보였음 → 정본 토큰으로 매핑.
    text: "#111827",
    textSub: "#374151",
    muted: "#6b7280",
    accent: "#0FA464",
    danger: "#DC2626",
    border: "#E5E7EB",
    divider: "#F1F5F9",
  },
  shadows: {
    card: "0 6px 16px rgba(15, 23, 42, 0.08)",
  },
};

export const darkTheme = {
  mode: "dark",
  ...sharedTokens,
  colors: {
    primary: "#6366f1",
    primaryWeak: "#4f46e5",
    bg: "#0b1220",
    card: "#111827",
    surface: "#1f2937",
    textStrong: "#f9fafb",
    textNormal: "#e5e7eb",
    textWeak: "#9ca3af",
    // 별칭(레거시 참조 호환) — light 와 동일하게 정본 토큰으로 매핑(다크 값)
    text: "#f9fafb",
    textSub: "#e5e7eb",
    muted: "#9ca3af",
    accent: "#22c55e",
    danger: "#f87171",
    border: "#1f2937",
    divider: "#1f2937",
  },
  shadows: {
    card: "0 6px 16px rgba(0, 0, 0, 0.40)",
  },
};

const theme = lightTheme;
export default theme;
