/* eslint-disable */
// src/components/home/MyProfilePage.jsx
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { playerAvatars, images } from "../../utils/imageAssets";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useThemeMode } from "../../context/ThemeContext";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { countPendingInvitesForUser } from "../../services/inviteService";
import { countPendingJoinRequestsForClub } from "../../services/joinRequestService";
import { shareApp } from "../../utils/share";

import InfoDialog from "../../components/common/InfoDialog";
import Spinner from "../../components/common/Spinner";
import { leaveClub, deleteClubAndCleanup } from "../../services/clubManageService";

// ✅ 팀장 이임 서비스
import {
  listClubMembersForLeaderTransfer,
  transferTeamLeader,
} from "../../services/clubLeaderService";

export default function MyProfilePage() {
  const nav = useNavigate();
  const { userDoc, loading, signOut } = useAuth();
  const { mode: themeMode, toggleMode: toggleThemeMode } = useThemeMode();

  const { club, members, activeTeamId, isTeamLeader: isTeamLeaderFromCtx, loading: clubLoading } =
    useClub();

  // ✅ 혼자(팀장 본인만) 있는 팀이면 "탈퇴 = 팀 해체"로 허용
  const memberCount = Array.isArray(members) ? members.length : 0;

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

  // ✅ 팀장이면서 팀원이 본인뿐이면 "탈퇴 = 팀 해체"
  const soloOwner = isTeamLeader && memberCount <= 1;

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

  const handleInviteFriends = async () => {
    const res = await shareApp({ refUid: uid, context: "my" });
    if (res.method === "copied") showAlert("초대 링크를 복사했어요.\n친구에게 붙여넣어 보내보세요!");
    else if (res.method === "unsupported") showAlert(`초대 링크:\n${res.url}`);
  };

  const handleMainMenuClick = (key) => {
    if (key === "reservations") nav("/my/reservations");
    if (key === "posts") nav("/my/posts");
    if (key === "personal-matches") nav("/my/personal-matches");
    if (key === "my-reports") nav("/my/reports");

    if (key === "team-join") nav("/my/profile/edit/team-join");

    if (key === "team-invites") nav("/my/team-invites");

    if (key === "join-requests") {
      if (!teamId) {
        showAlert("팀 정보가 없습니다.");
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

    if (key === "invite") {
      if (!teamId) {
        showAlert("팀 정보가 없습니다. 팀을 생성한 뒤 다시 시도해 주세요.");
        return;
      }
      // 팀 관리 진입과 동시에 팀원 초대 모달을 바로 연다
      nav(`/team/${teamId}/manage?invite=1`);
      return;
    }

    if (key === "manage") {
      if (!hasTeam) {
        showAlert("팀 정보가 없습니다. 팀을 생성한 뒤 다시 시도해 주세요.");
        return;
      }
      if (!isTeamLeader) {
        showAlert("팀장만 팀 관리를 할 수 있어요.");
        return;
      }
      nav(`/team/${teamId}/manage`);
      return;
    }

    if (key === "view") {
      if (!hasTeam) {
        showAlert("팀 정보가 없습니다. 팀을 선택한 뒤 다시 시도해 주세요.");
        return;
      }
      nav(`/team/${teamId}`);
      return;
    }

    if (key === "transfer-leader") {
      openTransferLeader();
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
    if (key === "withdraw") nav("/settings/withdraw");

    if (key === "privacy") nav("/privacy");
    if (key === "terms") nav("/terms");
    if (key === "operation") nav("/operation");

    if (key === "cs") nav("/my/inquiry");

    if (key === "logout") {
      const ok = await showConfirm("로그아웃할까요?");
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
      showAlert("로그인이 필요합니다.");
      return;
    }
    if (!hasTeam || !teamId) {
      showAlert("팀 정보가 없습니다.");
      return;
    }
    // 팀장이라도 혼자인 팀이면 탈퇴(해체) 허용. 팀원이 더 있으면 이임 후 가능.
    if (isTeamLeader && !soloOwner) {
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
      if (soloOwner) {
        // 혼자인 팀장: 탈퇴 = 팀 해체(팀/멤버/연결 정리)
        await deleteClubAndCleanup({ clubId: teamId, uid });
      } else {
        await leaveClub({ clubId: teamId, uid });
      }
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

  // =========================
  // ✅ 팀장 권한 이임 (팀장만)
  // =========================
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferDoneOpen, setTransferDoneOpen] = useState(false);

  const [transferMembers, setTransferMembers] = useState([]);
  const [selectedTargetUid, setSelectedTargetUid] = useState("");
  const [transferErr, setTransferErr] = useState("");

  const openTransferLeader = async () => {
    if (!uid) {
      showAlert("로그인이 필요합니다.");
      return;
    }
    if (!hasTeam || !teamId) {
      showAlert("팀 정보가 없습니다.");
      return;
    }
    if (!isTeamLeader) {
      showAlert("팀장만 권한을 이임할 수 있어요.");
      return;
    }

    setTransferErr("");
    setSelectedTargetUid("");
    setTransferMembers([]);
    setTransferOpen(true);

    setTransferLoading(true);
    try {
      const list = await listClubMembersForLeaderTransfer({ clubId: teamId, excludeUid: uid });
      setTransferMembers(Array.isArray(list) ? list : []);
    } catch (e) {
      setTransferMembers([]);
      setTransferErr(String(e?.message || "팀원 목록을 불러올 수 없습니다."));
    } finally {
      setTransferLoading(false);
    }
  };

  const closeTransferLeader = () => {
    if (transferBusy) return;
    setTransferOpen(false);
    setTransferErr("");
    setSelectedTargetUid("");
    setTransferMembers([]);
  };

  const runTransferLeader = async () => {
    if (!uid || !teamId) return;
    if (!selectedTargetUid) {
      showAlert("이임할 팀원을 선택해 주세요.");
      return;
    }

    const ok = await showConfirm("팀장 권한을 이임할까요? 이 작업은 되돌릴 수 없습니다.");
    if (!ok) return;

    setTransferBusy(true);
    setTransferErr("");
    try {
      await transferTeamLeader({
        clubId: teamId,
        fromUid: uid,
        toUid: selectedTargetUid,
      });

      setTransferOpen(false);
      setTransferDoneOpen(true);
    } catch (e) {
      setTransferErr(String(e?.message || "팀장 권한 이임에 실패했습니다."));
    } finally {
      setTransferBusy(false);
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
            : soloOwner
            ? `혼자 있는 팀이라 탈퇴하면\n"${teamName}" 팀이 해체(삭제)됩니다.\n계속할까요?`
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
        onPrimary={() => {
          setLeaveDoneOpen(false);
          nav("/my", { replace: true });
        }}
        secondaryText="닫기"
        onClose={() => {
          setLeaveDoneOpen(false);
          nav("/my", { replace: true });
        }}
        hideSecondary={true}
        showClose={true}
        closeOnOverlay={false}
      />

      {/* ✅ 팀장 권한 이임 완료 */}
      <InfoDialog
        open={transferDoneOpen}
        tone="success"
        title="팀장 권한이 이임됐어요"
        message={"새 팀장이 지정되었습니다.\n화면이 새로고침됩니다."}
        primaryText="확인"
        onPrimary={() => {
          setTransferDoneOpen(false);
          nav("/my", { replace: true });
          try {
            window.location.reload();
          } catch {}
        }}
        secondaryText="닫기"
        onClose={() => {
          setTransferDoneOpen(false);
          nav("/my", { replace: true });
          try {
            window.location.reload();
          } catch {}
        }}
        hideSecondary={true}
        showClose={true}
        closeOnOverlay={false}
      />

      {/* ✅ 팀장 이임 모달 */}
      {transferOpen && (
        <ModalOverlay onClick={closeTransferLeader}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTopRow>
              <ModalTitle>팀장 권한 이임</ModalTitle>
              <ModalCloseBtn type="button" onClick={closeTransferLeader} disabled={transferBusy}>
                ×
              </ModalCloseBtn>
            </ModalTopRow>

            <ModalSub>
              팀장 권한을 넘길 팀원을 선택해 주세요.
            </ModalSub>

            {transferLoading ? (
              <ModalCenter>
                <Spinner fullscreen={false} />
                <ModalHint>불러오는 중…</ModalHint>
              </ModalCenter>
            ) : transferMembers.length === 0 ? (
              <ModalCenter>
                <ModalHint>
                  {transferErr ? transferErr : "이임 가능한 팀원이 없습니다."}
                </ModalHint>
              </ModalCenter>
            ) : (
              <MemberList>
                {transferMembers.map((m) => {
                  const mid = String(m?.uid || m?.id || "").trim();
                  const name = String(m?.nickname || "").trim() || "(닉네임 없음)";
                  const avatar = String(m?.avatarUrl || "").trim();
                  const selected = mid && mid === selectedTargetUid;

                  return (
                    <MemberRow
                      key={mid || name}
                      type="button"
                      $selected={selected}
                      onClick={() => setSelectedTargetUid(mid)}
                      disabled={transferBusy}
                    >
                      <MemberLeft>
                        <MemberAvatarWrap>
                          {avatar ? <MemberAvatar src={avatar} alt={name} /> : <AvatarPlaceholder size={34} />}
                        </MemberAvatarWrap>
                        <MemberText>
                          <MemberName>{name}</MemberName>
                          {m?.region ? <MemberMeta>{String(m.region)}</MemberMeta> : null}
                        </MemberText>
                      </MemberLeft>

                      <MemberRadio $selected={selected}>{selected ? "✓" : ""}</MemberRadio>
                    </MemberRow>
                  );
                })}
              </MemberList>
            )}

            {transferErr ? <ModalError>{transferErr}</ModalError> : null}

            <ModalActions>
              <ModalGhostBtn type="button" onClick={closeTransferLeader} disabled={transferBusy}>
                취소
              </ModalGhostBtn>
              <ModalPrimaryBtn
                type="button"
                onClick={runTransferLeader}
                disabled={transferBusy || transferLoading || !selectedTargetUid}
              >
                {transferBusy ? "처리 중..." : "이임하기"}
              </ModalPrimaryBtn>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {transferBusy && (
        <BusyOverlay>
          <BusyCard>
            <Spinner />
            <BusyText>팀장 권한 이임 중…</BusyText>
          </BusyCard>
        </BusyOverlay>
      )}

      <PageWrap>
        <ProfileHeader>
          <ProfileHeaderInner
            role="button"
            tabIndex={0}
            onClick={handleGoEditProfile}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleGoEditProfile();
              }
            }}
          >
            <ProfileLeft>
              <AvatarWrap>
                {avatarSrc ? (
                  <Avatar src={avatarSrc} alt={nickname || "profile"} />
                ) : (
                  <AvatarPlaceholder size={68} />
                )}
              </AvatarWrap>

              <ProfileInfo>
                <NameRow>
                  <Name>{loading ? "불러오는 중..." : nickname ? nickname : "닉네임 미설정"}</Name>
                  <HeaderWave src={images.emoji3dWave} alt="" />
                  {isTeamLeader ? <OwnerPill>팀장</OwnerPill> : null}
                </NameRow>

                <MetaRow>
                  <MetaItem>{myRegion}</MetaItem>
                  <MetaDot>·</MetaDot>
                  <MetaItem>{teamName}</MetaItem>
                </MetaRow>
              </ProfileInfo>
            </ProfileLeft>

            <EditChevron aria-hidden>›</EditChevron>
          </ProfileHeaderInner>
        </ProfileHeader>

        <Section>
          <SectionInner>
            <SectionIcon src={images.emoji3dPeople} alt="" $nudgeUp={4} />
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

   
              {hasTeam && isTeamLeader ? (
                <MenuItemButton onClick={() => handleTeamMenuClick("invite")}>
                  <MenuTextWrap>
                    <MenuTitle>팀원 초대</MenuTitle>
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

              <MenuItemButton onClick={() => handleMainMenuClick("team-join")}>
                <MenuTextWrap>
                  <MenuTitle>팀 가입 신청</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              {/* ✅ 팀장만: 팀장 권한 이임 */}
              {hasTeam && isTeamLeader ? (
                <MenuItemButton onClick={() => handleTeamMenuClick("transfer-leader")}>
                  <MenuTextWrap>
                    <MenuTitle>팀장 권한 이임</MenuTitle>
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
            <SectionIcon src={images.emoji3dIdCard} alt="" $nudgeUp={4} />
            <SectionTitle>내 정보</SectionTitle>
          </SectionInner>
          <SectionBody>
            <MenuList>
              <MenuItemButton onClick={handleInviteFriends}>
                <MenuTextWrap>
                  <MenuTitle>친구 초대하고 같이 뛰기 🏀</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleMainMenuClick("reservations")}>
                <MenuTextWrap>
                  <MenuTitle>내 구장 예약</MenuTitle>
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

              <MenuItemButton onClick={() => handleMainMenuClick("my-reports")}>
                <MenuTextWrap>
                  <MenuTitle>내가 신고한 내역</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>
            </MenuList>
          </SectionBody>
        </Section>

        <Section>
          <SectionInner>
            <SectionIcon src={images.emoji3dGear} alt="" />
            <SectionTitle>계정 · 앱 설정</SectionTitle>
          </SectionInner>
          <SectionBody>
            <MenuList>
              <MenuItemButton onClick={toggleThemeMode}>
                <MenuTextWrap>
                  <MenuTitle>화면 모드</MenuTitle>
                </MenuTextWrap>
                <ThemeModeText>
                  {themeMode === "dark" ? "다크" : "라이트"}
                </ThemeModeText>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("alarm")}>
                <MenuTextWrap>
                  <MenuTitle>알림 설정</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("notice")}>
                <MenuTextWrap>
                  <MenuTitle>공지사항</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("faq")}>
                <MenuTextWrap>
                  <MenuTitle>FAQ</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("cs")}>
                <MenuTextWrap>
                  <MenuTitle>1:1 문의</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("reportBlock")}>
                <MenuTextWrap>
                  <MenuTitle>차단 관리</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>
            </MenuList>
          </SectionBody>
        </Section>

        <Section>
          <SectionInner>
            <SectionIcon src={images.emoji3dShield} alt="" />
            <SectionTitle>약관 · 계정 관리</SectionTitle>
          </SectionInner>
          <SectionBody>
            <MenuList>
              <MenuItemButton onClick={() => handleSettingMenuClick("privacy")}>
                <MenuTextWrap>
                  <MenuTitle>개인정보처리방침</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("terms")}>
                <MenuTextWrap>
                  <MenuTitle>이용약관</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("operation")}>
                <MenuTextWrap>
                  <MenuTitle>운영정책</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("logout")}>
                <MenuTextWrap>
                  <MenuTitle>로그아웃</MenuTitle>
                </MenuTextWrap>
                <MenuArrow>›</MenuArrow>
              </MenuItemButton>

              <MenuItemButton onClick={() => handleSettingMenuClick("withdraw")}>
                <MenuTextWrap>
                  <MenuTitle>회원탈퇴</MenuTitle>
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
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.18)"};
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
`;

const BusyCard = styled.div`
  width: min(420px, 90vw);
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 22px 18px;
  display: grid;
  place-items: center;
  gap: 10px;
