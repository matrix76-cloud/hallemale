/* eslint-disable */
// src/components/common/AppErrorBoundary.jsx
// 전역 렌더 예외 안전망. RN WebView엔 새로고침 크롬이 없어, 한 번의 렌더 throw가
// 전체 트리를 언마운트하면 사용자는 백지 화면에 갇힌다 → fallback + 다시시도로 복구.
// 라우트가 바뀌면 자동으로 에러 상태를 해제(같은 화면 반복 크래시가 아니면 계속 이용 가능).
import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this._path = typeof window !== "undefined" ? window.location.pathname : "";
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 원격 디버깅/로그 수집용 (throw는 삼킨다)
    try {
      console.error("[AppErrorBoundary]", error?.message || error, info?.componentStack || "");
    } catch (e) {}
  }

  componentDidUpdate() {
    // 라우트 이동 시 에러 자동 해제 → 다른 화면으로 벗어나면 정상 복귀
    if (this.state.error && typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p !== this._path) {
        this._path = p;
        this.setState({ error: null });
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const reload = () => {
      try {
        if (typeof window !== "undefined") window.location.reload();
      } catch (e) {}
    };
    const goHome = () => {
      try {
        if (typeof window !== "undefined") window.location.href = "/";
      } catch (e) {}
    };

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: "24px calc(24px + env(safe-area-inset-bottom))",
          textAlign: "center",
          background: "#fff",
          color: "#111",
        }}
      >
        <div style={{ fontSize: 40 }}>🏀</div>
        <div style={{ fontWeight: 700, fontSize: 17 }}>일시적인 오류가 발생했어요</div>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5, maxWidth: 280 }}>
          화면을 불러오는 중 문제가 생겼어요.
          <br />
          다시 시도하거나 홈으로 이동해 주세요.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={reload}
            style={{
              padding: "11px 20px",
              borderRadius: 12,
              border: "none",
              background: "#7C5CC9",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={goHome}
            style={{
              padding: "11px 20px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#333",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
