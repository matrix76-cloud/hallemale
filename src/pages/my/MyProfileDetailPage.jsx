// src/pages/my/MyProfileDetailPage.jsx
/* eslint-disable */
import React, { useMemo } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { images, playerAvatars } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/**
 * 내 프로필 보기 페이지
 * - 공개 프로필이 어떻게 보이는지 확인하는 화면
 * - 상단: 프로필 헤더 (사진 / 이름 / 포지션 / 실력 / 소속 팀)
 * - 중단: 기본 정보(나이/키/몸무게/실력) + 소속 팀/태그
 * - 하단: 경력 / 경기 사진·영상 섹션
 */

export default function MyProfileDetailPage() {
  const navigate = useNavigate();

  // 임시로 내 정보를 TEAMS[0]의 첫 번째 선수로 고정
  const myTeam = TEAMS[0];
  const myPlayer = myTeam.players[0];

  const avatarSrc = useMemo(
    () =>
      playerAvatars[myPlayer.userId] ||
      myPlayer.photoUrl ||
      images.logo,
    [myPlayer]
  );

  const heightLabel = myPlayer.heightCm ? `${myPlayer.heightCm}cm` : "-";
  const weightLabel = myPlayer.weightKg ? `${myPlayer.weightKg}kg` : "-";

  const positionLabel = useMemo(() => {
    if (myPlayer.mainPosition === "guard") return "가드";
    if (myPlayer.mainPosition === "forward") return "포워드";
    if (myPlayer.mainPosition === "center") return "센터";
    return "포지션 미지정";
  }, [myPlayer.mainPosition]);

  const skillLabel = useMemo(() => {
    const s = myPlayer.skillLevel;
    if (s === "beginner") return "입문";
    if (s === "amateur") return "아마추어";
    if (s === "intermediate") return "중급";
    if (s === "advanced") return "상급";
    if (s === "pro") return "프로";
    return "실력 미지정";
  }, [myPlayer.skillLevel]);

  // 경력 더미 (실제에선 users 컬렉션/경력 필드에서 가져오기)
  const careers = [
    { id: 1, title: "17회 클럽리그 대회 1등", year: "2024" },
    { id: 2, title: "동호회 3on3 대회 우승", year: "2023" },
    { id: 3, title: "대학 농구 리그 출전", year: "2022" },
  ];

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <PageWrap>

     <SubHeaderBar title="내 프로필" onBack={handleBack} />
      <Inner>
        {/* 상단 프로필 카드 */}
        <ProfileCard>
          <ProfileTopRow>
            <AvatarWrap>
              <Avatar src={avatarSrc} alt={myPlayer.nickname} />
            </AvatarWrap>
            <ProfileText>
              <NameRow>
                <Name>{myPlayer.nickname}</Name>
                <NameSub>{myTeam.region}</NameSub>
              </NameRow>
              <TagRow>
                <TagAccent>{positionLabel}</TagAccent>
                <TagSoft>실력 {skillLabel}</TagSoft>
                <TagSoft>{myTeam.name}</TagSoft>
              </TagRow>
            </ProfileText>
          </ProfileTopRow>

          <InfoGrid>
            <InfoItem>
              <InfoLabel>키</InfoLabel>
              <InfoValue>{heightLabel}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>몸무게</InfoLabel>
              <InfoValue>{weightLabel}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>포지션</InfoLabel>
              <InfoValue>{positionLabel}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>실력</InfoLabel>
              <InfoValue>{skillLabel}</InfoValue>
            </InfoItem>
          </InfoGrid>
        </ProfileCard>

        {/* 경력 섹션 */}
        <SectionCard>
          <SectionHeaderRow>
            <SectionTitle>경력</SectionTitle>
          </SectionHeaderRow>
          {careers.length === 0 ? (
            <EmptyText>아직 등록된 경력이 없습니다.</EmptyText>
          ) : (
            <CareerList>
              {careers.map((c) => (
                <CareerItem key={c.id}>
                  <CareerTitle>{c.title}</CareerTitle>
                  <CareerYear>{c.year}년</CareerYear>
                </CareerItem>
              ))}
            </CareerList>
          )}
        </SectionCard>

        {/* 경기 사진/영상 섹션 */}
        <SectionCard>
          <SectionHeaderRow>
            <SectionTitle>경기 사진 / 영상</SectionTitle>
            <SectionSub>최근 경기 하이라이트를 보여줘요.</SectionSub>
          </SectionHeaderRow>
          <MediaGrid>
            <MediaBox>
              <MediaPlaceholder>영상/사진 추가 예정</MediaPlaceholder>
            </MediaBox>
            <MediaBox>
              <MediaPlaceholder>영상/사진 추가 예정</MediaPlaceholder>
            </MediaBox>
          </MediaGrid>
        </SectionCard>
      </Inner>
    </PageWrap>
  );
}

/* ==================== styled ==================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
`;

/* 헤더 */

const HeaderBar = styled.div`
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  color: #4b5563;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const HeaderRightPlaceholder = styled.div`
  width: 24px;
`;

/* 내용 */

const Inner = styled.div`
  padding: 0 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

/* 프로필 카드 */

const ProfileCard = styled.div`
  background: #ffffff;
  border-radius: 22px;
  padding: 14px 14px 16px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ProfileTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AvatarWrap = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
  flex-shrink: 0;
`;

const Avatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ProfileText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const NameRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Name = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const NameSub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TagBase = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
`;

const TagAccent = styled(TagBase)`
  background: #e0ebff;
  color: #2563eb;
`;

const TagSoft = styled(TagBase)`
  background: #f3f4f6;
  color: #4b5563;
`;

/* 기본 정보 그리드 */

const InfoGrid = styled.div`
  margin-top: 4px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const InfoItem = styled.div`
  padding: 8px 10px;
  border-radius: 12px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const InfoLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const InfoValue = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 공통 섹션 카드 */

const SectionCard = styled.div`
  background: #ffffff;
  border-radius: 22px;
  padding: 12px 14px 14px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionHeaderRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionSub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const EmptyText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  padding: 6px 0;
`;

/* 경력 리스트 */

const CareerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CareerItem = styled.div`
  padding: 8px 10px;
  border-radius: 12px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

const CareerTitle = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CareerYear = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

/* 미디어 섹션 */

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const MediaBox = styled.div`
  height: 120px;
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MediaPlaceholder = styled.div`
  font-size: 11px;
  color: #6b7280;
`;

