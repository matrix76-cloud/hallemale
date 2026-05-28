/* eslint-disable */
// src/pages/matching/MatchingHomePage.jsx
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { TEAMS } from "../../mock/teamsMock";
import { images, playerAvatars } from "../../utils/imageAssets";

// 경기 인원 옵션
const MATCH_SIZES = [
  { key: "3v3", label: "3 vs 3", size: 3 },
  { key: "4v4", label: "4 vs 4", size: 4 },
  { key: "5v5", label: "5 vs 5", size: 5 },
];

// 임시 지역 목록 (나중에 API/DB로 교체)
const CITY_OPTIONS = ["서울시", "경기도"];
const AREA_OPTIONS = {
  서울시: ["성북구", "강동구", "마포구", "영등포구"],
  경기도: ["남양주", "용인시", "수원시"],
};

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 16px 0 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Inner = styled.div`
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/* ==================== 팀 카드 ==================== */

const TeamCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px 14px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TeamHeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TeamLogo = styled.img`
  width: 52px;
  height: 52px;
  border-radius: 999px;
  object-fit: cover;
`;

const TeamTitle = styled.div`
  font-size: 16px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Line = styled.div`
  margin: 4px 0;
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
`;

const LineupHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AddMemberButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
`;

const LineupList = styled.div`
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LineupRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CaptainBadge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
`;

const PositionBadge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const PlayerAvatar = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  object-fit: cover;
`;

const PlayerName = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* ==================== 활동 지역 / 인원 선택 ==================== */

const SectionBox = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PinIcon = styled.span`
  font-size: 16px;
`;

const SectionTitleText = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RegionRow = styled.div`
  display: flex;
  gap: 8px;
`;

const RegionChip = styled.button`
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
`;

const RegionPlaceholder = styled.span`
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Chevron = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

// 경기 인원
const MatchSizeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MatchSizeOptions = styled.div`
  display: flex;
  gap: 12px;
`;

const MatchSizeChip = styled.button`
  flex: 1;
  padding: 8px 0;
  border-radius: 999px;
  border: 1px solid
    ${({ active, theme }) =>
      active ? theme.colors.primary : theme.colors.border};
  background: ${({ active, theme }) =>
    active
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "rgba(52, 110, 246, 0.08)"
      : theme.colors.card};
  color: ${({ active, theme }) =>
    active ? theme.colors.primary : theme.colors.textStrong};
  font-size: 13px;
  cursor: pointer;
`;

/* ==================== 매칭 버튼 ==================== */

const BottomButtonWrap = styled.div`
  padding: 12px 16px 0;
`;

const MatchButton = styled.button`
  width: 100%;
  padding: 14px 0;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
`;

/* ==================== 오버레이/팝업 공용 ==================== */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.35)"};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
`;

const ModalCard = styled.div`
  width: 90%;
  max-width: 380px;
  max-height: 80vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px 16px 20px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ModalClose = styled.button`
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
`;

// 모달 하단 버튼 영역
const ModalActions = styled.div`
  margin-top: 8px;
  display: flex;
  gap: 8px;
`;

const ModalActionButton = styled.button`
  flex: 1;
  padding: 10px 0;
  border-radius: 999px;
  border: ${({ primary, theme }) =>
    primary ? "none" : `1px solid ${theme.colors.border}`};
  background: ${({ primary, theme }) =>
    primary ? theme.colors.primary : theme.colors.card};
  color: ${({ primary, theme }) =>
    primary ? "#ffffff" : theme.colors.textStrong};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
`;

/* ==================== 팀원 선택 리스트 ==================== */

const MemberItem = styled.button`
  width: 100%;
  border: none;
  background: ${({ selected, theme }) =>
    selected
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "#eef2ff"
      : theme.colors.card};
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const MemberMeta = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
`;

const MemberName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MemberSub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MemberSelectMark = styled.span`
  font-size: 16px;
  color: ${({ selected, theme }) =>
    selected ? theme.colors.primary : theme.colors.textWeak};
