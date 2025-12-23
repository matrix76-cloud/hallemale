// src/hooks/useMatchingData.js
/* eslint-disable */
import { useContext } from "react";
import { getMatchingDataContext } from "../context/MatchingDataContext";

export function useMatchingData() {
  const ctx = useContext(getMatchingDataContext());
  if (!ctx) throw new Error("useMatchingData must be used within <MatchingDataProvider />");
  return ctx;
}
