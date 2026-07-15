import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { captureReferrerFromUrl } from "./utils/referral";

// 초대 링크(?ref=<uid>)로 진입한 경우, 라우팅이 쿼리를 정리하기 전에 먼저 캡처
captureReferrerFromUrl();

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
