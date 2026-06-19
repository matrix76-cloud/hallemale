/* eslint-disable */
// src/context/ThemeContext.jsx
// 다크/라이트 모드 토글 + localStorage 영속 (기본 라이트)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "halle.theme.mode";

const ThemeModeContext = createContext({
  mode: "light",
  setMode: () => {},
  toggleMode: () => {},
});

function readInitialMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {}
  return "light";
}

export function ThemeModeProvider({ children }) {
  const [mode, setModeState] = useState(readInitialMode);

  const setMode = useCallback((next) => {
    const v = next === "light" ? "light" : "dark";
    setModeState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch (e) {}
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {}
      return next;
    });
  }, []);

  // body 에 data-theme 속성도 동기화 (필요시 CSS 변수 활용)
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", mode);
    } catch (e) {}
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
