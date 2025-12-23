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
            // 실제로 스크롤이 생기는 애들만 0으로
            if (el.scrollHeight > el.clientHeight) {
                el.scrollTop = 0;
                el.scrollLeft = 0;
            }
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
