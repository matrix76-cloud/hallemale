/* eslint-disable */
// src/pages/my/MyProfileDetailPage.jsx
import React, { useMemo } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images, playerAvatars } from "../../utils/imageAssets";
import { TEAMS_BY_ID } from "../../mock/teamsMock";
import { useAuth } from "../../hooks/useAuth";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/**
 * 내 프로필 보기 페이지 (실데이터 기반)
 * - userDoc(Firestore) 기반으로 렌더
 * - 팀 정보는 userDoc.activeTeamId || userDoc.clubId 기준으로 TEAMS_BY_ID에서 매칭
 */

export default function MyProfileDetailPage() {
  const navigate = useNavigate();
  const { userDoc, loading } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  const teamId = userDoc?.activeTeamId || userDoc?.clubId || "";
  const myTeam = teamId ? TEAMS_BY_ID?.[teamId] : null;


  console.log("[MyProfileDetail] uid =", userDoc?.uid || userDoc?.id, "region =", userDoc?.region, "regionSido =", userDoc?.regionSido, "regionGu =", userDoc?.regionGu);

  

  const avatarSrc = useMemo(() => {
    const a = userDoc?.avatarUrl || (uid ? playerAvatars?.[uid] : "") || "";
    return a || images.logo;
  }, [userDoc?.avatarUrl, uid]);

  const regionText = useMemo(() => {
    const r = (userDoc?.region || "").trim();
    if (r) return r;
    const sido = (userDoc?.regionSido || "").trim();
    const gu = (userDoc?.regionGu || "").trim();
    const merged = `${sido}${sido && gu ? " " : ""}${gu}`.trim();
    return merged || "지역 미지정";
  }, [userDoc?.region, userDoc?.regionSido, userDoc?.regionGu]);

  const heightLabel = userDoc?.heightCm ? `${userDoc.heightCm}cm` : "-";
  const weightLabel = userDoc?.weightKg ? `${userDoc.weightKg}kg` : "-";

  const positionLabel = useMemo(() => {
    const p = userDoc?.mainPosition;
    if (p === "guard") return "가드";
    if (p === "forward") return "포워드";
    if (p === "center") return "센터";
    return "포지션 미지정";
  }, [userDoc?.mainPosition]);

  const skillLabel = useMemo(() => {
    const s = userDoc?.skillLevel;
    if (s === "beginner") return "입문";
    if (s === "amateur") return "아마추어";
    if (s === "intermediate") return "중급";
    if (s === "advanced") return "상급";
    if (s === "pro") return "프로";
    return "실력 미지정";
  }, [userDoc?.skillLevel]);

  const teamNameLabel = myTeam?.name || "팀 미지정";

  const careers = useMemo(() => {
    const arr = Array.isArray(userDoc?.careers) ? userDoc.careers : [];
    return arr.filter((x) => typeof x === "string" && x.trim().length > 0).map((x, idx) => ({
      id: `${idx}-${x}`,
      title: x.trim(),
    }));
  }, [userDoc?.careers]);

  const handleBack = () => navigate(-1);

  return (
    <PageWrap>
   
      <Inner>
        {loading ? (
          <SectionCard>
            <EmptyText>불러오는 중...</EmptyText>
          </SectionCard>
        ) : !userDoc ? (
          <SectionCard>
            <EmptyText>로그인 정보가 없습니다.</EmptyText>
          </SectionCard>
        ) : (
          <>
            {/* 상단 프로필 카드 */}
            <ProfileCard>
              <ProfileTopRow>
                <AvatarWrap>
                  <Avatar src={avatarSrc} alt={userDoc?.nickname || "avatar"} />
                </AvatarWrap>

                <ProfileText>
                  <NameRow>
                    <Name>{userDoc?.nickname || "이름 미지정"}</Name>
                    <NameSub>
                      {regionText} · {teamNameLabel}
                    </NameSub>
                  </NameRow>

                  <TagRow>
                    <TagAccent>{positionLabel}</TagAccent>
                    <TagSoft>실력 {skillLabel}</TagSoft>
                    <TagSoft>{heightLabel !== "-" ? `키 ${heightLabel}` : "키 미지정"}</TagSoft>
                    <TagSoft>{weightLabel !== "-" ? `몸무게 ${weightLabel}` : "몸무게 미지정"}</TagSoft>
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
          </>
        )}
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
  flex: 1;
  min-width: 0;
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
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
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
  padding: 10px 12px;
  border-radius: 14px;
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
  font-weight: 700;
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

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 800;
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
  padding: 10px 12px;
  border-radius: 14px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

const CareerTitle = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
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
