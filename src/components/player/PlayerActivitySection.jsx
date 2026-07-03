/* eslint-disable */
// src/components/player/PlayerActivitySection.jsx
// 워치 기반 활동량 섹션 — 본인 프로필에서만 기록 UI 노출, 타 선수는 조회만

import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import { FiHeart, FiZap, FiWatch, FiActivity } from "react-icons/fi";
import {
  checkHealthAvailable,
  requestHealthPermission,
  startHealthTracking,
  stopHealthTracking,
  savePlayerSession,
  listPlayerSessions,
  formatDuration,
} from "../../services/playerHealthService";
import { isInWebView, onceFromApp } from "../../bridge/webviewBridge";
import EmptyState from "../common/EmptyState";

const Section = styled.section`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 16px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RecordBtn = styled.button`
  border: 0;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: ${({ $recording, theme }) =>
    $recording
      ? theme.mode === "dark"
        ? "#f87171"
        : "#ef4444"
      : theme.mode === "dark"
      ? "#14b8a6"
      : "#0f766e"};
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const InfoBox = styled.div`
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
  margin-bottom: 10px;
`;

const LiveCard = styled.div`
  background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
  color: #ecfeff;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
`;

const LiveCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`;

const LiveValue = styled.div`
  font-size: 22px;
  font-weight: 700;
`;

const LiveLabel = styled.div`
  font-size: 11px;
  opacity: 0.85;
`;

const SessionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SessionCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 12px;
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
  gap: 6px;
  align-items: center;
`;

const SessionDate = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  font-weight: 600;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`;

const StatValue = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const StatLabel = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Empty = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  padding: 18px 0;
  text-align: center;
`;

function formatDate(ts) {
  if (!ts) return "";
  if (ts?.seconds) ts = new Date(ts.seconds * 1000).toISOString();
  try {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default function PlayerActivitySection({ playerId, isSelf }) {
  const theme = useTheme();
  const [available, setAvailable] = useState(null); // null=미확인, true/false
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null); // {heartRate, calories}
  const [sessions, setSessions] = useState([]);
  const liveUnsubRef = useRef(null);

  const inApp = useMemo(() => isInWebView(), []);

  const loadSessions = useCallback(async () => {
    if (!playerId) return;
    try {
      const list = await listPlayerSessions(playerId, 10);
      setSessions(list);
    } catch (e) {
      console.warn("[PlayerActivity] list error", e?.message);
    }
  }, [playerId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 실시간 업데이트 수신 (녹화 중)
  useEffect(() => {
    if (!recording) return;
    const loop = () => {
      liveUnsubRef.current = onceFromApp("HEALTH_REALTIME_UPDATE", (p) => {
        setLive({
          heartRate: p?.heartRate,
          avgHeartRate: p?.avgHeartRate,
          maxHeartRate: p?.maxHeartRate,
          calories: p?.calories,
        });
        if (recording) loop();
      });
    };
    loop();
    return () => {
      liveUnsubRef.current?.();
    };
  }, [recording]);

  const onCheck = async () => {
    setBusy(true);
    try {
      const r = await checkHealthAvailable();
      if (!r?.available) {
        setAvailable(false);
        showAlert(
          r?.status === "update_required"
            ? "Health Connect 업데이트가 필요합니다."
            : "워치/헬스 데이터를 사용할 수 없습니다."
        );
        return;
      }
      const perm = await requestHealthPermission();
      if (!perm?.success) {
        showAlert("권한이 거부되었습니다.");
        return;
      }
      setAvailable(true);
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (available !== true) {
      await onCheck();
      return;
    }
    startHealthTracking();
    setRecording(true);
    setLive(null);
  };

  const onStop = async () => {
    setBusy(true);
    try {
      const summary = await stopHealthTracking();
      setRecording(false);
      setLive(null);
      if (summary && !summary.error && (summary.avgHeartRate || summary.totalCalories)) {
        try {
          await savePlayerSession({ playerId, summary });
          await loadSessions();
        } catch (e) {
          console.warn("[PlayerActivity] save error", e?.message);
          showAlert("기록 저장에 실패했습니다.");
        }
      } else {
        showAlert("수집된 활동 데이터가 없습니다. 경기 중 워치가 연결돼 있어야 합니다.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section>
      <HeaderRow>
        <Title>
          <FiWatch size={16} color="#0f766e" />
          워치 활동 기록
        </Title>
        {isSelf ? (
          recording ? (
            <RecordBtn $recording onClick={onStop} disabled={busy}>
              <FiActivity size={14} /> 종료
            </RecordBtn>
          ) : (
            <RecordBtn onClick={onStart} disabled={busy || !inApp}>
              <FiActivity size={14} /> 경기 시작
            </RecordBtn>
          )
        ) : null}
      </HeaderRow>

      {isSelf && !inApp ? (
        <InfoBox>앱에서 워치를 연결하면 경기 중 심박/칼로리가 자동 기록됩니다.</InfoBox>
      ) : null}

      {recording && (
        <LiveCard>
          <LiveCell>
            <FiHeart size={16} />
            <LiveValue>{live?.heartRate ?? "--"}</LiveValue>
            <LiveLabel>심박 (BPM)</LiveLabel>
          </LiveCell>
          <LiveCell>
            <FiActivity size={16} />
            <LiveValue>{live?.maxHeartRate ?? "--"}</LiveValue>
            <LiveLabel>최고 심박</LiveLabel>
          </LiveCell>
          <LiveCell>
            <FiZap size={16} />
            <LiveValue>{live?.calories ?? 0}</LiveValue>
            <LiveLabel>소모 칼로리</LiveLabel>
          </LiveCell>
        </LiveCard>
      )}

      {sessions.length === 0 ? (
        <EmptyState compact text="기록된 활동이 없습니다." />
      ) : (
        <SessionList>
          {sessions.map((s) => (
            <SessionCard key={s.id}>
              <SessionDate>
                {formatDate(s.startedAt || s.createdAt)}
                <div style={{ fontSize: 10, color: theme.colors.textWeak, marginTop: 2 }}>
                  {formatDuration(s.startedAt, s.endedAt) || "—"}
                </div>
              </SessionDate>
              <Stat>
                <StatValue>{s.avgHeartRate ?? "--"}</StatValue>
                <StatLabel>평균 HR</StatLabel>
              </Stat>
              <Stat>
                <StatValue>{s.maxHeartRate ?? "--"}</StatValue>
                <StatLabel>최고 HR</StatLabel>
              </Stat>
              <Stat>
                <StatValue>{s.totalCalories ?? 0}</StatValue>
                <StatLabel>kcal</StatLabel>
              </Stat>
            </SessionCard>
          ))}
        </SessionList>
      )}
    </Section>
  );
}
