/* eslint-disable */
// src/components/common/FilterBottomSheet.jsx
// ✅ 팀장 필터(토글) 추가 버전
// - draft.onlyCaptain: boolean
// - onApply는 draft 그대로 넘김 (페이지에서 onlyCaptain 적용)

import React, { useEffect, useMemo } from "react";
import styled from "styled-components";
import { KR_AREAS } from "../../utils/constants";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 60;
  display: flex;
  align-items: flex-end;
`;

const Sheet = styled.div`
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  background: #ffffff;
  padding: 14px 14px 16px;
  box-shadow: 0 -16px 40px rgba(15, 23, 42, 0.22);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Title = styled.div`
  font-size: 16px;
  color: #111827;
`;

const CloseBtn = styled.button`
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const Body = styled.div`
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const GroupTitle = styled.div`
  font-size: 13px;
  color: #111827;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "#4f46e5" : "#e5e7eb")};
  background: ${({ $active }) => ($active ? "#eef2ff" : "#ffffff")};
  color: ${({ $active }) => ($active ? "#3730a3" : "#374151")};
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const TwoCols = styled.div`
  display: flex;
  gap: 10px;
`;

const Select = styled.select`
  flex: 1;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 0 12px;
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
  }
`;

const Footer = styled.div`
  margin-top: 14px;
  display: flex;
  gap: 8px;
`;

const Btn = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: ${({ $primary }) => ($primary ? "none" : "1px solid #e5e7eb")};
  background: ${({ $primary }) => ($primary ? "#4f46e5" : "#ffffff")};
  color: ${({ $primary }) => ($primary ? "#ffffff" : "#111827")};
  font-size: 13px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

function safeString(v) {
  return String(v || "").trim();
}

export default function FilterBottomSheet({
  open,
  title = "필터",
  draft,
  setDraft,
  onClose,
  onReset,
  onApply,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sidoOptions = useMemo(() => {
    const list = Array.isArray(KR_AREAS) ? KR_AREAS : [];
    return ["all", ...list.map((x) => safeString(x.sido)).filter(Boolean)];
  }, []);

  const currentSido = safeString(draft?.regionSido || "all") || "all";

  const guOptions = useMemo(() => {
    if (currentSido === "all") return ["all"];
    const found = (KR_AREAS || []).find((x) => safeString(x?.sido) === currentSido);
    const guList = Array.isArray(found?.guList) ? found.guList : [];
    return ["all", ...guList.map(safeString).filter(Boolean)];
  }, [currentSido]);

  if (!open) return null;

  const toggleOne = (key, value) => {
    const cur = draft?.[key] || "";
    setDraft((prev) => ({ ...(prev || {}), [key]: cur === value ? "" : value }));
  };

  return (
    <Overlay onClick={() => onClose && onClose()}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <HeaderRow>
          <Title>{title}</Title>
          <CloseBtn type="button" onClick={onClose}>
            ×
          </CloseBtn>
        </HeaderRow>

        <Body>
          <Group>
            <GroupTitle>지역</GroupTitle>
            <TwoCols>
              <Select
                value={currentSido}
                onChange={(e) => {
                  const nextSido = e.target.value;
                  setDraft((prev) => ({
                    ...(prev || {}),
                    regionSido: nextSido,
                    regionGu: "all",
                  }));
                }}
              >
                <option value="all">전체 시/도</option>
                {sidoOptions
                  .filter((x) => x !== "all")
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </Select>

              <Select
                value={safeString(draft?.regionGu || "all") || "all"}
                onChange={(e) => {
                  const nextGu = e.target.value;
                  setDraft((prev) => ({ ...(prev || {}), regionGu: nextGu }));
                }}
                disabled={currentSido === "all"}
                title={currentSido === "all" ? "시/도를 먼저 선택하세요" : ""}
              >
                <option value="all">전체 구/군</option>
                {guOptions
                  .filter((x) => x !== "all")
                  .map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
              </Select>
            </TwoCols>
          </Group>

          <Group>
            <GroupTitle>포지션</GroupTitle>
            <Chips>
              {["가드", "포워드", "센터"].map((v) => (
                <Chip
                  key={v}
                  type="button"
                  $active={draft?.position === v}
                  onClick={() => toggleOne("position", v)}
                >
                  {v}
                </Chip>
              ))}
            </Chips>
          </Group>

          <Group>
            <GroupTitle>실력</GroupTitle>
            <Chips>
              {["입문", "아마추어", "중급", "상급", "프로"].map((v) => (
                <Chip
                  key={v}
                  type="button"
                  $active={draft?.skill === v}
                  onClick={() => toggleOne("skill", v)}
                >
                  {v}
                </Chip>
              ))}
            </Chips>
          </Group>

          <Group>
            <GroupTitle>승률</GroupTitle>
            <Chips>
              {[
                { k: "any", label: "전체" },
                { k: "70", label: "70%+" },
                { k: "50", label: "50%+" },
              ].map((x) => (
                <Chip
                  key={x.k}
                  type="button"
                  $active={(draft?.winRate || "any") === x.k}
                  onClick={() => setDraft((prev) => ({ ...(prev || {}), winRate: x.k }))}
                >
                  {x.label}
                </Chip>
              ))}
            </Chips>
          </Group>

          {/* ✅ 팀장 필터 추가 */}
          <Group>
            <GroupTitle>역할</GroupTitle>
            <Chips>
              <Chip
                type="button"
                $active={draft?.onlyCaptain === true}
                onClick={() => setDraft((prev) => ({ ...(prev || {}), onlyCaptain: !(prev?.onlyCaptain === true) }))}
              >
                팀장만
              </Chip>
            </Chips>
          </Group>
        </Body>

        <Footer>
          <Btn type="button" onClick={onReset}>
            초기화
          </Btn>
          <Btn type="button" $primary onClick={onApply}>
            적용
          </Btn>
        </Footer>
      </Sheet>
    </Overlay>
  );
}
