/* eslint-disable */
// src/components/community/TodayMatchesStripFlat.jsx
// ✅ 커뮤니티 상단 "오늘 경기" 탭 + 가로 카드 스트립
// ✅ data 입력 2가지 지원
// 1) 그룹형: [{ key, label, items: [...] }, ...]
// 2) 플랫형:  [ item, item, ... ] → 내부에서 featured + kbl/wkbl/nba 그룹 구성
// ✅ 팀 로고(홈/원정) 표시 지원
// - it.homeEmblemUrl / it.awayEmblemUrl
// - 또는 it.raw.home.emblemUrl / it.raw.away.emblemUrl 에서 자동 추출

import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

const Wrap = styled.section`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 10px 0 0;
`;

const TabsRow = styled.div`
  display: flex;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabBtn = styled.button`
  appearance: none;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "rgba(17, 24, 39, 0.08)"};
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary || "#24457f" : theme?.colors?.card || "#ffffff"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;

  &:active {
    transform: translateY(1px);
  }
`;

const Strip = styled.div`
  margin-top: 10px;
  padding: 0 16px 6px;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Card = styled.button`
  flex: 0 0 260px;
  max-width: 260px;
  border: none;
  text-align: left;
  cursor: pointer;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 8px;
  padding: 14px 14px 12px;
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 8px 24px rgba(15, 23, 42, 0.06)"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "rgba(17, 24, 39, 0.06)"};

  &:active {
    transform: translateY(1px);
    opacity: 0.95;
  }
`;

const TopLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const TimeText = styled.div`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Badge = styled.div`
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme?.mode === "dark"
      ? "rgba(99,102,241,0.18)"
      : "rgba(36, 69, 127, 0.08)"};
  color: ${({ theme }) =>
    theme?.mode === "dark"
      ? "#a5b4fc"
      : theme?.colors?.primary || "#24457f"};
  white-space: nowrap;
`;

const TeamRow = styled.div`
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const LogoStack = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
`;

const LogoCircle = styled.div`
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f3f4f6"};
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "rgba(0, 0, 0, 0.06)"};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoImg = styled.img.attrs({
  referrerPolicy: "no-referrer",
  loading: "lazy",
  decoding: "async",
})`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`;

const TeamNameBlock = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 800;
  line-height: 1.2;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Sub = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#6b7280"};
  line-height: 1.4;
