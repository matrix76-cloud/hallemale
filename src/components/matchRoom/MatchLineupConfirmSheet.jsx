/* eslint-disable */
// src/components/matchRoom/MatchLineupConfirmSheet.jsx
// 매칭룸(조율) 라인업 확정 시트
// - 내 팀 로스터에서 주전 N명(=매치 사이즈) 선택 + 후보(벤치) 선택
// - 탭으로 역할 순환: 미선택 → 주전 → 후보 → 미선택
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  loadClubRosterForLineup,
  confirmMatchLineup,
} from "../../services/matchRoomService";
import AvatarPlaceholder from "../common/AvatarPlaceholder";
import PositionChip from "../common/PositionChip";

const toStr = (v) => String(v || "").trim();
const POS_KO = { guard: "가드", forward: "포워드", center: "센터" };
const sizeFromKey = (k) => {
  const m = toStr(k).match(/^(\d+)\s*v/i);
  return m ? Number(m[1]) : 0;
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;
const Sheet = styled.div`
  width: 100%;
  max-width: 480px;
  max-height: 86vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px 18px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;
const Head = styled.div`
  padding: 16px 16px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;
const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;
const Title = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const CloseBtn = styled.button`
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const CountRow = styled.div`
  margin-top: 6px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  b {
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 800;
  }
`;
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 12px;
`;
const Row = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;
const Avatar = styled.img`
  width: 38px;
  height: 38px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;
const Texts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const Name = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const Meta = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const RoleChip = styled.span`
  flex-shrink: 0;
  min-width: 56px;
  text-align: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  ${({ $role, theme }) => {
    if ($role === "starter")
      return `background:${theme.colors.primary};color:#fff;border:1px solid transparent;`;
    if ($role === "sub")
      return `background:transparent;color:${theme.colors.primary};border:1px solid ${theme.colors.primary};`;
    return `background:transparent;color:${theme.colors.textWeak};border:1px dashed ${theme.colors.border};`;
  }}
`;
const Foot = styled.div`
  padding: 10px 14px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  display: flex;
  gap: 8px;
`;
const Btn = styled.button`
  flex: 1;
  border-radius: 12px;
  padding: 13px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.primary : "transparent"};
  color: ${({ $primary, theme }) =>
    $primary ? "#fff" : theme.colors.textStrong};
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
const State = styled.div`
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export default function MatchLineupConfirmSheet({
  open,
  onClose,
  matchRequestId,
  clubId,
  matchSizeKey,
  initialStarterIds = [],
  initialSubIds = [],
  onConfirmed,
}) {
  const size = sizeFromKey(matchSizeKey);

  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // role map: { [uid]: "starter" | "sub" }
  const [roles, setRoles] = useState({});

  useEffect(() => {
    if (!open || !clubId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await loadClubRosterForLineup(clubId);
        if (!alive) return;
        setRoster(Array.isArray(list) ? list : []);
        // 기존 확정값으로 초기화
        const init = {};
        (initialStarterIds || []).forEach((id) => {
          if (toStr(id)) init[toStr(id)] = "starter";
        });
        (initialSubIds || []).forEach((id) => {
          if (toStr(id) && !init[toStr(id)]) init[toStr(id)] = "sub";
        });
        setRoles(init);
      } catch (e) {
        if (alive) setRoster([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clubId]);

  const starterIds = useMemo(
    () => Object.keys(roles).filter((id) => roles[id] === "starter"),
    [roles]
  );
  const subIds = useMemo(
    () => Object.keys(roles).filter((id) => roles[id] === "sub"),
    [roles]
  );

  const cycle = (uid) => {
    setRoles((prev) => {
      const cur = prev[uid] || null;
      const next = { ...prev };
      if (cur === null || cur === undefined) {
        // 미선택 → 주전(여석 있으면) / 아니면 후보
        const starters = Object.keys(prev).filter((id) => prev[id] === "starter");
        if (!size || starters.length < size) next[uid] = "starter";
        else next[uid] = "sub";
      } else if (cur === "starter") {
        next[uid] = "sub";
      } else {
        delete next[uid];
      }
      return next;
    });
  };

  const canConfirm = !busy && size > 0 && starterIds.length === size;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await confirmMatchLineup({
        matchRequestId,
        clubId,
        starterIds,
        subIds,
        roster,
      });
      onConfirmed && (await onConfirmed());
      onClose && onClose();
    } catch (e) {
      showAlert(e?.message || "라인업 확정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Overlay onClick={() => (!busy ? onClose && onClose() : null)}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <Head>
          <TitleRow>
            <Title>라인업 확정 {matchSizeKey ? `· ${matchSizeKey}` : ""}</Title>
            <CloseBtn type="button" onClick={() => (!busy ? onClose && onClose() : null)}>
              ×
            </CloseBtn>
          </TitleRow>
          <CountRow>
            주전 <b>{starterIds.length}</b>/{size || "-"} · 후보 <b>{subIds.length}</b>
            {" · "}탭으로 주전 → 후보 → 해제
          </CountRow>
        </Head>

        <Body>
          {loading ? (
            <State>로스터를 불러오는 중...</State>
          ) : roster.length === 0 ? (
            <State>팀원이 없습니다.</State>
          ) : (
            roster.map((p) => {
              const role = roles[p.userId] || null;
              const posKo = POS_KO[p.mainPosition] || "";
              const hw = [
                p.heightCm ? `${p.heightCm}cm` : "",
                p.weightKg ? `${p.weightKg}kg` : "",
              ]
                .filter(Boolean)
                .join(" / ");
              return (
                <Row key={p.userId} type="button" onClick={() => cycle(p.userId)}>
                  {p.photoUrl ? (
                    <Avatar src={p.photoUrl} alt={p.nickname} />
                  ) : (
                    <AvatarPlaceholder size={38} />
                  )}
                  <Texts>
                    <NameRow>
                      {posKo ? <PositionChip label={posKo} size="sm" tone="text" /> : null}
                      <Name>{p.nickname}</Name>
                    </NameRow>
                    {hw ? <Meta>{hw}</Meta> : null}
                  </Texts>
                  <RoleChip $role={role}>
                    {role === "starter" ? "주전" : role === "sub" ? "후보" : "선택"}
                  </RoleChip>
                </Row>
              );
            })
          )}
        </Body>

        <Foot>
          <Btn type="button" onClick={() => (!busy ? onClose && onClose() : null)}>
            취소
          </Btn>
          <Btn type="button" $primary disabled={!canConfirm} onClick={handleConfirm}>
            {busy ? "확정 중..." : `라인업 확정 (주전 ${starterIds.length}/${size || "-"})`}
          </Btn>
        </Foot>
      </Sheet>
    </Overlay>
  );
}
