/* eslint-disable */
// src/admin/layout/AdminSidebar.jsx
// 단일 다크 사이드바 (jogun 레이아웃 참고)
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { NavLink, useLocation } from "react-router-dom";
import { IoChevronDownOutline } from "react-icons/io5";
import { MENUS } from "../../utils/menus";
import { listPendingVenues } from "../../services/ownerVenueService";

const Side = styled.aside`
  width: ${({ $w }) => $w}px;
  min-height: 100vh;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
`;

const Logo = styled.div`
  padding: 22px 20px 18px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  letter-spacing: -0.2px;
`;

const Nav = styled.nav`
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
`;

const Section = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  padding: 16px 0 8px 16px;
  letter-spacing: 0.6px;
  ${({ $first }) =>
    !$first &&
    `border-top: 1px solid rgba(255,255,255,0.08); margin-top: 8px; padding-top: 16px;`}
`;

const itemBase = `
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
  transition: all 0.15s;
  text-decoration: none;
  svg { font-size: 18px; flex-shrink: 0; }
`;

const Item = styled(NavLink)`
  ${itemBase}
  color: #cbd5e1;
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }
  &.active {
    background: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
    color: #fff;
    font-weight: 700;
  }
`;

const GroupBtn = styled.button`
  ${itemBase}
  width: 100%;
  border: none;
  cursor: pointer;
  text-align: left;
  background: ${({ $active }) => ($active ? "rgba(255,255,255,0.08)" : "transparent")};
  color: ${({ $active }) => ($active ? "#f8fafc" : "#cbd5e1")};
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }
`;

const Chevron = styled(IoChevronDownOutline)`
  margin-left: auto;
  font-size: 14px !important;
  transform: ${({ $open }) => ($open ? "rotate(180deg)" : "rotate(0)")};
  transition: transform 0.2s;
`;

// 승인 대기 구장 수 뱃지 — 어드민이 신규 신청을 실시간 인지하도록
const Badge = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const SubWrap = styled.div`
  overflow: hidden;
  max-height: ${({ $open }) => ($open ? "400px" : "0")};
  transition: max-height 0.25s ease;
`;

const SubItem = styled(NavLink)`
  display: block;
  padding: 8px 14px 8px 44px;
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
  text-decoration: none;
  border-radius: 6px;
  margin-bottom: 1px;
  transition: all 0.15s;
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }
  &.active {
    color: #fff;
    font-weight: 700;
    background: rgba(79, 70, 229, 0.3);
  }
`;

function isPathInGroup(pathname, group) {
  return (group.sub || []).some((s) => {
    const sLower = String(s.to).toLowerCase();
    const p = String(pathname).toLowerCase();
    return p === sLower || p.startsWith(sLower + "/");
  });
}

export default function AdminSidebar({ width = 220 }) {
  const { pathname } = useLocation();

  // 승인 대기(pending) 구장 수 — 사이드바 '구장 관리'에 뱃지로 노출
  const [pendingVenues, setPendingVenues] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const rows = await listPendingVenues();
        if (alive) setPendingVenues(Array.isArray(rows) ? rows.length : 0);
      } catch {
        if (alive) setPendingVenues(0);
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  const [open, setOpen] = useState(() => {
    const init = {};
    MENUS.forEach((m) => {
      if (m.sub && isPathInGroup(pathname, m)) init[m.key || m.label] = true;
    });
    return init;
  });

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      MENUS.forEach((m) => {
        if (m.sub && isPathInGroup(pathname, m)) {
          next[m.key || m.label] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  const toggle = (key) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  let firstSection = true;

  return (
    <Side $w={width}>
      <Logo>할래말래 Admin</Logo>
      <Nav>
        {MENUS.map((m, i) => {
          if (m.section) {
            const node = (
              <Section key={`sec-${i}`} $first={firstSection}>
                {m.section}
              </Section>
            );
            firstSection = false;
            return node;
          }

          if (m.sub) {
            const k = m.key || m.label;
            const active = isPathInGroup(pathname, m);
            const isOpen = !!open[k] || active;
            return (
              <React.Fragment key={k}>
                <GroupBtn type="button" $active={active} onClick={() => toggle(k)}>
                  {m.icon && <m.icon />}
                  {m.label}
                  {k === "venues" && pendingVenues > 0 && (
                    <Badge>{pendingVenues > 99 ? "99+" : pendingVenues}</Badge>
                  )}
                  <Chevron $open={isOpen} />
                </GroupBtn>
                <SubWrap $open={isOpen}>
                  {m.sub.map((s) => (
                    <SubItem
                      key={s.to}
                      to={s.to}
                      className={({ isActive }) => (isActive ? "active" : "")}
                    >
                      {s.label}
                      {String(s.to).endsWith("/venues") && pendingVenues > 0 && (
                        <Badge style={{ marginLeft: 8 }}>{pendingVenues > 99 ? "99+" : pendingVenues}</Badge>
                      )}
                    </SubItem>
                  ))}
                </SubWrap>
              </React.Fragment>
            );
          }

          return (
            <Item
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {m.icon && <m.icon />}
              {m.label}
            </Item>
          );
        })}
      </Nav>
    </Side>
  );
}
