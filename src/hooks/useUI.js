import { useUIContext, useUIActionsContext } from "../context/UIContext";

export function useUI() {
  return useUIContext();
}

/**
 * showToast/showModal 등 액션만 필요할 때 사용한다.
 * useUI()와 달리 UI 상태(토스트·모달·시트)가 바뀌어도 리렌더되지 않는다.
 */
export function useUIActions() {
  return useUIActionsContext();
}
