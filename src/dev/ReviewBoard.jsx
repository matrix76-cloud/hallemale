/* eslint-disable */
// src/dev/ReviewBoard.jsx — 피그마식 전 화면 보드 (/review/board)
//
// · 앱의 모든 화면 + 상태별 "경우의 수"를 한 캔버스에 카테고리별로 고정 배치한다.
// · 각 프레임은 ?mock=<시나리오> 로 띄워서 (1) 로그인 없이 뜨고 (2) 언제 열어도 같은 화면이다.
// · 프레임은 기본적으로 클릭이 막혀 있다(피그마 아트보드처럼 정지) → 화면이 다른 데로 안 넘어간다.
//   특정 프레임을 만져보려면 그 프레임의 "조작" 버튼을 켠다.
// · 휠=상하 / Shift+휠=좌우 / Ctrl(⌘)+휠=줌 / 빈 공간 드래그=팬.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BOARD_SECTIONS, BOARD_TOTAL, frameSrc } from "./boardData";

const PHONE_W = 390;
const PHONE_H = 844;
const PC_W = 1266;
const PC_H = 900;
const PC_SCALE = 0.42; // 관리자 PC 화면을 폰 프레임 옆에 같이 놓기 위한 축소율

const C = {
  ink: "#18181b",
  ink2: "#3f3f46",
  gray: "#71717a",
  gray2: "#a1a1aa",
  line: "#e4e4e7",
  bg: "#f4f5f7",
  card: "#ffffff",
  accent: "#fc5b41",
};
const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";

