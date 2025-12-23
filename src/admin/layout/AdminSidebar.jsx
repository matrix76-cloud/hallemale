/* eslint-disable */
// src/admin/layout/AdminSidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { NavLink, useLocation } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";
import { findActiveTop } from "../../utils/menus";

const Side = styled.aside`
  width: 240px;
  min-width: 240px;
  min-height: 100%;
  background: #f3f5f9;
  color: #222;
  padding: 16px 12px;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow: auto;
  font-size: 14px;
`;

const Section = styled.div`
  border-bottom: 1px solid #e6eaf2;
`;

const GroupHead = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.18s ease;

  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 7px 8px 10px 8px;
  color: #1b1f27;

  ${({ $open }) =>
    $open &&
    `
    background: #fff;
    border: 1px solid #e6eaf2;
    border-radius: 8px;
    padding: 6px 16px;
    box-shadow: 0 6px 14px rgba(0,0,0,.04);
  `}

  svg {
    transition: transform 0.18s ease, color 0.18s ease;
    transform: rotate(${({ $open }) => ($open ? 180 : 0)}deg);
    color: ${({ $open }) => ($open ? "#111" : "#9aa1ac")};
  }

  &:hover {
    ${({ $open }) => (!$open ? `background: rgba(0,0,0,.035); border-radius: 12px;` : "")}
  }
`;

const L2Wrap = styled.div`
  max-height: ${({ $open }) => ($open ? "999px" : "0")};
  overflow: hidden;
  transition: max-height 0.22s ease;
  padding: ${({ $open }) => ($open ? "8px 6px 10px 6px" : "0 6px")};
`;

const L2Item = styled(NavLink)`
  position: relative;
  display: block;
  margin-left: 14px;
  padding: 10px 10px 10px 18px;
  border-radius: 12px;
  color: #2a2e37;
  text-decoration: none;

  &::before {
    content: "–";
    position: absolute;
    left: 6px;
    top: 10px;
    color: #a5adbd;
  }

  &:hover {
    color: #111;
  }

  &.active {
    color: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
    background: transparent;
  }
`;

const L3Item = styled(NavLink)`
  position: relative;
  display: block;
  margin: 2px 0 2px 30px;
  padding: 8px 8px 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  color: #444;
  text-decoration: none;

  &::before {
    content: "•";
    position: absolute;
    left: 6px;
    top: 6px;
    color: #b3bac8;
    font-size: 14px;
  }

  &:hover {
    color: #111;
  }

  &.active {
    color: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
    background: transparent;
  }
`;

function pathInNode(path, node) {
  if (node?.to && String(path).startsWith(String(node.to))) return true;
  return (node?.children || []).some((c) => pathInNode(path, c));
}

export default function AdminSidebar() {
  const { pathname } = useLocation();
  const activeTop = useMemo(() => findActiveTop(pathname), [pathname]);
  const groups = activeTop?.children || [];

  const [open, setOpen] = useState({});

  useEffect(() => {
    const next = {};
    groups.forEach((g) => {
      next[g.key] = pathInNode(pathname, g);
    });
    const anyOpen = Object.values(next).some(Boolean);
    if (!anyOpen && groups.length) next[groups[0].key] = true;
    setOpen(next);
  }, [pathname, groups]);

  const handleToggle = (key) => {
    setOpen((prev) => {
      const nowOpen = !!prev[key];
      const next = {};
      groups.forEach((g) => (next[g.key] = false));
      next[key] = !nowOpen;
      return next;
    });
  };

  return (
    <Side>
      {groups.map((group) => {
        const isOpen = !!open[group.key];

        const directL2 = (group.children || []).filter((c) => !!c.to);
        const nestedL2 = (group.children || []).filter((c) => c.children?.length);

        return (
          <Section key={group.key}>
            <GroupHead onClick={() => handleToggle(group.key)} $open={isOpen}>
              {group.label}
              <FiChevronDown />
            </GroupHead>

            <L2Wrap $open={isOpen}>
              {directL2.map((c) => (
                <L2Item
                  key={c.key}
                  to={c.to || "#"}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {c.label}
                </L2Item>
              ))}

              {nestedL2.map((sg) => (
                <div key={sg.key} style={{ marginTop: 4 }}>
                  <L2Item to={sg.to || "#"} className={({ isActive }) => (isActive ? "active" : "")}>
                    {sg.label}
                  </L2Item>
                  {(sg.children || []).map((g3) => (
                    <L3Item
                      key={g3.key}
                      to={g3.to || "#"}
                      className={({ isActive }) => (isActive ? "active" : "")}
                    >
                      {g3.label}
                    </L3Item>
                  ))}
                </div>
              ))}
            </L2Wrap>
          </Section>
        );
      })}
    </Side>
  );
}
