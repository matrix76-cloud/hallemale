import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef
} from "react";

// ⚡ 상태와 액션을 별도 컨텍스트로 나눈다.
//    액션(showToast/showModal/…)은 마운트 후 identity가 절대 바뀌지 않으므로,
//    액션만 구독하는 페이지는 토스트·시트가 열고 닫혀도 리렌더되지 않는다.
//    (예전엔 value가 매 렌더 새 객체라, 토스트 하나에 현재 페이지 전체가 다시 그려졌다.)
const UIStateContext = createContext(null);
const UIActionsContext = createContext(null);

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

  const state = useMemo(
    () => ({
      globalLoading,
      toast,
      banner,
      modal,
      bottomSheet,
      headerSubtitle,
      headerConfig,
      blockingCount
    }),
    [globalLoading, toast, banner, modal, bottomSheet, headerSubtitle, headerConfig, blockingCount]
  );

  // 전부 useCallback / setState setter 라서 이 객체의 identity는 마운트 이후 고정된다.
  const actions = useMemo(
    () => ({
      setGlobalLoading,
      showToast,
      showBanner,
      hideBanner,
      showModal,
      hideModal,
      showBottomSheet,
      hideBottomSheet,
      setHeaderSubtitle,
      setHeaderConfig,
      registerBackInterceptor,
      runTopBackInterceptor
    }),
    [
      showToast,
      showBanner,
      hideBanner,
      showModal,
      hideModal,
      showBottomSheet,
      hideBottomSheet,
      registerBackInterceptor,
      runTopBackInterceptor
    ]
  );

  return (
    <UIActionsContext.Provider value={actions}>
      <UIStateContext.Provider value={state}>{children}</UIStateContext.Provider>
    </UIActionsContext.Provider>
  );
}

/** UI 상태 + 액션 전부. 상태를 실제로 그리는 컴포넌트(레이아웃 등)만 사용할 것. */
export function useUIContext() {
  const state = useContext(UIStateContext);
  const actions = useContext(UIActionsContext);
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

/** 액션만. UI 상태 변화에 리렌더되지 않는다. showToast/showModal 만 필요한 곳은 이걸 쓴다. */
export function useUIActionsContext() {
  return useContext(UIActionsContext);
}
