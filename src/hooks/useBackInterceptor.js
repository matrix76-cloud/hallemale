/* eslint-disable */
// src/hooks/useBackInterceptor.js
// active가 true인 동안 안드로이드 하드웨어 뒤로가기를 가로채 closeFn을 실행한다.
//
// 동작 원리:
//  - UIContext.registerBackInterceptor 로 LIFO 스택에 등록하면 blockingCount가 올라가고,
//    BridgeNavSync가 NAV_STATE.hasBlockingUI=true 로 전송 → RN이 BACK_REQUEST를 보냄 →
//    AppRoutes의 BACK_REQUEST 핸들러가 최상단 인터셉터(runTopBackInterceptor)를 실행.
//  - 따라서 오버레이/게이트/작성이탈 가드를 이 훅 하나로 통일 처리한다. (RN 수정 불필요)
//
// 사용:
//  useBackInterceptor(isOpen, () => setOpen(false));           // 오버레이 닫기
//  useBackInterceptor(true, () => { /* consume, no-op */ });    // 게이트: 뒤로가기 소비
//  useBackInterceptor(dirty, () => showLeaveConfirm());         // 작성 이탈 확인
import { useEffect, useRef } from "react";
import { useUIActions } from "./useUI";

export function useBackInterceptor(active, closeFn) {
  const ui = useUIActions();
  const registerBackInterceptor = ui?.registerBackInterceptor;
  const fnRef = useRef(closeFn);
  fnRef.current = closeFn;

  useEffect(() => {
    if (!active || typeof registerBackInterceptor !== "function") return;
    const unregister = registerBackInterceptor(() => {
      try {
        fnRef.current && fnRef.current();
      } catch (e) {}
    });
    return unregister;
  }, [active, registerBackInterceptor]);
}

export default useBackInterceptor;
