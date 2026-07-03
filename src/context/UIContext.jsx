import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef
} from "react";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [globalLoading, setGlobalLoading] = useState(false);
  const [toast, setToast] = useState(null);
  // 상단 인앱 알림 배너 (인스타처럼 새 알림 오면 화면 상단에 슬라이드로 표시)
  const [banner, setBanner] = useState(null);
  const [modal, setModal] = useState(null);
  const [bottomSheet, setBottomSheet] = useState(null);
  // 상단 헤더 부제 (예: 구장 정하기 페이지의 "리바운드5 vs 패스트브레이")
  const [headerSubtitle, setHeaderSubtitle] = useState("");
  // 상단 헤더 커스텀(매칭룸: 팀 로고 + 팀명 + 햄버거 메뉴) — null이면 기본 헤더
  // { title, avatarUrl, onMenu } 형태
  const [headerConfig, setHeaderConfig] = useState(null);

  const showToast = useCallback((opts) => {
    setToast({ message: opts.message, type: opts.type || "info" });
    setTimeout(() => setToast(null), 2000);
  }, []);

  // 상단 알림 배너 표시 — 자동 사라짐/슬라이드 아웃은 배너 컴포넌트가 직접 처리
  const showBanner = useCallback((opts) => {
    setBanner({
      id: opts.id || null,
      title: opts.title || "새 알림",
      body: opts.body || "",
      deepLink: opts.deepLink || "",
      kind: opts.kind || "",
      avatarUrl: opts.avatarUrl || "",
      ts: Date.now(),
    });
  }, []);

  const hideBanner = useCallback(() => setBanner(null), []);

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

  // ✅ 하드웨어 백 인터셉트 스택 — 자체 오버레이(RegionPickerSheet 등)가 열려 있으면
  //    백 버튼이 페이지를 벗어나지 않고 오버레이를 먼저 닫도록 등록한다. (LIFO)
  const backStackRef = useRef([]);
  const [blockingCount, setBlockingCount] = useState(0);

  const registerBackInterceptor = useCallback((closeFn) => {
    const entry = { close: closeFn };
    backStackRef.current.push(entry);
    setBlockingCount(backStackRef.current.length);
    return () => {
      const i = backStackRef.current.indexOf(entry);
      if (i >= 0) backStackRef.current.splice(i, 1);
      setBlockingCount(backStackRef.current.length);
    };
  }, []);

  // 최상단 인터셉터 1개 실행(닫기). 있으면 true 반환 → 호출측은 네비게이션 중단.
  const runTopBackInterceptor = useCallback(() => {
    const top = backStackRef.current[backStackRef.current.length - 1];
    if (!top) return false;
    try {
      top.close && top.close();
    } catch (e) {}
    return true;
  }, []);

  const value = {
    globalLoading,
    setGlobalLoading,
    toast,
    showToast,
    banner,
    showBanner,
    hideBanner,
    modal,
    showModal,
    hideModal,
    bottomSheet,
    showBottomSheet,
    hideBottomSheet,
    headerSubtitle,
    setHeaderSubtitle,
    headerConfig,
    setHeaderConfig,
    blockingCount,
    registerBackInterceptor,
    runTopBackInterceptor
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext() {
  return useContext(UIContext);
}
