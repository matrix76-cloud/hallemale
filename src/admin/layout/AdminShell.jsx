/* eslint-disable */
// src/admin/layout/AdminShell.jsx
import React from "react";
import styled from "styled-components";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import AdminBreadcrumb from "./AdminBreadcrumb";

const SIDEBAR_W = 220;

const Wrap = styled.div`
  display: flex;
  min-height: 100dvh;
  background: #f5f6fa;
`;

const Content = styled.main`
  flex: 1;
  margin-left: ${SIDEBAR_W}px;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const Body = styled.div`
  flex: 1;
  padding: 24px;
  overflow: auto;
  min-width: 0;
`;

export default function AdminShell() {
  return (
    <Wrap>
      <AdminSidebar width={SIDEBAR_W} />
      <Content>
        <AdminTopbar />
        <AdminBreadcrumb />
        <Body>
          <Outlet />
        </Body>
      </Content>
    </Wrap>
  );
}
