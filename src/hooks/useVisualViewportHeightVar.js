/* eslint-disable */
// src/hooks/useVisualViewportHeightVar.js
// 모바일 키보드가 올라오면 visualViewport.height 가 줄어드는데, 100dvh 는 줄지 않아
// 하단 고정 입력창(채팅)이 키보드 뒤로 숨는 문제를 해결한다.
// 실제 보이는 높이를 CSS 변수 --app-vph 로 노출 → 채팅 컨테이너 높이 계산에 사용.
// (visualViewport 미지원 브라우저는 변수 미설정 → 기존 100dvh 폴백)
import { useEffect } from "react";

export default function useVisualViewportHeightVar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--app-vph", `${Math.round(vv.height)}px`);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--app-vph");
    };
  }, []);
}
