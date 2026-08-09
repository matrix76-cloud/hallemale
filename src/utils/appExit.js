/* eslint-disable */
// src/utils/appExit.js
// "앱 종료?" 확인 — 뒤로 갈 곳이 없는 화면(각 영역의 진입점·게이트)에서 하드웨어 뒤로가기의 종착지.
//
// ⚠️ UIContext 의 showModal 은 MainLayout 안에서만 렌더된다. 게이트 화면(RequireConsent 등은
//    MainLayout 대신 게이트를 렌더)과 구장주/어드민 트리에는 그 렌더러가 없어서, 거기서 showModal 을
//    부르면 상태만 켜지고 화면엔 아무것도 안 뜬다(= 뒤로가기 무반응). 그래서 App 루트에 항상 떠 있는
//    공통 팝업(AppDialog)을 쓴다.
import { showConfirm } from "./appDialog";

let pending = false;

/**
 * @param {object} bridge - WebviewBridgeContext ({ sendToApp, isWebView })
 * @returns {boolean} 종료 확인을 띄웠는지 (웹뷰가 아니면 false — 브라우저엔 종료 개념이 없다)
 */
export function confirmAppExit(bridge) {
  if (!bridge?.isWebView) return false;
  if (pending) return true; // 연타로 팝업이 쌓이지 않게

  pending = true;
  showConfirm("앱을 종료하시겠습니까?", {
    title: "앱 종료",
    confirmText: "종료",
    cancelText: "취소",
  })
    .then((ok) => {
      if (ok && bridge.sendToApp) bridge.sendToApp("EXIT_APP");
    })
    .finally(() => {
      pending = false;
    });
  return true;
}
