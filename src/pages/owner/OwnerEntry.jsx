/* eslint-disable */
// src/pages/owner/OwnerEntry.jsx
// /owner 진입점 — 막지 않고 바로 워크스페이스(예약 탭)로 입장.
// 구장 등록/심사 상태는 각 탭 안에서 인포 카드로 안내한다.
import React from "react";
import { Navigate } from "react-router-dom";

export default function OwnerEntry() {
  return <Navigate to="/owner/home" replace />;
}
