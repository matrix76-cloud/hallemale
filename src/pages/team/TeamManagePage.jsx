// src/pages/team/TeamManagePage.jsx
/* eslint-disable */
// ✅ 팀 로고 변경 추가
// - 로고 위 카메라 아이콘 클릭 → 파일 선택
// - 선택 즉시 업로드(압축→Storage) 후 미리보기 반영(pendingLogo)
// - 상단 저장 버튼 누르면 clubs.logoUrl/logoPath 업데이트 반영
// - 저장 성공 후 refreshClub()로 최신 로고 확정

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { FiSearch, FiX, FiChevronRight } from "react-icons/fi";
import { FiCamera } from "react-icons/fi";

import { useAuth } from "../../hooks/useAuth";
import {
  getClubManageView,
  updateClubIntroPromo,
  updateClubMedia,
  searchUsersByNickname,
  createClubInvite,
  updateClubLogo, // ✅ 추가
} from "../../services/clubManageService";

import {
  uploadCompressedImageMedia,
  createYoutubeMediaItem,
  deleteMediaItem,
} from "../../services/mediaService";

import Spinner from "../../components/common/Spinner";
import { listClubInvites } from "../../services/clubManageService";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";

/* ====================== Render ====================== */

export default function TeamManagePage() {
  const nav = useNavigate();
  const { clubId } = useParams();
  const { userDoc, loading: authLoading } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  const [tab, setTab] = useState("intro"); // intro | members | media

  // 소개/홍보
  const [description, setDescription] = useState("");
  const [usePromoText, setUsePromoText] = useState(false);
  const [promoText, setPromoText] = useState("");
  const [savingIntro, setSavingIntro] = useState(false);

  // ✅ 로고 변경(업로드 결과를 저장 버튼에서 반영)
  const [logoBusy, setLogoBusy] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null); // { logoUrl, logoPath }
  const logoFileRef = useRef(null);

  // 멤버 초대
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchKey, setSearchKey] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState([]);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  // 미디어
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaFileRef = useRef(null);

  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytCaption, setYtCaption] = useState("");
  const [ytError, setYtError] = useState("");

  const [capOpen, setCapOpen] = useState(false);
  const [capText, setCapText] = useState("");
  const [capTargetId, setCapTargetId] = useState("");

  const [pendingInvites, setPendingInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const teamName = club?.name || "-";
  const teamRegion = club?.region || "-";

  // ✅ 로고는 pendingLogo가 있으면 그걸 우선 미리보기로 사용
  const logoUrl = (pendingLogo?.logoUrl || club?.logoUrl || "").trim();


  const [deleteBusy, setDeleteBusy] = useState(false);

  const onDeleteTeam = async () => {
    if (deleteBusy) return;
    if (!clubId) return;

    const ok1 = window.confirm("팀을 삭제할까요? 삭제 후 복구할 수 없습니다.");
    if (!ok1) return;

    const ok2 = window.confirm("정말 삭제합니다. 팀 멤버들의 팀 연결(activeTeamId/clubId)이 해제됩니다.");
    if (!ok2) return;

    try {
      setDeleteBusy(true);
      await deleteClubAndCleanup({ clubId, uid });
      window.alert("팀이 삭제되었습니다.");
      nav("/my", { replace: true });
    } catch (e) {
      window.alert(e?.message || "팀 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const refreshPendingInvites = async () => {
    if (!clubId) return;
    setInvitesLoading(true);
    try {
      const rows = await listClubInvites({ clubId, status: "pending", limitCount: 30 });
      setPendingInvites(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn("[TeamManage] list invites failed:", e?.message || e);
      setPendingInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!clubId) return;
    if (tab !== "members") return;
    refreshPendingInvites();
  }, [loading, clubId, tab]);

  useEffect(() => {
    if (authLoading) return;
    if (!clubId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const view = await getClubManageView({ clubId, uid });
        if (!alive) return;

        setClub(view.club);
        setIsOwner(!!view.isOwner);

        setDescription(String(view.club?.description || ""));
        setUsePromoText(!!view.club?.promo?.usePromoText);
        setPromoText(String(view.club?.promo?.promoText || ""));

        setMediaItems(Array.isArray(view.club?.media) ? view.club.media : []);

        // ✅ 로딩 시 pendingLogo는 비움(저장 전 임시값 방지)
        setPendingLogo(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, clubId, uid]);

  const guardBlocked = !loading && !isOwner;

  const refreshClub = async () => {
    const c = await getClubManageView({ clubId, uid });
    setClub(c.club);
    setIsOwner(!!c.isOwner);
    setMediaItems(Array.isArray(c.club?.media) ? c.club.media : []);
    setPendingLogo(null);
  };

  /* ======================
   * ✅ 로고 업로드
   * ====================== */

  const onClickChangeLogo = () => {
    if (logoBusy) return;
    logoFileRef.current?.click();
  };

  const pickLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLogoBusy(true);
    try {
      // ✅ 업로드(압축→Storage) — scope=clubs, ownerId=clubId
      const uploaded = await uploadCompressedImageMedia({
        scope: "clubs",
        ownerId: clubId,
        file,
        kind: "logo",
      });

      // uploaded: { url, storagePath, id, ... }
      const next = {
        logoUrl: uploaded?.url || "",
        logoPath: uploaded?.storagePath || "",
      };

      if (!next.logoUrl || !next.logoPath) {
        throw new Error("로고 업로드 결과가 올바르지 않습니다.");
      }

      setPendingLogo(next);
      window.alert("로고가 업로드되었습니다. 저장을 누르면 반영됩니다.");
    } catch (e2) {
      console.warn("[TeamManage] logo upload failed:", e2?.message || e2);
      window.alert("로고 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setPendingLogo(null);
    } finally {
      setLogoBusy(false);
    }
  };

  /* ======================
   * 소개/홍보 저장 (로고도 같이 저장)
   * ====================== */

  const onSaveIntro = async () => {
    if (savingIntro) return;
    setSavingIntro(true);

    try {
      // 1) 소개/홍보 저장
      await updateClubIntroPromo({
        clubId,
        description: String(description || "").trim(),
        promo: {
          usePromoText,
          promoText: String(promoText || "").trim(),
        },
      });

      // 2) ✅ 로고 변경이 있다면 같이 반영
      if (pendingLogo?.logoUrl && pendingLogo?.logoPath) {
        await updateClubLogo({
          clubId,
          logoUrl: pendingLogo.logoUrl,
          logoPath: pendingLogo.logoPath,
        });
      }

      await refreshClub();
      window.alert("저장되었습니다.");
    } catch (e) {
      console.warn("[TeamManage] save intro/logo failed:", e?.message || e);
      window.alert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingIntro(false);
    }
  };

  /* ======================
   * 멤버 초대/미디어 등 (기존 그대로)
   * ====================== */

  const openInvite = async () => {
    setInviteOpen(true);
    setSearchKey("");
    setSearchResult([]);
    setInviteTarget(null);
    setSelectedUserId("");
    setInviteMsg("");

    setSearching(true);
    try {
      const list = await searchUsersByNickname({ keyword: "", excludeUid: uid, max: 20 });
      setSearchResult(list);
    } finally {
      setSearching(false);
    }
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setSearchKey("");
    setSearchResult([]);
    setInviteTarget(null);
    setSelectedUserId("");
    setInviteMsg("");
  };

  const doSearch = async () => {
    const k = String(searchKey || "").trim();
    setSearching(true);
    try {
      const list = await searchUsersByNickname({ keyword: k, excludeUid: uid, max: 20 });
      setSearchResult(list);
    } catch (e) {
      console.warn("[TeamManage] search failed:", e?.message || e);
      window.alert("검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const goInviteMessageStep = () => {
    if (!selectedUserId) {
      window.alert("초대할 선수를 선택해 주세요.");
      return;
    }
    const u = (searchResult || []).find((x) => x?.uid === selectedUserId) || null;
    if (!u) {
      window.alert("선수 정보를 찾을 수 없습니다.");
      return;
    }
    setInviteTarget(u);
    setInviteMsg(`${teamName} 팀에서 초대합니다. 함께 뛰어요!`);
  };

  const sendInvite = async () => {
    if (!inviteTarget?.uid) return;
    if (inviting) return;

    setInviting(true);
    try {
      const res = await createClubInvite({
        clubId,
        fromUid: uid,
        toUid: inviteTarget.uid,
        message: inviteMsg,
        toSnapshot: {
          nickname: inviteTarget.nickname || "",
          avatarUrl: inviteTarget.avatarUrl || "",
          region: inviteTarget.region || "",
        },
      });

      await refreshPendingInvites();

      console.groupCollapsed("[Invite] created");
      console.log("clubId:", clubId);
      console.log("fromUid:", uid);
      console.log("toUid:", inviteTarget.uid);
      console.log("inviteId:", res?.inviteId || "");
      console.log("path:", `clubs/${clubId}/invites/${res?.inviteId || ""}`);
      console.groupEnd();

      window.alert("초대를 보냈습니다.");
      closeInvite();
    } catch (e) {
      console.warn("[TeamManage] invite failed:", e?.message || e);
      window.alert("초대 전송에 실패했습니다.");
    } finally {
      setInviting(false);
    }
  };

  const getYoutubeThumb = (youtubeId) => {
    if (!youtubeId) return "";
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  };

  const syncClubMedia = async (next) => {
    setMediaItems(next);
    await updateClubMedia({ clubId, media: next });
  };

  const openAddPicker = () => setAddPickerOpen(true);
  const closeAddPicker = () => setAddPickerOpen(false);

  const openYoutubeModal = () => {
    setYtUrl("");
    setYtCaption("");
    setYtError("");
    setYtOpen(true);
  };

  const closeYoutubeModal = () => setYtOpen(false);

  const openCaptionModalFor = (id) => {
    setCapTargetId(id || "");
    setCapText("");
    setCapOpen(true);
  };

  const closeCaptionModal = () => {
    setCapOpen(false);
    setCapTargetId("");
    setCapText("");
  };

  const onAddMediaClick = () => {
    if (mediaBusy) return;
    if ((mediaItems?.length || 0) >= 10) {
      window.alert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
      return;
    }
    openAddPicker();
  };

  const choosePhoto = () => {
    closeAddPicker();
    mediaFileRef.current?.click();
  };

  const chooseYoutube = () => {
    closeAddPicker();
    openYoutubeModal();
  };

  const submitYoutube = async () => {
    const url = String(ytUrl || "").trim();
    if (!url) return;

    try {
      const base = createYoutubeMediaItem(url);
      const item = { ...base, caption: String(ytCaption || "").trim() };

      const next = [...(mediaItems || []), item];
      await syncClubMedia(next);
      closeYoutubeModal();
    } catch (e) {
      setYtError(e?.message || "유튜브 링크를 확인해 주세요.");
    }
  };

  const saveCaption = async () => {
    const id = capTargetId;
    if (!id) return;

    const next = (mediaItems || []).map((m) => {
      if (m.id !== id) return m;
      return { ...m, caption: String(capText || "").trim() };
    });

    await syncClubMedia(next);
    closeCaptionModal();
  };

  const pickMediaFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if ((mediaItems?.length || 0) >= 10) {
      window.alert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
      return;
    }

    setMediaBusy(true);
    try {
      const uploaded = await uploadCompressedImageMedia({
        scope: "clubs",
        ownerId: clubId,
        file,
        kind: "highlight",
      });

      const itemWithCaption = { ...uploaded, caption: "" };
      const next = [...(mediaItems || []), itemWithCaption];

      await syncClubMedia(next);
      openCaptionModalFor(itemWithCaption.id);
    } catch (e2) {
      console.warn("[TeamManage] media upload failed:", e2?.message || e2);
      window.alert("사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  const removeMedia = async (item) => {
    if (!item?.id) return;
    if (mediaBusy) return;

    const ok = window.confirm("삭제할까요?");
    if (!ok) return;

    setMediaBusy(true);
    try {
      await deleteMediaItem({ item });
      const next = (mediaItems || []).filter((x) => x.id !== item.id);
      await syncClubMedia(next);
    } catch (e) {
      console.warn("[TeamManage] media delete failed:", e?.message || e);
      window.alert("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  if (!clubId) {
    return (
      <Shell>
        <TopHint>팀 정보를 불러올 수 없습니다.</TopHint>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <SpinnerWrap>
          <Spinner size="lg" />
        </SpinnerWrap>
      </Shell>
    );
  }

  if (guardBlocked) {
    return (
      <Shell>
        <TopHint>
          클럽장만 팀 관리를 할 수 있어요.
          <br />
          팀 관리가 필요하면 클럽장에게 요청해 주세요.
        </TopHint>
      </Shell>
    );
  }

  return (
    <Shell>
      <TeamRow>
        <TeamLogo>
          {logoUrl ? <TeamLogoImg src={logoUrl} alt="logo" /> : <TeamLogoFallback />}

          {/* ✅ 카메라 오버레이 */}
          <LogoCameraBtn type="button" onClick={onClickChangeLogo} disabled={logoBusy}>
            <FiCamera size={16} />
          </LogoCameraBtn>
        </TeamLogo>

        <TeamInfo>
          <TeamNameText>{teamName}</TeamNameText>
          <TeamMetaText>{teamRegion}</TeamMetaText>
          <TeamMetaSubText>팀 이름/지역은 변경할 수 없어요. 로고는 변경 가능해요.</TeamMetaSubText>
        </TeamInfo>
      </TeamRow>

      {/* ✅ 로고 파일 input */}
      <input
        ref={logoFileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={pickLogoFile}
      />

      <TabsRow>
        <TabBtn type="button" $active={tab === "intro"} onClick={() => setTab("intro")}>
          소개/홍보
        </TabBtn>
        <TabBtn type="button" $active={tab === "members"} onClick={() => setTab("members")}>
          팀 멤버
        </TabBtn>
        <TabBtn type="button" $active={tab === "media"} onClick={() => setTab("media")}>
          사진/영상
        </TabBtn>
      </TabsRow>

      <Divider />

      {tab === "intro" ? (
        <Section>
          <Field>
            <Label>팀 소개</Label>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예) 전술 맞춰서 뛰는 팀으로 주말 위주 친선 경기와 리그 참여를 목표로 합니다."
            />
          </Field>

          <Field>
            <LabelRow2>
              <Label>홍보 문구</Label>
              <CheckRow>
                <CheckBox
                  type="checkbox"
                  checked={usePromoText}
                  onChange={(e) => setUsePromoText(e.target.checked)}
                />
                <CheckText>사용</CheckText>
              </CheckRow>
            </LabelRow2>

            <TextArea
              value={promoText}
              onChange={(e) => setPromoText(e.target.value)}
              placeholder="예) 수비부터 맞추고 조직적으로 움직이는 팀입니다..."
              disabled={!usePromoText}
              style={{ opacity: usePromoText ? 1 : 0.6 }}
            />
          </Field>

          <BtnRow>
            <BtnGhost type="button" onClick={() => nav(`/team/${clubId}`)}>
              팀 프로필 보기
            </BtnGhost>
            <BtnPrimary type="button" onClick={onSaveIntro} disabled={savingIntro || logoBusy}>
              {savingIntro ? "저장 중..." : logoBusy ? "로고 처리중..." : "저장"}
            </BtnPrimary>
          </BtnRow>
        </Section>
      ) : null}

      {tab === "members" ? (
        <Section>
          <HintText>
            팀 멤버 관리는 초대로 진행해요.
          </HintText>

          <LineButton type="button" onClick={openInvite}>
            <LineLeft>
              <LineTitle>선수 검색해서 초대</LineTitle>
              <LineSub>닉네임으로 검색 후 초대 메시지를 보낼 수 있어요.</LineSub>
            </LineLeft>
            <LineRight>
              <FiChevronRight size={18} />
            </LineRight>
          </LineButton>
          <Divider />

          <InviteSectionTitle>보낸 초대 (대기중)</InviteSectionTitle>

          {invitesLoading ? (
            <InviteEmpty>불러오는 중...</InviteEmpty>
          ) : pendingInvites.length === 0 ? (
            <InviteEmpty>아직 보낸 초대가 없습니다.</InviteEmpty>
          ) : (
            <InviteList>
              {pendingInvites.map((inv) => {
                const snap = inv?.toSnapshot || {};
                return (
                  <InviteRow key={inv.inviteId || inv.id}>
                    <InviteLeft>
                      <InviteAvatarWrap>
                        {snap.avatarUrl ? (
                          <InviteAvatar src={snap.avatarUrl} alt={snap.nickname || "avatar"} />
                        ) : (
                          <AvatarPlaceholder size={34} />
                        )}
                      </InviteAvatarWrap>

                      <InviteText>
                        <InviteName>{snap.nickname || "(닉네임 없음)"}</InviteName>
                        <InviteMeta>{(snap.region || "").trim() || "지역 미지정"}</InviteMeta>
                        {inv.message ? <InviteMsgLine>{String(inv.message).slice(0, 40)}</InviteMsgLine> : null}
                      </InviteText>
                    </InviteLeft>

                    <InviteRight>
                      <InviteStatus>대기중</InviteStatus>
                    </InviteRight>
                  </InviteRow>
                );
              })}
            </InviteList>
          )}


 
        </Section>
      ) : null}

      {tab === "media" ? (
        <Section>
          <HintText>
            사진은 즉시 업로드, 동영상은 유튜브 링크로 추가해요.
          </HintText>

          <MediaGrid>
            {(mediaItems || []).map((m) => {
              const isYoutube = m.type === "youtube";
              const thumb = isYoutube ? getYoutubeThumb(m.youtubeId) : m.url;
              const caption = String(m.caption || "").trim();

              return (
                <MediaItem key={m.id}>
                  <MediaThumb
                    type="button"
                    onClick={() => window.open(m.url, "_blank")}
                    title="새 창에서 보기"
                  >
                    <MediaImg src={thumb || ""} alt="media" />
                    {isYoutube ? <MediaPlay>▶</MediaPlay> : null}
                    {caption ? <MediaCap>{caption}</MediaCap> : null}
                  </MediaThumb>

                  <MediaRemove type="button" onClick={() => removeMedia(m)} disabled={mediaBusy}>
                    ×
                  </MediaRemove>
                </MediaItem>
              );
            })}

            <MediaAdd type="button" onClick={onAddMediaClick} disabled={mediaBusy}>
              <MediaAddPlus>+</MediaAddPlus>
              <MediaAddLabel>{mediaBusy ? "처리 중..." : "추가"}</MediaAddLabel>
            </MediaAdd>
          </MediaGrid>

          <input
            ref={mediaFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={pickMediaFile}
          />
        </Section>
      ) : null}

      {/* ===== 초대 모달 ===== */}
      {inviteOpen ? (
        <ModalOverlay onClick={closeInvite}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>선수 초대</ModalTitle>
              <IconBtn type="button" onClick={closeInvite}>
                <FiX size={18} />
              </IconBtn>
            </ModalTop>

            {!inviteTarget ? (
              <>
              <ModalSub>닉네임으로 검색해 초대할 선수를 선택해 주세요.</ModalSub>

              <SearchRow>
                <SearchInput
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doSearch();
                  }}
                  placeholder="닉네임 검색 (예: 김민)"
                />
                <SearchBtn type="button" onClick={doSearch} disabled={searching}>
                  <FiSearch size={16} />
                </SearchBtn>
              </SearchRow>

              <ResultList>
                {searchResult.length === 0 ? (
                  <ResultEmpty>{searching ? "불러오는 중..." : "표시할 선수가 없습니다."}</ResultEmpty>
                ) : (
                  searchResult.map((u) => {
                    const checked = selectedUserId === u.uid;

                    return (
                      <PickRow
                        key={u.uid}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedUserId(u.uid)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedUserId(u.uid);
                        }}
                      >
                        <PickLeft>
                          <AvatarBtn
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              nav(`/player/${u.uid}`);
                            }}
                            aria-label="프로필 보기"
                            title="프로필 보기"
                          >
                            {u.avatarUrl ? (
                              <PickAvatar src={u.avatarUrl} alt={u.nickname || "avatar"} />
                            ) : (
                              <AvatarPlaceholder size={34} />
                            )}
                          </AvatarBtn>

                          <PickText>
                            <PickName>{u.nickname || "(닉네임 없음)"}</PickName>
                            <PickMeta>{(u.region || "").trim() || "지역 미지정"}</PickMeta>
                          </PickText>
                        </PickLeft>

                        <PickRight>
                          <RadioOuter aria-hidden="true">{checked ? <RadioInner /> : null}</RadioOuter>
                        </PickRight>
                      </PickRow>
                    );
                  })
                )}
              </ResultList>

              <BtnRow>
                <BtnGhost type="button" onClick={closeInvite}>
                  취소
                </BtnGhost>
                <BtnPrimary type="button" onClick={goInviteMessageStep} disabled={!selectedUserId}>
                  다음
                </BtnPrimary>
              </BtnRow>
              </>
            ) : (
              <>
                <ModalSub>
                  {inviteTarget?.nickname || "선수"} 님에게 보낼 초대 메시지를 작성해 주세요.
                </ModalSub>

                <InviteMsg
                  value={inviteMsg}
                  onChange={(e) => setInviteMsg(e.target.value)}
                  placeholder="초대 메시지"
                />

                <BtnRow>
                  <BtnGhost type="button" onClick={() => setInviteTarget(null)} disabled={inviting}>
                    뒤로
                  </BtnGhost>
                  <BtnPrimary type="button" onClick={sendInvite} disabled={inviting}>
                    {inviting ? "전송 중..." : "초대 보내기"}
                  </BtnPrimary>
                </BtnRow>
              </>
            )}
          </Modal>
        </ModalOverlay>
      ) : null}

      {/* ===== 추가 방식 선택 ===== */}
      {addPickerOpen ? (
        <ModalOverlay onClick={closeAddPicker}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>추가하기</ModalTitle>
              <IconBtn type="button" onClick={closeAddPicker}>
                <FiX size={18} />
              </IconBtn>
            </ModalTop>

            <ModalSub>추가할 항목을 선택해 주세요.</ModalSub>

            <ChoiceCol>
              <ChoiceCard type="button" onClick={choosePhoto} disabled={mediaBusy}>
                <ChoiceLeft>사진 추가</ChoiceLeft>
                <ChoiceRight>›</ChoiceRight>
              </ChoiceCard>
              <ChoiceCard type="button" onClick={chooseYoutube} disabled={mediaBusy}>
                <ChoiceLeft>유튜브 추가</ChoiceLeft>
                <ChoiceRight>›</ChoiceRight>
              </ChoiceCard>
            </ChoiceCol>
          </Modal>
        </ModalOverlay>
      ) : null}

      {/* ===== 유튜브 입력 ===== */}
      {ytOpen ? (
        <ModalOverlay onClick={closeYoutubeModal}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>유튜브 추가</ModalTitle>
              <IconBtn type="button" onClick={closeYoutubeModal}>
                <FiX size={18} />
              </IconBtn>
            </ModalTop>

            <ModalSub>유튜브 URL과 설명을 입력해 주세요.</ModalSub>

            <ModalInput
              value={ytUrl}
              onChange={(e) => {
                setYtUrl(e.target.value);
                setYtError("");
              }}
              placeholder="예) https://youtu.be/VIDEO_ID"
            />

            <ModalInput
              value={ytCaption}
              onChange={(e) => setYtCaption(e.target.value)}
              placeholder="설명 (예: 12/3 리그 경기 하이라이트)"
            />

            {ytError ? <ModalError>{ytError}</ModalError> : null}

            <BtnRow>
              <BtnGhost type="button" onClick={closeYoutubeModal}>
                취소
              </BtnGhost>
              <BtnPrimary type="button" onClick={submitYoutube} disabled={!ytUrl.trim()}>
                추가
              </BtnPrimary>
            </BtnRow>
          </Modal>
        </ModalOverlay>
      ) : null}

      {/* ===== 사진 캡션 ===== */}
      {capOpen ? (
        <ModalOverlay onClick={closeCaptionModal}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTop>
              <ModalTitle>설명 추가</ModalTitle>
              <IconBtn type="button" onClick={closeCaptionModal}>
                <FiX size={18} />
              </IconBtn>
            </ModalTop>

            <ModalSub>어떤 경기/장면인지 한 줄로 적어 주세요.</ModalSub>

            <ModalInput
              value={capText}
              onChange={(e) => setCapText(e.target.value)}
              placeholder="예) 한강 공원 3:3 경기"
            />

            <BtnRow>
              <BtnGhost type="button" onClick={closeCaptionModal}>
                건너뛰기
              </BtnGhost>
              <BtnPrimary type="button" onClick={saveCaption}>
                저장
              </BtnPrimary>
            </BtnRow>
          </Modal>
        </ModalOverlay>
      ) : null}

      <BottomDangerArea>
        <DangerButton type="button" onClick={onDeleteTeam} disabled={deleteBusy}>
          {deleteBusy ? "삭제 중..." : "팀삭제"}
        </DangerButton>
      </BottomDangerArea>
    </Shell>
  );
}

/* ====================== styles ====================== */

const Shell = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors?.bg || "#f3f4f6"};
  padding: 14px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const TopHint = styled.div`
  padding: 14px 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  border-radius: 12px;
  line-height: 1.6;
`;

const Divider = styled.div`
  height: 1px;
  background: #e5e7eb;
`;

const TeamRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const TeamLogo = styled.div`
  width: 54px;
  height: 54px;
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
  flex-shrink: 0;
  position: relative;
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamLogoFallback = styled.div`
  width: 100%;
  height: 100%;
`;

/* ✅ 카메라 버튼(오버레이) */
const LogoCameraBtn = styled.button`
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.7);
  color: #ffffff;
  display: grid;
  place-items: center;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TeamInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const TeamNameText = styled.div`
  font-size: 16px;
  color: #111827;
`;

const TeamMetaText = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const TeamMetaSubText = styled.div`
  font-size: 11px;
  color: #9ca3af;
`;

const TabsRow = styled.div`
  display: flex;
  gap: 8px;
`;

const TabBtn = styled.button`
  flex: 1;
  height: 30px;
  border-radius: 16px;
  border: 1px solid ${({ $active }) => ($active ? "#4f46e5" : "#e5e7eb")};
  background: ${({ $active }) => ($active ? "#eef2ff" : "#ffffff")};
  color: ${({ $active }) => ($active ? "#4f46e5" : "#111827")};
  font-size: 13px;
  cursor: pointer;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.div`
  font-size: 13px;
  color: #111827;
`;

const LabelRow2 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const TextArea = styled.textarea`
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  min-height: 110px;
  resize: none;
  background: #ffffff;

  &:focus {
    border-color: #4f46e5;
  }
`;

const CheckRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CheckBox = styled.input`
  width: 14px;
  height: 14px;
`;

const CheckText = styled.div`
  font-size: 12px;
  color: #4b5563;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 8px;
`;

const BtnGhost = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 13px;
  cursor: pointer;
`;

const BtnPrimary = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: none;
  background: #4f46e5;
  color: #ffffff;
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const SpinnerWrap = styled.div`
  padding: 28px 0;
  display: flex;
  justify-content: center;
`;


const HintText = styled.div`
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
`;

const LineButton = styled.button`
  width: 100%;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 12px;
  padding: 12px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const LineLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
`;

const LineTitle = styled.div`
  font-size: 14px;
  color: #111827;
`;

const LineSub = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const LineRight = styled.div`
  color: #9ca3af;
`;

/* media */

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`;

const MediaItem = styled.div`
  position: relative;
  height: 108px;
  border-radius: 12px;
  overflow: hidden;
  background: #e5e7eb;
`;

const MediaThumb = styled.button`
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
`;

const MediaImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const MediaPlay = styled.div`
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
`;

const MediaCap = styled.div`
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.55);
  color: #ffffff;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MediaRemove = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
`;

const MediaAdd = styled.button`
  height: 108px;
  border-radius: 12px;
  border: 1px dashed #d1d5db;
  background: #ffffff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
`;

const MediaAddPlus = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  display: grid;
  place-items: center;
  font-size: 22px;
`;

const MediaAddLabel = styled.div`
  font-size: 12px;
  color: #111827;
`;

/* modal */

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 16px;
`;

const Modal = styled.div`
  width: min(520px, 92vw);
  background: #ffffff;
  border-radius: 14px;
  padding: 14px 14px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ModalTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.div`
  font-size: 15px;
  color: #111827;
`;

const IconBtn = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
`;

const ModalSub = styled.div`
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
`;

const ModalInput = styled.input`
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  background: #ffffff;

  &:focus {
    border-color: #4f46e5;
  }
`;

const ModalError = styled.div`
  font-size: 12px;
  color: #ef4444;
`;

/* invite */

const SearchRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const SearchInput = styled(ModalInput)`
  flex: 1;
`;

const SearchBtn = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ResultList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
`;



const ResultEmpty = styled.div`
  font-size: 12px;
  color: #9ca3af;
  padding: 10px 4px;
  text-align: center;
`;

const ResultItem = styled.button`
  width: 100%;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const ResultLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;


const ResultAvatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const NameCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const ResultRight = styled.div`
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
`;



const ResultName = styled.div`
  font-size: 13px;
  color: #111827;
`;

const ResultMeta = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const InviteMsg = styled.textarea`
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  min-height: 90px;
  resize: none;
  background: #ffffff;

  &:focus {
    border-color: #4f46e5;
  }
`;

/* choice */

const ChoiceCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChoiceCard = styled.button`
  width: 100%;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 12px;
  padding: 12px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ChoiceLeft = styled.div`
  font-size: 13px;
  color: #111827;
`;

const ChoiceRight = styled.div`
  color: #9ca3af;
`;




const PickRow = styled.div`
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;

  &:hover {
    background: #f8fafc;
  }
`;

const PickLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const PickRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
`;

const PickText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PickName = styled.div`
  font-size: 13px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PickMeta = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const AvatarBtn = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  overflow: hidden;
  padding: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
`;

const PickAvatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const RadioOuter = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid #d1d5db;
  display: grid;
  place-items: center;
`;

const RadioInner = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #4f46e5;
`;

const InviteSectionTitle = styled.div`
  margin-top: 8px;
  font-size: 13px;
  color: #111827;
`;

const InviteEmpty = styled.div`
  font-size: 12px;
  color: #9ca3af;
  padding: 10px 2px;
`;

const InviteList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InviteRow = styled.div`
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const InviteLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const InviteAvatarWrap = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  flex-shrink: 0;
  display: grid;
  place-items: center;
`;

const InviteAvatar = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const InviteText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const InviteName = styled.div`
  font-size: 13px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InviteMeta = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const InviteMsgLine = styled.div`
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InviteRight = styled.div`
  flex-shrink: 0;
`;

const InviteStatus = styled.div`
  font-size: 11px;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.12);
  padding: 4px 8px;
  border-radius: 999px;
`;

// ✅ 4) styled-components 제일 아래에 추가
const BottomDangerArea = styled.div`
  margin-top: 18px;
`;

const DangerButton = styled.button`
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 14px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
    opacity: 0.95;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

