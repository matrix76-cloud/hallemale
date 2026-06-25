/* eslint-disable */
// src/setupProxy.js
// CRA 개발 서버(npm start) 전용 설정 — 빌드/배포에는 영향 없음.
//
// [목적] Firebase signInWithPopup(구글 로그인)이 localhost 에서 간헐적으로 실패/멈추는 문제 해결.
//   구글 팝업이 accounts.google.com(COOP: same-origin)으로 이동하면 opener(localhost)가
//   window.closed 를 읽지 못해 "Cross-Origin-Opener-Policy policy would block the window.closed call"
//   경고가 뜨고, 팝업 닫힘 감지가 깨져 타이밍에 따라 auth/popup-closed-by-user 로 실패한다.
//   opener 응답에 COOP: same-origin-allow-popups 를 주면 팝업 핸들을 유지해 안정적으로 동작한다.
module.exports = function (app) {
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });
};
