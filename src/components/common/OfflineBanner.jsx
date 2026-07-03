/* eslint-disable */
// src/components/common/OfflineBanner.jsx
// ✅ 전역 오프라인 안내 배너
// - 네트워크가 끊기면(navigator.onLine=false / offline 이벤트) 모든 화면 상단에 표시
// - 다시 연결되면 자동으로 사라짐
// - "재시도": 연결 복구 후 화면 데이터 새로고침(일부 1회성 fetch 화면 대응)
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { FiWifiOff } from "react-icons/fi";

const Bar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1500;
  background: #b91c1c;
  color: #fff;
  padding: calc(env(safe-area-inset-top) + 8px) 14px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
`;

const Msg = styled.span`
  flex: 1;
  min-width: 0;
`;

const RetryBtn = styled.button`
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  const handleRetry = () => {
    // 연결이 실제로 복구됐으면 새로고침으로 데이터 갱신, 아니면 상태만 재확인
    if (navigator.onLine) {
      window.location.reload();
    } else {
      setOnline(navigator.onLine);
    }
  };

  return (
    <Bar role="alert">
      <FiWifiOff size={16} />
      <Msg>인터넷 연결이 끊겼어요. 연결 상태를 확인해주세요.</Msg>
      <RetryBtn type="button" onClick={handleRetry}>
        재시도
      </RetryBtn>
    </Bar>
  );
}
