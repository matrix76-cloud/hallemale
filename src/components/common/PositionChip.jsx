/* eslint-disable */
// src/components/common/PositionChip.jsx
// ✅ 배경 "하나만" 남기기: Wrap 배경 유지, Abbr(내부 흰 배경) 제거

import React, { useMemo } from "react";
import styled from "styled-components";

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: ${({ $size }) => ($size === "sm" ? "3px 8px" : "4px 10px")};
  font-size: ${({ $size }) => ($size === "sm" ? "11px" : "12px")};
  line-height: 1;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  border: 1px solid rgba(0, 0, 0, 0.04);
`;

/* ✅ 내부 배경 제거(두 겹 배경 문제 해결) */
const Abbr = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  padding: 0;              /* ✅ */
  min-width: 0;            /* ✅ */
  height: auto;            /* ✅ */
  border-radius: 0;        /* ✅ */
  background: transparent; /* ✅ */
  font-weight: 800;
`;

function normalizeKo(label) {
  const v = String(label || "").trim();
  if (!v) return "";
  if (v.includes("가드")) return "가드";
  if (v.includes("포워드")) return "포워드";
  if (v.includes("센터")) return "센터";
  return v;
}

function mapStyle(posKo) {
  if (posKo === "가드") return { abbr: "G", bg: "#eef2ff", color: "#1d4ed8" };
  if (posKo === "포워드") return { abbr: "F", bg: "#ecfdf5", color: "#047857" };
  if (posKo === "센터") return { abbr: "C", bg: "#fff7ed", color: "#c2410c" };
  return { abbr: "P", bg: "#f3f4f6", color: "#6b7280" };
}

export default function PositionChip({
  label,
  size = "sm",
  showAbbr = true,
  onlyAbbr = false,
}) {
  const posKo = useMemo(() => normalizeKo(label), [label]);
  const style = useMemo(() => mapStyle(posKo), [posKo]);

  if (!posKo) return null;

  return (
    <Wrap $size={size} $bg={style.bg} $color={style.color}>
      {showAbbr && <Abbr>{style.abbr}</Abbr>}
      {!onlyAbbr && <span>{posKo}</span>}
    </Wrap>
  );
}
