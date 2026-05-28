/* eslint-disable */
// src/components/common/BlockedAuthGate.jsx
// 로그인된 사용자가 차단되면 화면을 가리고 차단 다이얼로그 표시
// - signOut은 하지 않음 (그 사이 어드민이 해제할 수 있으므로 새로고침 시 재확인)
// - 어드민 영역(/admin/*)에서는 동작하지 않음

import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import BlockedOverlay from "./BlockedOverlay";

export default function BlockedAuthGate() {
  const { firebaseUser, userDoc } = useAuth();
  const location = useLocation();

  const isAdminPath = String(location.pathname || "").startsWith("/admin");
  if (isAdminPath) return null;

  if (!firebaseUser?.uid) return null;
  if (!userDoc) return null;
  if (userDoc.blocked !== true) return null;

  return (
    <BlockedOverlay
      title="이 계정은 차단되었습니다"
      description={
        "관리자에 의해 이용이 제한되었습니다.\n새로고침 시 차단 상태가 다시 확인됩니다."
      }
      reason={userDoc?.blockedReason}
      blockedAt={userDoc?.blockedAt}
    />
  );
}
