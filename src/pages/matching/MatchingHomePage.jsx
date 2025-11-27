// src/pages/matching/MatchingHomePage.jsx
/* eslint-disable */
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { TEAMS } from "../../mock/teamsMock";
import { images, playerAvatars } from "../../utils/imageAssets";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/* ==================== 상수/헬퍼 ==================== */

const MATCH_SIZES = [
  { key: "3v3", label: "3 vs 3", size: 3 },
  { key: "4v4", label: "4 vs 4", size: 4 },
  { key: "5v5", label: "5 vs 5", size: 5 },
];

const CITY_OPTIONS = ["서울시", "경기도"];
const AREA_OPTIONS = {
  서울시: ["성북구", "강동구", "마포구", "영등포구"],
  경기도: ["남양주", "용인시", "수원시"],
};

const POSITION_LABEL = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로",
};

/* ==================== 레이아웃 ==================== */

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

/* ==================== 팀 섹션 / 라인업 ==================== */

const TeamSection = styled.div`
  padding: 4px 0 18px;
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

const TeamHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TeamTitle = styled.div`
  font-size: 16px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const Line = styled.div`
  margin: 12px 0 8px;
  height: 1px;
  background: ${({ theme }) => theme.colors.border || "#e5e7eb"};
`;

const LineupHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 150px;
  padding-bottom: 4px;
`;

const LineupRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PlayerAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
`;

const PlayerName = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const BadgesWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CaptainBadge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
`;

const PositionBadge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #111827;
`;

/* 빈 슬롯(+) */

const EmptySlotRow = styled.button`
  width: 100%;
  border-radius: 10px;
  border: 1px dashed ${({ theme }) => theme.colors.border || "#d4d4d8"};
  background: #d4d4d8;
  padding: 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const EmptySlotPlus = styled.span`
  font-size: 20px;
  line-height: 1;
  color: #ffffff;
`;

/* ==================== 활동 지역 / 인원 선택 ==================== */

const SectionBox = styled.div`
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
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
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border || "#e5e7eb"};
  background: #ffffff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
`;

const RegionPlaceholder = styled.span`
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const Chevron = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

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
      active ? theme.colors.primary : theme.colors.border || "#e5e7eb"};
  background: ${({ active }) => (active ? "rgba(52, 110, 246, 0.08)" : "#ffffff")};
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
  background: ${({ theme, disabled }) =>
    disabled ? "#cbd5f5" : theme.colors.primary};
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.8 : 1)};
  transition: background 0.15s ease, opacity 0.15s ease;
`;

/* ==================== 오버레이/팝업 공용 ==================== */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
`;

const ModalCard = styled.div`
  width: 90%;
  max-width: 380px;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 18px;
  padding: 16px 16px 20px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.3);
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
`;

const ModalClose = styled.button`
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
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
    primary ? "none" : `1px solid ${theme.colors.border || "#e5e7eb"}`};
  background: ${({ primary, theme }) =>
    primary ? theme.colors.primary : "#ffffff"};
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
  background: ${({ selected }) => (selected ? "#eef2ff" : "#ffffff")};
  border-radius: 12px;
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

// 네모 체크박스
const MemberSelectMark = styled.span`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid
    ${({ selected, theme }) =>
      selected ? theme.colors.primary : theme.colors.border || "#d4d4d8"};
  background: ${({ selected, theme }) =>
    selected ? theme.colors.primary : "#ffffff"};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #ffffff;
`;

/* ==================== 상대팀 선택 ==================== */

const OpponentItem = styled.button`
  width: 100%;
  border: none;
  background: #ffffff;
  border-radius: 12px;
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

