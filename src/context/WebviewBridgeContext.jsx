import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  isInWebView,
  postToApp,
  parseAppMessage,
} from "../bridge/webviewBridge";

const WebviewBridgeContext = createContext(null);

export function WebviewBridgeProvider({ children }) {
  const listenersRef = useRef({});
  const didSendWebReady = useRef(false);

  /**
   * Web → RN 메시지 발송
   * @param {string} type
   * @param {object} payload
   */
  const sendToApp = useCallback((type, payload = {}) => {
    return postToApp(type, payload);
  }, []);

  /**
   * RN → Web 메시지 타입별 구독
   * @param {string} type - 메시지 타입 ("*" = 와일드카드)
   * @param {function} callback - (payload) => void  ("*"이면 { type, payload })
   * @returns {() => void} unsubscribe
   */
  const subscribe = useCallback((type, callback) => {
    if (!listenersRef.current[type]) {
      listenersRef.current[type] = new Set();
    }
    listenersRef.current[type].add(callback);
    return () => {
      listenersRef.current[type]?.delete(callback);
    };
  }, []);

  // ── RN → Web 메시지 수신 → 타입별 라우팅 ──
  useEffect(() => {
    const handler = (event) => {
      const msg = parseAppMessage(event.data);
      if (!msg) return;

      const { type, payload } = msg;

      // 타입별 리스너
      const cbs = listenersRef.current[type];
      if (cbs?.size) {
        cbs.forEach((cb) => {
          try {
            cb(payload);
          } catch (e) {
            console.warn("[Bridge] listener error:", type, e);
          }
        });
      }

      // 와일드카드 리스너 (디버깅 등)
      const wildcard = listenersRef.current["*"];
      if (wildcard?.size) {
        wildcard.forEach((cb) => {
          try {
            cb({ type, payload });
          } catch {}
        });
      }
    };

    // RN WebView: iOS는 window에, Android는 document에 message가 dispatch됨
    window.addEventListener("message", handler);
    document.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      document.removeEventListener("message", handler);
    };
  }, []);

  // ── 마운트 시 WEB_READY 발송 (1회) ──
  useEffect(() => {
    if (!isInWebView()) return;
    if (didSendWebReady.current) return;
    didSendWebReady.current = true;

    requestAnimationFrame(() => {
      postToApp("WEB_READY", { at: Date.now() });
    });
  }, []);

  const value = {
    sendToApp,
    subscribe,
    isWebView: isInWebView(),
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
