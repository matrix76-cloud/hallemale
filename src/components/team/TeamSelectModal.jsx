/* eslint-disable */
// src/components/team/TeamSelectModal.jsx
// ✅ Firestore clubs 실데이터 기반 "지원할 팀 선택" 모달
// - 검색(팀명/지역/태그) : v1은 로드된 목록에서 includes 필터
// - 지역 필터 : regionSido 기반 (없으면 region 문자열로 fallback)
// - stats 없으면 0경기 · 승률 0% 표시
// - 신청 보내기: clubs/{clubId}/joinRequests에 pending 생성

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { FiX, FiSearch } from "react-icons/fi";
import { images } from "../../utils/imageAssets";
import { useAuth } from "../../hooks/useAuth";
import EmptyState from "../common/EmptyState";
import { listClubsForPicker, createJoinRequestToClub } from "../../services/teamService";

export default function TeamSelectModal({
  open,
  onClose,
  title = "지원할 팀 선택",
  subtitle = "내 프로필을 보내고 싶은 팀을 한 곳 선택하고,\n요청팀에게 남길 말도 함께 적어 주세요.",
  submitText = "팀에 신청 보내기",
  cancelText = "취소",
  initialRegionSido = "전체 지역",
  initialQuery = "",
  initialMessage = "",
  onSubmitted,
}) {
  const { userDoc } = useAuth();
  const myUid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [error, setError] = useState("");

  const [q, setQ] = useState(initialQuery);
  const [regionSido, setRegionSido] = useState(initialRegionSido);

  const [selectedClubId, setSelectedClubId] = useState("");
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (!open) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await listClubsForPicker({ limitCount: 60 });
        if (!alive) return;
        setClubs(rows || []);
      } catch (e) {
        if (!alive) return;
        setError("팀 목록을 불러오지 못했습니다.");
        setClubs([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ(initialQuery || "");
    setRegionSido(initialRegionSido || "전체 지역");
    setSelectedClubId("");
    setMessage(initialMessage || "");
    setError("");
  }, [open, initialQuery, initialRegionSido, initialMessage]);

  const regionOptions = useMemo(() => {
    const set = new Set();
    for (const c of clubs) {
      const v = String(c?.regionSido || "").trim();
      if (v) set.add(v);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["전체 지역", ...arr];
  }, [clubs]);

  const filtered = useMemo(() => {
    const qq = String(q || "").trim().toLowerCase();

    return (clubs || [])
      .filter((c) => {
        if (!c) return false;

        const sido = String(c.regionSido || "").trim();
        const regionText = String(c.regionLabel || "").trim();

        if (regionSido && regionSido !== "전체 지역") {
          if (sido) {
            if (sido !== regionSido) return false;
          } else {
            if (!regionText.includes(regionSido)) return false;
          }
        }

        if (!qq) return true;

        const name = String(c.name || "").toLowerCase();
        const regionLower = String(regionText || "").toLowerCase();
        const tags = Array.isArray(c.tags) ? c.tags.join(" ").toLowerCase() : "";

        return (
          name.includes(qq) ||
          regionLower.includes(qq) ||
          tags.includes(qq)
        );
      })
      .slice(0, 80);
  }, [clubs, q, regionSido]);

  const handleSubmit = async () => {
    if (!myUid) {
      window.alert("로그인이 필요합니다.");
      return;
    }
    if (!selectedClubId) {
      window.alert("지원할 팀을 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await createJoinRequestToClub({
        clubId: selectedClubId,
        playerUid: myUid,
        message: String(message || "").trim(),
        playerSnapshot: {
          uid: myUid,
          nickname: userDoc?.nickname || "",
          avatarUrl: userDoc?.avatarUrl || "",
          mainPosition: userDoc?.mainPosition || null,
          skillLevel: userDoc?.skillLevel || null,
          region: userDoc?.region || "",
          regionSido: userDoc?.regionSido || null,
          regionGu: userDoc?.regionGu || null,
          heightCm: userDoc?.heightCm ?? null,
          weightKg: userDoc?.weightKg ?? null,
        },
      });

      if (typeof onSubmitted === "function") {
        onSubmitted(res);
      }

      onClose?.();
    } catch (e) {
      setError("신청 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dim onMouseDown={onClose}>
      <Sheet onMouseDown={(e) => e.stopPropagation()}>
        <HeaderRow>
          <HeaderTitle>{title}</HeaderTitle>
          <CloseBtn type="button" onClick={onClose} aria-label="닫기">
            <FiX size={22} />
          </CloseBtn>
        </HeaderRow>

        <HeaderSub>{subtitle}</HeaderSub>

        <SearchWrap>
          <FiSearch size={16} />
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="팀 이름, 지역, 태그로 검색"
          />
        </SearchWrap>

        <SelectRow>
          <Select
            value={regionSido}
            onChange={(e) => setRegionSido(e.target.value)}
          >
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </SelectRow>

        <ListWrap>
          {loading ? (
            <EmptyText>불러오는 중…</EmptyText>
          ) : error ? (
            <EmptyText>{error}</EmptyText>
          ) : filtered.length === 0 ? (
            <EmptyState compact text="표시할 팀이 없습니다." />
          ) : (
            filtered.map((c) => {
              const checked = selectedClubId === c.clubId;
              return (
                <TeamRow
                  key={c.clubId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedClubId(c.clubId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedClubId(c.clubId);
                    }
                  }}
                >
                  <TeamLeft>
                    <LogoWrap>
                      <LogoImg
                        src={c.logoUrl || images.logo}
                        alt={c.name || "team"}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = images.logo;
                        }}
                      />
                    </LogoWrap>

                    <TeamText>
                      <TeamName>{c.name || "팀 이름 없음"}</TeamName>
                      <TeamMeta>
                        {`${c.totalMatches ?? 0}경기 · 승률 ${c.winRatePercent ?? 0}%`}
                      </TeamMeta>
                    </TeamText>
                  </TeamLeft>

                  <TeamRight>
                    <RegionText>{c.regionLabel || "지역 미지정"}</RegionText>
                    <RadioOuter aria-hidden="true">
                      {checked ? <RadioInner /> : null}
                    </RadioOuter>
                  </TeamRight>
                </TeamRow>
              );
            })
          )}
        </ListWrap>

        <MessageTitle>요청팀에게 남길 말 (선택)</MessageTitle>
        <MessageBox
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="예) 주말 저녁 경기 위주로 참여 가능합니다."
          rows={4}
        />

        <BottomRow>
          <GhostBtn type="button" onClick={onClose} disabled={loading}>
            {cancelText}
          </GhostBtn>
          <PrimaryBtn type="button" onClick={handleSubmit} disabled={loading}>
            {submitText}
          </PrimaryBtn>
        </BottomRow>
      </Sheet>
    </Dim>
  );
}