`;

const BusyText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ===== 팀장 이임 모달 ===== */
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99998;
  display: grid;
  place-items: center;
  padding: 16px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.35)"};
`;

const ModalCard = styled.div`
  width: min(520px, 92vw);
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px 14px 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ModalTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ModalCloseBtn = styled.button`
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ModalSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.45;
`;

const ModalCenter = styled.div`
  padding: 14px 0;
  display: grid;
  place-items: center;
  gap: 8px;
`;

const ModalHint = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ModalError = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.danger};
`;

const MemberList = styled.div`
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MemberRow = styled.button`
  width: 100%;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.border};
  background: ${({ $selected, theme }) =>
    $selected
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "#eef2ff"
      : theme.colors.card};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const MemberLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const MemberAvatarWrap = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  flex-shrink: 0;
  display: grid;
  place-items: center;
`;

const MemberAvatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const MemberText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MemberName = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MemberMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MemberRadio = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.border};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary : theme.colors.card};
  color: #ffffff;
  font-size: 11px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
`;

const ModalActions = styled.div`
  margin-top: 6px;
  display: flex;
  gap: 8px;
`;

const ModalGhostBtn = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ModalPrimaryBtn = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

/* ==================== 기존 styled (원본 유지) ==================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  padding: 12px 12px
    calc(${({ theme }) => theme.layout.bottomTabHeight}px + 24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
`;

const ProfileHeader = styled.div`
  padding: 2px 0 0;
`;

const ProfileHeaderInner = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 16px 16px;
  cursor: pointer;
  transition: transform 0.06s ease, background 0.15s ease;

  &:active {
    transform: scale(0.994);
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  }
`;

const ProfileLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
`;

const AvatarWrap = styled.div`
  width: 68px;
  height: 68px;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  background: ${({ theme }) => theme.colors.border};
`;

/* 프로필 헤더 인사 3D (손 흔들기) */
const HeaderWave = styled.img`
  width: 26px;
  height: 26px;
  object-fit: contain;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
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
  background: ${({ theme }) => theme.colors.primary};
  font-size: 12px;
  font-weight: 800;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MetaItem = styled.span``;
const MetaDot = styled.span``;

/* 카드가 클릭 가능함을 알리는 화살표 */
const EditChevron = styled.span`
  flex-shrink: 0;
  font-size: 24px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SetupOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.07)"};
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  padding: 18px;
`;

const SetupCard = styled.button`
  width: min(560px, 94vw);
  border: none;
  cursor: pointer;
  border-radius: 8px;
  padding: 28px 22px 22px;
  display: grid;
  place-items: center;
  gap: 12px;
  text-align: center;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
