/* eslint-disable */
// src/hooks/useExitConfirm.js
// 게이트 화면(동의·전화인증·구장주 주체선택 등)에서 하드웨어 뒤로가기의 종착지.
// 게이트는 통과 전엔 뒤로 갈 곳이 없어서 예전엔 뒤로가기를 '소비'만 했고, 사용자에겐
// "뒤로가기가 안 먹는 화면"으로 보였다. 이제는 앱 종료 확인 모달을 띄운다.
//
// 사용:
//   const confirmExit = useExitConfirm();
//   useBackInterceptor(true, confirmExit);
import { useCallback } from "react";
import { useWebviewBridgeContext } from "../context/WebviewBridgeContext";
import { confirmAppExit } from "../utils/appExit";

export function useExitConfirm() {
  const bridge = useWebviewBridgeContext();
  return useCallback(() => confirmAppExit(bridge), [bridge]);
}

export default useExitConfirm;
