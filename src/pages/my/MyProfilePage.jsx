/* eslint-disable */
// src/components/home/MyProfilePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { playerAvatars } from "../../utils/imageAssets";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { countPendingInvitesForUser } from "../../services/inviteService";
import { countPendingJoinRequestsForClub } from "../../services/joinRequestService";

import InfoDialog from "../../components/common/InfoDialog";
import Spinner from "../../components/common/Spinner";
import { leaveClub } from "../../services/clubManageService";

export default function MyProfilePage() {
  const nav = useNavigate();
  const { userDoc, loading, signOut } = useAuth();

  const { club, activeTeamId, isTeamLeader: isTeamLeaderFromCtx, loading: clubLoading } =
    useClub();

  const uid = userDoc?.uid || userDoc?.id || "";
  const nickname = userDoc?.nickname || "";
  const mainPosition = userDoc?.mainPosition || "";
  const skillLevel = userDoc?.skillLevel || "";
  const heightCm = userDoc?.heightCm ?? null;
  const weightKg = userDoc?.weightKg ?? null;

  const avatarSrc = useMemo(() => {
    return userDoc?.avatarUrl || (uid ? playerAvatars[uid] : null) || "";
  }, [userDoc, uid]);

  const myRegion = useMemo(() => {
    const r = (userDoc?.region || "").trim();
    if (r) return r;

    const sido = (userDoc?.regionSido || "").trim();
    const gu = (userDoc?.regionGu || "").trim();
    const merged = `${sido}${sido && gu ? " " : ""}${gu}`.trim();
    return merged || "지역 미지정";
  }, [userDoc?.region, userDoc?.regionSido, userDoc?.regionGu]);

  const teamId = String(activeTeamId || "").trim();
  const hasTeam = !!teamId;

  const teamName = useMemo(() => {
    if (!hasTeam) return "팀 미지정";
    return club?.name || "팀 불러오는 중...";
  }, [hasTeam, club?.name]);

  const isTeamLeader = !!hasTeam && !!isTeamLeaderFromCtx;

  // ✅ 메뉴 뱃지: 팀장=참여요청, 팀원=받은초대
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setPendingCount(0);
      return;
    }

    let alive = true;

    (async () => {
      try {
        if (isTeamLeader && teamId) {
          const n = await countPendingJoinRequestsForClub({ clubId: teamId, limitCount: 200 });
          if (!alive) return;
          setPendingCount(Number.isFinite(n) ? n : 0);
          return;
        }

        const n = await countPendingInvitesForUser({ uid, limitCount: 200 });
        if (!alive) return;
        setPendingCount(Number.isFinite(n) ? n : 0);
      } catch (e) {
        if (!alive) return;
        setPendingCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid, isTeamLeader, teamId]);

  const needSetup = useMemo(() => {
    if (!userDoc) return true;
    const hasNick = !!(nickname && nickname.trim().length > 0);
    const hasPos = !!mainPosition;
    const hasSkill = !!skillLevel;
    const hasBody = !!heightCm || !!weightKg;
    const hasIntro = !!(userDoc?.intro && String(userDoc.intro).trim().length > 0);

    const onlyNick = hasNick && !(hasPos || hasSkill || hasBody || hasIntro);
    const allEmpty = !(hasNick || hasPos || hasSkill || hasBody || hasIntro);
    return allEmpty || onlyNick;
  }, [userDoc, nickname, mainPosition, skillLevel, heightCm, weightKg]);

  const handleGoEditProfile = () => nav("/my/profile/edit");

  const handleMainMenuClick = (key) => {
    if (key === "posts") nav("/my/posts");
    if (key === "personal-matches") nav("/my/personal-matches");
    if (key === "matched-matches") nav("/my/matched-matches");

    if (key === "team-invites") nav("/my/team-invites");

    if (key === "join-requests") {
      if (!teamId) {
        window.alert("팀 정보가 없습니다.");
        return;
      }
      nav(`/team/${teamId}/join-requests`);
    }
  };

  const handleTeamMenuClick = (key) => {
    if (key === "create") {
      nav("/team/create");
      return;
    }

    if (key === "manage") {
      if (!hasTeam) {
        window.alert("팀 정보가 없습니다. 팀을 생성한 뒤 다시 시도해 주세요.");
        return;
      }
      if (!isTeamLeader) {
        window.alert("팀장만 팀 관리를 할 수 있어요.");
        return;
      }
      nav(`/team/${teamId}/manage`);
      return;
    }

    if (key === "view") {
      if (!hasTeam) {
        window.alert("팀 정보가 없습니다. 팀을 선택한 뒤 다시 시도해 주세요.");
        return;
      }
      nav(`/team/${teamId}`);
      return;
    }

    if (key === "leave") {
      openLeaveTeam();
      return;
    }
  };

  const handleSettingMenuClick = async (key) => {
    if (key === "alarm") nav("/settings/notifications");
    if (key === "notice") nav("/settings/notices");
    if (key === "reportBlock") nav("/settings/block-report");
    if (key === "faq") nav("/settings/faq");
    if (key === "changePassword") nav("/settings/password");

    if (key === "privacy") nav("/privacy");
    if (key === "terms") nav("/terms");

    if (key === "cs") window.alert("문의하기 기능은 준비 중입니다.");

    if (key === "logout") {
      const ok = window.confirm("로그아웃할까요?");
      if (!ok) return;
      try {
        await signOut();
      } catch (e) {}
      nav("/login", { replace: true });
    }
  };

  // =========================
  // ✅ 팀 탈퇴 (InfoDialog)
  // =========================
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveBlockedOpen, setLeaveBlockedOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveDoneOpen, setLeaveDoneOpen] = useState(false);
  const [leaveErr, setLeaveErr] = useState("");

  const openLeaveTeam = () => {
    if (!uid) {
      window.alert("로그인이 필요합니다.");
      return;
    }
    if (!hasTeam || !teamId) {
      window.alert("팀 정보가 없습니다.");
      return;
    }
    if (isTeamLeader) {
      setLeaveBlockedOpen(true);
      return;
    }
    setLeaveErr("");
    setLeaveConfirmOpen(true);
  };

  const runLeaveTeam = async () => {
    setLeaveConfirmOpen(false);
    setLeaveErr("");
    setLeaveBusy(true);

    try {
      await leaveClub({ clubId: teamId, uid });
      setLeaveBusy(false);
      setLeaveDoneOpen(true);
    } catch (e) {
      const code = String(e?.code || "");
      const msg = String(e?.message || "팀 탈퇴에 실패했습니다.");

      if (code === "team-leader-cannot-leave" || msg.includes("팀장")) {
        setLeaveBusy(false);
        setLeaveBlockedOpen(true);
        return;
      }

      setLeaveBusy(false);
      setLeaveErr(msg);
      setLeaveConfirmOpen(true);
    }
  };

  return (
    <>
      <InfoDialog
        open={leaveBlockedOpen}
        tone="danger"
        title="팀 탈퇴 불가"
        message={
          '팀장 권한이 있는 상태에서는\n팀 탈퇴를 할 수 없습니다.\n\n팀 관리를 통해 팀장 권한을\n위임한 뒤 다시 시도해 주세요.'
        }
        primaryText="확인"
        onPrimary={() => setLeaveBlockedOpen(false)}
        secondaryText="닫기"
        onClose={() => setLeaveBlockedOpen(false)}
        hideSecondary={true}
        showClose={true}
        closeOnOverlay={false}
      />

      <InfoDialog
        open={leaveConfirmOpen}
        tone="danger"
        title="팀을 탈퇴할까요?"
        message={
          leaveErr
            ? `팀 탈퇴에 실패했습니다.\n${leaveErr}\n\n다시 시도할까요?`
            : `탈퇴하면 "${teamName}"에서\n내 멤버 정보가 제거됩니다.`
        }
        primaryText="탈퇴하기"
        onPrimary={runLeaveTeam}
        secondaryText="취소"
        onClose={() => {
          setLeaveConfirmOpen(false);
          setLeaveErr("");
        }}
        hideSecondary={false}
        showClose={true}
        closeOnOverlay={false}
      />

      {leaveBusy && (
        <BusyOverlay>
          <BusyCard>
            <Spinner />
            <BusyText>팀 탈퇴 처리 중…</BusyText>
          </BusyCard>
        </BusyOverlay>
      )}

      <InfoDialog
        open={leaveDoneOpen}
        tone="success"
        title="팀 탈퇴가 완료됐어요"
        message={"팀에서 정상적으로 탈퇴했습니다."}
        primaryText="확인"
        onPrimary={() => setLeaveDoneOpen(false)}
        secondaryText="닫기"
        onClose={() => setLeaveDoneOpen(false)}
        hideSecondary={true}
        showClose={true}
        closeOnOverlay={false}
      />

      <PageWrap>
        {/* ✅ 프로필 영역: 톱니 아이콘 제거 → "내프로필 설정" 버튼 */}
        <ProfileHeader>
          <ProfileHeaderInner>
            <ProfileLeft>
              <AvatarWrap>
                {avatarSrc ? (
                  <Avatar src={avatarSrc} alt={nickname || "profile"} />
                ) : (
                  <AvatarPlaceholder size={60} />
                )}
              </AvatarWrap>

              <ProfileInfo>
                <NameRow>
                  <Name>{loading ? "불러오는 중..." : nickname ? nickname : "닉네임 미설정"}</Name>
                  {isTeamLeader ? <OwnerPill>팀장</OwnerPill> : null}
                </NameRow>

                <MetaRow>
                  <MetaItem>{myRegion}</MetaItem>
                  <MetaDot>·</MetaDot>
                  <MetaItem>{teamName}</MetaItem>
                </MetaRow>
              </ProfileInfo>
            </ProfileLeft>

            <ProfileSettingBtn type="button" onClick={handleGoEditProfile}>
              내프로필 설정
            </ProfileSettingBtn>

            {!loading && needSetup ? (
              <SetupOverlay
                role="button"
                tabIndex={0}
                onClick={handleGoEditProfile}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleGoEditProfile();
                }}
                aria-label="프로필 설정 필요"
              >
                <SetupCard
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoEditProfile();
                  }}
                >
                  <SetupPill>설정 필요</SetupPill>
                  <SetupSub>프로필을 입력하면 매칭이 쉬워져요</SetupSub>
                  <SetupCta>지금 설정하기</SetupCta>
                </SetupCard>
              </SetupOverlay>
            ) : null}
          </ProfileHeaderInner>
        </ProfileHeader>

        <Section>
          <SectionInner>
            <SectionTitle>팀 정보 설정</SectionTitle>
          </SectionInner>

          <SectionBody>
            <MenuList>
              {!hasTeam ? (
                <MenuItemButton onClick={() => handleTeamMenuClick("create")}>
                  <MenuTextWrap>
                    <MenuTitle>팀 생성</MenuTitle>
                  </MenuTextWrap>
                  <MenuArrow>›</MenuArrow>
                </MenuItemButton>
              ) : null}

              {hasTeam ? (
                <MenuItemButton onClick={() => handleTeamMenuClick("view")}>
                  <MenuTextWrap>
                    <MenuTitle>{clubLoading ? "팀 불러오는 중..." : "팀 보기"}</MenuTitle>
                  </MenuTextWrap>
                  <MenuArrow>›</MenuArrow>
                </MenuItemButton>
              ) : null}

              {hasTeam && isTeamLeader ? (
                <MenuItemButton onClick={() => handleTeamMenuClick("manage")}>
                  <MenuTextWrap>
                    <MenuTitle>팀 관리</MenuTitle>
                  </MenuTextWrap>
                  <MenuArrow>›</MenuArrow>
                </MenuItemButton>
              ) : null}

              {hasTeam ? (
                <MenuItemButton onClick={() => handleTeamMenuClick("leave")}>
                  <MenuTextWrap>
                    <MenuTitle>{clubLoading ? "팀 불러오는 중..." : "팀 탈퇴"}</MenuTitle>
                  </MenuTextWrap>
                  <MenuArrow>›</MenuArrow>
                </MenuItemButton>
              ) : null}
            </MenuList>
          </SectionBody>
        </Section>

        <Section>
          <SectionInner>
            <SectionTitle>내 정보</SectionTitle>
          </SectionInner>
          <SectionBody>
            <MenuList>
              <MenuItemButton
                onClick={() => handleMainMenuClick(isTeamLeader ? "join-requests" : "team-invites")}
              >
                <MenuTextWrap>
                  <MenuTitleRow>
                    <MenuTitle>{isTeamLeader ? "참여요청" : "받은 초대"}</MenuTitle>
                    {pendingCount > 0 ? (
                      <NewBadge aria-label="new">
                        {pendingCount > 99 ? "99+" : String(pendingCount)}
                      </NewBadge>
                    ) : null}
                  </MenuTitleRow>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleMainMenuClick("posts")}>
                <MenuTextWrap>
                  <MenuTitle>내가 쓴 게시글</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleMainMenuClick("personal-matches")}>
                <MenuTextWrap>
                  <MenuTitle>개인 활동 경기</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleMainMenuClick("matched-matches")}>
                <MenuTextWrap>
                  <MenuTitle>매칭된 경기</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>
            </MenuList>
          </SectionBody>
        </Section>

        <Section>
          <SectionInner>
            <SectionTitle>계정 · 앱 설정</SectionTitle>
          </SectionInner>
          <SectionBody>
            <MenuList>
              <MenuItemButton onClick={() => handleSettingMenuClick("alarm")}>
                <MenuTextWrap>
                  <MenuTitle>알림 설정</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("faq")}>
                <MenuTextWrap>
                  <MenuTitle>FAQ</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("privacy")}>
                <MenuTextWrap>
                  <MenuTitle>개인정보 처리지침</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("terms")}>
                <MenuTextWrap>
                  <MenuTitle>이용약관</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("logout")}>
                <MenuTextWrap>
                  <MenuTitle>로그아웃</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>
            </MenuList>
          </SectionBody>
        </Section>
      </PageWrap>
    </>
  );
}

