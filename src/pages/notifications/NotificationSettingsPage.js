/* eslint-disable */
// src/pages/settings/NotificationSettingsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import Spinner from "../../components/common/Spinner";
import { useAuth } from "../../hooks/useAuth";
import {
  getDefaultNotificationPrefs,
  getMyNotificationPrefs,
  saveMyNotificationPrefs,
} from "../../services/notificationPrefsService";

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 14px 14px 24px;
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px 14px;
`;

const Title = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  margin-bottom: 6px;
`;

const Desc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  line-height: 1.55;
`;

const Divider = styled.div`
  height: 1px;
  background: #e5e7eb;
  margin: 12px 0;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;

  &:not(:last-child) {
    border-bottom: 1px solid #f3f4f6;
  }
`;

const RowLeft = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RowTitle = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
`;

const RowSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const Switch = styled.button`
  width: 44px;
  height: 26px;
  border-radius: 999px;
  border: none;
  padding: 2px;
  cursor: pointer;
  position: relative;
  background: ${({ $on }) => ($on ? "#4f46e5" : "#d1d5db")};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};

  &:active {
    transform: translateY(1px);
  }
`;

const Knob = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #ffffff;
  position: absolute;
  top: 2px;
  left: ${({ $on }) => ($on ? "20px" : "2px")};
  transition: left 140ms ease;
`;

const FooterHint = styled.div`
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  line-height: 1.55;
`;

const SaveState = styled.div`
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

function clonePrefs(p) {
  return {
    enabled: !!p?.enabled,
    categories: { ...(p?.categories || {}) },
  };
}

export default function NotificationSettingsPage() {
  const { firebaseUser, userDoc } = useAuth();
  const uid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [prefs, setPrefs] = useState(getDefaultNotificationPrefs());

  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);

  const items = useMemo(() => {
    return [
      { key: "notice", title: "공지사항", sub: "공지/점검/안내 알림" },
      { key: "chat", title: "채팅", sub: "DM/팀 채팅 메시지 알림" },
      { key: "teamInvite", title: "팀 초대", sub: "팀 초대 수신 알림" },
      { key: "teamDecision", title: "팀 수락", sub: "참여요청 승인/거절 알림" },
      { key: "match", title: "매칭 알람", sub: "매칭 신청/수락/거절/확정 알림" },
      { key: "player", title: "선수등록", sub: "선수 관련 알림" },
      { key: "team", title: "팀등록", sub: "팀 관련 알림" },
    ];
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!uid) {
        setPrefs(getDefaultNotificationPrefs());
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const p = await getMyNotificationPrefs(uid);
        if (!alive) return;
        setPrefs(p);
        lastSavedRef.current = JSON.stringify(p);
      } catch (e) {
        if (!alive) return;
        setPrefs(getDefaultNotificationPrefs());
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [uid]);

  const scheduleSave = (nextPrefs) => {
    if (!uid) return;

    const payload = clonePrefs(nextPrefs);
    const serialized = JSON.stringify(payload);

    setSaveMsg("저장 중…");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = setTimeout(async () => {
      const prev = lastSavedRef.current;
      if (prev && prev === serialized) {
        setSaveMsg("저장됨");
        return;
      }

      setSaving(true);
      try {
        const saved = await saveMyNotificationPrefs(uid, payload);
        lastSavedRef.current = JSON.stringify(saved);
        setSaveMsg("저장됨");
      } catch (e) {
        setSaveMsg("저장 실패 (잠시 후 다시 시도)");
      } finally {
        setSaving(false);
      }
    }, 450);
  };

  const toggleMaster = () => {
    const next = { ...prefs, enabled: !prefs.enabled };
    setPrefs(next);
    scheduleSave(next);
  };

  const toggleCategory = (key) => {
    if (!prefs.enabled) return;

    const next = {
      ...prefs,
      categories: {
        ...prefs.categories,
        [key]: !prefs.categories?.[key],
      },
    };
    setPrefs(next);
    scheduleSave(next);
  };

  if (loading) {
    return (
      <PageWrap>
        <Spinner />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <Card>
        <Title>알림 설정</Title>
        <Desc>받고 싶은 알림만 선택할 수 있어요.</Desc>

        <Divider />

        <Row>
          <RowLeft>
            <RowTitle>푸시 알림 받기</RowTitle>
            <RowSub>전체 알림을 켜거나 끌 수 있어요</RowSub>
          </RowLeft>
          <Switch type="button" onClick={toggleMaster} $on={prefs.enabled} disabled={saving}>
            <Knob $on={prefs.enabled} />
          </Switch>
        </Row>

        <Divider />

        {items.map((it) => {
          const on = !!prefs.categories?.[it.key];
          const disabled = !prefs.enabled || saving;

          return (
            <Row key={it.key}>
              <RowLeft>
                <RowTitle>{it.title}</RowTitle>
                <RowSub>{it.sub}</RowSub>
              </RowLeft>
              <Switch
                type="button"
                onClick={() => toggleCategory(it.key)}
                $on={prefs.enabled ? on : false}
                disabled={disabled}
                aria-disabled={disabled}
              >
                <Knob $on={prefs.enabled ? on : false} />
              </Switch>
            </Row>
          );
        })}

        <SaveState>{saveMsg}</SaveState>

        <FooterHint>
          전체 알림을 끄면 카테고리별 설정은 유지되지만 알림이 전송되지 않습니다.
        </FooterHint>
      </Card>
    </PageWrap>
  );
}
