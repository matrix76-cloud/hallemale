/* eslint-disable */
// src/components/matchRoom/matchRoomPalette.js
// 매칭룸/채팅 전용 팔레트 — 기획안 HTML(할래말래_직접입력.html)의
// 다크(.phone .screen) / 라이트(.phone.light .screen) 두 버전을 그대로 옮긴 것.
// 앱 색상 모드(theme.mode)에 맞춰 mrp(theme.mode)로 선택해서 사용한다.

export const MR_DARK = {
  bg: "#070a14",
  bg2: "#0c1020",
  surface: "#121829",
  surface2: "#171f33",
  line: "#222d44",
  line2: "#2c3a55",
  t1: "#eef2ff",
  t2: "#94a6c4",
  t3: "#5d7095",
  pu: "#7c5cff",
  puD: "#5b3fd6",
  puL: "#b3a0ff",
  puBg: "#1a1640",
  gr: "#1fd187",
  grL: "#6ef0bb",
  grBg: "#08291f",
  ye: "#ffce4a",
  yeL: "#ffe18a",
  yeBg: "#332700",
  bl: "#4aa3ff",
  blL: "#9ecbff",
  blBg: "#082038",
  blBorder: "#1c4f80",
  // mode-specific
  vsCardBg: "linear-gradient(135deg, #121829, #0c1020)",
  vsCardShadow: "none",
  vsGlow: true, // ::before 보라 글로우
  crestBg: "linear-gradient(145deg,#2a3350,#1a2138)",
  crestHomeBg: "linear-gradient(145deg, #5b3fd6, #3d28a0)",
  bubbleMeBg: "linear-gradient(135deg, #7c5cff, #5b3fd6)",
};

export const MR_LIGHT = {
  bg: "#ffffff",
  bg2: "#f5f6f8",
  surface: "#ffffff",
  surface2: "#eef0f4",
  line: "#e8eaef",
  line2: "#e1e4ea",
  t1: "#1b1f27",
  t2: "#454c5a",
  t3: "#6b7280",
  pu: "#6c5ce7",
  puD: "#5546c9",
  puL: "#6c5ce7",
  puBg: "#f0eefc",
  gr: "#16a34a",
  grL: "#15803d",
  grBg: "#e8f6ee",
  ye: "#d97706",
  yeL: "#b45309",
  yeBg: "#fef4e2",
  bl: "#2563eb",
  blL: "#1d4ed8",
  blBg: "#eaf1fe",
  blBorder: "#cdddfb",
  // mode-specific
  vsCardBg: "#ffffff",
  vsCardShadow: "0 1px 2px rgba(16,24,40,.05)",
  vsGlow: false,
  crestBg: "#eef0f4",
  crestHomeBg: "#6c5ce7",
  bubbleMeBg: "#6c5ce7",
};

export const mrp = (mode) => (mode === "dark" ? MR_DARK : MR_LIGHT);
