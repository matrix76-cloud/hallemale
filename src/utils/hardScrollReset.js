// src/utils/hardScrollReset.js
/* eslint-disable */
export function hardScrollReset() {
    if (typeof window === "undefined") return;

    const doc = document;

    // 후보들: 가장 많이 쓰일 만한 컨테이너들
    const candidates = [
        doc.scrollingElement,
        doc.documentElement,
        doc.body,
        document.getElementById("root"),
        ...Array.from(
            doc.querySelectorAll(
                "main, [data-scroll-root], .page-wrap, .scroll-container"
            )
        ),
    ];

    const seen = new Set();

    for (const el of candidates) {
        if (!el || seen.has(el)) continue;
        seen.add(el);

        try {
            // scrollHeight/clientHeight 를 읽으면 강제 리플로우가 걸린다. 이 함수는 라우트가
            // 바뀔 때마다 useLayoutEffect 안에서(=페인트 직전) 돌기 때문에 그 비용이 매 화면 전환에
            // 얹힌다. 스크롤이 있는지 묻지 말고 그냥 0으로 쓴다 — 비스크롤 요소에는 no-op 이다.
            el.scrollTop = 0;
            el.scrollLeft = 0;
        } catch {
            // ignore
        }
    }

    // 마지막으로 window 기준도 한 번
    try {
        window.scrollTo(0, 0);
    } catch {
        // ignore
    }
}
