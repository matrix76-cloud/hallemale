import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const WebviewBridgeContext = createContext(null);

export function WebviewBridgeProvider({ children }) {
  const [lastMessageFromApp, setLastMessageFromApp] = useState(null);

  const sendToApp = useCallback((payload) => {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const handler = (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        setLastMessageFromApp(data);
      } catch {
        setLastMessageFromApp(event.data);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const value = {
    sendToApp,
    lastMessageFromApp
  };

  return (
    <WebviewBridgeContext.Provider value={value}>
      {children}
    </WebviewBridgeContext.Provider>
  );
}

export function useWebviewBridgeContext() {
  return useContext(WebviewBridgeContext);
}