`;

const SetupPill = styled.div`
  display: inline-flex;
  justify-self: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "rgba(79, 70, 229, 0.14)"};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 14px;
  font-weight: 800;
`;

const SetupSub = styled.div`
  font-size: 15px;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const SetupCta = styled.div`
  justify-self: center;
  margin-top: 6px;
  padding: 12px 18px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
`;

const Section = styled.section`
  margin-top: 14px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
`;

const SectionInner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px 8px;
`;

/* 섹션 헤더 3D 아이콘 */
/* $nudgeUp: 그림이 PNG 내부에서 아래로 쏠린 이모지(people·idcard)를 위로 올려
   텍스트와 시각 중심을 맞추기 위한 광학 보정(px). gear는 정중앙이라 보정 없음. */
const SectionIcon = styled.img`
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.16));
  ${({ $nudgeUp }) => ($nudgeUp ? `transform: translateY(-${$nudgeUp}px);` : "")}
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionBody = styled.div`
  display: flex;
  padding: 0 14px 4px;
`;

const MenuList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const MenuItemButton = styled.button`
  width: 100%;
  border: none;
  padding: 13px 4px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};

  &:last-child {
    border-bottom: none;
  }
  &:active {
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)"};
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
  background: ${({ theme }) => theme.colors.danger};
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
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ThemeModeText = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-right: 8px;
`;
