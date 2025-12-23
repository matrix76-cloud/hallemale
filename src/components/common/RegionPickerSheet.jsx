/* eslint-disable */
// src/components/common/RegionPickerSheet.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { FiX } from "react-icons/fi";
import { KR_AREAS } from "../../utils/constants";

/**
 * RegionPickerSheet
 * - 하단 시트(바텀시트) + 좌 시/도 / 우 구/군 2컬럼
 * - props:
 *   open: boolean
 *   onClose: () => void
 *   value: { sido: string, gu: string }
 *   onPick: ({ sido, gu, region }) => void
 *   title?: string
 */
export default function RegionPickerSheet({
  open,
  onClose,
  value,
  onPick,
  title = "지역 선택",
}) {
  const initialSido = value?.sido || KR_AREAS?.[0]?.sido || "";
  const [pickedSido, setPickedSido] = useState(initialSido);

  useEffect(() => {
    if (!open) return;

    const next = value?.sido || KR_AREAS?.[0]?.sido || "";
    setPickedSido(next);

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.touchAction = prevTouchAction || "";
    };
  }, [open, value?.sido]);

  const guList = useMemo(() => {
    const found = (KR_AREAS || []).find((x) => x.sido === pickedSido);
    return found?.guList || [];
  }, [pickedSido]);

  const handlePickGu = (gu) => {
    const sido = pickedSido;
    const region = `${sido} ${gu}`.trim();
    onPick?.({ sido, gu, region });
    onClose?.();
  };

  if (!open) return null;

  return (
    <Overlay role="dialog" aria-modal="true" onClick={onClose}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <SheetTop>
          <SheetTitle>{title}</SheetTitle>
          <CloseBtn type="button" onClick={onClose} aria-label="close">
            <FiX size={18} />
          </CloseBtn>
        </SheetTop>

        <SheetBody>
          <Col>
            {(KR_AREAS || []).map((a) => (
              <Item
                key={a.sido}
                type="button"
                $active={a.sido === pickedSido}
                onClick={() => setPickedSido(a.sido)}
              >
                {a.sido}
              </Item>
            ))}
          </Col>

          <Col $right>
            {guList.map((g) => (
              <Item
                key={g}
                type="button"
                $active={value?.sido === pickedSido && value?.gu === g}
                onClick={() => handlePickGu(g)}
              >
                {g}
              </Item>
            ))}
          </Col>
        </SheetBody>
      </Sheet>
    </Overlay>
  );
}

/* ===== styled ===== */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  z-index: 9998;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 14px 14px;
  box-sizing: border-box;
  overflow: hidden;
  touch-action: none;
`;

const Sheet = styled.div`
  width: 100%;
  max-width: 460px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
`;

const SheetTop = styled.div`
  padding: 10px 12px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
`;

const SheetTitle = styled.div`
  font-size: 13px;
  color: #111827;
`;

const CloseBtn = styled.button`
  border: none;
  background: rgba(15, 23, 42, 0.06);
  width: 30px;
  height: 30px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const SheetBody = styled.div`
  display: grid;
  grid-template-columns: 0.9fr 1.25fr;
  flex: 1;
  min-height: 240px;
  overflow: hidden;
`;

const Col = styled.div`
  border-right: ${({ $right }) =>
    $right ? "none" : "1px solid rgba(15, 23, 42, 0.08)"};
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const Item = styled.button`
  width: 100%;
  border: none;
  background: ${({ $active }) =>
    $active ? "rgba(15, 111, 114, 0.10)" : "transparent"};
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  font-size: 12.5px;
  color: ${({ $active }) => ($active ? "#0f6f72" : "#111827")};
`;