/* 공통 팀 로고 (상대 팀 리스트에서도 사용) */
const TeamLogoWrapSmall = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
`;

const TeamLogoImgSmall = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PinIcon = styled.img`
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: block;
`;

/* ==================== 메인 컴포넌트 ==================== */

export default function MatchingHomePage() {
  const navigate = useNavigate();

  // 임시로 내 팀을 TEAMS[0] 로 고정
  const myTeam = TEAMS[0];
  const myMembers = myTeam.players || [];

  const captain = myMembers[0];

  const [selectedMemberIds, setSelectedMemberIds] = useState(
    captain ? [captain.userId] : []
  );
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [matchSize, setMatchSize] = useState(MATCH_SIZES[2]); // 기본 3v3

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showOpponentModal, setShowOpponentModal] = useState(false);

  const opponentTeams = useMemo(
    () => TEAMS.filter((t) => t.clubId !== myTeam.clubId),
    [myTeam]
  );

  const selectedMembers = useMemo(
    () => myMembers.filter((m) => selectedMemberIds.includes(m.userId)),
    [myMembers, selectedMemberIds]
  );

  // 슬롯: 선택 멤버 + 빈 슬롯(null)으로 matchSize.size 개
  const lineupSlots = useMemo(() => {
    const needed = matchSize.size;
    const filled = selectedMembers.slice(0, needed);
    const slots = [];
    for (let i = 0; i < needed; i += 1) {
      slots.push(filled[i] || null);
    }
    return slots;
  }, [selectedMembers, matchSize]);

  const canMatch =
    selectedMembers.length === matchSize.size &&
    !!selectedCity &&
    !!selectedArea;

  const regionLabel =
    selectedCity && selectedArea
      ? `${selectedCity} ${selectedArea}`
      : "활동지역을 선택해주세요";

  const handleToggleMember = (userId) => {
    if (userId === captain?.userId) return; // 팀장은 항상 포함

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

    // TODO: 실제 매칭 생성 API 호출 후 matchId받기
    const matchId = "dummy-match-id-001";
    setShowOpponentModal(false);

    // 매칭룸으로 이동
    navigate(`/match-room/${matchId}`);
  };

    const handleBack = () => {
    navigate(-1);
  };

  return (

    <>
        <SubHeaderBar title="매칭관리" onBack={handleBack} />
    <Wrap>


      <Inner>
        <TeamSection>
          <TeamHeaderRow>
            <TeamLogo src={images[myTeam.logoKey]} alt={myTeam.name} />
            <TeamHeaderText>
              <TeamTitle>{myTeam.name}</TeamTitle>
              <TeamSub>{myTeam.description}</TeamSub>
            </TeamHeaderText>
          </TeamHeaderRow>

          <Line />

          <LineupHeaderRow>
            <span>라인업 구성</span>
            <span>총 {selectedMembers.length}명</span>
          </LineupHeaderRow>

          <LineupList>
            {lineupSlots.map((m, idx) => {
              if (m) {
                const avatar =
                  playerAvatars[m.userId] ||
                  images.profileDefault ||
                  images.logo;
                const isCaptain = m.userId === captain?.userId;
                const positionLabel =
                  POSITION_LABEL[m.mainPosition] || "포지션";

                return (
                  <LineupRow key={m.userId}>
                    <PlayerAvatar src={avatar} alt={m.nickname} />
                    <div style={{ flex: 1 }}>
                      <PlayerName>{m.nickname}</PlayerName>
                    </div>
                    <BadgesWrap>
                      {isCaptain && <CaptainBadge>팀장</CaptainBadge>}
                      <PositionBadge>{positionLabel}</PositionBadge>
                    </BadgesWrap>
                  </LineupRow>
                );
              }

              return (
                <EmptySlotRow
                  key={`empty-${idx}`}
                  type="button"
                  onClick={() => setShowMemberModal(true)}
                >
                  <EmptySlotPlus>+</EmptySlotPlus>
                </EmptySlotRow>
              );
            })}
          </LineupList>

          <LineupHeaderRow>
            <span />
            <AddMemberButton onClick={() => setShowMemberModal(true)}>
              + 팀원 추가
            </AddMemberButton>
          </LineupHeaderRow>

          <SectionBox>
            <SectionTitleRow>
              <PinIcon src={images.pinRegion} alt="활동지역 아이콘" />
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

            <SectionTitleRow>
              <PinIcon src={images.peopleMatch} alt="그룹 아이콘" />
              <SectionTitleText>경기 인원 선택</SectionTitleText>
            </SectionTitleRow>
            <MatchSizeRow>
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
        </TeamSection>
      </Inner>

      <BottomButtonWrap>
        <MatchButton type="button" disabled={!canMatch} onClick={handleOpenMatch}>
          매칭
        </MatchButton>
      </BottomButtonWrap>

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

                const positionLabel =
                  POSITION_LABEL[m.mainPosition] || "포지션 미지정";
                const skillLabel =
                  SKILL_LABEL[m.skillLevel] || "실력 미지정";

                const height = m.heightCm ? `${m.heightCm}cm` : "";
                const weight = m.weightKg ? `${m.weightKg}kg` : "";

                let detailText = "";
                if (isCaptain) {
                  detailText = "팀장 · ";
                }

                detailText += `${positionLabel} · ${skillLabel}`;

                if (height || weight) {
                  detailText += ` · ${height}${
                    height && weight ? " / " : ""
                  }${weight}`;
                }

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
                      <MemberSub>{detailText}</MemberSub>
                    </MemberMeta>
                    <MemberSelectMark selected={selected}>
                      {selected ? "✓" : ""}
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
                  <div
                    style={{
                      fontSize: 12,
                      marginBottom: 4,
                      color: "#6b7280",
                    }}
                  >
                    {city}
                  </div>
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
                          {selected ? "✓" : ""}
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
              {opponentTeams.map((team) => (
                <OpponentItem
                  key={team.clubId}
                  type="button"
                  onClick={() => handleRequestMatch(team.clubId)}
                >
                  <TeamLogoWrapSmall>
                    <TeamLogoImgSmall
                      src={images[team.logoKey]}
                      alt={team.name}
                    />
                  </TeamLogoWrapSmall>
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
    </>

  );
}