/* ================== styles ================== */

const Dim = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 16px;
`;

const Sheet = styled.div`
  width: min(520px, 94vw);
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 18px 18px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const HeaderTitle = styled.div`
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CloseBtn = styled.button`
  border: none;
  background: transparent;
  padding: 6px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const HeaderSub = styled.div`
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: pre-line;
`;

const SearchWrap = styled.div`
  margin-top: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : theme.colors.card};
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  width: 100%;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  background: transparent;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const SelectRow = styled.div`
  margin-top: 10px;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 10px 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : theme.colors.card};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  outline: none;
`;

const ListWrap = styled.div`
  margin-top: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
  max-height: min(340px, 50vh);
  overflow-y: auto;
`;

const EmptyText = styled.div`
  padding: 18px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  background: ${({ theme }) => theme.colors.card};
`;

const TeamRow = styled.div`
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.card};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:hover {
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f8fafc"};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const TeamLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const LogoWrap = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  flex: 0 0 auto;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const TeamName = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TeamRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
`;

const RegionText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

const RadioOuter = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  display: grid;
  place-items: center;
`;

const RadioInner = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
`;

const MessageTitle = styled.div`
  margin-top: 14px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MessageBox = styled.textarea`
  margin-top: 8px;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  outline: none;
  resize: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : theme.colors.card};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const BottomRow = styled.div`
  margin-top: 14px;
  display: flex;
  gap: 10px;
`;

const GhostBtn = styled.button`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 999px;
  padding: 12px 14px;
  cursor: pointer;
`;

const PrimaryBtn = styled.button`
  flex: 1.2;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  border-radius: 999px;
  padding: 12px 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;