`;

/* ==================== 상대팀 선택 ==================== */

const OpponentItem = styled.button`
  width: 100%;
  border: none;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 10px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const OpponentMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const OpponentName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const OpponentSub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CityLabel = styled.div`
  font-size: 12px;
  margin-bottom: 4px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ==================== 메인 컴포넌트 ==================== */

export default function MatchingHomePage() {
  // 임시로 내 팀을 TEAMS[0] 로 고정
  const myTeam = TEAMS[0];
  const myMembers = myTeam.players || [];

  // 팀장: 첫 번째 멤버
  const captain = myMembers[0];

  const [selectedMemberIds, setSelectedMemberIds] = useState(
    captain ? [captain.userId] : []
  );

  const [selectedCity, setSelectedCity] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [matchSize, setMatchSize] = useState(MATCH_SIZES[0]); // 기본 3v3

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showOpponentModal, setShowOpponentModal] = useState(false);

  const opponentTeams = useMemo(
    () => TEAMS.filter((t) => t.clubId !== myTeam.clubId),
    [myTeam]
  );

  const selectedMembers = useMemo(
    () =>
      myMembers.filter((m) =>
        selectedMemberIds.includes(m.userId)
      ),
    [myMembers, selectedMemberIds]
  );

  const canMatch =
    selectedMembers.length === matchSize.size &&
    selectedCity &&
    selectedArea;

  const regionLabel =
    selectedCity && selectedArea
      ? `${selectedCity} ${selectedArea}`
      : "활동지역을 선택해주세요";

  const handleToggleMember = (userId) => {
    // 팀장은 항상 포함
    if (userId === captain?.userId) return;

    setSelectedMemberIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleOpenMatch = () => {
    if (!canMatch) return;
    setShowOpponentModal(true);
  };

  const handleRequestMatch = (opponentClubId) => {
    const payload = {
      myClubId: myTeam.clubId,
      opponentClubId,
      members: selectedMemberIds,
      region: { city: selectedCity, area: selectedArea },
      matchSize: matchSize.size,
    };

    console.log("📡 매칭 요청 payload:", payload);
    setShowOpponentModal(false);

    // TODO: 여기서 매칭 요청 API 호출 후 matchId 받아오면
    // navigate(`/match-room/${matchId}`) 로 이동
  };

  return (
    <Wrap>
      <Inner>
        {/* 팀 카드 / 라인업 */}
        <TeamCard>
          <TeamHeaderRow>
            <TeamLogo src={images[myTeam.logoKey]} alt={myTeam.name} />
            <div>
              <TeamTitle>{myTeam.name}</TeamTitle>
              <TeamSub>{myTeam.description}</TeamSub>
            </div>
          </TeamHeaderRow>

          <Line />

          <LineupHeaderRow>
            <span>라인업 구성</span>
            <span>총 {selectedMembers.length}명</span>
          </LineupHeaderRow>

          <LineupList>
            {selectedMembers.map((m, idx) => {
              const avatar =
                playerAvatars[m.userId] || images.profileDefault || images.logo;
              const isCaptain = m.userId === captain?.userId;
              return (
                <LineupRow key={m.userId}>
                  <PlayerAvatar src={avatar} alt={m.nickname} />
                  <div style={{ flex: 1 }}>
                    <PlayerName>{m.nickname}</PlayerName>
                  </div>
                  {isCaptain ? (
                    <CaptainBadge>팀장</CaptainBadge>
                  ) : (
                    <PositionBadge>{m.position || "선수"}</PositionBadge>
                  )}
                </LineupRow>
              );
            })}
          </LineupList>

          <LineupHeaderRow>
            <span />
            <AddMemberButton onClick={() => setShowMemberModal(true)}>
              + 팀원 추가
            </AddMemberButton>
          </LineupHeaderRow>
        </TeamCard>

        {/* 활동지역 / 경기 인원 선택 */}
        <SectionBox>
          <SectionTitleRow>
            <PinIcon>📍</PinIcon>
            <SectionTitleText>활동지역 선택</SectionTitleText>
          </SectionTitleRow>

          <RegionRow>
            <RegionChip onClick={() => setShowRegionModal(true)}>
              {selectedCity && selectedArea ? (
                <span>{regionLabel}</span>
              ) : (
                <RegionPlaceholder>{regionLabel}</RegionPlaceholder>
              )}
              <Chevron>▾</Chevron>
            </RegionChip>
          </RegionRow>

          <MatchSizeRow>
            <SectionTitleText>경기 인원 선택</SectionTitleText>
            <MatchSizeOptions>
              {MATCH_SIZES.map((opt) => (
                <MatchSizeChip
                  key={opt.key}
                  type="button"
                  active={matchSize.key === opt.key}
                  onClick={() => setMatchSize(opt)}
                >
                  {opt.label}
                </MatchSizeChip>
              ))}
            </MatchSizeOptions>
          </MatchSizeRow>
        </SectionBox>
      </Inner>

      {/* 매칭 버튼 */}
      {canMatch && (
        <BottomButtonWrap>
          <MatchButton type="button" onClick={handleOpenMatch}>
            매칭
          </MatchButton>
        </BottomButtonWrap>
      )}

      {/* 팀원 선택 모달 */}
      {showMemberModal && (
        <Overlay onClick={() => setShowMemberModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>팀원 선택</ModalTitle>
              <ModalClose onClick={() => setShowMemberModal(false)}>
                ×
              </ModalClose>
            </ModalHeader>

            <ModalBody>
              {myMembers.map((m) => {
                const avatar =
                  playerAvatars[m.userId] ||
                  images.profileDefault ||
                  images.logo;
                const selected = selectedMemberIds.includes(m.userId);
                const isCaptain = m.userId === captain?.userId;
                return (
                  <MemberItem
                    key={m.userId}
                    type="button"
                    selected={selected}
                    onClick={() => handleToggleMember(m.userId)}
                  >
                    <PlayerAvatar src={avatar} alt={m.nickname} />
                    <MemberMeta>
                      <MemberName>{m.nickname}</MemberName>
                      <MemberSub>
                        {isCaptain ? "팀장" : m.position || "선수"}
                      </MemberSub>
                    </MemberMeta>
                    <MemberSelectMark selected={selected}>
                      {selected ? "✔" : "○"}
                    </MemberSelectMark>
                  </MemberItem>
                );
              })}
            </ModalBody>

            <ModalActions>
              <ModalActionButton
                type="button"
                onClick={() => setShowMemberModal(false)}
              >
                닫기
              </ModalActionButton>
              <ModalActionButton
                type="button"
                primary
                onClick={() => setShowMemberModal(false)}
              >
                확인
              </ModalActionButton>
            </ModalActions>
          </ModalCard>
        </Overlay>
      )}

      {/* 활동지역 선택 모달 */}
      {showRegionModal && (
        <Overlay onClick={() => setShowRegionModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>활동지역 선택</ModalTitle>
              <ModalClose onClick={() => setShowRegionModal(false)}>
                ×
              </ModalClose>
            </ModalHeader>

            <ModalBody>
              {CITY_OPTIONS.map((city) => (
                <div key={city} style={{ marginBottom: 8 }}>
                  <CityLabel>{city}</CityLabel>
                  {(AREA_OPTIONS[city] || []).map((area) => {
                    const selected =
                      selectedCity === city && selectedArea === area;
                    return (
                      <MemberItem
                        key={`${city}-${area}`}
                        type="button"
                        selected={selected}
                        onClick={() => {
                          setSelectedCity(city);
                          setSelectedArea(area);
                        }}
                      >
                        <MemberMeta>
                          <MemberName>
                            {city} {area}
                          </MemberName>
                        </MemberMeta>
                        <MemberSelectMark selected={selected}>
                          {selected ? "✔" : "○"}
                        </MemberSelectMark>
                      </MemberItem>
                    );
                  })}
                </div>
              ))}
            </ModalBody>

            <ModalActions>
              <ModalActionButton
                type="button"
                onClick={() => setShowRegionModal(false)}
              >
                닫기
              </ModalActionButton>
              <ModalActionButton
                type="button"
                primary
                onClick={() => setShowRegionModal(false)}
              >
                선택 완료
              </ModalActionButton>
            </ModalActions>
          </ModalCard>
        </Overlay>
      )}

      {/* 상대팀 선택 모달 */}
      {showOpponentModal && (
        <Overlay onClick={() => setShowOpponentModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>상대팀 선택</ModalTitle>
              <ModalClose onClick={() => setShowOpponentModal(false)}>
                ×
              </ModalClose>
            </ModalHeader>

            <ModalBody>
              {opponentTeams.map((team, idx) => (
                <OpponentItem
                  key={team.clubId}
                  type="button"
                  onClick={() => handleRequestMatch(team.clubId)}
                >
                  <TeamLogoWrap>
                    <TeamLogoImg
                      src={images[team.logoKey]}
                      alt={team.name}
                    />
                  </TeamLogoWrap>
                  <OpponentMeta>
                    <OpponentName>{team.name}</OpponentName>
                    <OpponentSub>
                      최근 전적 {team.stats.wins}:{team.stats.losses} 승
                    </OpponentSub>
                  </OpponentMeta>
                </OpponentItem>
              ))}
            </ModalBody>

            <ModalActions>
              <ModalActionButton
                type="button"
                onClick={() => setShowOpponentModal(false)}
              >
                닫기
              </ModalActionButton>
            </ModalActions>
          </ModalCard>
        </Overlay>
      )}
    </Wrap>
  );
}