`;

const EmptyCard = styled(Card)``;

function safeStr(v) {
  return String(v || "").trim();
}

function leagueLabel(league) {
  const l = safeStr(league).toLowerCase();
  if (l === "kbl") return "남자농구";
  if (l === "wkbl") return "여자농구";
  if (l === "nba") return "NBA";
  return "농구";
}

function normalizeItem(it = {}) {
  const raw = it?.raw || null;

  const homeEmblemUrl = safeStr(raw?.home?.emblemUrl);
  const awayEmblemUrl = safeStr(raw?.away?.emblemUrl);

  const homeName =
    safeStr(it?.homeName) || safeStr(raw?.home?.name) || safeStr(raw?.homeName);

  const awayName =
    safeStr(it?.awayName) || safeStr(raw?.away?.name) || safeStr(raw?.awayName);

  const title =
    safeStr(it?.title) ||
    (homeName && awayName ? `${homeName} vs ${awayName}` : "오늘 경기");

  const sub = safeStr(it?.sub);
  const badge = safeStr(it?.badge);

  const date = safeStr(raw?.date);

  const startTime =
    safeStr(it?.startTime) ||
    safeStr(raw?.startTime) ||
    safeStr(raw?.time) ||
    "";

  const time =
    startTime || safeStr(it?.time) || safeStr(it?.startAtText) || "";

  const league =
    safeStr(it?.league) ||
    safeStr(raw?.league) ||
    safeStr(raw?.categoryId) ||
    "";

  return {
    id: safeStr(it?.id) || safeStr(it?.key) || `${title}-${time}`,
    key: safeStr(it?.key) || safeStr(it?.id) || `${title}-${time}`,
    title,
    sub,
    badge,
    date,
    time,
    league: safeStr(league).toLowerCase(),
    homeName,
    awayName,
    homeEmblemUrl,
    awayEmblemUrl,
    empty: !!it?.empty,
    raw,
  };
}

function isGroupShape(data) {
  return Array.isArray(data) && data.length > 0 && !!data[0]?.items && !!data[0]?.key;
}

function buildDefaultGroupsIfEmpty() {
  return [
    {
      key: "featured",
      label: "주요 경기",
      items: [
        {
          id: "featured-empty",
          title: "오늘 경기",
          sub: "금일 예정된 경기 없습니다",
          badge: "농구",
          empty: true,
        },
      ],
    },
    {
      key: "kbl",
      label: "남자농구",
      items: [
        {
          id: "kbl-empty",
          title: "남자농구",
          sub: "금일 예정된 경기 없습니다",
          badge: "KBL",
          empty: true,
        },
      ],
    },
    {
      key: "wkbl",
      label: "여자농구",
      items: [
        {
          id: "wkbl-empty",
          title: "여자농구",
          sub: "금일 예정된 경기 없습니다",
          badge: "WKBL",
          empty: true,
        },
      ],
    },
    {
      key: "nba",
      label: "NBA",
      items: [
        {
          id: "nba-empty",
          title: "NBA",
          sub: "금일 예정된 경기 없습니다",
          badge: "NBA",
          empty: true,
        },
      ],
    },
  ];
}

function buildEmptyLeagueItem(league) {
  const l = safeStr(league).toLowerCase();
  const label = leagueLabel(l);
  return normalizeItem({
    id: `${l}-empty`,
    title: label,
    sub: "금일 예정된 경기 없습니다",
    badge: l === "kbl" ? "KBL" : l === "wkbl" ? "WKBL" : l === "nba" ? "NBA" : "농구",
    league: l,
    empty: true,
  });
}

export default function TodayMatchesStripFlat({
  data,
  initialKey = "featured",
  onItemClick,
}) {
  const groups = useMemo(() => {
    if (!data) return buildDefaultGroupsIfEmpty();

    if (isGroupShape(data)) {
      const g = (data || [])
        .map((grp) => {
          const key = safeStr(grp?.key);
          const label = safeStr(grp?.label) || key;
          const items = Array.isArray(grp?.items) ? grp.items.map(normalizeItem) : [];
          return { key, label, items };
        })
        .filter((x) => !!x.key);

      return g.length ? g : buildDefaultGroupsIfEmpty();
    }

    if (Array.isArray(data)) {
      const items = data.map(normalizeItem);
      if (!items.length) return buildDefaultGroupsIfEmpty();

      const kbl = items.filter((x) => x.league === "kbl");
      const wkbl = items.filter((x) => x.league === "wkbl");
      const nba = items.filter((x) => x.league === "nba");

      return [
        { key: "featured", label: "주요 경기", items },
        { key: "kbl", label: "남자농구", items: kbl.length ? kbl : [buildEmptyLeagueItem("kbl")] },
        { key: "wkbl", label: "여자농구", items: wkbl.length ? wkbl : [buildEmptyLeagueItem("wkbl")] },
        { key: "nba", label: "NBA", items: nba.length ? nba : [buildEmptyLeagueItem("nba")] },
      ];
    }

    return buildDefaultGroupsIfEmpty();
  }, [data]);

  const [activeKey, setActiveKey] = useState(initialKey);

  useEffect(() => {
    const exists = groups.some((g) => g.key === activeKey);
    if (!exists) setActiveKey(groups[0]?.key || "featured");
  }, [groups, activeKey]);

  const activeGroup = useMemo(() => {
    return groups.find((g) => g.key === activeKey) || groups[0];
  }, [groups, activeKey]);

  const items = Array.isArray(activeGroup?.items) ? activeGroup.items : [];

  return (
    <Wrap>
      <TabsRow>
        {groups.map((g) => (
          <TabBtn
            key={g.key}
            type="button"
            $active={g.key === activeKey}
            onClick={() => setActiveKey(g.key)}
          >
            {g.label}
          </TabBtn>
        ))}
      </TabsRow>

      <Strip>
        {items.length ? (
          items.map((it) => {
            const key = it.id || it.key;

            const badgeText = it.badge || (it.league ? leagueLabel(it.league) : "농구");
            const timeText = it.date || "—";
            const subtitle = it.sub || "";

            if (it.empty) {
              return (
                <EmptyCard
                  key={key}
                  type="button"
                  onClick={() => {
                    if (typeof onItemClick === "function") onItemClick(it);
                    else showAlert("금일 예정된 경기 없습니다");
                  }}
                >
                  <TopLine>
                    <TimeText>—</TimeText>
                    <Badge>{badgeText}</Badge>
                  </TopLine>

                  <TeamRow>
                    <LogoStack>
                      <LogoCircle style={{ left: 0, top: 16 }} />
                      <LogoCircle style={{ left: 20, top: 2 }} />
                    </LogoStack>
                    <TeamNameBlock>
                      <Title>{it.title || "오늘 경기"}</Title>
                    </TeamNameBlock>
                  </TeamRow>

                  <Sub>{subtitle || "금일 예정된 경기 없습니다"}</Sub>
                </EmptyCard>
              );
            }

            return (
              <Card
                key={key}
                type="button"
                onClick={() => {
                  if (typeof onItemClick === "function") onItemClick(it);
                }}
              >
                <TopLine>
                  <TimeText>{timeText}</TimeText>
                  <Badge>{badgeText}</Badge>
                </TopLine>

                <TeamRow>
                  <LogoStack>
                    <LogoCircle style={{ left: 0, top: 16 }}>
                      {it.homeEmblemUrl ? <LogoImg src={it.homeEmblemUrl} alt="" /> : null}
                    </LogoCircle>
                    <LogoCircle style={{ left: 20, top: 2 }}>
                      {it.awayEmblemUrl ? <LogoImg src={it.awayEmblemUrl} alt="" /> : null}
                    </LogoCircle>
                  </LogoStack>

                  <TeamNameBlock>
                    <Title>{it.title}</Title>
                    {it.homeName || it.awayName ? null : null}
                  </TeamNameBlock>
                </TeamRow>

                {subtitle ? <Sub>{subtitle}</Sub> : null}
              </Card>
            );
          })
        ) : (
          <EmptyCard type="button" onClick={() => showAlert("금일 예정된 경기 없습니다")}>
            <TopLine>
              <TimeText>—</TimeText>
              <Badge>농구</Badge>
            </TopLine>
            <TeamRow>
              <LogoStack>
                <LogoCircle style={{ left: 0, top: 16 }} />
                <LogoCircle style={{ left: 20, top: 2 }} />
              </LogoStack>
              <TeamNameBlock>
                <Title>오늘 경기</Title>
              </TeamNameBlock>
            </TeamRow>
            <Sub>금일 예정된 경기 없습니다</Sub>
          </EmptyCard>
        )}
      </Strip>
    </Wrap>
  );
}
