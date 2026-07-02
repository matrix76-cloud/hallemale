/* eslint-disable */
// src/pages/owner/components/useConfirm.js
// Promise 기반 확인창 훅. 사용:
//   const { confirmState, ask, closeConfirm } = useConfirm();
//   if (await ask({ title, message, confirmLabel, danger })) { ...실행... }
//   <ConfirmDialog state={confirmState} onConfirm={()=>closeConfirm(true)} onCancel={()=>closeConfirm(false)} />
import { useState, useRef, useCallback } from "react";

export function useConfirm() {
  const [confirmState, setConfirmState] = useState(null);
  const resolver = useRef(null);

  const ask = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setConfirmState({
          title: "",
          message: "",
          confirmLabel: "확인",
          cancelLabel: "취소",
          danger: false,
          ...opts,
        });
      }),
    []
  );

  const closeConfirm = useCallback((result) => {
    setConfirmState(null);
    if (resolver.current) {
      resolver.current(!!result);
      resolver.current = null;
    }
  }, []);

  return { confirmState, ask, closeConfirm };
}
