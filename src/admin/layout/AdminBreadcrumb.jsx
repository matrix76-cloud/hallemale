/* eslint-disable */
// src/admin/layout/AdminBreadcrumb.jsx
import React, { useMemo } from "react";
import styled from "styled-components";
import { NavLink, useLocation } from "react-router-dom";
import { IoChevronForwardOutline, IoHomeOutline } from "react-icons/io5";
import { getBreadcrumb } from "../../utils/menus";

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
`;

const CrumbLink = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  text-decoration: none;
  &:hover {
    color: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
  }
`;

const Current = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: #111827;
`;

export default function AdminBreadcrumb() {
  const { pathname } = useLocation();
  const crumbs = useMemo(() => getBreadcrumb(pathname), [pathname]);

  return (
    <Bar>
      {crumbs.map((c, i) => (
        <React.Fragment key={`${c.label}-${i}`}>
          {i > 0 && <IoChevronForwardOutline size={12} color="#6b7280" />}
          {c.to && i < crumbs.length - 1 ? (
            <CrumbLink to={c.to}>
              {i === 0 && <IoHomeOutline size={13} />}
              {c.label}
            </CrumbLink>
          ) : (
            <Current>{c.label}</Current>
          )}
        </React.Fragment>
      ))}
    </Bar>
  );
}
