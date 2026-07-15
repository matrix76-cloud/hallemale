/* eslint-disable */
// src/pages/owner/components/OwnerVenueSwitcher.jsx
// 다구장 전환 — 헤더 아래 슬림 바. 활성 구장명 표시 + 탭하면 구장 목록(전환)/구장 추가 드롭다운.
import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { LuChevronDown, LuCheck, LuPlus, LuStore } from "react-icons/lu";
import { useOwner } from "../../../context/OwnerContext";
import { C } from "./od";

const STATUS_TAG = { pending: "승인대기", rejected: "반려" };

export default function OwnerVenueSwitcher() {
  const { venues, venue, setActiveVenue } = useOwner();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  if (!venue) return null; // 구장 없으면(온보딩 단계) 미표시

  const pick = (id) => { setActiveVenue(id); setOpen(false); };
  const addVenue = () => { setOpen(false); navigate("/owner/onboarding?new=1"); };

  return (
    <Bar ref={ref}>
      <Pill type="button" onClick={() => setOpen((v) => !v)} $open={open}>
        <LuStore size={14} />
        <Name>{venue.name || "내 구장"}</Name>
        {venues.length > 1 && <Count>{venues.length}</Count>}
        <LuChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </Pill>

      {open && (
        <Menu>
          {venues.map((v) => {
            const tag = STATUS_TAG[v.status] || "";
            const active = v.id === venue.id;
            return (
              <Item key={v.id} type="button" onClick={() => pick(v.id)} $active={active}>
                <ItemName>{v.name || "내 구장"}</ItemName>
                {tag && <Tag>{tag}</Tag>}
                {active && <LuCheck size={16} color={C.violet600} />}
              </Item>
            );
          })}
          <Divider />
          <AddItem type="button" onClick={addVenue}>
            <LuPlus size={16} /> 구장 추가
          </AddItem>
        </Menu>
      )}
    </Bar>
  );
}

const Bar = styled.div`
  position: relative;
  padding: 8px 14px;
  background: #fff;
  border-bottom: 1px solid ${C.slate200};
`;
const Pill = styled.button`
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
  padding: 7px 12px; border-radius: 999px;
  border: 1px solid ${({ $open }) => ($open ? C.violet300 : C.slate200)};
  background: ${({ $open }) => ($open ? C.violet50 : "#fff")};
  color: ${C.slate800}; font-size: 13px; font-weight: 700; cursor: pointer;
  &:active { transform: translateY(1px); }
`;
const Name = styled.span`max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Count = styled.span`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 17px; height: 17px; padding: 0 5px; border-radius: 999px;
  background: ${C.violet600}; color: #fff; font-size: 10.5px; font-weight: 800;
`;
const Menu = styled.div`
  position: absolute; top: calc(100% - 2px); left: 14px; z-index: 40;
  min-width: 220px; max-width: calc(100vw - 28px);
  background: #fff; border: 1px solid ${C.slate200}; border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); overflow: hidden; padding: 4px;
`;
const Item = styled.button`
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 10px 10px; border: 0; border-radius: 8px;
  background: ${({ $active }) => ($active ? C.violet50 : "#fff")};
  color: ${C.slate800}; font-size: 13.5px; font-weight: ${({ $active }) => ($active ? 800 : 600)};
  cursor: pointer; text-align: left;
  &:active { background: ${C.slate100}; }
`;
const ItemName = styled.span`flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Tag = styled.span`
  font-size: 10.5px; font-weight: 700; color: ${C.amber500};
  border: 1px solid ${C.amber500}; border-radius: 999px; padding: 1px 7px;
`;
const Divider = styled.div`height: 1px; background: ${C.slate200}; margin: 4px 6px;`;
const AddItem = styled.button`
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 10px 10px; border: 0; border-radius: 8px; background: #fff;
  color: ${C.violet600}; font-size: 13.5px; font-weight: 700; cursor: pointer;
  &:active { background: ${C.violet50}; }
`;
