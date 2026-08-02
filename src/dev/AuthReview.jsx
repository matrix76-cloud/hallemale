/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { DOMAINS } from "./reviewData";
import { baseScenarioFor, scenarioForScreen, variantsForScreen } from "./boardData";
import { subscribeThread, postEntry, deleteEntry } from "./reviewThreadService";

// 개발용 리뷰 허브 (/review/:id) — 11개 도메인 통합.
// 좌=실제 화면(iframe) + 핀 찍기(화면공유로 지도까지 캡처) / 우상=기획 / 우하=기록 스레드(Firestore).
// 핀에 요소정보 저장 + 화면공유로 핀 박은 스샷 자동 첨부(핀 번호가 이미지에 박힘).
const ALL = DOMAINS.flatMap((d) => d.screens.map((s) => ({ ...s, domain: d.key })));

// 프레임 URL 조립 — 화면 보드(/review/board)와 같은 규칙.
//  · mock=<시나리오>  → 로그인 없이 뜨고 데이터가 항상 같다 (variant 를 고르면 그 경우의 수로)
//  · freeze=1        → 페이지가 스스로 navigate() 해도 그 화면에 머문다(스플래시→홈 자동이동 차단)
//    "조작" 을 켜면 freeze 를 빼고 다시 로드해 실제로 눌러볼 수 있다.
const previewPath = (screen, variant, freeze) => {
  const base = variant ? variant.path : (screen?.path || "").replace(/:[A-Za-z0-9_]+/g, "sample");
  if (!base) return base;
  const scenario = variant ? variant.scenario : scenarioForScreen(screen?.domain, screen?.id);
  const q = [];
  if (scenario) q.push("mock=" + scenario);
  if (freeze) q.push("freeze=1");
  if (!q.length) return base;
  return base + (base.includes("?") ? "&" : "?") + q.join("&");
};

const CORAL = "#fc5b41";
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// 캔버스에 핀(라벨 말풍선 + 점)을 그림 — 캡처 이미지에 핀 번호가 박혀 겹침 혼란 해소
function drawPinOnCanvas(ctx, xPx, yPx, label) {
  ctx.font = "bold 13px 'Pretendard Variable', Pretendard, sans-serif";
  const padX = 9, bh = 24;
  const tw = ctx.measureText(label).width;
  const bw = tw + padX * 2;
  const bx = xPx - bw / 2;
  const by = yPx - bh - 9;
  roundRect(ctx, bx, by, bw, bh, 7);
  ctx.fillStyle = CORAL; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xPx - 5, by + bh); ctx.lineTo(xPx + 5, by + bh); ctx.lineTo(xPx, by + bh + 7);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(xPx, yPx, 4, 0, Math.PI * 2);
  ctx.fillStyle = CORAL; ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, xPx, by + bh / 2 + 0.5);
}
// 폴백: html2canvas (카카오맵 등 CORS 이미지는 빠질 수 있음 → 그럴 땐 화면공유가 필요)
async function captureViaHtml2canvas(iframeEl, pins) {
  const w = iframeEl.clientWidth, h = iframeEl.clientHeight;
  let base = null;
  try {
    const doc = iframeEl.contentDocument;
    const win = iframeEl.contentWindow;
    base = await html2canvas(doc.body, {
      useCORS: true, allowTaint: false, backgroundColor: "#ffffff", logging: false,
      width: w, height: h, windowWidth: w, windowHeight: h,
      x: (win && win.scrollX) || 0, y: (win && win.scrollY) || 0, scale: 1,
    });
  } catch { base = null; }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  if (base) { try { ctx.drawImage(base, 0, 0, w, h); } catch { /* noop */ } }
  pins.forEach((p) => drawPinOnCanvas(ctx, (p.x / 100) * w, (p.y / 100) * h, p.label || ""));
  try { return canvas.toDataURL("image/jpeg", 0.82); } catch { return ""; }
}

