/* eslint-disable */
// src/admin/layout/AdminShell.jsx
import React from "react";
import styled from "styled-components";
import { Outlet } from "react-router-dom";
import AdminTopbar from "./AdminTopbar";
import AdminSidebar from "./AdminSidebar";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  width: 100vw;
  background: #f5f6fa;
`;

const Content = styled.div`
  flex: 1;
  display: grid;
  min-width: 0;
  grid-template-columns: 240px minmax(0, 1fr);
  grid-template-areas: "sidebar main";
`;

const SideArea = styled.aside`
  grid-area: sidebar;
  min-width: 0;
`;

const Main = styled.main`
  grid-area: main;
  padding: 24px;
  overflow: auto;
  min-width: 0;
`;

export default function AdminShell() {
  return (
    <Wrap>
      <AdminTopbar />
      <Content>
        <SideArea>
          <AdminSidebar />
        </SideArea>
        <Main>
          <Outlet />
        </Main>
      </Content>
    </Wrap>
  );
}
