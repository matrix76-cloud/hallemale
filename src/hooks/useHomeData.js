// src/hooks/useHomeData.js
/* eslint-disable */
import { useContext } from "react";
import { getHomeDataContext } from "../context/HomeDataContext";

export function useHomeData() {
  const ctx = useContext(getHomeDataContext());
  if (!ctx) {
    throw new Error("useHomeData must be used within <HomeDataProvider />");
  }
  return ctx;
}