export default function AuthReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const cur = ALL.find((r) => r.id === id) || ALL[0];
  const domain = DOMAINS.find((d) => d.key === cur.domain);
  const isPC = cur.domain === "admin"; // 관리자=PC 풀와이드 → 넓은 프레임(스케일 축소)
  const [thread, setThread] = useState(null); // { id: [{by,at,text}] }
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("개발자"); // 작성자: 개발자 | AI
  const [attachImgs, setAttachImgs] = useState([]); // 첨부 스샷 dataURL[]
  const [pinMode, setPinMode] = useState(false); // 핀 찍기 모드
  const [draftPins, setDraftPins] = useState([]); // 작성 중 핀 [{x,y,label,target}]
  const [pinShotDone, setPinShotDone] = useState(false); // 현재 핀들이 이미 캡처돼 첨부됐는지
  const stageRef = useRef(null);                   // 폰 프레임이 놓일 영역 (가용 높이 측정용)
  const [phoneScale, setPhoneScale] = useState(1); // 창이 844보다 짧을 때만 1 미만
  const [viewPins, setViewPins] = useState(null); // 기록 클릭 시 화면에 표시할 핀
  const [specExpanded, setSpecExpanded] = useState(false); // 기획 펼치기(기본 접힘)
  const [variantKey, setVariantKey] = useState(""); // 선택한 경우의 수 ("" = 기본 화면)
  const [live, setLive] = useState(false);          // 조작 허용(기본 꺼짐 = 화면 고정)
  const [sending, setSending] = useState(false);
  const iframeRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => subscribeThread((all) => setThread(all)), []);
  useEffect(() => { setDraftPins([]); setViewPins(null); setPinMode(false); setVariantKey(""); setLive(false); }, [cur.id]);

  // 이 화면에 등록된 경우의 수 + 현재 선택
  const variants = variantsForScreen(cur.domain, cur.id);
  const variant = variants.find((v) => v.key === variantKey) || null;
  const frameSrcNow = previewPath(cur, variant, !live);

  // ── 화면공유 (핀 박은 스샷 캡처용 — 카카오맵 등 지도까지 포함) ──
  const stopShare = useCallback(() => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSharing(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const startShare = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" });
      streamRef.current = stream;
      setSharing(true);
      const v = videoRef.current;
      if (v) { v.srcObject = stream; try { await v.play(); } catch { /* noop */ } }
      const track = stream.getVideoTracks()[0];
      if (track) track.addEventListener("ended", stopShare);
      return stream;
    } catch { return null; }
  }, [stopShare]);
  useEffect(() => () => stopShare(), [stopShare]);

  // 폰 프레임은 항상 390×844로 렌더한다. 세로가 모자라면 통째로 축소해 비율을 지킨다.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => setPhoneScale(Math.min(1, el.clientHeight / PHONE_H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cur.path, isPC]);

  // 핀이 가리킨 실제 요소 정보(개발자가 위치를 정확히 읽음)
  const describeTarget = (clientX, clientY) => {
    try {
      const el0 = iframeRef.current;
      const doc = el0 && el0.contentDocument;
      if (!doc) return null;
      const r = el0.getBoundingClientRect();
      const el = doc.elementFromPoint(clientX - r.left, clientY - r.top);
      if (!el) return null;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
      return { tag: (el.tagName || "").toLowerCase(), text, label: el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "" };
    } catch { return null; }
  };
  // 화면공유 프레임에서 iframe 영역만 잘라 핀을 얹어 캡처(폴백 html2canvas)
  const captureFrame = async (pins) => {
    const iframeEl = iframeRef.current;
    const v = videoRef.current;
    if (!iframeEl) return "";
    if (v && v.videoWidth > 0 && streamRef.current) {
      await new Promise((r) => requestAnimationFrame(() => r()));
      const rect = iframeEl.getBoundingClientRect();
      const scaleX = v.videoWidth / window.innerWidth;
      const scaleY = v.videoHeight / window.innerHeight;
      const cw = Math.max(1, Math.round(rect.width));
      const ch = Math.max(1, Math.round(rect.height));
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch);
      try { ctx.drawImage(v, rect.left * scaleX, rect.top * scaleY, rect.width * scaleX, rect.height * scaleY, 0, 0, cw, ch); } catch { /* noop */ }
      pins.forEach((p) => drawPinOnCanvas(ctx, (p.x / 100) * cw, (p.y / 100) * ch, p.label || ""));
      try { return canvas.toDataURL("image/jpeg", 0.85); } catch { /* noop */ }
    }
    return captureViaHtml2canvas(iframeEl, pins);
  };
  // 핀 박아 캡처 → 첨부 이미지에 자동 추가 (draftPins는 위치 저장용으로 유지)
  const captureWithPins = async () => {
    if (!draftPins.length || busy) return;
    if (!streamRef.current) { const s = await startShare(); if (!s) alert("화면공유를 허용하면 지도까지 캡처됩니다. 취소하면 html2canvas로 캡처(지도 배경은 빠질 수 있음)."); }
    setBusy("캡처 중...");
    setPinMode(false);
    await new Promise((r) => setTimeout(r, 280));
    let dataUrl = "";
    try { dataUrl = await captureFrame(draftPins); } catch { /* noop */ }
    if (dataUrl) { setAttachImgs((p) => [...p, dataUrl]); setPinShotDone(true); }
    setBusy("");
  };

  const entries = (thread && thread[cur.id]) || [];

  // 미답변 수 — 개발자가 올린 질문/지시(root) 중 AI 답글(replyTo)이 안 달린 것
  const unanswered = (sid) => {
    const items = (thread && thread[sid]) || [];
    const answered = new Set(items.filter((x) => x.replyTo).map((x) => x.replyTo));
    return items.filter((x) => !x.replyTo && x.by === "개발자" && !answered.has(x.pid)).length;
  };
  const domainUnanswered = (d) => d.screens.reduce((n, s) => n + unanswered(s.id), 0);

  // 기록 남기기 → Firestore (실시간 반영, 배포 공유)
  const post = async () => {
    const text = draft.trim();
    if ((!text && !attachImgs.length && !draftPins.length) || sending) return;
    setSending(true);
    try {
      // 핀만 찍고 캡처를 안 누른 채 올리면 좌표만 남아, 나중에 읽는 사람이 핀 번호와
      // 화면을 맞출 수 없다 → 여기서 자동으로 한 장 박아 첨부한다.
      // 전송 흐름이 끊기지 않게 화면공유 권한은 새로 묻지 않는다(있으면 쓰고, 없으면 html2canvas).
      let imgs = attachImgs;
      if (draftPins.length && !pinShotDone) {
        setBusy("핀 캡처 중...");
        setPinMode(false);
        await new Promise((r) => setTimeout(r, 280)); // 화면 위 핀 오버레이가 걷힐 때까지 (이중 표시 방지)
        try { const shot = await captureFrame(draftPins); if (shot) imgs = [...imgs, shot]; } catch { /* noop */ }
        setBusy("");
      }
      await postEntry({ screenId: cur.id, by: author, text, imgs, pins: draftPins });
      setDraft(""); setAttachImgs([]); setDraftPins([]); setPinMode(false); setPinShotDone(false);
    } catch (e) {
      alert("저장 실패: " + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  // 스샷 첨부 — 파일 선택 / 클립보드 붙여넣기(Ctrl+V) → dataURL 누적
  // 리사이즈+jpeg 압축 (Firestore 문서 1MB 제한 대비)
  const fileToDataUrl = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        let { width, height } = img;
        if (width > max || height > max) { const s = Math.min(max / width, max / height); width = Math.round(width * s); height = Math.round(height * s); }
        const c = document.createElement("canvas"); c.width = width; c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  const addFiles = async (files) => {
    const arr = [];
    for (const f of files) if (f && f.type.startsWith("image/")) arr.push(await fileToDataUrl(f));
    if (arr.length) setAttachImgs((p) => [...p, ...arr]);
  };
  const onPasteImg = (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((it) => it.type.startsWith("image/")).map((it) => it.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  };
  // 화면 위 핀 찍기 (뷰포트 % 좌표 + 작성자+번호 라벨 + 가리킨 요소정보)
  const addPin = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = +(((e.clientX - r.left) / r.width) * 100).toFixed(1);
    const y = +(((e.clientY - r.top) / r.height) * 100).toFixed(1);
    const label = `${author}${draftPins.length + 1}`; // 작성자+번호(예: AI1) — 캡처 이미지에 박혀 번호 겹침 혼란 없음
    const target = describeTarget(e.clientX, e.clientY);
    setDraftPins((p) => [...p, { x, y, label, target }]);
    setPinShotDone(false); // 핀이 늘었으니 이전 캡처는 낡았다 → 전송 시 다시 뜬다
  };

  // 기록 1건 삭제 (confirm 후) — Firestore docId(pid). 글 삭제 시 그 댓글도 함께.
  const del = async (pid) => {
    if (!pid || !window.confirm("이 기록을 삭제할까요? (달린 댓글도 함께 삭제)")) return;
    try { await deleteEntry(pid); } catch (e) { alert("삭제 실패: " + (e?.message || e)); }
  };

  // 기록 카드 (isReply=true면 개발자 글 밑에 AI 답글처럼 들여쓰기)
  const renderCard = (e, isReply) => {
    const st = BY_STYLE[e.by] || BY_STYLE["개발자"];
    return (
      <div key={e.pid || `${e.by}_${e.at}_${(e.text || "").slice(0, 8)}`} style={{ marginLeft: isReply ? 22 : 0, padding: "9px 12px", borderRadius: 9, border: `1px solid ${st.line}`, background: st.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {isReply && <span style={{ color: C.gray2, fontSize: 13 }}>↳</span>}
          <b style={{ fontSize: 12, color: st.ink }}>{e.by}</b>
          <span style={{ fontSize: 11, color: C.gray2, fontVariantNumeric: "tabular-nums" }}>{e.at}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => del(e.pid || entries.indexOf(e))} title="이 기록 삭제" style={{ flex: "none", width: 20, height: 20, borderRadius: 5, border: "none", background: "transparent", color: C.gray2, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        {e.text && <div style={{ fontSize: 13, lineHeight: 1.55, color: C.ink2, whiteSpace: "pre-line" }}>{e.text}</div>}
        {e.imgs && e.imgs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: e.text ? 6 : 0 }}>
            {e.imgs.map((src, k) => (
              <img key={k} src={src} alt="첨부" onClick={() => window.open(src, "_blank")} style={{ maxWidth: 200, maxHeight: 140, borderRadius: 6, border: `1px solid ${C.line}`, cursor: "zoom-in", objectFit: "cover" }} />
            ))}
          </div>
        )}
        {e.pins && e.pins.length > 0 && (
          <button onClick={() => { setViewPins(e.pins); setPinMode(false); }} style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
            화면 핀 {e.pins.length}개 위치 보기
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.ink, fontFamily: FONT }}>
      {/* 화면공유 프레임 소스(숨김) — 핀 박은 스샷 캡처용 */}
      <video ref={videoRef} muted autoPlay playsInline style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999, top: -9999 }} />
      <header style={{ flex: "none", background: C.card, borderBottom: `1px solid ${C.line}`, padding: "12px 20px" }}>
        {/* 도메인 탭 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {DOMAINS.map((d) => {
            const on = d.key === cur.domain;
            const nUn = domainUnanswered(d);
            return (
              <button
                key={d.key}
                onClick={() => nav(`/review/${d.screens[0].id}`)}
                style={{
                  fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : "#fff", color: on ? "#fff" : C.ink2,
                }}
              >
                {d.label} <span style={{ fontWeight: 600, opacity: 0.7 }}>{d.screens.length}</span>
                {nUn > 0 && <span style={NBADGE} title={`미답변 ${nUn}건`}>{nUn}</span>}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => nav("/review/board")}
            title="전 화면 + 상태별 경우의 수를 한 캔버스에 고정 배치"
            style={{ fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "none", background: "#fc5b41", color: "#fff" }}
          >
            화면 보드
          </button>
          <span style={{ fontSize: 12, color: C.gray }}>화면 리뷰 · 좌=화면 / 우상=기획 / 우하=기록(개발자·AI)</span>
        </div>

        {/* 현재 화면 정보 */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 11 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, fontVariantNumeric: "tabular-nums" }}>{cur.no}</span>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-0.3px" }}>{cur.name}</h1>
          <span style={{ fontSize: 12, color: C.gray2, fontFamily: "ui-monospace, monospace" }}>{cur.path || "— 화면 없음(정책)"}</span>
        </div>

        {/* 현재 도메인 화면 칩 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
          {domain.screens.map((r) => {
            const nUn = unanswered(r.id);
            return (
              <button
                key={r.id}
                onClick={() => nav(`/review/${r.id}`)}
                style={{
                  fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 14, cursor: "pointer",
                  border: `1px solid ${nUn > 0 ? "#fc5b41" : r.id === cur.id ? C.ink : C.line}`,
                  background: r.id === cur.id ? C.ink : "#fff", color: r.id === cur.id ? "#fff" : C.gray,
                }}
              >
                {r.no} {r.name}
                {nUn > 0 && <span style={NBADGE} title={`미답변 ${nUn}건`}>{nUn}</span>}
              </button>
            );
          })}
        </div>
      </header>

      {/* 본문: 좌 화면 / 우 (기획 + 노트) */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, padding: 18, gap: 18 }}>
        <div style={{ flex: "none", width: isPC ? 780 : PHONE_W + 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {/* 경우의 수 — 이 화면에 등록된 상태 변형을 골라 본다 (목업이라 언제 봐도 같은 화면) */}
          {cur.path && variants.length > 0 && (
            <div style={{ width: isPC ? 760 : PHONE_W, flex: "none", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: C.gray2, fontWeight: 700 }}>경우의 수</span>
              <button onClick={() => setVariantKey("")} style={VCHIP(!variantKey)}>기본</button>
              {variants.map((v) => (
                <button key={v.key} onClick={() => setVariantKey(v.key)} style={VCHIP(variantKey === v.key)} title={v.scenario}>
                  {v.name.replace(/^[^·]+ · /, "")}
                </button>
              ))}
            </div>
          )}
          {cur.path && (
            <div style={{ width: isPC ? 760 : PHONE_W, flex: "none", display: "flex", alignItems: "center", gap: 6 }}>
              {/* 지금 상태를 그대로 읽히게 쓴다.
                  예전 라벨("화면 고정")은 "누르면 고정된다"로 읽혀서, 이미 고정된 상태인데
                  눌러버리면 오히려 고정이 풀리고 스플래시가 웰컴으로 넘어갔다. */}
              <button
                onClick={() => setLive((v) => !v)}
                title={
                  live
                    ? "지금 조작 가능 — 화면이 스스로 다음 화면으로 넘어갈 수 있습니다. 누르면 다시 고정."
                    : "지금 고정됨 — 화면이 안 넘어갑니다. 눌러서 직접 만져보기."
                }
                style={{
                  fontSize: 12, fontWeight: 800, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${live ? "#fc5b41" : "#18181b"}`,
                  background: live ? "#fc5b41" : "#18181b",
                  color: "#fff",
                }}
              >
                {live ? "✋ 조작 중" : "🔒 고정됨"}
              </button>
              <span style={{ fontSize: 11, color: C.gray2, fontWeight: 600, whiteSpace: "nowrap" }}>
                {live ? "→ 눌러서 고정" : "→ 눌러서 조작"}
              </span>
              <span style={{ fontSize: 11, color: C.gray2, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {frameSrcNow}
              </span>
            </div>
          )}
          {cur.path && !isPC && (
            <div style={{ width: PHONE_W, flex: "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => { setPinMode((v) => !v); setViewPins(null); }} style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${pinMode ? "#c2410c" : C.line}`, background: pinMode ? "#c2410c" : "#fff", color: pinMode ? "#fff" : C.gray }}>
                {pinMode ? "핀 찍는 중 · 화면 클릭" : "핀 찍기"}
              </button>
              {draftPins.length > 0 && (
                <>
                  <span style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>핀 {draftPins.length}
                    <button onClick={() => setDraftPins([])} style={{ marginLeft: 5, color: "#c2410c", fontWeight: 700, cursor: "pointer", background: "none", border: "none" }}>지우기</button>
                  </span>
                  <button onClick={captureWithPins} disabled={!!busy} title="화면공유로 지도까지 캡처 + 핀 박아 첨부 (지도 배경까지 담으려면 여기서 미리 캡처)" style={{ fontSize: 12, fontWeight: 800, padding: "5px 12px", borderRadius: 8, cursor: busy ? "default" : "pointer", border: "none", background: "#111827", color: "#fff" }}>
                    {busy || "핀 박아 캡처"}
                  </button>
                  <span style={{ fontSize: 11, color: pinShotDone ? "#10b981" : C.gray2, fontWeight: 700 }}>
                    {pinShotDone ? "캡처 첨부됨" : "기록 누르면 자동 캡처"}
                  </span>
                </>
              )}
              {sharing && (
                <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />공유중
                  <button onClick={stopShare} style={{ marginLeft: 2, background: "none", border: "none", color: C.gray2, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>중지</button>
                </span>
              )}
              {viewPins && (
                <button onClick={() => setViewPins(null)} style={{ fontSize: 12, color: C.gray, fontWeight: 700, cursor: "pointer", background: "none", border: "none" }}>핀 숨기기</button>
              )}
            </div>
          )}
          {cur.path && isPC ? (
            // 관리자 PC 화면: 1266px 논리폭을 0.6 스케일로 축소해 전체 레이아웃 프리뷰
            <div style={{ width: 760, height: "100%", maxHeight: 822, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.10)", background: "#fff" }}>
              <div style={{ width: 1266, height: 1370, transform: "scale(0.6)", transformOrigin: "top left" }}>
                <iframe ref={iframeRef} key={cur.id} title={cur.name} src={frameSrcNow} style={{ width: 1266, height: 1370, border: "none" }} />
              </div>
            </div>
          ) : cur.path ? (
            <div ref={stageRef} style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* boxSizing:content-box — 전역 border-box면 테두리 2px이 먹혀 내부가 388×842가 된다 */}
            <div style={{ position: "relative", boxSizing: "content-box", width: PHONE_W, height: PHONE_H, flex: "none", transform: `scale(${phoneScale})`, transformOrigin: "center center", borderRadius: 20, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.10)", background: "#fff" }}>
              <iframe ref={iframeRef} key={cur.id} title={cur.name} src={frameSrcNow} style={{ width: "100%", height: "100%", border: "none", pointerEvents: pinMode || !live ? "none" : "auto" }} />
              {(pinMode || viewPins) && (
                <div onClick={pinMode ? addPin : undefined} style={{ position: "absolute", inset: 0, cursor: pinMode ? "crosshair" : "default", background: pinMode ? "rgba(252,91,65,0.04)" : "transparent" }}>
                  {(pinMode ? draftPins : viewPins || []).map((p, i) => (
                    <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)", pointerEvents: "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ background: "#c2410c", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 7, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>{p.label || i + 1}</div>
                        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid #c2410c" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          ) : (
            <div style={{ width: PHONE_W, height: 460, borderRadius: 20, border: `1px dashed ${C.line2}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gray2, fontSize: 14, textAlign: "center", padding: 24 }}>
              화면 없음 — 정책/로직 항목입니다.<br />오른쪽 기획 내용을 참고하세요.
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <section style={{ flex: specExpanded ? "1 1 50%" : "none", minHeight: 0, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "none", padding: "11px 16px", borderBottom: `1px solid ${C.line}`, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>기획 내용</span>
              {cur.spec.length > 0 && (
                <button onClick={() => setSpecExpanded((v) => !v)} style={{ fontSize: 12, fontWeight: 700, color: C.gray, background: "none", border: "none", cursor: "pointer" }}>{specExpanded ? "접기" : "펼치기"}</button>
              )}
            </div>
            <div className="no-scrollbar" style={{ flex: specExpanded ? 1 : "none", maxHeight: specExpanded ? "none" : 96, overflowY: "auto", padding: "12px 16px" }}>
              {cur.spec.length === 0 ? (
                <div style={{ fontSize: 13, color: C.gray2 }}>아직 기획 내용이 없습니다. (필요한 화면부터 채워요)</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  {cur.spec.map((s, i) => {
                    const star = s.startsWith("★");
                    return <li key={i} style={{ fontSize: 13, lineHeight: 1.55, color: star ? C.ink : C.ink2, fontWeight: star ? 700 : 400 }}>{s}</li>;
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* 기록 스레드 — 개발자·AI 시간순, Firestore(reviewThreads) 저장 */}
          <section style={{ flex: 1, minHeight: 0, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "none", padding: "11px 16px", borderBottom: `1px solid ${C.line}`, fontSize: 13, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
              <span>기록 <span style={{ color: C.gray, fontWeight: 600 }}>개발자 · AI (시간순)</span></span>
              <span style={{ fontSize: 11, color: C.gray2, fontWeight: 600 }}>Firestore · reviewThreads</span>
            </div>

            {/* 스레드 목록 */}
            <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {entries.length === 0 ? (
                <div style={{ color: C.gray2, fontSize: 13, textAlign: "center", padding: "20px 0" }}>아직 기록이 없습니다. 아래에 남겨보세요.</div>
              ) : (
                // 개발자 글(root) + 그 밑에 AI 답글(replyTo=root.pid) 들여쓰기
                entries.filter((e) => !e.replyTo).flatMap((root) => [
                  renderCard(root, false),
                  ...entries.filter((c) => c.replyTo && c.replyTo === root.pid).map((c) => renderCard(c, true)),
                ])
              )}
            </div>

            {/* 입력 — 작성자(개발자/AI) 선택 후 기록 (Enter=전송 / Shift+Enter=줄바꿈) */}
            <div style={{ flex: "none", borderTop: `1px solid ${C.line}`, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.gray, fontWeight: 700 }}>작성자</span>
                {["개발자", "AI"].map((a) => {
                  const on = author === a;
                  const st = BY_STYLE[a];
                  return (
                    <button key={a} onClick={() => setAuthor(a)} style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 14, cursor: "pointer", border: `1px solid ${on ? st.ink : C.line}`, background: on ? st.ink : "#fff", color: on ? "#fff" : C.gray }}>
                      {a}
                    </button>
                  );
                })}
                <div style={{ flex: 1 }} />
                <label style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 14, cursor: "pointer", border: `1px solid ${C.line}`, background: "#fff", color: C.gray }}>
                  스샷 첨부
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
                </label>
              </div>
              {attachImgs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {attachImgs.map((src, k) => (
                    <div key={k} style={{ position: "relative" }}>
                      <img src={src} alt="첨부" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
                      <button onClick={() => setAttachImgs((p) => p.filter((_, j) => j !== k))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", border: "none", background: C.ink, color: "#fff", fontSize: 12, lineHeight: 1, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }}
                  onPaste={onPasteImg}
                  placeholder={`${author}(으)로 기록 · 스샷 Ctrl+V 붙여넣기 가능. Enter 전송 · Shift+Enter 줄바꿈`}
                  rows={2}
                  style={{ flex: 1, resize: "none", borderRadius: 8, border: `1px solid ${C.line}`, outline: "none", padding: "9px 11px", fontSize: 13, lineHeight: 1.5, fontFamily: FONT, color: C.ink }}
                />
                <button onClick={post} disabled={sending || (!draft.trim() && !attachImgs.length)} style={{ flex: "none", alignSelf: "stretch", padding: "0 16px", borderRadius: 8, border: "none", background: (draft.trim() || attachImgs.length) ? C.ink : C.line, color: "#fff", fontSize: 13, fontWeight: 800, cursor: (draft.trim() || attachImgs.length) ? "pointer" : "default" }}>
                  기록
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const C = { ink: "#18181b", ink2: "#3f3f46", gray: "#71717a", gray2: "#a1a1aa", line: "#e4e4e7", line2: "#d4d4d8", bg: "#f4f5f7", card: "#ffffff" };
// 미답변 N 뱃지 — 개발자 질문에 AI 답글 안 달린 화면/도메인 표시(코랄 원 + 흰 숫자)
// 경우의 수 칩
const VCHIP = (on) => ({
  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 12, cursor: "pointer",
  border: `1px solid ${on ? "#fc5b41" : C.line}`, background: on ? "#fc5b41" : "#fff", color: on ? "#fff" : C.gray,
});
const NBADGE = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 16, height: 16, marginLeft: 5, padding: "0 4px", borderRadius: 8, background: "#fc5b41", color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1, verticalAlign: "middle" };
// 작성자별 카드 색 (AI=파랑 / 개발자=검정)
const BY_STYLE = {
  AI: { ink: "#2563eb", line: "#bfdbfe", bg: "#f0f7ff" },
  개발자: { ink: "#18181b", line: "#e4e4e7", bg: "#fafafa" },
};
// 실제 폰 논리 해상도(iPhone 12~15 / 갤럭시 S 계열 기준). iframe은 항상 이 크기로 렌더해
// 앱이 인식하는 뷰포트를 실기기와 같게 유지하고, 창이 짧으면 비율 그대로 축소만 한다.
const PHONE_W = 390, PHONE_H = 844;
const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
