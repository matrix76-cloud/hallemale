/* eslint-disable */
// src/pages/owner/components/PriceBandsEditor.jsx
// 시간대 구간(band)별 요금 편집 — [start~end : price] 리스트. 요일별/특정날짜 공용.
import React from "react";
import styled from "styled-components";
import { LuPlus, LuX } from "react-icons/lu";
import { C } from "./od";

const Wrap = styled.div`display:flex;flex-direction:column;gap:8px;`;
const Row = styled.div`display:grid;grid-template-columns:1fr 12px 1fr 1.2fr 30px;align-items:center;gap:6px;`;
const T = styled.input`width:100%;border:1px solid ${C.slate200};border-radius:10px;padding:9px 8px;font-size:13px;color:${C.slate800};box-sizing:border-box;&:focus{outline:none;border-color:${C.violet300};}`;
const Tilde = styled.span`text-align:center;color:${C.slate400};`;
const Won = styled.div`position:relative;& > input{padding-right:24px;} & > span{position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:12px;color:${C.slate400};}`;
const Del = styled.button`border:none;background:transparent;color:${C.slate400};cursor:pointer;display:flex;justify-content:center;`;
const Add = styled.button`border:1px dashed ${C.violet300};background:transparent;color:${C.violet600};border-radius:10px;padding:9px;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;`;
const Empty = styled.div`font-size:12px;color:${C.slate400};text-align:center;padding:6px 0;`;

export default function PriceBandsEditor({ bands = [], onChange, basePrice = 0 }) {
  const set = (i, patch) => onChange(bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const add = () => onChange([...bands, { start: "18:00", end: "22:00", price: basePrice || 0 }]);
  const remove = (i) => onChange(bands.filter((_, idx) => idx !== i));

  return (
    <Wrap>
      {bands.length === 0 && <Empty>구간이 없어요. 기본요금이 적용됩니다.</Empty>}
      {bands.map((b, i) => (
        <Row key={i}>
          <T type="time" value={b.start} onChange={(e) => set(i, { start: e.target.value })} />
          <Tilde>~</Tilde>
          <T type="time" value={b.end} onChange={(e) => set(i, { end: e.target.value })} />
          <Won><T type="number" value={b.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="요금" /><span>원</span></Won>
          <Del type="button" onClick={() => remove(i)}><LuX size={16} /></Del>
        </Row>
      ))}
      <Add type="button" onClick={add}><LuPlus size={14} /> 구간 추가</Add>
    </Wrap>
  );
}
