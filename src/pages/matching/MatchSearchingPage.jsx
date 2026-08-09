/* eslint-disable */
// src/pages/matching/MatchSearchingPage.jsx
// 빠른 매칭 ①.5 탐색 — 실제 후보 선별 과정을 단계별로 보여준다 + 광고 배너
// - 예전엔 3초 타이머만 돌리는 가짜 로딩이었다. 화면은 "종합하고 있어요"라고 하는데
//   실제로는 아무것도 하지 않아서, 다음 화면의 추천이 어디서 나온 건지 알 수 없었다.
// - 지금은 이 3초 동안 진짜로 후보를 선별한다(멤버 수 조회 → rankOpponents).
//   각 단계에 실제 숫자를 붙여 보여주고, 결과(멤버 수 맵)는 상대 공개 화면으로 넘겨
//   같은 조회를 두 번 하지 않는다(=상대 공개 화면의 스피너도 사라진다).
// - 최소 2.4초는 보여주고, 조회가 느려도 7초에서는 끊고 넘어간다(무한 대기 방지).

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { track } from "../../utils/analytics";
import { images } from "../../utils/imageAssets";
import FlowSteps from "./components/FlowSteps";
import { useClubContext } from "../../context/ClubContext";
import { useMatchingData } from "../../hooks/useMatchingData";
import { getClubMemberCounts } from "../../services/matchingHomeService";
import { rankOpponents, WEIGHTS } from "../../utils/matchmaking";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";
import {
  listActiveBanners,
  incrementBannerImpression,
  incrementBannerClick,
} from "../../services/bannersService";

const MIN_SHOW_MS = 2400; // 결과가 즉시 나와도 이 시간은 보여준다(깜빡임 방지)
const MAX_WAIT_MS = 7000; // 조회가 느려도 여기서는 넘어간다

const ripple = keyframes`
  0%   { transform: scale(0.5); opacity: 0.55; }
  100% { transform: scale(1.8); opacity: 0; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const stepIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
  padding: env(safe-area-inset-top) 16px 0;
`;

const StepsBar = styled.div`
  padding-top: 14px;
`;

const Top = styled.div`
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const Radar = styled.div`
  position: relative;
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
`;

const Ring = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1.5px solid ${({ theme }) => theme.colors.primary};
  opacity: 0.35;
  animation: ${ripple} 2.4s ease-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`;

const Sweep = styled.span`
  position: absolute;
  width: 98px;
  height: 98px;
  border-radius: 999px;
  border: 3px solid transparent;
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-right-color: ${({ theme }) => theme.colors.primary};
  animation: ${spin} 1.5s linear infinite;
`;

const Core = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(157,134,220,0.18)" : "#f2eefb"};
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.primary};
`;

const Headline = styled.h1`
  margin: 0;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RegionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ===== 선별 단계 로그 ===== */
const Steps = styled.ol`
  margin: 22px 0 0;
  padding: 14px 16px;
  list-style: none;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  gap: 11px;
`;

const StepRow = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  animation: ${stepIn} 0.3s ease both;
`;

/* 진행 중인 단계만 브랜드색, 끝난 단계는 회색으로 가라앉힌다 */
const StepMark = styled.span`
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  color: ${({ $done, theme }) =>
    $done ? theme.colors.primary : theme.colors.textWeak};
`;

const StepDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  animation: ${ripple} 1.2s ease-out infinite;
`;

const StepLabel = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: ${({ $done }) => ($done ? 600 : 700)};
  color: ${({ $done, theme }) =>
    $done ? theme.colors.textWeak : theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StepValue = styled.span`
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const AdWrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
`;

const AdCard = styled.div`
  position: relative;
  width: 100%;
  max-width: 360px;
  aspect-ratio: 2 / 1;
  border-radius: 18px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
`;

const AdImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const AdBadge = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.55);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
`;

const Footer = styled.div`
  padding: 14px 0 calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Track = styled.div`
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#e5e7eb"};
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  width: ${({ $pct }) => $pct}%;
  transition: width 0.2s linear;
`;

const FootRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function PinIcon({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MatchSearchingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const region = navState.region || "내 주변";
  const regionGu = String(navState.regionGu || "").trim();
  const regionSido = String(navState.regionSido || "").trim();

  const { activeTeamId } = useClubContext();
  const { myTeam, opponentTeams, loadedTeamId, preloadMatchingHomeData } =
    useMatchingData();

  // 사이클(다른 상대 찾기)로 들어온 경우 — 상대 공개 화면이 멤버 수를 넘겨준다.
  // 이미 아는 값을 다시 조회할 이유가 없으므로 여기선 연출과 광고만 담당한다.
  const cycling = !!navState.cycling;
  const handedCounts = useMemo(() => {
    const raw = navState.memberCounts;
    return Array.isArray(raw) && raw.length ? new Map(raw) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pct, setPct] = useState(6);
  const [visible, setVisible] = useState(1); // 지금까지 드러난 단계 수
  const [counts, setCounts] = useState(handedCounts); // clubId → 멤버 수 (null = 조회 중)
  const [ad, setAd] = useState(null); // 어드민 등록 광고(placement=matching) 1장
  const navStateRef = useRef(navState);
  navStateRef.current = navState;
  const leftRef = useRef(false); // 광고 클릭 등으로 화면을 떠났는지

  // 데이터 미로딩 진입(딥링크 등) 대비 — 후보 목록이 없으면 여기서 채운다
  useEffect(() => {
    if (!activeTeamId || opponentTeams?.length) return;
    preloadMatchingHomeData(activeTeamId).catch(() => {});
  }, [activeTeamId, opponentTeams, preloadMatchingHomeData]);

  // 새 탐색(사이클이 아닌 진입)이면 상대 공개 화면이 들고 있던 후보 순서·위치를 비운다.
  // 안 비우면 지역을 다시 골라 찾아도 직전에 보던 순번부터 이어서 나온다.
  useEffect(() => {
    if (cycling) return;
    try {
      window.sessionStorage?.removeItem(
        `halle.matchQueue.${activeTeamId || ""}.${regionGu}|${regionSido}`
      );
    } catch (e) {}
  }, [cycling, activeTeamId, regionGu, regionSido]);

  // 이 화면의 본업 — 후보 팀의 멤버 수 조회(하드 필터의 근거).
  // 결과는 다음 화면으로 넘겨 같은 조회를 반복하지 않는다.
  const idsKey = useMemo(
    () =>
      (Array.isArray(opponentTeams) ? opponentTeams : [])
        .map((t) => String(t.clubId || t.id || "").trim())
        .filter(Boolean)
        .join(","),
    [opponentTeams]
  );

  useEffect(() => {
    if (handedCounts) return; // 넘겨받은 값이 있으면 조회하지 않는다
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      // 목록이 다 로드됐는데도 비어 있으면 "후보 0" 으로 확정한다.
      // (로딩 중과 구분하지 않으면 아무 숫자도 못 채운 채 최대 대기까지 끌려간다)
      if (loadedTeamId && loadedTeamId === String(activeTeamId || "")) {
        setCounts(new Map());
      }
      return;
    }
    let alive = true;
    getClubMemberCounts(ids)
      .then((m) => alive && setCounts(m))
      .catch(() => alive && setCounts(new Map()));
    return () => {
      alive = false;
    };
  }, [idsKey, loadedTeamId, activeTeamId, handedCounts]);

  // 어드민(관리자 > 배너 > 매칭 광고)에서 등록한 활성 배너 중 순서가 가장 앞인 1장
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await listActiveBanners("matching");
        if (!alive || !Array.isArray(rows) || rows.length === 0) return;
        setAd(rows[0]);
        incrementBannerImpression(rows[0].id);
      } catch (e) {
        console.warn("[MatchSearchingPage] ad fetch failed:", e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 실제 선별 결과 — 다음 화면의 rankOpponents 와 같은 입력이라 숫자가 어긋나지 않는다.
  const result = useMemo(() => {
    if (!counts) return null;
    const list = Array.isArray(opponentTeams) ? opponentTeams : [];
    const mineId = String(myTeam?.clubId || myTeam?.id || activeTeamId || "").trim();
    const enough = list.filter((t) => {
      const id = String(t.clubId || t.id || "").trim();
      if (!id || id === mineId) return false;
      return (Number(counts.get(id)) || 0) >= MIN_TEAM_MEMBERS;
    }).length;
    const ranked = rankOpponents({
      myTeam,
      candidates: list,
      memberCounts: counts,
      regionGu,
      regionSido,
    });
    return { total: list.length, enough, final: ranked.total, widened: ranked.widened };
  }, [counts, opponentTeams, myTeam, activeTeamId, regionGu, regionSido]);

  const regionLabel = regionGu || regionSido || region;

  // 단계 정의 — value 가 null 이면 아직 계산 중(점 세 개로 표시)
  const steps = useMemo(
    () => [
      { label: "등록된 팀 불러오기", value: result ? `${result.total}팀` : null },
      {
        label: `팀원 ${MIN_TEAM_MEMBERS}명 이상 확인`,
        value: result ? `${result.enough}팀` : null,
      },
      {
        label: `${regionLabel} 인접 지역 추리기`,
        value: result ? `${result.final}팀` : null,
      },
      {
        label: "전력 균형·활동량 점수화",
        value: `전력 ${WEIGHTS.balance} · 지역 ${WEIGHTS.region}`,
      },
      {
        label: cycling ? "다음 후보 고르기" : "추천 순서 확정",
        value: result ? "완료" : null,
      },
    ],
    [result, regionLabel, cycling]
  );

  // 진행바 + 단계 노출 타이밍 (표시용 타임라인 — 실제 이동은 아래 effect 가 결정)
  useEffect(() => {
    // 빠른매칭 탐색 시작 — 매칭 퍼널. 사이클 재탐색은 새 진입과 구분해서 센다.
    track("match_search", { region, cycling });
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      const ratio = Math.min(1, elapsed / MIN_SHOW_MS);
      setPct(Math.round(6 + ratio * 90));
      setVisible(Math.min(5, 1 + Math.floor(elapsed / 460)));
      if (elapsed < MAX_WAIT_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [region]);

  // 이동 — 최소 노출 시간을 채우고 결과가 나오면 넘어간다(늦어도 MAX_WAIT_MS).
  // 두 시간 모두 "화면 진입 시각" 기준이다. 조회가 끝난 시점부터 재면 느린 회선에서
  // 대기 시간이 그만큼 더 붙는다.
  const mountedAtRef = useRef(0);
  if (!mountedAtRef.current) mountedAtRef.current = performance.now();

  useEffect(() => {
    const go = () => {
      if (leftRef.current) return;
      setPct(100);
      navigate("/matching/opponent", {
        state: {
          ...navStateRef.current,
          // 멤버 수를 함께 넘긴다 — 상대 공개 화면이 같은 조회를 반복하지 않도록.
          memberCounts: counts ? Array.from(counts.entries()) : null,
        },
        replace: true, // 뒤로가기 시 로딩 재진입 방지
      });
    };
    const elapsed = performance.now() - mountedAtRef.current;
    const hardStop = setTimeout(go, Math.max(0, MAX_WAIT_MS - elapsed));
    let soft;
    if (result) soft = setTimeout(go, Math.max(0, MIN_SHOW_MS - elapsed));
    return () => {
      clearTimeout(hardStop);
      clearTimeout(soft);
    };
    // counts 는 result 와 함께 확정되므로 의존성에 넣지 않는다(타이머 재설정 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, navigate]);

  const handleAdClick = () => {
    if (!ad) return;
    incrementBannerClick(ad.id);
    const url = String(ad.linkUrl || "").trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    leftRef.current = true; // 앱 내부 이동이면 자동 이동을 멈춘다
    navigate(url.startsWith("/") ? url : `/${url}`);
  };

  return (
    <Page>
      <StepsBar>
        <FlowSteps current={2} />
      </StepsBar>

      <Top>
        <Radar>
          <Ring $delay={0} />
          <Ring $delay={0.8} />
          <Ring $delay={1.6} />
          <Sweep />
          <Core>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
              <path
                d="m20 20-3.4-3.4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </Core>
        </Radar>

        <Headline>
          {cycling ? "다른 상대를 찾고 있어요" : "딱 맞는 상대를 찾고 있어요"}
        </Headline>
        <RegionRow>
          <PinIcon />
          {region} 주변
        </RegionRow>
      </Top>

      <Steps>
        {steps.slice(0, visible).map((s, i) => {
          const done = i < visible - 1 && s.value != null;
          return (
            <StepRow key={s.label}>
              <StepMark $done={done}>{done ? <CheckIcon /> : <StepDot />}</StepMark>
              <StepLabel $done={done}>{s.label}</StepLabel>
              <StepValue>{s.value ?? "…"}</StepValue>
            </StepRow>
          );
        })}
      </Steps>

      <AdWrap>
        <AdCard $clickable={!!ad?.linkUrl} onClick={handleAdClick}>
          <AdImg src={ad?.imageUrl || images.homeBanner2} alt={ad?.title || "광고"} />
          <AdBadge>AD · 광고</AdBadge>
        </AdCard>
      </AdWrap>

      <Footer>
        <Track>
          <Fill $pct={pct} />
        </Track>
        <FootRow>
          <span>
            {result?.widened
              ? "선택 지역에 상대가 적어 범위를 넓히는 중"
              : "지역·전력·활동량을 종합하고 있어요"}
          </span>
          <span>잠시만요…</span>
        </FootRow>
      </Footer>
    </Page>
  );
}
