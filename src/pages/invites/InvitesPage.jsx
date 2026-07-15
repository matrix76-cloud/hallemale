import React from "react";
import { Navigate } from "react-router-dom";

// 구 placeholder(수락/거절 UI·데이터 없음). 실제 받은 초대는 /my/team-invites 에 있으므로 리다이렉트.
export default function InvitesPage() {
  return <Navigate to="/my/team-invites" replace />;
}
