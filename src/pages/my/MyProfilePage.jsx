// src/pages/my/MyProfilePage.jsx
/* eslint-disable */
import React, { useMemo } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiSettings } from "react-icons/fi";
import { images, playerAvatars } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";

/**
 * 내 정보 메인
 * - 상단: 프로필 헤더 (전체 폭)
 * - 중간: 내 정보/활동 메뉴
 * - 하단: 계정/앱 설정 메뉴
 */

export default function MyProfilePage() {
  const navigate = useNavigate();

  // 임시: TEAMS[0] 첫 번째 선수 = 내 프로필
  const myTeam = TEAMS[0];
  const myPlayer = myTeam.players[0];

  const avatarSrc = useMemo(
    () => playerAvatars[myPlayer.userId] || myPlayer.photoUrl || images.logo,
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

  const handleGoEditProfile = () => {
    navigate("/my/profile/edit");
  };

  const handleMainMenuClick = (key) => {
    if (key === "profile") navigate("/my/profile/detail");
    if (key === "posts") navigate("/my/posts");
    if (key === "personalMatches") navigate("/my/personal-matches");
    if (key === "matchedMatches") navigate("/my/matched-matches");
  };

  const handleSettingMenuClick = (key) => {
    console.log("settings menu:", key);
    if (key === "logout") {
      // TODO: 로그아웃 처리
    }
  };

  return (
    <PageWrap>
      {/* 상단 프로필 헤더 */}
      <ProfileHeader>
        <ProfileLeft>
          <AvatarWrap>
            <Avatar src={avatarSrc} alt={myPlayer.nickname} />
          </AvatarWrap>
          <ProfileInfo>
            <NameRow>
              <Name>{myPlayer.nickname}</Name>
              <EditButton type="button" onClick={handleGoEditProfile}>
                프로필 수정
              </EditButton>
            </NameRow>
            <MetaRow>
              <MetaItem>{myTeam.region}</MetaItem>
              <MetaDot>·</MetaDot>
              <MetaItem>{myTeam.name}</MetaItem>
            </MetaRow>
            <TagRow>
              <TagAccent>{positionLabel}</TagAccent>
              <TagSoft>실력 {skillLabel}</TagSoft>
              <TagSoft>키 {heightLabel}</TagSoft>
              <TagSoft>몸무게 {weightLabel}</TagSoft>
            </TagRow>
          </ProfileInfo>
        </ProfileLeft>
        <SettingsButton type="button">
          <FiSettings size={20} />
        </SettingsButton>
      </ProfileHeader>

      <Divider />

      {/* 내 정보 / 활동 메뉴 */}
      <Section>
        <SectionInner>
          <SectionTitle>내 정보</SectionTitle>
        </SectionInner>
        <MenuList>
          <MenuItemButton
            type="button"
            onClick={() => handleMainMenuClick("profile")}
          >
            <MenuTextWrap>
              <MenuTitle>내 프로필 보기</MenuTitle>
              <MenuSub>공개 프로필이 어떻게 보이는지 확인해요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleMainMenuClick("posts")}
          >
            <MenuTextWrap>
              <MenuTitle>내가 쓴 게시글</MenuTitle>
              <MenuSub>
                커뮤니티에 남긴 글을 한 번에 모아서 볼 수 있어요.
              </MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleMainMenuClick("personalMatches")}
          >
            <MenuTextWrap>
              <MenuTitle>개인 활동 경기</MenuTitle>
              <MenuSub>픽업게임, 개인 참가 경기 기록을 확인해요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleMainMenuClick("matchedMatches")}
          >
            <MenuTextWrap>
              <MenuTitle>매칭된 경기</MenuTitle>
              <MenuSub>팀 매칭으로 확정된 경기 기록을 확인해요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
        </MenuList>
      </Section>

      <SectionSpacer />

      {/* 계정 / 앱 설정 메뉴 */}
      <Section>
        <SectionInner>
          <SectionTitle>계정 · 앱 설정</SectionTitle>
        </SectionInner>
        <MenuList>
          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("alarm")}
          >
            <MenuTextWrap>
              <MenuTitle>알림 설정</MenuTitle>
              <MenuSub>알림 / 매칭요청 / 메시지 / 이벤트 알림 ON/OFF</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("notice")}
          >
            <MenuTextWrap>
              <MenuTitle>공지사항</MenuTitle>
              <MenuSub>업데이트, 점검, 이벤트 소식을 모아 볼 수 있어요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("reportBlock")}
          >
            <MenuTextWrap>
              <MenuTitle>신고 / 차단</MenuTitle>
              <MenuSub>비매너 사용자 신고 및 팀 · 사용자 차단 관리</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("faq")}
          >
            <MenuTextWrap>
              <MenuTitle>FAQ</MenuTitle>
              <MenuSub>자주 묻는 질문을 카테고리별로 모아두었어요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("cs")}
          >
            <MenuTextWrap>
              <MenuTitle>고객센터 / 문의하기</MenuTitle>
              <MenuSub>앱 내 1:1 문의로 궁금한 점을 남겨주세요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("changePassword")}
          >
            <MenuTextWrap>
              <MenuTitle>비밀번호 변경</MenuTitle>
              <MenuSub>로그인에 사용하는 비밀번호를 변경해요.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("logout")}
          >
            <MenuTextWrap>
              <MenuTitle>로그아웃</MenuTitle>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
          <MenuItemDivider />

          <MenuItemButton
            type="button"
            onClick={() => handleSettingMenuClick("withdraw")}
          >
            <MenuTextWrap>
              <MenuTitle style={{ color: "#ef4444" }}>회원 탈퇴</MenuTitle>
              <MenuSub>계정과 경기 기록이 모두 삭제됩니다.</MenuSub>
            </MenuTextWrap>
            <MenuArrow>›</MenuArrow>
          </MenuItemButton>
        </MenuList>
      </Section>
    </PageWrap>
  );
}

/* ==================== styled ==================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 10px 0 24px;
  display: flex;
  flex-direction: column;
`;

/* 상단 프로필 */

const ProfileHeader = styled.div`
  padding: 0 12px 16px; /* 왼쪽 여백 줄임 */
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const ProfileLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AvatarWrap = styled.div`
  width: 56px;
  height: 56px;
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

const ProfileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Name = styled.div`
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const EditButton = styled.button`
  border: none;
  background: #eff3ff;
  color: #2563eb;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  cursor: pointer;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const MetaItem = styled.span``;
const MetaDot = styled.span``;

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

const SettingsButton = styled.button`
  border: none;
  background: transparent;
  color: #9ca3af;
  padding: 4px 8px 0 0;
  cursor: pointer;
`;

const Divider = styled.div`
  height: 1px;
  background: #e5e7eb;
`;

/* 섹션 공통 */

const Section = styled.section`
  margin-top: 8px;
`;

const SectionInner = styled.div`
  padding: 0 12px; /* 왼쪽 여백 줄임 */
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  margin-bottom: 6px;
`;

const SectionSpacer = styled.div`
  height: 16px;
`;

/* 메뉴 리스트 */

const MenuList = styled.div`
  display: flex;
  flex-direction: column;
`;

const MenuItemButton = styled.button`
  width: 100%;
  border: none;
  padding: 14px 12px; /* 왼쪽 여백 줄임 */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
`;

const MenuTextWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
`;

const MenuTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MenuSub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const MenuArrow = styled.div`
  font-size: 16px;
  color: #9ca3af;
`;

const MenuItemDivider = styled.div`
  height: 1px;
  background: #e5e7eb;
`;