/* ===== 진행 오버레이 ===== */
const BusyOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
`;

const BusyCard = styled.div`
  width: min(420px, 90vw);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(229, 231, 235, 0.9);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  padding: 22px 18px;
  display: grid;
  place-items: center;
  gap: 10px;
`;

const BusyText = styled.div`
  font-size: 13px;
  color: #6b7280;
`;

/* ==================== 기존 styled (원본 유지) ==================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 12px 12px 24px;
  display: flex;
  flex-direction: column;
  margin-bottom: 50px;
`;

const ProfileHeader = styled.div`
  padding: 0 12px 18px;
`;

const ProfileHeaderInner = styled.div`
  position: relative;
`;

const ProfileLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AvatarWrap = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
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
  gap: 8px;
`;

const Name = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const OwnerPill = styled.div`
  padding: 4px 10px;
  border-radius: 5px;
  color: #fff;
  background: #4f46e5;
  font-size: 12px;
  font-weight: 800;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const MetaItem = styled.span``;
const MetaDot = styled.span``;

/* ✅ 톱니 버튼 제거 (기존 SettingsButton 삭제해도 됨) */

const ProfileSettingBtn = styled.button`
  position: absolute;
  top: 2px;
  right: 0px;

  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  z-index: 2;

  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);

  &:active {
    transform: translateY(1px);
    background: #f9fafb;
  }
`;

const SetupOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  padding: 18px;
`;

const SetupCard = styled.button`
  width: min(560px, 94vw);
  border: none;
  cursor: pointer;
  border-radius: 22px;
  padding: 28px 22px 22px;
  display: grid;
  place-items: center;
  gap: 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
`;

const SetupPill = styled.div`
  display: inline-flex;
  justify-self: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.14);
  color: #4f46e5;
  font-size: 14px;
  font-weight: 800;
`;

const SetupSub = styled.div`
  font-size: 15px;
  line-height: 1.45;
  color: rgba(17, 24, 39, 0.78);
`;

const SetupCta = styled.div`
  justify-self: center;
  margin-top: 6px;
  padding: 12px 18px;
  border-radius: 999px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
`;

const Section = styled.section`
  margin-top: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
`;

const SectionInner = styled.div`
  padding: 0 12px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: "GmarketSans";
`;

const SectionBody = styled.div`
  display: flex;
  padding: 0 20px 0 20px;
  margin-top: 10px;
`;

const MenuList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const MenuItemButton = styled.button`
  width: 100%;
  border: none;
  padding: 10px 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
`;

const MenuTextWrap = styled.div`
  display: flex;
  flex-direction: column;
  text-align: left;
  gap: 2px;
`;

const MenuTitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const NewBadge = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
`;

const MenuTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MenuArrow = styled.div`
  font-size: 18px;
  color: #9ca3af;
`;
