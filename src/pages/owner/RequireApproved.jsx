/* eslint-disable */
// src/pages/owner/RequireApproved.jsx
// 승인된 구장이 있어야 접근 가능한 탭(예약/내구장) 가드
import React from "react";
import { Navigate } from "react-router-dom";
import { useOwner } from "../../context/OwnerContext";
import OwnerSpinner from "./components/OwnerSpinner";

export default function RequireApproved({ children }) {
  const { loading, venue } = useOwner();
  if (loading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue) return <Navigate to="/owner/register" replace />;
  if (venue.status !== "approved") return <Navigate to="/owner/pending" replace />;
  return children;
}
