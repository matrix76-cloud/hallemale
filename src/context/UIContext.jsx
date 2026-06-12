import React, {
  createContext,
  useContext,
  useState,
  useCallback
} from "react";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [globalLoading, setGlobalLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [bottomSheet, setBottomSheet] = useState(null);
  // 상단 헤더 부제 (예: 구장 정하기 페이지의 "리바운드5 vs 패스트브레이")
  const [headerSubtitle, setHeaderSubtitle] = useState("");

  const showToast = useCallback((opts) => {
    setToast({ message: opts.message, type: opts.type || "info" });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const showModal = useCallback((opts) => {
    setModal({
      title: opts.title || "",
      message: opts.message,
      onConfirm: opts.onConfirm || null,
      onCancel: opts.onCancel || null
    });
  }, []);

  const hideModal = useCallback(() => setModal(null), []);

  const showBottomSheet = useCallback((renderFn) => {
    setBottomSheet(() => renderFn);
  }, []);

  const hideBottomSheet = useCallback(() => setBottomSheet(null), []);

  const value = {
    globalLoading,
    setGlobalLoading,
    toast,
    showToast,
    modal,
    showModal,
    hideModal,
    bottomSheet,
    showBottomSheet,
    hideBottomSheet,
    headerSubtitle,
    setHeaderSubtitle
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext() {
  return useContext(UIContext);
}
