/* eslint-disable */
// src/utils/appDialog.js
// 공통 팝업(알럿/컨펌) 명령형 API — 네이티브 alert()/confirm() 대체.
// - 서비스/페이지 어디서든 import 해서 사용 (React 밖에서도 호출 가능)
// - 실제 렌더는 App 루트에 마운트된 <AppDialog/> 가 담당
//
// 사용:
//   import { showAlert, showConfirm } from "../utils/appDialog";
//   await showAlert("저장했어요.");
//   if (await showConfirm("삭제할까요?")) { ... }

let queue = [];
let current = null;
const listeners = new Set();

function notify() {
  listeners.forEach((l) => {
    try {
      l(current);
    } catch (e) {}
  });
}

export function subscribeAppDialog(fn) {
  listeners.add(fn);
  fn(current);
  return () => {
    listeners.delete(fn);
  };
}

function startNext() {
  current = queue.shift() || null;
  notify();
}

function enqueue(item) {
  return new Promise((resolve) => {
    queue.push({ ...item, resolve });
    if (!current) startNext();
  });
}

// 현재 팝업 닫고 결과 resolve → 대기열 다음 항목 표시
export function resolveAppDialog(value) {
  if (!current) return;
  const r = current.resolve;
  current = null;
  notify();
  if (typeof r === "function") r(value);
  if (queue.length) startNext();
}

/** 알림(확인 버튼 1개). Promise<true> 반환 (닫히면 resolve) */
export function showAlert(message, opts = {}) {
  return enqueue({
    kind: "alert",
    title: opts.title || "",
    message: message == null ? "" : String(message),
    confirmText: opts.confirmText || "확인",
    tone: opts.tone || "default",
  });
}

/** 확인/취소. Promise<boolean> 반환 (확인=true, 취소=false) */
export function showConfirm(message, opts = {}) {
  return enqueue({
    kind: "confirm",
    title: opts.title || "",
    message: message == null ? "" : String(message),
    confirmText: opts.confirmText || "확인",
    cancelText: opts.cancelText || "취소",
    tone: opts.tone || "default",
  });
}
