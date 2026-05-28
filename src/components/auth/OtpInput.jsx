/* eslint-disable */
// src/components/auth/OtpInput.jsx
import React, { useCallback, useEffect, useRef } from "react";
import styled from "styled-components";

const LEN = 6;

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

export default function OtpInput({ value = "", onChange, disabled = false, autoFocus = false }) {
  const refs = useRef([]);
  const digits = onlyDigits(value).slice(0, LEN).padEnd(LEN, " ").split("");

  useEffect(() => {
    if (autoFocus && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [autoFocus]);

  const setAt = useCallback(
    (idx, char) => {
      const arr = onlyDigits(value).slice(0, LEN).split("");
      while (arr.length < LEN) arr.push("");
      arr[idx] = char;
      const next = arr.join("").slice(0, LEN);
      onChange?.(next);
    },
    [value, onChange]
  );

  const handleChange = (idx) => (e) => {
    const raw = onlyDigits(e.target.value);
    if (raw.length > 1) {
      const merged = (onlyDigits(value).slice(0, idx) + raw).slice(0, LEN);
      onChange?.(merged);
      const focusIdx = Math.min(merged.length, LEN - 1);
      refs.current[focusIdx]?.focus();
      return;
    }
    setAt(idx, raw);
    if (raw && idx < LEN - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx) => (e) => {
    if (e.key === "Backspace") {
      const cur = digits[idx]?.trim();
      if (!cur && idx > 0) {
        e.preventDefault();
        setAt(idx - 1, "");
        refs.current[idx - 1]?.focus();
      } else if (cur) {
        setAt(idx, "");
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      refs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < LEN - 1) {
      e.preventDefault();
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (idx) => (e) => {
    const text = e.clipboardData?.getData("text") || "";
    const pasted = onlyDigits(text);
    if (!pasted) return;
    e.preventDefault();
    const merged = (onlyDigits(value).slice(0, idx) + pasted).slice(0, LEN);
    onChange?.(merged);
    const focusIdx = Math.min(merged.length, LEN - 1);
    refs.current[focusIdx]?.focus();
  };

  return (
    <Row>
      {digits.map((d, i) => (
        <Box
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d.trim()}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste(i)}
          disabled={disabled}
        />
      ))}
    </Row>
  );
}

const Row = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
`;

const Box = styled.input`
  flex: 1;
  min-width: 0;
  height: 52px;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.mode === "dark"
          ? "rgba(99, 102, 241, 0.30)"
          : "rgba(37, 99, 235, 0.18)"};
  }

  &:disabled {
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;
