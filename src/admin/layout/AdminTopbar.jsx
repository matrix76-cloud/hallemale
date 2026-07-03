/* eslint-disable */
// src/admin/layout/AdminTopbar.jsx
// 얇은 상단바 (jogun 레이아웃 참고): 접속시간 / 관리자명 / 로그아웃
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { IoTimeOutline, IoLogOutOutline } from "react-icons/io5";
import { adminSignOut } from "../../services/adminAuthService";

const ADMIN_SESSION_USER_KEY = "HALLE_ADMIN_USER";

const Bar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 50;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  svg {
    font-size: 15px;
  }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const AdminName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #111827;
`;

const LogoutBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: #f5f6fa;
    color: #111827;
  }
  svg {
    font-size: 14px;
  }
`;

function formatNow() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function readAdminUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export default function AdminTopbar() {
  const nav = useNavigate();
  const [loginTime] = React.useState(() => formatNow());
  const [user] = React.useState(() => readAdminUser());

  const handleLogout = async () => {
    await adminSignOut();
    nav("/admin/login", { replace: true });
  };

  const displayName = user?.name || user?.id || "관리자";

  return (
    <Bar>
      <Left>
        <IoTimeOutline />
        접속: {loginTime}
      </Left>
      <Right>
        <AdminName>{displayName}님</AdminName>
        <LogoutBtn onClick={handleLogout}>
          <IoLogOutOutline />
          로그아웃
        </LogoutBtn>
      </Right>
    </Bar>
  );
}
