import React, { useEffect, useState } from "react";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "styled-components";
import GlobalStyle from "./theme/GlobalStyle";
import { lightTheme, darkTheme } from "./theme/theme";
import { ThemeModeProvider, useThemeMode } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ClubProvider } from "./context/ClubContext";
import { UIProvider } from "./context/UIContext";
import { WebviewBridgeProvider } from "./context/WebviewBridgeContext";
import { HomeDataProvider } from "./context/HomeDataContext";
import { MatchingDataProvider } from "./context/MatchingDataContext";
import { IoInformationCircleOutline } from "react-icons/io5";
import { checkAppUpdate } from "./services/appVersionService";

function VersionChecker() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    checkAppUpdate({
      onUpdate: (latest) => {
        setToast({
          version: latest.version,
          content: latest.content || "",
        });
      },
    });
  }, []);

  if (!toast) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 16,
        zIndex: 9999,
        background: "#ffffff",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        color: "#111",
      }}
    >
      <IoInformationCircleOutline size={20} color="#2563eb" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          새로운 버전으로 업데이트 중... (v{toast.version})
        </div>
        {toast.content && (
          <div style={{ color: "#555", fontSize: 12 }}>{toast.content}</div>
        )}
      </div>
    </div>
  );
}

function ThemedApp() {
  const { mode } = useThemeMode();
  const theme = mode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <ClubProvider>
          <UIProvider>
            <HomeDataProvider>
              <MatchingDataProvider>
                <WebviewBridgeProvider>
                  <AppRoutes />
                  <VersionChecker />
                </WebviewBridgeProvider>
              </MatchingDataProvider>
            </HomeDataProvider>
          </UIProvider>
        </ClubProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  );
}
