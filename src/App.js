import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "styled-components";
import GlobalStyle from "./theme/GlobalStyle";
import theme from "./theme/theme";
import { AuthProvider } from "./context/AuthContext";
import { ClubProvider } from "./context/ClubContext";
import { UIProvider } from "./context/UIContext";
import { WebviewBridgeProvider } from "./context/WebviewBridgeContext";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <ClubProvider>
          <UIProvider>
            <WebviewBridgeProvider>
              <AppRoutes />
            </WebviewBridgeProvider>
          </UIProvider>
        </ClubProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
