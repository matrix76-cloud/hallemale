/* eslint-disable */
// src/components/community/TodayMatchesStripFlat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

/**
 * TodayMatchesStripFlat
 * - tabs + items(flat) 기반으로 "오늘의 경기" 위젯 렌더
 * - 스크롤 내리면 접히고, 위로 올리면 다시 보여줌
 *
 * props
 * - data: { tabs: {key,label}[], items: FlatItem[] }
 * - initialKey?: string
 * - onItemClick?: (item) => void
 */

const Wrap = styled.section`
  width: 100%;
  box-sizing: border-box;
`;

const Shell = styled.div`
  border-radius: 16px;
  background: ${({ theme }) => theme.colors?.card || "#fff"};
  border: 1px solid #eef0f4;
  overflow: hidden;
`;

const TabsRow = styled.div`
  padding: 14px 14px 10px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled.button`
  appearance: none;
  border: 1px solid ${({ $active }) => ($active ? "transparent" : "#e6e8ee")};
  background: ${({ $active }) => ($active ? "#2f6cf6" : "#fff")};
  color: ${({ $active }) => ($active ? "#fff" : "#2b2f36")};
  padding: 9px 14px;
  border-radius: 999px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
`;




const TeamRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;




/* eslint-disable */
// TodayMatchesStripFlat.jsx에서 아래 Styled들만 이걸로 교체해줘

const Track = styled.div`
  position: relative;
  padding: 8px 10px 12px;
  background: ${({ theme }) => theme.colors?.bgSoft || "#f7f8fa"};
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Card = styled.button`
  appearance: none;
  border: 0;
  text-align: left;
  cursor: pointer;

  min-width: 188px;
  max-width: 188px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #eef0f4;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  box-shadow: 0 8px 14px rgba(0, 0, 0, 0.06);

  &:active {
    transform: translateY(1px);
  }
`;

const Meta = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;

  .time {
    color: #2f6cf6;
    font-size: 14px;
    font-weight: 600;
  }
  .league {
    color: #6b7280;
    font-size: 13px;
  }
`;

const Teams = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
`;

const Logo = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: contain;
  background: #fff;
  border: 1px solid #f0f2f6;
`;

const LogoFallback = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #f2f4f7;
  border: 1px solid #f0f2f6;
`;

const Name = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-family: "GmarketSans";

  .text {
    font-size: 16px;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag {
    font-size: 11px;
    color: #6b7280;
    background: #f2f4f7;
    padding: 3px 7px;
    border-radius: 8px;
    line-height: 1;
  }
`;

const TextOnlyBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  .title {
    font-size: 15px;
    color: #111827;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sub {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/* 스크롤 내리면 숨김, 위로 올리면 표시 */
function useHideOnScroll({ thresholdPx = 28 } = {}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const goingDown = y > lastY.current;

      if (y <= thresholdPx) {
        setHidden(false);
      } else if (goingDown) {
        setHidden(true);
      } else {
        setHidden(false);
      }

      lastY.current = y;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholdPx]);

  return hidden;
}

const Collapsible = styled.div`
  overflow: hidden;
  will-change: max-height, opacity, transform;
  transition: max-height 260ms ease, opacity 220ms ease, transform 260ms ease;

  max-height: ${({ $hidden }) => ($hidden ? "0px" : "340px")};
  opacity: ${({ $hidden }) => ($hidden ? 0 : 1)};
  transform: ${({ $hidden }) => ($hidden ? "translateY(-6px)" : "translateY(0)")};
`;

function toHttps(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("http://")) return s.replace("http://", "https://");
  return s;
}

export function SafeLogo({ src, alt }) {
  const [bad, setBad] = useState(false);

  const safeSrc = useMemo(() => toHttps(src), [src]);

  if (!safeSrc || bad) return <LogoFallback aria-hidden="true" />;

  return (
    <Logo
      src={safeSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBad(true)}
    />
  );
}

export default function TodayMatchesStripFlat({
  data,
  initialKey = "featured",
  onItemClick,
}) {
  const hidden = useHideOnScroll({ thresholdPx: 28 });

  const tabs = useMemo(() => (data?.tabs?.length ? data.tabs : []), [data]);
  const items = useMemo(() => (data?.items?.length ? data.items : []), [data]);

  const [activeKey, setActiveKey] = useState(initialKey);

  useEffect(() => {
    setActiveKey(initialKey || "featured");
  }, [initialKey]);

  useEffect(() => {
    if (!tabs.length) return;
    const ok = tabs.some((t) => t.key === activeKey);
    if (!ok) setActiveKey(tabs[0].key);
  }, [tabs, activeKey]);

  const filtered = useMemo(() => {
    return items.filter((x) => x.tabKey === activeKey);
  }, [items, activeKey]);

  const handleClick = (item) => {
    if (typeof onItemClick === "function") return onItemClick(item);
  };

  if (!tabs.length) return null;

  return (
    <Wrap aria-label="오늘의 경기">
      <Collapsible $hidden={hidden}>
        <Shell>
          <TabsRow>
            {tabs.map((t) => (
              <Tab
                key={t.key}
                type="button"
                $active={t.key === activeKey}
                onClick={() => setActiveKey(t.key)}
              >
                {t.label}
              </Tab>
            ))}
          </TabsRow>

          <Track>
            <Row>
              {filtered.map((it) => (
                <Card key={`${it.tabKey}:${it.id}`} type="button" onClick={() => handleClick(it)}>
                  <Meta>
                    <div className="time">{it.timeText}</div>
                    <div className="league">{it.league}</div>
                  </Meta>

                  {it.kind === "text" ? (
                    <TextOnlyBox>
                      <div className="title">{it.title}</div>
                      {it.stadium ? <div className="sub">{it.stadium}</div> : null}
                    </TextOnlyBox>
                  ) : (
                    <Teams>
                      <TeamRow>
                        <SafeLogo src={it.home?.logoUrl} alt={`${it.home?.name || ""} 로고`} />
                        <Name>
                          <div className="text">{it.home?.name}</div>
                          <div className="tag">홈</div>
                        </Name>
                      </TeamRow>

                      <TeamRow>
                        <SafeLogo src={it.away?.logoUrl} alt={`${it.away?.name || ""} 로고`} />
                        <Name>
                          <div className="text">{it.away?.name}</div>
                        </Name>
                      </TeamRow>
                    </Teams>
                  )}
                </Card>
              ))}
            </Row>
          </Track>
        </Shell>
      </Collapsible>
    </Wrap>
  );
}