/* ───────────────── 프레임 1장 ───────────────── */
// 화면 밖에 있으면 iframe을 마운트하지 않는다(110개를 한꺼번에 띄우면 브라우저가 죽는다).
function Frame({ frame, wide, rootRef, onOpenReview }) {
  const boxRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [live, setLive] = useState(false); // 조작 허용(기본 꺼짐 = 화면 고정)
  const [nonce, setNonce] = useState(0);   // 새로고침

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { root: rootRef.current || null, rootMargin: "800px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  const w = wide ? PC_W * PC_SCALE : PHONE_W;
  const h = wide ? PC_H * PC_SCALE : PHONE_H;
  // 고정(기본): freeze=1 → 화면이 스스로 다음 화면으로 안 넘어간다.
  // 조작 켜면 freeze 를 빼고 다시 로드해 실제로 눌러볼 수 있다.
  const src = frameSrc(frame, { freeze: !live });

  return (
    <div data-frame style={{ flex: "none", width: w, display: "flex", flexDirection: "column", gap: 6 }}>
      {/* 프레임 이름 — 피그마 아트보드 라벨 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 18 }}>
        <span
          onClick={() => frame.reviewId && onOpenReview(frame.reviewId)}
          title={frame.reviewId ? "이 화면 상세 리뷰 열기" : frame.name}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: frame.no === "변형" ? C.accent : C.ink2,
            cursor: frame.reviewId ? "pointer" : "default",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {frame.no !== "변형" && <span style={{ color: C.gray2, marginRight: 5 }}>{frame.no}</span>}
          {frame.name}
        </span>
        <div style={{ flex: 1 }} />
        {/* 라벨은 "지금 상태" — 눌러야 할 동작으로 읽히면 이미 고정된 걸 풀어버린다. */}
        <button
          onClick={() => setLive((v) => !v)}
          title={live ? "지금 조작 가능(화면이 넘어갈 수 있음) — 눌러서 고정" : "지금 고정됨 — 눌러서 조작"}
          // 두 상태 모두 채워서 보여준다 — 흰 버튼이면 "꺼짐"으로 읽혀 고정 상태가 안 보인다.
          style={{ ...miniBtn(true), background: live ? C.accent : "#18181b", border: "1px solid transparent" }}
        >
          {live ? "✋조작중" : "🔒고정"}
        </button>
        <button onClick={() => setNonce((n) => n + 1)} title="이 프레임 새로고침" style={miniBtn(false)}>
          ↻
        </button>
        <button onClick={() => window.open(src, "_blank")} title="새 탭에서 열기" style={miniBtn(false)}>
          ↗
        </button>
      </div>

      <div
        ref={boxRef}
        style={{
          position: "relative",
          boxSizing: "content-box",
          width: w,
          height: h,
          borderRadius: wide ? 8 : 18,
          overflow: "hidden",
          border: `1px solid ${live ? C.accent : C.line}`,
          boxShadow: "0 4px 18px rgba(0,0,0,0.07)",
          background: "#fff",
        }}
      >
        {visible && src ? (
          wide ? (
            <div style={{ width: PC_W, height: PC_H, transform: `scale(${PC_SCALE})`, transformOrigin: "top left" }}>
              <iframe
                key={`${frame.key}_${nonce}`}
                title={frame.name}
                src={src}
                style={{ width: PC_W, height: PC_H, border: "none", pointerEvents: live ? "auto" : "none" }}
              />
            </div>
          ) : (
            <iframe
              key={`${frame.key}_${nonce}`}
              title={frame.name}
              src={src}
              style={{ width: "100%", height: "100%", border: "none", pointerEvents: live ? "auto" : "none" }}
            />
          )
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.gray2, fontSize: 12 }}>
            {src ? "…" : "화면 없음"}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: C.gray2, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {frame.path}
      </div>
    </div>
  );
}

const miniBtn = (on) => ({
  flex: "none",
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 6px",
  borderRadius: 5,
  cursor: "pointer",
  border: `1px solid ${on ? C.accent : C.line}`,
  background: on ? C.accent : "#fff",
  color: on ? "#fff" : C.gray,
  lineHeight: 1.5,
});

/* ───────────────── 보드 ───────────────── */
export default function ReviewBoard() {
  const nav = useNavigate();
  const rootRef = useRef(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [onlyKey, setOnlyKey] = useState(""); // 카테고리 필터 ("" = 전체)
  const dragRef = useRef(null);

  const sections = useMemo(
    () => (onlyKey ? BOARD_SECTIONS.filter((s) => s.key === onlyKey) : BOARD_SECTIONS),
    [onlyKey]
  );

  // 휠: 기본 상하 / Shift 좌우 / Ctrl(⌘) 줌
  // 줌은 커서 아래 지점을 고정한 채 확대/축소해야 해서 zoom·pan 을 같이 계산한다.
  const viewRef = useRef({ zoom, pan });
  useEffect(() => { viewRef.current = { zoom, pan }; }, [zoom, pan]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const { zoom: z0, pan: p0 } = viewRef.current;

    if (e.ctrlKey || e.metaKey) {
      const rect = rootRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const z = Math.min(1.6, Math.max(0.12, z0 * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const next = { x: mx - ((mx - p0.x) / z0) * z, y: my - ((my - p0.y) / z0) * z };
      viewRef.current = { zoom: z, pan: next };
      setZoom(z);
      setPan(next);
      return;
    }

    const next = {
      x: p0.x - (e.shiftKey ? e.deltaY : e.deltaX),
      y: p0.y - (e.shiftKey ? 0 : e.deltaY),
    };
    viewRef.current = { zoom: z0, pan: next };
    setPan(next);
  }, []);

  // 휠 이벤트는 passive 기본값이라 preventDefault 가 먹지 않는다 → 직접 등록
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onMouseDown = (e) => {
    // 프레임(iframe·버튼) 위가 아니라 빈 캔버스에서 시작한 드래그만 팬으로 처리
    if (e.button !== 0) return;
    if (e.target.closest("[data-frame]")) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };
  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const openReview = (id) => nav(`/review/${id}`);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.ink, fontFamily: FONT, overflow: "hidden" }}>
      {/* 상단 바 */}
      <header style={{ flex: "none", background: C.card, borderBottom: `1px solid ${C.line}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 15 }}>화면 보드</b>
        <span style={{ fontSize: 12, color: C.gray }}>{BOARD_TOTAL}개 프레임 · 목업 고정</span>

        <span style={{ width: 12 }} />
        <button onClick={() => setOnlyKey("")} style={tabBtn(!onlyKey)}>전체</button>
        {BOARD_SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setOnlyKey(s.key)} style={tabBtn(onlyKey === s.key)}>
            {s.label} <span style={{ fontWeight: 600, opacity: 0.65 }}>{s.frames.length}</span>
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.gray, fontVariantNumeric: "tabular-nums" }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.max(0.12, z / 1.25))} style={tabBtn(false)}>−</button>
        <button onClick={() => setZoom((z) => Math.min(1.6, z * 1.25))} style={tabBtn(false)}>+</button>
        <button onClick={() => { setZoom(0.5); setPan({ x: 40, y: 40 }); }} style={tabBtn(false)}>맞춤</button>
        <button onClick={() => nav("/review")} style={tabBtn(false)}>리뷰 상세로</button>
      </header>

      {/* 캔버스 */}
      <div
        ref={rootRef}
        onMouseDown={onMouseDown}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          cursor: "grab",
          backgroundImage: "radial-gradient(#d9dbe0 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
            display: "flex",
            flexDirection: "column",
            gap: 64,
            padding: 8,
          }}
        >
          {sections.map((sec, i) => (
            <section key={sec.key} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 앱이 바뀌는 지점(사용자앱 → 구장앱 → 관리자)에만 큰 구분선 */}
              {sec.group && sec.group !== sections[i - 1]?.group && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: i === 0 ? 0 : 24 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "1px", color: C.gray2 }}>{sec.group}</span>
                  <div style={{ flex: 1, height: 1, background: "#d4d4d8" }} />
                </div>
              )}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>{sec.label}</h2>
                <span style={{ fontSize: 15, color: C.gray2, fontWeight: 700 }}>{sec.frames.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 28, maxWidth: 6 * (PHONE_W + 28) }}>
                {sec.frames.map((f) => (
                  // 프레임이 폭을 직접 지정했으면(랜딩의 PC/모바일) 그걸 쓰고, 아니면 섹션 기본
                  <Frame key={f.key} frame={f} wide={f.pc ?? sec.wide} rootRef={rootRef} onOpenReview={openReview} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer style={{ flex: "none", background: C.card, borderTop: `1px solid ${C.line}`, padding: "6px 16px", fontSize: 11, color: C.gray2 }}>
        휠=상하 · Shift+휠=좌우 · Ctrl(⌘)+휠=줌 · 빈 곳 드래그=이동 &nbsp;|&nbsp; 프레임은 기본 고정(클릭 안 먹음) — 만져보려면 프레임의 <b style={{ color: C.gray }}>조작</b> 버튼
      </footer>
    </div>
  );
}

const tabBtn = (on) => ({
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 7,
  cursor: "pointer",
  border: `1px solid ${on ? C.ink : C.line}`,
  background: on ? C.ink : "#fff",
  color: on ? "#fff" : C.gray,
});
