"""
Pretendard woff2 2단 서브셋 생성기.

문제: 굵기 6종 × 약 770KB = 4.6MB. 로그인 화면 하나에서만 폰트 2.3MB를 받는다.
      용량의 대부분은 한글 완성형 11,172자 전체를 담고 있어서다.

해법: 굵기마다 두 파일로 나눈다.
  - <weight>.subset.woff2 : 상용 한글 2,350자(KS X 1001) + 라틴 + 문장부호
  - <weight>.ext.woff2    : 나머지 전부(희귀 음절, 그리스, 키릴, 가나, PUA …)

CSS의 unicode-range 가 둘을 연결하므로 글리프는 하나도 잃지 않는다. 브라우저는
화면에 실제로 나온 문자가 속한 파일만 내려받는다. 희귀 음절이 없는 일반 화면은
.subset 만 받으면 된다.

상용 2,350자는 "EUC-KR로 인코딩되는 음절"과 정확히 일치하므로 별도 목록이 필요없다.

실행: python scripts/subset-fonts.py
"""

from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

FONT_DIR = Path("public/fonts")
WEIGHTS = {
    "Regular": 400,
    "Medium": 500,
    "SemiBold": 600,
    "Bold": 700,
    "ExtraBold": 800,
    "Black": 900,
}


def common_hangul():
    """KS X 1001 완성형 상용 한글 2,350자.

    파이썬의 euc_kr 코덱은 실제로는 확장(cp949)이라 11,172자를 전부 인코딩한다.
    그래서 바이트값으로 KS X 1001 완성형 영역(선행 0xB0-0xC8, 후행 0xA1-0xFE)만 걸러낸다.
    """
    out = set()
    for cp in range(0xAC00, 0xD7A4):
        try:
            b = chr(cp).encode("euc-kr")
        except UnicodeEncodeError:
            continue
        if len(b) == 2 and 0xB0 <= b[0] <= 0xC8 and 0xA1 <= b[1] <= 0xFE:
            out.add(cp)
    return out


def tier1_codepoints(all_cps):
    keep = set()
    keep |= {c for c in all_cps if 0x0020 <= c <= 0x007E}   # 기본 라틴
    keep |= {c for c in all_cps if 0x00A0 <= c <= 0x00FF}   # 라틴-1 보충
    keep |= {c for c in all_cps if 0x2000 <= c <= 0x206F}   # 일반 문장부호
    keep |= {c for c in all_cps if 0x20A0 <= c <= 0x20BF}   # 통화기호
    keep |= {c for c in all_cps if 0x2100 <= c <= 0x21FF}   # 문자꼴 기호 + 화살표
    keep |= {c for c in all_cps if 0x2460 <= c <= 0x24FF}   # 원문자
    keep |= {c for c in all_cps if 0x25A0 <= c <= 0x25FF}   # 도형
    keep |= {c for c in all_cps if 0x2600 <= c <= 0x26FF}   # 기타 기호
    keep |= {c for c in all_cps if 0x3000 <= c <= 0x303F}   # CJK 문장부호
    keep |= {c for c in all_cps if 0x3130 <= c <= 0x318F}   # 한글 호환 자모
    keep |= {c for c in all_cps if 0xFF00 <= c <= 0xFFEF}   # 전각/반각
    keep |= common_hangul() & all_cps
    return keep


def to_ranges(cps):
    """정렬된 코드포인트를 CSS unicode-range 문자열로 압축한다."""
    cps = sorted(cps)
    parts, i = [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        if i == j:
            parts.append(f"U+{cps[i]:X}")
        else:
            parts.append(f"U+{cps[i]:X}-{cps[j]:X}")
        i = j + 1
    return ",".join(parts)


def subset(src, dst, cps):
    # 유니코드 3천 개를 CLI 인자로 넘기면 Windows 명령줄 길이 제한에 걸린다 → API 직접 호출.
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.hinting = False
    opts.desubroutinize = True
    opts.notdef_outline = True

    font = TTFont(src)
    s = Subsetter(options=opts)
    s.populate(unicodes=cps)
    s.subset(font)
    font.flavor = "woff2"
    font.save(str(dst))
    font.close()


def main():
    css_blocks = []
    total_before = total_t1 = total_t2 = 0

    for name, weight in WEIGHTS.items():
        src = FONT_DIR / f"Pretendard-{name}.woff2"
        if not src.exists():
            print(f"  건너뜀 (없음): {src}")
            continue

        all_cps = set(TTFont(src).getBestCmap().keys())
        t1 = tier1_codepoints(all_cps)
        t2 = all_cps - t1

        d1 = FONT_DIR / f"Pretendard-{name}.subset.woff2"
        d2 = FONT_DIR / f"Pretendard-{name}.ext.woff2"
        subset(src, d1, t1)
        subset(src, d2, t2)

        b, s1, s2 = src.stat().st_size, d1.stat().st_size, d2.stat().st_size
        total_before += b
        total_t1 += s1
        total_t2 += s2
        print(f"  {name:<10} {b//1024:>4}KB → subset {s1//1024:>3}KB ({len(t1):,}자) + ext {s2//1024:>3}KB ({len(t2):,}자)")

        # CSS Fonts 사양: 같은 family/weight 에서 unicode-range 가 겹치면
        # "나중에 선언된 규칙을 먼저" 검사한다. 그래서 ext 를 먼저(범위 생략 = 전체),
        # subset 을 나중에 정밀 범위로 선언하면 상용 문자는 subset, 나머지는 ext 가 맡는다.
        # → 거대한 ext 범위 문자열을 CSS에 넣지 않아도 된다.
        css_blocks.append(
            "@font-face {\n"
            '  font-family: "Pretendard";\n'
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            f'  src: url("/fonts/{d2.name}") format("woff2");\n'
            "  font-display: swap;\n"
            "}"
        )
        css_blocks.append(
            "@font-face {\n"
            '  font-family: "Pretendard";\n'
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            f'  src: url("/fonts/{d1.name}") format("woff2");\n'
            "  font-display: swap;\n"
            f"  unicode-range: {to_ranges(t1)};\n"
            "}"
        )

    header = (
        "/* 자동 생성 파일 — 직접 고치지 말 것. `python scripts/subset-fonts.py` 로 재생성한다.\n"
        "   굵기마다 두 벌: .subset(상용 2,350자+라틴) 과 .ext(나머지 전부).\n"
        "   ext 를 먼저 선언해 전체 범위를 맡기고, subset 을 나중에 정밀 범위로 선언한다.\n"
        "   (나중 규칙이 먼저 검사되므로 상용 문자는 작은 subset 파일만 내려받는다) */\n\n"
    )
    out = Path("public/fonts/pretendard.css")
    out.write_text(header + "\n\n".join(css_blocks) + "\n", encoding="utf-8")
    print(f"\n  원본 합계 {total_before//1024}KB")
    print(f"  1차(subset) 합계 {total_t1//1024}KB  ← 일반 화면이 받는 양")
    print(f"  2차(ext) 합계 {total_t2//1024}KB     ← 희귀 문자 나올 때만")
    print(f"\n  @font-face 규칙 → {out}")


if __name__ == "__main__":
    main()
