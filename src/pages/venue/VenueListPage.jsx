/* eslint-disable */
// src/pages/venue/VenueListPage.jsx
// 제휴구장 예약 — 전용 헤더(뒤로+검색+일정) + 지도 메인
// - 지도 뷰: 전체 지도 + 가격 핀 + 하단 가로 스와이프 카드 캐러셀(중앙 카드 ↔ 핀 강조 동기화) + 인덱스 + 리스트로 보기
// - 리스트 뷰: 세로 카드 리스트 + 지도로 보기
// ⚠️ 평점/거리 데이터는 venues 모델에 없음 → 평점 없으면 "신규", 거리 생략(추후 연동)
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiMapPin, FiSearch, FiStar, FiCrosshair, FiCalendar, FiChevronDown, FiChevronLeft, FiList, FiMap, FiCheckCircle } from "react-icons/fi";
import { listBookableVenues, listReservations, listBlocks } from "../../services/ownerVenueService";
import Spinner from "../../components/common/Spinner";
import { FacilityIcon } from "./facilityIcons";

const toStr = (v) => String(v || "").trim();
function minPrice(v) {
  const prices = (v.courts || []).map((c) => Number(c.pricePerHour) || 0).filter((n) => n > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}
const isValidLatLng = (v) =>
  Number.isFinite(Number(v?.lat)) &&
  Number.isFinite(Number(v?.lng)) &&
  !(Number(v.lat) === 0 && Number(v.lng) === 0);

/* ---- 일정 필터 헬퍼 ---- */
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const hhmmToMin = (v) => {
  const [h, m] = String(v || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};
const overlap = (aS, aE, bS, bE) => hhmmToMin(aS) < hhmmToMin(bE) && hhmmToMin(aE) > hhmmToMin(bS);
const dayKeyOf = (ds) => { const d = new Date(`${ds}T00:00:00`); return DAY_KEYS[(d.getDay() + 6) % 7]; };
const addHours = (start, h) => { const t = hhmmToMin(start) + h * 60; return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`; };
const fmtDateChip = (ds) => {
  if (!ds) return "날짜";
  const d = new Date(`${ds}T00:00:00`);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}.${d.getDate()}(${w})`;
};
function nextDays(n) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  return out;
}
const HOUR_OPTS = Array.from({ length: 17 }, (_, i) => `${pad2(6 + i)}:00`); // 06:00~22:00

function ratingNode(v) {
  const score = Number(v?.rating);
  const count = Number(v?.reviewCount);
  if (Number.isFinite(score) && score > 0) {
    return (
      <RatingBadge>
        <FiStar size={12} /> {score.toFixed(1)}
        {Number.isFinite(count) && count > 0 ? <span>({count})</span> : null}
      </RatingBadge>
    );
  }
  return <RatingBadge $new><span>신규</span></RatingBadge>;
}

export default function VenueListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get("match") || "";
  const suffix = matchId ? `?match=${matchId}` : "";

  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("map"); // "map" | "list"
  const [selectedId, setSelectedId] = useState("");

  // 일정 필터
  const [fDate, setFDate] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [fStart, setFStart] = useState("");
  const [fDur, setFDur] = useState(2);
  const [picker, setPicker] = useState(null); // "schedule" | null
  const [availIds, setAvailIds] = useState(null);

  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const mapAreaRef = useRef(null);
  const carouselRef = useRef(null);
  const cardRefs = useRef({});
  const progScrollRef = useRef(false);
  const myLocRef = useRef(null); // 내 위치 마커(CustomOverlay)
  const geoWatchRef = useRef(null); // navigator.geolocation.watchPosition id
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBookableVenues()
      .then((rows) => { if (!cancelled) setVenues(Array.isArray(rows) ? rows : []); })
      .catch((e) => { console.warn("[VenueListPage] load failed", e); if (!cancelled) setVenues([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const schedLabel = (() => {
    const parts = [];
    if (fDate) { const d = new Date(`${fDate}T00:00:00`); parts.push(`${d.getMonth() + 1}.${d.getDate()}`); }
    if (fStart) parts.push(fStart);
    if (fRegion) parts.push(fRegion.split(" ").slice(-1)[0]);
    return parts.length ? parts.join(" · ") : "일정";
  })();
  const schedOn = !!(fDate || fStart || fRegion);

  const regions = useMemo(() => {
    const set = new Set();
    venues.forEach((v) => {
      const r = toStr(v.region) || toStr(v.address).split(" ").slice(0, 2).join(" ");
      if (r) set.add(r);
    });
    return Array.from(set);
  }, [venues]);

  // 날짜+시간대 → 예약 가능 구장 id 집합
  useEffect(() => {
    if (!fDate || !fStart) { setAvailIds(null); return; }
    let cancelled = false;
    const start = fStart;
    const end = addHours(fStart, fDur);
    const dk = dayKeyOf(fDate);
    (async () => {
      const ids = new Set();
      await Promise.all(
        venues.map(async (v) => {
          try {
            const [res, blk] = await Promise.all([
              listReservations({ venueId: v.id, date: fDate }),
              listBlocks({ venueId: v.id, date: fDate }),
            ]);
            const ok = (v.courts || []).some((c) => {
              const h = c.hours && c.hours[dk];
              if (h && h.closed) return false;
              if (h && (hhmmToMin(start) < hhmmToMin(h.open) || hhmmToMin(end) > hhmmToMin(h.close))) return false;
              const taken =
                res.some((r) => ["requested", "pending", "confirmed"].includes(r.status) && r.courtId === c.id && overlap(start, end, r.startTime, r.endTime)) ||
                blk.some((b) => b.courtId === c.id && overlap(start, end, b.startTime, b.endTime));
              return !taken;
            });
            if (ok) ids.add(v.id);
          } catch (e) {}
        })
      );
      if (!cancelled) setAvailIds(ids);
    })();
    return () => { cancelled = true; };
  }, [fDate, fStart, fDur, venues]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return venues.filter((v) => {
      if (kw && !(toStr(v.name).toLowerCase().includes(kw) || toStr(v.address).toLowerCase().includes(kw))) return false;
      if (fRegion && !(toStr(v.region) === fRegion || toStr(v.address).includes(fRegion))) return false;
      if (availIds && !availIds.has(v.id)) return false;
      return true;
    });
  }, [venues, q, fRegion, availIds]);

  const geoVenues = useMemo(() => filtered.filter(isValidLatLng), [filtered]);

  // 초기/필터 변경 시 활성 카드 = 첫 번째
  useEffect(() => {
    if (!filtered.length) { setSelectedId(""); return; }
    if (!selectedId || !filtered.some((v) => v.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const selIndex = filtered.findIndex((v) => v.id === selectedId);

  // 지도 + 가격 핀
  useEffect(() => {
    const kakao = window.kakao;
    if (view !== "map" || loading || !kakao || !kakao.maps || !hostRef.current) return;
    let cancelled = false;

    const build = () => {
      if (cancelled || !hostRef.current) return;
      if (hostRef.current.offsetWidth === 0) { requestAnimationFrame(build); return; }

      const center = geoVenues[0]
        ? new kakao.maps.LatLng(Number(geoVenues[0].lat), Number(geoVenues[0].lng))
        : new kakao.maps.LatLng(37.5665, 126.978);
      const map = new kakao.maps.Map(hostRef.current, { center, level: 6 });
      mapRef.current = map;

      const bounds = new kakao.maps.LatLngBounds();
      overlaysRef.current = geoVenues.map((v) => {
        const pos = new kakao.maps.LatLng(Number(v.lat), Number(v.lng));
        bounds.extend(pos);
        const price = minPrice(v);

        const wrap = document.createElement("div");
        Object.assign(wrap.style, {
          position: "relative", display: "inline-flex", flexDirection: "column",
          alignItems: "center", cursor: "pointer",
        });
        const pill = document.createElement("div");
        pill.textContent = price != null ? `${price.toLocaleString()}원` : "예약";
        Object.assign(pill.style, {
          padding: "6px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: "800",
          whiteSpace: "nowrap", background: "#fff", color: "#1f2937",
          border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 3px 10px -3px rgba(0,0,0,0.35)",
        });
        const tail = document.createElement("div");
        Object.assign(tail.style, {
          width: "0", height: "0", borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent", borderTop: "7px solid #fff", marginTop: "-1px",
          filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.18))",
        });
        wrap.appendChild(pill);
        wrap.appendChild(tail);
        wrap.addEventListener("click", () => selectAndScroll(v.id));
        const ov = new kakao.maps.CustomOverlay({ position: pos, content: wrap, yAnchor: 1, zIndex: 3 });
        ov.setMap(map);
        return { id: v.id, pill, tail, ov };
      });
      if (geoVenues.length > 1) map.setBounds(bounds);
    };

    if (typeof kakao.maps.load === "function") kakao.maps.load(() => !cancelled && build());
    else build();

    return () => {
      cancelled = true;
      overlaysRef.current = [];
      mapRef.current = null;
      // 지도 재생성 시 내 위치 마커는 옛 지도에서 분리(다음 위치 갱신 때 새 지도에 다시 붙음)
      if (myLocRef.current) myLocRef.current.setMap(null);
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loading, geoVenues]);

  // 지도 화면을 벗어나거나 언마운트되면 위치 추적 중지
  useEffect(() => {
    if (view !== "map") stopLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    return () => {
      if (geoWatchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
      }
    };
  }, []);

  // 선택 핀 강조 + 지도 센터 이동
  useEffect(() => {
    (overlaysRef.current || []).forEach(({ id, pill, tail, ov }) => {
      if (!pill) return;
      const on = id === selectedId;
      pill.style.background = on ? "#7c5cc9" : "#fff";
      pill.style.color = on ? "#fff" : "#1f2937";
      if (tail) tail.style.borderTopColor = on ? "#7c5cc9" : "#fff";
      if (ov && ov.setZIndex) ov.setZIndex(on ? 10 : 3);
    });
    const sel = filtered.find((v) => v.id === selectedId);
    if (sel && mapRef.current && window.kakao && isValidLatLng(sel)) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(Number(sel.lat), Number(sel.lng)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 핀 클릭/선택 → 해당 카드 가운데로 스크롤
  const selectAndScroll = (id) => {
    setSelectedId(id);
    const c = cardRefs.current[id];
    const el = carouselRef.current;
    if (c && el) {
      progScrollRef.current = true;
      el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
      setTimeout(() => { progScrollRef.current = false; }, 400);
    }
  };

  // 캐러셀 스와이프 → 중앙 카드 활성화(핀 동기화)
  const onCarouselScroll = () => {
    if (progScrollRef.current) return;
    const el = carouselRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let bestId = "";
    let best = Infinity;
    filtered.forEach((v) => {
      const c = cardRefs.current[v.id];
      if (!c) return;
      const cc = c.offsetLeft + c.offsetWidth / 2;
      const d = Math.abs(cc - center);
      if (d < best) { best = d; bestId = v.id; }
    });
    if (bestId && bestId !== selectedId) setSelectedId(bestId);
  };

  // ───── 내 위치(실시간) ─────
  const stopLocate = () => {
    if (geoWatchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
    }
    geoWatchRef.current = null;
    if (myLocRef.current) {
      myLocRef.current.setMap(null);
      myLocRef.current = null;
    }
    setLocating(false);
  };

  const showMyLocation = (lat, lng, recenterMap) => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!myLocRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 5px rgba(79,70,229,0.22);";
      myLocRef.current = new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5,
      });
    } else {
      myLocRef.current.setPosition(pos);
    }
    myLocRef.current.setMap(map);
    if (recenterMap) {
      map.setLevel(4);
      map.panTo(pos);
    }
  };

  // 클릭 시 GPS 추적 시작/중지(토글). 추적 중에는 위치가 바뀌면 실시간으로 마커가 따라옴.
  const locateMe = () => {
    if (geoWatchRef.current != null) {
      stopLocate();
      return;
    }
    if (!navigator.geolocation) {
      showAlert("이 기기에서는 위치 정보를 사용할 수 없어요.");
      return;
    }
    setLocating(true);
    let first = true;
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        showMyLocation(p.coords.latitude, p.coords.longitude, first);
        first = false;
      },
      (err) => {
        stopLocate();
        showAlert(
          err && err.code === 1
            ? "위치 권한이 거부됐어요. 기기/브라우저 설정에서 위치 권한을 허용해 주세요."
            : "현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요."
        );
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  };

  const goBook = (v) => navigate(`/venue-book/${v.id}${suffix}`);
  const resetFilters = () => { setFDate(""); setFRegion(""); setFStart(""); };
  const noMap = !window.kakao || !window.kakao.maps;

  return (
    <Page>
      {/* 전용 헤더 */}
      <TopRow>
        <BackBtn type="button" onClick={() => navigate(-1)} aria-label="뒤로"><FiChevronLeft size={22} /></BackBtn>
        <SearchBar>
          <FiSearch size={17} />
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="지역·구장 이름 검색" />
          {q && <ClearBtn type="button" onClick={() => setQ("")}>✕</ClearBtn>}
        </SearchBar>
        <HeaderSchedBtn type="button" $on={schedOn} onClick={() => setPicker("schedule")}>
          <FiCalendar size={13} /> {schedLabel} <FiChevronDown size={12} />
        </HeaderSchedBtn>
      </TopRow>

      {loading ? (
        <Center><Spinner size="lg" /></Center>
      ) : view === "map" ? (
        <MapArea ref={mapAreaRef}>
          {noMap ? (
            <Center><FiMapPin size={28} /><div>지도를 불러올 수 없어요.</div></Center>
          ) : (
            <>
              <MapHost ref={hostRef} />
              <LocBtn type="button" $on={locating} onClick={locateMe} aria-label="내 위치" title="내 위치"><FiCrosshair size={18} /></LocBtn>
            </>
          )}

          {/* 상단 중앙: 리스트로 보기 */}
          <TopCenterBtn type="button" onClick={() => setView("list")}><FiList size={14} /> 리스트로 보기</TopCenterBtn>

          {/* 우상단: 현재/전체 인덱스 */}
          {filtered.length > 0 && (
            <IndexBadge>{Math.max(0, selIndex) + 1} / {filtered.length}</IndexBadge>
          )}

          {/* 하단 가로 카드 캐러셀 */}
          {filtered.length === 0 ? (
            <EmptyBar>예약 가능한 구장이 없어요.</EmptyBar>
          ) : (
            <Carousel ref={carouselRef} onScroll={onCarouselScroll}>
              {filtered.map((v) => (
                <CardWrap
                  key={v.id}
                  ref={(el) => { cardRefs.current[v.id] = el; }}
                  $on={v.id === selectedId}
                  onClick={() => goBook(v)}
                >
                  <CardPhoto>
                    {v.imageUrl ? <CardPhotoImg src={v.imageUrl} alt={v.name} /> : <CardNoImg><FiMapPin size={22} /><span>구장 사진 / No image</span></CardNoImg>}
                    {ratingNode(v)}
                  </CardPhoto>
                  <CardInfo>
                    <CardName>{v.name}</CardName>
                    <CardAddr><FiMapPin size={12} /> {v.address}</CardAddr>
                    <CardBottom>
                      <CardTags>
                        {v.business?.status === "verified" && <VerifiedTag><FiCheckCircle size={11} /> 국세청 인증</VerifiedTag>}
                        <Tag>{v.type === "outdoor" ? "실외" : "실내"}</Tag>
                        <Tag>코트 {v.courts?.length || 0}개</Tag>
                      </CardTags>
                      <CardPrice>{minPrice(v) != null ? `${minPrice(v).toLocaleString()}원/시간` : "가격 문의"}</CardPrice>
                    </CardBottom>
                  </CardInfo>
                </CardWrap>
              ))}
            </Carousel>
          )}
        </MapArea>
      ) : (
        <ListArea>
          <TopCenterBtn type="button" onClick={() => setView("map")}><FiMap size={14} /> 지도로 보기</TopCenterBtn>
          <ListScroll>
            <ListHead>주변 구장 {filtered.length}<span>거리순 ›</span></ListHead>
            {filtered.length === 0 ? (
              <Center><FiMapPin size={26} /><div>예약 가능한 구장이 없어요.</div></Center>
            ) : (
              filtered.map((v) => (
                <ListCard key={v.id} type="button" onClick={() => goBook(v)}>
                  <ListCover>
                    {v.imageUrl ? <CardPhotoImg src={v.imageUrl} alt={v.name} /> : <CardNoImg><FiMapPin size={20} /><span>구장 사진 / No image</span></CardNoImg>}
                    {ratingNode(v)}
                    {minPrice(v) != null && <PriceTag>{minPrice(v).toLocaleString()}원~ / 시간</PriceTag>}
                  </ListCover>
                  <CardInfo>
                    <CardName>{v.name}</CardName>
                    <CardAddr><FiMapPin size={12} /> {v.address}</CardAddr>
                    <CardTags>
                      {v.business?.status === "verified" && <VerifiedTag><FiCheckCircle size={11} /> 국세청 인증</VerifiedTag>}
                      <Tag>{v.type === "outdoor" ? "실외" : "실내"}</Tag>
                      <Tag>코트 {v.courts?.length || 0}개</Tag>
                      {(v.facilities || []).slice(0, 3).map((f) => (
                        <Tag key={f}><FacilityIcon name={f} size={12} /> {f}</Tag>
                      ))}
                    </CardTags>
                  </CardInfo>
                </ListCard>
              ))
            )}
          </ListScroll>
        </ListArea>
      )}

      {/* 일정 선택 피커 */}
      {picker === "schedule" && (
        <PickerOverlay onClick={() => setPicker(null)}>
          <PickerSheet onClick={(e) => e.stopPropagation()}>
            <PickerHead>
              <PickerTitle>일정 선택</PickerTitle>
              <PickerClose type="button" onClick={() => setPicker(null)}>✕</PickerClose>
            </PickerHead>
            <PickerBody>
              <SecTitle>이용 날짜</SecTitle>
              <ChipsRow>
                {nextDays(14).map((d) => (
                  <MiniOpt key={d} $on={fDate === d} onClick={() => setFDate(fDate === d ? "" : d)}>{fmtDateChip(d)}</MiniOpt>
                ))}
              </ChipsRow>
              <SecTitle>지역</SecTitle>
              <ChipsRow $wrap>
                <MiniOpt $on={!fRegion} onClick={() => setFRegion("")}>전체</MiniOpt>
                {regions.map((r) => (<MiniOpt key={r} $on={fRegion === r} onClick={() => setFRegion(r)}>{r}</MiniOpt>))}
              </ChipsRow>
              <SecTitle>시간대</SecTitle>
              <DurRow>
                <DurBtn $on={fDur === 1} type="button" onClick={() => setFDur(1)}>1시간</DurBtn>
                <DurBtn $on={fDur === 2} type="button" onClick={() => setFDur(2)}>2시간</DurBtn>
              </DurRow>
              <ChipsRow>
                {HOUR_OPTS.map((h) => (
                  <MiniOpt key={h} $on={fStart === h} onClick={() => setFStart(fStart === h ? "" : h)}>{h}~{addHours(h, fDur)}</MiniOpt>
                ))}
              </ChipsRow>
            </PickerBody>
            <PickerFoot>
              <FootReset type="button" onClick={resetFilters}>초기화</FootReset>
              <FootApply type="button" onClick={() => setPicker(null)}>적용</FootApply>
            </PickerFoot>
          </PickerSheet>
        </PickerOverlay>
      )}
    </Page>
  );
}

/* ==================== styled ==================== */
const Page = styled.div`
  display: flex; flex-direction: column;
  height: 100dvh; min-height: 0; overflow: hidden;
  background: ${({ theme }) => theme.colors.bg};
`;
const Center = styled.div`
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;
`;

const TopRow = styled.div`
  flex-shrink: 0; display: flex; align-items: center; gap: 8px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
`;
const BackBtn = styled.button`
  flex-shrink: 0; border: none; background: transparent; cursor: pointer;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const SearchBar = styled.div`
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 999px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
`;
const SearchInput = styled.input`
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font-size: 14px; color: ${({ theme }) => theme.colors.textStrong};
  &::placeholder { color: ${({ theme }) => theme.colors.textWeak}; }
`;
const ClearBtn = styled.button`
  flex-shrink: 0; border: none; background: transparent; cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;
`;
const HeaderSchedBtn = styled.button`
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 11px; border-radius: 999px; cursor: pointer;
  font-size: 12.5px; font-weight: 700; white-space: nowrap;
  border: 1px solid ${({ theme, $on }) => ($on ? "#7c5cc9" : theme.colors.border)};
  background: ${({ theme, $on }) => ($on ? (theme.mode === "dark" ? "rgba(124,92,201,0.22)" : "#efe9ff") : theme.colors.surface)};
  color: ${({ theme, $on }) => ($on ? "#7c5cc9" : theme.colors.textStrong)};
`;

const MapArea = styled.div`
  position: relative; flex: 1; min-height: 0; overflow: hidden;
`;
const MapHost = styled.div`width: 100%; height: 100%;`;
const LocBtn = styled.button`
  position: absolute; right: 14px; bottom: 278px; z-index: 6;
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.textStrong)};
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  box-shadow: 0 4px 12px -4px rgba(0,0,0,0.35);
`;
const TopCenterBtn = styled.button`
  position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 5;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border: none; border-radius: 999px; cursor: pointer;
  background: rgba(17,24,39,0.88); color: #fff; font-size: 13px; font-weight: 700;
  box-shadow: 0 6px 16px -6px rgba(0,0,0,0.45);
`;
const IndexBadge = styled.div`
  position: absolute; right: 14px; top: 12px; z-index: 4;
  padding: 6px 11px; border-radius: 999px; font-size: 12px; font-weight: 800;
  background: rgba(17,24,39,0.78); color: #fff;
`;
const EmptyBar = styled.div`
  position: absolute; left: 12px; right: 12px; bottom: 16px; z-index: 5;
  padding: 18px; border-radius: 16px; text-align: center; font-size: 13px;
  background: ${({ theme }) => theme.colors.card}; color: ${({ theme }) => theme.colors.textWeak};
  box-shadow: 0 12px 30px -14px rgba(0,0,0,0.4);
`;

/* 가로 스와이프 캐러셀 */
const Carousel = styled.div`
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
  display: flex; gap: 12px;
  padding: 0 11vw 16px;
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { display: none; }
`;
const CardWrap = styled.div`
  flex: 0 0 78vw;
  max-width: 300px;
  scroll-snap-align: center;
  border-radius: 16px; overflow: hidden; cursor: pointer;
  background: ${({ theme }) => theme.colors.card};
  border: 2px solid ${({ theme, $on }) => ($on ? "#7c5cc9" : "transparent")};
  box-shadow: 0 14px 34px -16px rgba(0,0,0,0.5);
`;
const CardPhoto = styled.div`
  position: relative; width: 100%; aspect-ratio: 2 / 1; background: #1b1f27; overflow: hidden;
`;
const CardPhotoImg = styled.img`width: 100%; height: 100%; object-fit: cover; display: block;`;
const CardNoImg = styled.div`
  width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  color: rgba(255,255,255,0.4); font-size: 12px;
`;
const RatingBadge = styled.div`
  position: absolute; top: 10px; right: 10px;
  display: inline-flex; align-items: center; gap: 3px;
  padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 800;
  background: ${({ $new }) => ($new ? "rgba(124,92,201,0.92)" : "rgba(17,24,39,0.78)")};
  color: #fff;
  span { font-weight: 700; }
`;
const PriceTag = styled.div`
  position: absolute; left: 12px; bottom: 12px;
  background: rgba(0,0,0,0.62); color: #fff; padding: 6px 12px; border-radius: 8px;
  font-size: 13px; font-weight: 800;
`;
const CardInfo = styled.div`padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px;`;
const CardName = styled.div`
  font-size: 16px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const CardAddr = styled.div`
  font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};
  display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const CardBottom = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px;`;
const CardTags = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
const Tag = styled.span`
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 7px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textNormal};
`;
const VerifiedTag = styled.span`
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11.5px; font-weight: 800; padding: 4px 9px; border-radius: 7px;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.16)" : "#ecfdf5")};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.4)" : "#a7f3d0")};
  color: #059669;
`;
const CardPrice = styled.div`flex-shrink: 0; font-size: 14px; font-weight: 800; color: #7c5cc9;`;

/* 리스트 뷰 */
const ListArea = styled.div`position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column;`;
const ListScroll = styled.div`
  flex: 1; min-height: 0; overflow-y: auto; padding: 56px 14px 20px;
  display: flex; flex-direction: column; gap: 14px;
`;
const ListHead = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  font-size: 14px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};
  span { font-size: 12.5px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }
`;
const ListCard = styled.button`
  width: 100%; text-align: left; cursor: pointer; padding: 0;
  border-radius: 16px; overflow: hidden;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  display: flex; flex-direction: column;
  &:active { transform: translateY(1px); }
`;
const ListCover = styled.div`
  position: relative; width: 100%; aspect-ratio: 16 / 9; background: #1b1f27; overflow: hidden;
`;

/* 일정 피커 */
const PickerOverlay = styled.div`
  position: fixed; inset: 0; z-index: 1200; background: rgba(15,23,42,0.45);
  display: flex; align-items: flex-end; justify-content: center;
`;
const PickerSheet = styled.div`
  width: 100%; max-width: 520px; max-height: 72vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px 18px 0 0; display: flex; flex-direction: column; overflow: hidden;
`;
const PickerHead = styled.div`
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;
const PickerTitle = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const PickerClose = styled.button`border: none; background: transparent; cursor: pointer; font-size: 18px; color: ${({ theme }) => theme.colors.textWeak};`;
const PickerBody = styled.div`flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px calc(16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 6px;`;
const SecTitle = styled.div`font-size: 13px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; margin: 8px 2px 2px;`;
const ChipsRow = styled.div`
  display: flex; gap: 7px; padding-bottom: 2px;
  ${({ $wrap }) => ($wrap ? "flex-wrap: wrap;" : "overflow-x: auto; -webkit-overflow-scrolling: touch;")}
  &::-webkit-scrollbar { height: 0; }
`;
const MiniOpt = styled.button`
  flex: 0 0 auto; cursor: pointer; white-space: nowrap;
  padding: 9px 13px; border-radius: 999px; font-size: 13px; font-weight: 700;
  border: 1px solid ${({ theme, $on }) => ($on ? "#7c5cc9" : theme.colors.border)};
  background: ${({ theme, $on }) => ($on ? (theme.mode === "dark" ? "rgba(124,92,201,0.18)" : "#f3efff") : "transparent")};
  color: ${({ theme, $on }) => ($on ? "#7c5cc9" : theme.colors.textStrong)};
`;
const DurRow = styled.div`display: flex; gap: 8px; margin-bottom: 4px;`;
const DurBtn = styled.button`
  flex: 1; cursor: pointer; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 800;
  border: 1px solid ${({ theme, $on }) => ($on ? "#7c5cc9" : theme.colors.border)};
  background: ${({ theme, $on }) => ($on ? "#7c5cc9" : "transparent")};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textStrong)};
`;
const PickerFoot = styled.div`
  flex-shrink: 0; display: flex; gap: 8px;
  padding: 10px 14px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;
const FootReset = styled.button`
  flex: 1; cursor: pointer; border-radius: 12px; padding: 13px; font-size: 14px; font-weight: 700;
  border: 1px solid ${({ theme }) => theme.colors.border}; background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const FootApply = styled.button`
  flex: 1.6; cursor: pointer; border: none; border-radius: 12px; padding: 13px; font-size: 14px; font-weight: 800;
  color: #fff; background: #7c5cc9;
`;
