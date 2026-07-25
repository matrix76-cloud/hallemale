# 랜딩페이지 미디어 출처

외부에서 가져온 사진·영상의 출처와 라이선스를 남긴다.
재인코딩·리사이즈 과정에서 원본 메타데이터가 지워지므로, 새 에셋을 추가하면 여기에 반드시 한 줄 남길 것.

## Pexels

전부 [Pexels 라이선스](https://www.pexels.com/license/) — 상업적 사용 무료, 출처 표기 의무 없음, 편집 허용.
금지: 원본 무단 재판매, 다른 스톡 플랫폼 재배포, 상표·상호의 일부로 사용,
인물을 부정적으로 묘사, **인물이 제품을 추천하는 것처럼 암시**.

| 파일 | 원본 | 제작자 | 받은 날 |
|---|---|---|---|
| `hero.mp4` | [#8693601 People Playing Basketball](https://www.pexels.com/video/people-playing-basketball-8693601/) | Yaroslav Shuraev | 2026-07-18 |
| `story-match.jpg` | [#16599399](https://www.pexels.com/photo/men-plying-basketball-on-urban-open-air-court-16599399/) | rockwell-branding-agency | 2026-07-19 |
| `story-level.jpg` | [#36589583](https://www.pexels.com/photo/silhouettes-playing-basketball-at-dusk-36589583/) | Leo Wang | 2026-07-19 |
| `story-venue.jpg` | [#9739466](https://www.pexels.com/photo/aerial-view-of-basketball-court-9739466/) | kindelmedia | 2026-07-19 |
| `story-record.jpg` | [#5275524](https://www.pexels.com/photo/basketball-balls-on-a-basketball-hoop-5275524/) | cottonbro | 2026-07-19 |

### 가공 내역

- `hero.mp4` — 원본 2732×1440 24fps를 ffmpeg(libx264)로 1080p·10초 루프·무음·3.1MB로 재인코딩.
  첫 프레임을 `hero-poster.jpg`로 뽑아 자동재생 실패·reduced-motion 시 폴백으로 쓴다.
- `story-*.jpg` — Pexels CDN에서 1200×800로 받아 그대로 사용. 카드에서는 CSS로 3:1만 잘라 보여준다.

### endorsement 조항 주의

`hero.mp4`에는 얼굴이 식별되는 인물이 나온다. 지금은 캡션 없는 배경 영상이라 문제없지만,
**영상·사진 속 인물을 "할래말래 사용자"로 지칭하거나 후기처럼 배치하면 라이선스 위반**이 된다.
`story-*.jpg` 4장은 이 위험을 피하려고 부감·실루엣으로 얼굴이 안 보이는 것만 골랐다.
