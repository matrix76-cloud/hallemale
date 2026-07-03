/* eslint-disable */
// src/pages/settings/NotificationSettingsPage.jsx
// ✅ 푸시 알림 설정 — 전체 ON/OFF + 카테고리별 ON/OFF
//    서버(functions/jobs/sendPushNotifications)가 users.notificationPrefs 를 확인해
//    enabled=false 또는 categories[category]=false 면 푸시를 건너뛴다.
import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import Spinner from "../../components/common/Spinner";
import {
  getMyNotificationPrefs,
  saveMyNotificationPrefs,
  getDefaultNotificationPrefs,
} from "../../services/notificationPrefsService";

const CATEGORY_ITEMS = [
  { key: "notice", label: "공지사항", desc: "서비스 공지·업데이트 안내" },
  { key: "chat", label: "채팅", desc: "매칭룸 채팅 메시지" },
  { key: "community", label: "커뮤니티", desc: "내 글 댓글·좋아요 알림" },
  { key: "teamInvite", label: "팀 초대", desc: "팀 초대 도착 알림" },
  { key: "teamDecision", label: "팀 수락/거절", desc: "참여요청 결과 알림" },
  { key: "match", label: "매칭 알림", desc: "매칭 신청·성사·경기 리마인드" },
];

export default function NotificationSettingsPage() {
  const { userDoc } = useAuth();
  const uid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(getDefaultNotificationPrefs());
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const p = await getMyNotificationPrefs(uid);
        if (alive) setPrefs(p);
      } catch (e) {
        // 실패 시 기본값 유지
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  const persist = useCallback(
    async (next) => {
      setPrefs(next); // 낙관적 반영
      if (!uid) return;
      try {
        await saveMyNotificationPrefs(uid, next);
        setSavedHint(true);
        window.clearTimeout(persist._t);
        persist._t = window.setTimeout(() => setSavedHint(false), 1500);
      } catch (e) {
        // 저장 실패해도 UI는 유지(다음 토글 시 재시도)
      }
    },
    [uid]
  );

  const toggleMaster = () => {
    persist({ ...prefs, enabled: !prefs.enabled });
  };

  const toggleCategory = (key) => {
    persist({
      ...prefs,
      categories: { ...prefs.categories, [key]: !prefs.categories?.[key] },
    });
  };

  if (loading) {
    return (
      <Wrap>
        <Center>
          <Spinner />
        </Center>
      </Wrap>
    );
  }

  const masterOn = prefs.enabled !== false;

  return (
    <Wrap>
      <H2>알림 설정</H2>
      <Desc>받고 싶은 푸시 알림을 선택할 수 있어요.</Desc>

      <Card>
        <Row>
          <RowText>
            <RowTitle>전체 푸시 알림</RowTitle>
            <RowDesc>끄면 아래 모든 알림이 전송되지 않아요.</RowDesc>
          </RowText>
          <Toggle $on={masterOn} onClick={toggleMaster} role="switch" aria-checked={masterOn}>
            <Knob $on={masterOn} />
          </Toggle>
        </Row>
      </Card>

      <SectionLabel>카테고리별 설정</SectionLabel>
      <Card $dim={!masterOn}>
        {CATEGORY_ITEMS.map((item, idx) => {
          const on = masterOn && prefs.categories?.[item.key] !== false;
          return (
            <Row key={item.key} $divider={idx > 0}>
              <RowText>
                <RowTitle>{item.label}</RowTitle>
                <RowDesc>{item.desc}</RowDesc>
              </RowText>
              <Toggle
                $on={on}
                $disabled={!masterOn}
                onClick={() => masterOn && toggleCategory(item.key)}
                role="switch"
                aria-checked={on}
              >
                <Knob $on={on} />
              </Toggle>
            </Row>
          );
        })}
      </Card>

      <SavedHint $show={savedHint}>저장됐어요</SavedHint>
    </Wrap>
  );
}

/* ===== styles ===== */

const Wrap = styled.div`
  padding: 16px 16px 40px;
  max-width: 720px;
  margin: 0 auto;
`;

const Center = styled.div`
  display: flex;
  justify-content: center;
  padding: 48px 0;
`;

const H2 = styled.h2`
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Desc = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#6b7280"};
`;

const SectionLabel = styled.div`
  margin: 20px 4px 8px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textNormal || "#374151"};
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 14px;
  padding: 4px 14px;
  opacity: ${({ $dim }) => ($dim ? 0.55 : 1)};
  transition: opacity 0.15s;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-top: ${({ $divider, theme }) =>
    $divider ? `1px solid ${theme?.colors?.border || "#f0f0f0"}` : "none"};
`;

const RowText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const RowTitle = styled.div`
  font-size: 14.5px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const RowDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#6b7280"};
`;

const Toggle = styled.button`
  flex-shrink: 0;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  border: none;
  padding: 0;
  position: relative;
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  background: ${({ $on, theme }) =>
    $on ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.border || "#d1d5db"};
  transition: background 0.18s;
`;

const Knob = styled.span`
  position: absolute;
  top: 3px;
  left: ${({ $on }) => ($on ? "23px" : "3px")};
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: left 0.18s;
`;

const SavedHint = styled.div`
  margin: 14px 4px 0;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transition: opacity 0.2s;
`;
