/* eslint-disable */
// src/pages/team/TeamManagePage.jsx
// ✅ 팀명/팀로고 탭 추가 + 소개/홍보 탭도 실시간 저장(디바운스)
// - 페이지에서 DB 직접 접근 금지(서비스만 호출)
// - 소개/홍보: description / promo / activity 변경 시 자동 저장
// - 저장 버튼 제거, 상태 텍스트로만 표시

import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { FiSearch, FiX, FiChevronRight, FiUserX } from "react-icons/fi";
import { FiCamera } from "react-icons/fi";

import { useAuth } from "../../hooks/useAuth";
import {
  getClubManageView,
  updateClubIntroPromo,
  updateClubMedia,
  searchUsersByNickname,
  createClubInvite,
  updateClubLogo,
  updateClubActivity,
  listClubInvites,
  deleteClubAndCleanup,
  updateClubName,
  listClubMembers,
  forceRemoveClubMember,
  updateClubRegion,
  subscribeClubMembers,
  subscribeClubInvites,
} from "../../services/clubManageService";
import { isClubNameTaken } from "../../services/teamService";
import { getNameChangeStatus } from "../../utils/nameChange";
import { TEAM_TAG_PRESETS } from "../../utils/constants";

import {
  uploadCompressedImageMedia,
  createYoutubeMediaItem,
  deleteMediaItem,
} from "../../services/mediaService";

import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import RegionPickerSheet from "../../components/common/RegionPickerSheet";
import EmptyState from "../../components/common/EmptyState";

/* ====================== Render ====================== */

export default function TeamManagePage() {
  const nav = useNavigate();
  const { clubId } = useParams();
  const { userDoc, loading: authLoading } = useAuth();

  const uid = userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  const [tab, setTab] = useState("profile"); // profile | intro | members | media

  // 소개/홍보
  const [description, setDescription] = useState("");
  const [usePromoText, setUsePromoText] = useState(false);
  const [promoText, setPromoText] = useState("");
  const [tags, setTags] = useState([]); // 팀 태그 (생성 시 입력 → 관리에서 수정)

  // ✅ 활동 요일/시간 (팀 활동 패턴)
  const [activityDays, setActivityDays] = useState("ANY"); // WEEKDAY | WEEKEND | ANY
  const [activityTime, setActivityTime] = useState("ANY"); // MORNING | AFTERNOON | EVENING | NIGHT | ANY

  // ✅ 소개/홍보 자동저장 상태
  const [introSaveState, setIntroSaveState] = useState("idle"); // idle | saving | saved | error
  const [introSaveMsg, setIntroSaveMsg] = useState("");

  // ✅ 팀명/로고 탭용 상태
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaveState, setNameSaveState] = useState("idle"); // idle | saving | saved | error
  const [nameSaveMsg, setNameSaveMsg] = useState("");
  // 팀명 중복 확인 상태: "idle" | "checking" | "available" | "taken" | "error"
  const [nameCheckStatus, setNameCheckStatus] = useState("idle");

  // ✅ 로고 변경(업로드 결과를 저장 버튼에서 반영) → 저장 버튼 제거: 업로드 후 자동 저장(디바운스)
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoSaveState, setLogoSaveState] = useState("idle"); // idle | saving | saved | error
  const [logoSaveMsg, setLogoSaveMsg] = useState("");
  const [pendingLogo, setPendingLogo] = useState(null); // { logoUrl, logoPath }
  const logoFileRef = useRef(null);


  // ✅ 팀 지역 변경(시도/구 2단계)
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSidoDraft, setRegionSidoDraft] = useState("");
  const [regionGuDraft, setRegionGuDraft] = useState("");
  const [regionSaveState, setRegionSaveState] = useState("idle"); // idle | saving | saved | error
  const [regionSaveMsg, setRegionSaveMsg] = useState("");


  // 멤버 초대
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchKey, setSearchKey] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState([]);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");


  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [kickBusyUid, setKickBusyUid] = useState(""); // 강제탈퇴 진행중 uid


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

  const [deleteBusy, setDeleteBusy] = useState(false);

  const teamName = club?.name || "-";
  const teamRegion =
  (regionSidoDraft && regionGuDraft ? `${regionSidoDraft} ${regionGuDraft}` : "") ||
  club?.region ||
  "-";  

  // ✅ 로고는 pendingLogo가 있으면 그걸 우선 미리보기로 사용
  const logoUrl = (pendingLogo?.logoUrl || club?.logoUrl || "").trim();

  const guardBlocked = !loading && !isOwner;

  // ===== 디바운스 타이머 refs =====
  const introTimerRef = useRef(null);
  const logoTimerRef = useRef(null);
  const regionTimerRef = useRef(null);



  // ===== 서버값 기준 스냅샷(변경 감지용) =====
  const introServerRef = useRef({
    description: "",
    usePromoText: false,
    promoText: "",
    activityDays: "ANY",
    activityTime: "ANY",
  });

  const nameServerRef = useRef("");
  const logoServerRef = useRef({ logoUrl: "", logoPath: "" });

  const regionServerRef = useRef({ region: "", regionSido: "", regionGu: "" });


  const clearTimer = (refObj) => {
    if (refObj?.current) {
      clearTimeout(refObj.current);
      refObj.current = null;
    }
  };

  const onDeleteTeam = async () => {
    if (deleteBusy) return;
    if (!clubId) return;

    const ok1 = await showConfirm("팀을 삭제할까요? 삭제 후 복구할 수 없습니다.");
    if (!ok1) return;

    const ok2 = await showConfirm("정말 삭제합니다. 팀 멤버들의 팀 연결(activeTeamId/clubId)이 해제됩니다.");
    if (!ok2) return;

    try {
      setDeleteBusy(true);
      await deleteClubAndCleanup({ clubId, uid });
      showAlert("팀이 삭제되었습니다.");
      nav("/my", { replace: true });
    } catch (e) {
      showAlert(e?.message || "팀 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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

  // 보낸 초대(대기중) 실시간 구독 — 선수가 수락/거절하면 즉시 목록 반영
  useEffect(() => {
    if (loading) return;
    if (!clubId) return;
    if (tab !== "members") return;
    setInvitesLoading(true);
    const unsub = subscribeClubInvites(
      { clubId, status: "pending", limitCount: 30 },
      (rows) => {
        setPendingInvites(Array.isArray(rows) ? rows : []);
        setInvitesLoading(false);
      }
    );
    return () => {
      try {
        unsub && unsub();
      } catch (e) {}
    };
  }, [loading, clubId, tab]);


  const refreshMembers = async () => {
    if (!clubId) return;
    setMembersLoading(true);
    try {
      const rows = await listClubMembers({ clubId, limitCount: 100 });
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn("[TeamManage] list members failed:", e?.message || e);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const onForceKick = async (targetUid) => {
    if (!clubId) return;
    if (!targetUid) return;

    if (targetUid === uid) {
      showAlert("본인은 강제 탈퇴할 수 없습니다.");
      return;
    }

    const ok = await showConfirm("해당 멤버를 팀에서 강제 탈퇴시킬까요? (즉시 반영)");
    if (!ok) return;

    try {
      setKickBusyUid(targetUid);
      await forceRemoveClubMember({ clubId, targetUid, actorUid: uid });

      console.groupCollapsed("[TeamManage] force remove member");
      console.log("clubId:", clubId);
      console.log("actorUid:", uid);
      console.log("targetUid:", targetUid);
      console.groupEnd();

      await refreshMembers();
      showAlert("강제 탈퇴 처리되었습니다.");
    } catch (e) {
      console.warn("[TeamManage] force remove failed:", e?.message || e);
      showAlert(e?.message || "강제 탈퇴에 실패했습니다.");
    } finally {
      setKickBusyUid("");
    }
  };



  // 팀 멤버 실시간 구독 — 초대 수락으로 새 멤버가 붙으면 즉시 화면 반영
  useEffect(() => {
    if (loading) return;
    if (!clubId) return;
    if (tab !== "members") return;
    setMembersLoading(true);
    const unsub = subscribeClubMembers(
      { clubId, limitCount: 100 },
      (rows) => {
        setMembers(Array.isArray(rows) ? rows : []);
        setMembersLoading(false);
      }
    );
    return () => {
      try {
        unsub && unsub();
      } catch (e) {}
    };
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

        const nextDesc = String(view.club?.description || "");
        const nextUsePromo = !!view.club?.promo?.usePromoText;
        const nextPromo = String(view.club?.promo?.promoText || "");

        const nextTags = Array.isArray(view.club?.tags) ? view.club.tags : [];

        setDescription(nextDesc);
        setUsePromoText(nextUsePromo);
        setPromoText(nextPromo);
        setTags(nextTags);

        setMediaItems(Array.isArray(view.club?.media) ? view.club.media : []);

        const act = view.club?.activity || {};
        const nextDays = String(act?.days || "ANY");
        const nextTime = String(act?.time || "ANY");

        setActivityDays(nextDays);
        setActivityTime(nextTime);

        // ✅ 팀명 draft
        const nextName = String(view.club?.name || "");
        setNameDraft(nextName);

        // ✅ 팀 지역 draft 갱신
        const nextRegionSido = String(view.club?.regionSido || "");
        const nextRegionGu = String(view.club?.regionGu || "");
        setRegionSidoDraft(nextRegionSido);
        setRegionGuDraft(nextRegionGu);

        regionServerRef.current = {
          region: String(view.club?.region || "").trim(),
          regionSido: nextRegionSido,
          regionGu: nextRegionGu,
        };

        setRegionSaveState("idle");
        setRegionSaveMsg("");


        // ✅ 로딩 시 pendingLogo는 비움(저장 전 임시값 방지)
        setPendingLogo(null);

        // ✅ 서버 스냅샷(자동저장 비교 기준) 갱신
        introServerRef.current = {
          description: nextDesc,
          usePromoText: nextUsePromo,
          promoText: nextPromo,
          activityDays: nextDays,
          activityTime: nextTime,
          tags: nextTags,
        };
        nameServerRef.current = String(nextName || "").trim();
        logoServerRef.current = {
          logoUrl: String(view.club?.logoUrl || "").trim(),
          logoPath: String(view.club?.logoPath || "").trim(),
        };

        setIntroSaveState("idle");
        setIntroSaveMsg("");
        setNameSaveState("idle");
        setNameSaveMsg("");
        setLogoSaveState("idle");
        setLogoSaveMsg("");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, clubId, uid]);

  const refreshClub = async () => {
    const c = await getClubManageView({ clubId, uid });
    setClub(c.club);
    setIsOwner(!!c.isOwner);
    setMediaItems(Array.isArray(c.club?.media) ? c.club.media : []);
    setPendingLogo(null);

    const act = c.club?.activity || {};
    const nextDays = String(act?.days || "ANY");
    const nextTime = String(act?.time || "ANY");
    setActivityDays(nextDays);
    setActivityTime(nextTime);

    const nextDesc = String(c.club?.description || "");
    const nextUsePromo = !!c.club?.promo?.usePromoText;
    const nextPromo = String(c.club?.promo?.promoText || "");

    const nextTags = Array.isArray(c.club?.tags) ? c.club.tags : [];

    setDescription(nextDesc);
    setUsePromoText(nextUsePromo);
    setPromoText(nextPromo);
    setTags(nextTags);

    const nextName = String(c.club?.name || "");
    setNameDraft(nextName);

    // ✅ 서버 스냅샷 갱신
    introServerRef.current = {
      description: nextDesc,
      usePromoText: nextUsePromo,
      promoText: nextPromo,
      activityDays: nextDays,
      activityTime: nextTime,
      tags: nextTags,
    };
    nameServerRef.current = String(nextName || "").trim();
    logoServerRef.current = {
      logoUrl: String(c.club?.logoUrl || "").trim(),
      logoPath: String(c.club?.logoPath || "").trim(),
    };

    setIntroSaveState("idle");
    setIntroSaveMsg("");
    setNameSaveState("idle");
    setNameSaveMsg("");
    setLogoSaveState("idle");
    setLogoSaveMsg("");
  };

  /* ======================
   * ✅ 팀 로고 업로드 (업로드 후 자동 저장)
   * ====================== */

  const onClickPickLogo = () => {
    if (logoBusy) return;
    logoFileRef.current?.click();
  };

  const pickLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLogoBusy(true);
    try {
      const uploaded = await uploadCompressedImageMedia({
        scope: "clubs",
        ownerId: clubId,
        file,
        kind: "logo",
      });

      const next = {
        logoUrl: uploaded?.url || "",
        logoPath: uploaded?.storagePath || "",
      };

      if (!next.logoUrl || !next.logoPath) {
        throw new Error("로고 업로드 결과가 올바르지 않습니다.");
      }

      setPendingLogo(next);
      setLogoSaveState("saving");
      setLogoSaveMsg("업로드 완료 · 저장 중...");
    } catch (e2) {
      console.warn("[TeamManage] logo upload failed:", e2?.message || e2);
      showAlert("로고 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setPendingLogo(null);
      setLogoSaveState("error");
      setLogoSaveMsg("로고 저장 실패");
    } finally {
      setLogoBusy(false);
    }
  };


  /* ======================
  * ✅ 팀 지역 변경 (실시간 저장, 디바운스)
  * ====================== */
  useEffect(() => {
  if (!clubId) return;
  if (!isOwner) return;

  const sido = String(regionSidoDraft || "").trim();
  const gu = String(regionGuDraft || "").trim();

  // 둘 중 하나라도 없으면 저장 안 함
  if (!sido || !gu) {
    setRegionSaveState("idle");
    setRegionSaveMsg("");
    return;
  }

  const nextRegion = `${sido} ${gu}`.trim();
  const snap = regionServerRef.current || {};

  const prevRegion = String(snap.region || "").trim();
  const prevSido = String(snap.regionSido || "").trim();
  const prevGu = String(snap.regionGu || "").trim();

  if (nextRegion === prevRegion && sido === prevSido && gu === prevGu) {
    setRegionSaveState("idle");
    setRegionSaveMsg("");
    return;
  }

  clearTimer(regionTimerRef);

  setRegionSaveState("saving");
  setRegionSaveMsg("팀 지역 저장 중...");

  regionTimerRef.current = setTimeout(async () => {
    try {
      await updateClubRegion({
        clubId,
        region: nextRegion,
        regionSido: sido,
        regionGu: gu,
      });

      regionServerRef.current = {
        region: nextRegion,
        regionSido: sido,
        regionGu: gu,
      };

      setRegionSaveState("saved");
      setRegionSaveMsg("팀 지역 저장됨");

      // 화면 club도 즉시 반영
      setClub((prev) => {
        if (!prev) return prev;
        return { ...prev, region: nextRegion, regionSido: sido, regionGu: gu };
      });
    } catch (e) {
      console.warn("[TeamManage] auto save region failed:", e?.message || e);
      setRegionSaveState("error");
      setRegionSaveMsg("팀 지역 저장 실패");
    }
  }, 900);

  return () => clearTimer(regionTimerRef);
  }, [clubId, isOwner, regionSidoDraft, regionGuDraft]);



  // ✅ pendingLogo 변경 시 디바운스로 즉시 저장
  useEffect(() => {
    if (!clubId) return;
    if (!pendingLogo?.logoUrl || !pendingLogo?.logoPath) return;

    const serverSnap = logoServerRef.current || {};
    const nextUrl = String(pendingLogo.logoUrl || "").trim();
    const nextPath = String(pendingLogo.logoPath || "").trim();

    if (nextUrl === String(serverSnap.logoUrl || "").trim() && nextPath === String(serverSnap.logoPath || "").trim()) {
      return;
    }

    clearTimer(logoTimerRef);

    logoTimerRef.current = setTimeout(async () => {
      try {
        setLogoSaveState("saving");
        setLogoSaveMsg("로고 저장 중...");

        await updateClubLogo({
          clubId,
          logoUrl: nextUrl,
          logoPath: nextPath,
        });

        // 서버 스냅샷 갱신
        logoServerRef.current = { logoUrl: nextUrl, logoPath: nextPath };
        setLogoSaveState("saved");
        setLogoSaveMsg("로고 저장됨");
        setPendingLogo(null);

        // 화면 club도 즉시 반영
        setClub((prev) => {
          if (!prev) return prev;
          return { ...prev, logoUrl: nextUrl, logoPath: nextPath };
        });
      } catch (e) {
        console.warn("[TeamManage] auto save logo failed:", e?.message || e);
        setLogoSaveState("error");
        setLogoSaveMsg("로고 저장 실패");
      }
    }, 800);

    return () => clearTimer(logoTimerRef);
  }, [clubId, pendingLogo?.logoUrl, pendingLogo?.logoPath]);

  /* ======================
   * ✅ 팀 이름 변경 (중복체크 + 명시적 변경, 90일 쿨다운)
   * ====================== */

  const validateTeamName = (v) => {
    const name = String(v || "").trim();
    if (!name) return "팀 이름을 입력해 주세요.";
    if (name.length < 2) return "팀 이름은 2자 이상이어야 해요.";
    if (name.length > 20) return "팀 이름은 20자 이내로 입력해 주세요.";
    return "";
  };

  // 최초 rename 이후(nameUpdatedAt)부터 쿨다운 (생성 직후엔 잠기지 않음)
  const nameLock = getNameChangeStatus(club?.nameUpdatedAt);
  const nameChanged = String(nameDraft || "").trim() !== String(club?.name || "").trim();

  const onChangeNameDraft = (v) => {
    setNameDraft(v);
    setNameCheckStatus("idle"); // 변경 시 다시 확인 필요
    setNameSaveState("idle");
    setNameSaveMsg("");
  };

  const nameValid = !validateTeamName(nameDraft);

  // ✅ 중복체크 버튼
  const handleCheckName = async () => {
    const next = String(nameDraft || "").trim();
    if (!nameValid || nameCheckStatus === "checking") return;

    setNameCheckStatus("checking");
    try {
      const taken = await isClubNameTaken(next, clubId);
      setNameCheckStatus(taken ? "taken" : "available");
    } catch (e) {
      setNameCheckStatus("error");
    }
  };

  // ✅ 변경 버튼 (명시적 저장)
  const handleSaveName = async () => {
    if (savingName) return;
    const next = String(nameDraft || "").trim();
    const err = validateTeamName(next);
    if (err) {
      setNameSaveState("error");
      setNameSaveMsg(err);
      return;
    }
    if (nameLock.locked) {
      setNameSaveState("error");
      setNameSaveMsg(`팀 이름은 ${nameLock.remainingDays}일 후에 변경할 수 있어요.`);
      return;
    }
    if (nameCheckStatus !== "available") {
      setNameSaveState("error");
      setNameSaveMsg("중복체크를 먼저 진행해 주세요.");
      return;
    }

    setSavingName(true);
    setNameSaveState("saving");
    setNameSaveMsg("팀 이름 저장 중...");
    try {
      await updateClubName({ clubId, name: next });
      nameServerRef.current = next;
      setNameSaveState("saved");
      setNameSaveMsg("팀 이름이 변경됐어요.");
      setNameCheckStatus("idle");

      // 화면 club 즉시 반영 (쿨다운 시작 표시를 위해 nameUpdatedAt도 갱신)
      setClub((prev) => (prev ? { ...prev, name: next, nameUpdatedAt: { seconds: Math.floor(Date.now() / 1000) } } : prev));
    } catch (e) {
      console.warn("[TeamManage] save name failed:", e?.message || e);
      setNameSaveState("error");
      setNameSaveMsg(e?.message || "팀 이름 저장 실패");
    } finally {
      setSavingName(false);
    }
  };

  /* ======================
   * ✅ 소개/홍보 실시간 저장 (디바운스)
   * - description / promo / activity 변경 시 자동 저장
   * ====================== */

  const toggleTag = (tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const buildIntroPayload = () => {
    const desc = String(description || "").trim();
    const use = !!usePromoText;
    const promo = use ? String(promoText || "").trim() : "";
    const days = String(activityDays || "ANY");
    const time = String(activityTime || "ANY");
    const tagList = Array.isArray(tags) ? tags.map((t) => String(t || "").trim()).filter(Boolean) : [];

    return { desc, use, promo, days, time, tags: tagList };
  };

  const isIntroChangedFromServer = () => {
    const s = introServerRef.current || {};
    const cur = buildIntroPayload();

    const sDesc = String(s.description || "").trim();
    const sUse = !!s.usePromoText;
    const sPromo = sUse ? String(s.promoText || "").trim() : "";
    const sDays = String(s.activityDays || "ANY");
    const sTime = String(s.activityTime || "ANY");
    const sTags = Array.isArray(s.tags) ? s.tags : [];

    if (cur.desc !== sDesc) return true;
    if (cur.use !== sUse) return true;
    if (cur.promo !== sPromo) return true;
    if (cur.days !== sDays) return true;
    if (cur.time !== sTime) return true;
    if (cur.tags.join("|") !== sTags.join("|")) return true;
    return false;
  };

  useEffect(() => {
    if (!clubId) return;
    if (!isOwner) return;
    if (!club) return;

    // 로딩 직후/탭 전환 등에서 불필요 저장 방지
    if (!isIntroChangedFromServer()) {
      setIntroSaveState("idle");
      setIntroSaveMsg("");
      return;
    }

    clearTimer(introTimerRef);

    setIntroSaveState("saving");
    setIntroSaveMsg("자동 저장 중...");

    introTimerRef.current = setTimeout(async () => {
      const cur = buildIntroPayload();

      try {
        // 1) 소개/홍보/태그 저장
        await updateClubIntroPromo({
          clubId,
          description: cur.desc,
          promo: {
            usePromoText: cur.use,
            promoText: cur.promo,
          },
          tags: cur.tags,
        });

        // 2) 활동 요일/시간 저장
        await updateClubActivity({
          clubId,
          activity: {
            days: cur.days,
            time: cur.time,
          },
        });

        // ✅ 서버 스냅샷 갱신
        introServerRef.current = {
          description: cur.desc,
          usePromoText: cur.use,
          promoText: cur.promo,
          activityDays: cur.days,
          activityTime: cur.time,
          tags: cur.tags,
        };

        setIntroSaveState("saved");
        setIntroSaveMsg("저장됨");

        // 화면 club도 즉시 반영
        setClub((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            description: cur.desc,
            promo: { usePromoText: cur.use, promoText: cur.promo },
            activity: { days: cur.days, time: cur.time },
            tags: cur.tags,
          };
        });
      } catch (e) {
        console.warn("[TeamManage] auto save intro/activity failed:", e?.message || e);
        setIntroSaveState("error");
        setIntroSaveMsg("저장 실패");
      }
    }, 900);

    return () => clearTimer(introTimerRef);
  }, [clubId, isOwner, club, description, usePromoText, promoText, activityDays, activityTime, tags]);

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
      showAlert("검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const goInviteMessageStep = () => {
    if (!selectedUserId) {
      showAlert("초대할 선수를 선택해 주세요.");
      return;
    }
    const u = (searchResult || []).find((x) => x?.uid === selectedUserId) || null;
    if (!u) {
      showAlert("선수 정보를 찾을 수 없습니다.");
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

      showAlert("초대를 보냈습니다.");
      closeInvite();
    } catch (e) {
      console.warn("[TeamManage] invite failed:", e?.message || e);
      showAlert("초대 전송에 실패했습니다.");
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
      showAlert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
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
      showAlert("사진/동영상은 최대 10개까지 추가할 수 있어요.");
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
      showAlert("사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setMediaBusy(false);
    }
  };

  const removeMedia = async (item) => {
    if (!item?.id) return;
    if (mediaBusy) return;

    const ok = await showConfirm("삭제할까요?");
    if (!ok) return;

    setMediaBusy(true);
    try {
      await deleteMediaItem({ item });
      const next = (mediaItems || []).filter((x) => x.id !== item.id);
      await syncClubMedia(next);
    } catch (e) {
      console.warn("[TeamManage] media delete failed:", e?.message || e);
      showAlert("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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

  const showIntroState = tab === "intro";
  const showNameState = tab === "profile";
  const showLogoState = tab === "profile";

  const renderAutoState = (state, msg) => {
    if (!msg) return null;
    return <AutoSaveHint $state={state}>{msg}</AutoSaveHint>;
  };

  return (
    <Shell>
      {/* ✅ 상단 */}
      <TeamRowTop>
        <HeaderTop>
          <HeaderLogo>
            {logoUrl ? (
              <HeaderLogoImg src={logoUrl} alt={teamName} />
            ) : (
              <AvatarPlaceholder size={54} />
            )}
          </HeaderLogo>

          <TeamInfo>
            <TeamNameText>{teamName}</TeamNameText>
            <TeamMetaText>{teamRegion}</TeamMetaText>
          </TeamInfo>
        </HeaderTop>

        <TopActions>
          <TopGhost type="button" onClick={() => nav(`/team/${clubId}`)}>
            팀 프로필 보기
          </TopGhost>

          <TopDanger type="button" onClick={onDeleteTeam} disabled={deleteBusy}>
            {deleteBusy ? "삭제 중..." : "팀 삭제"}
          </TopDanger>
        </TopActions>
      </TeamRowTop>

      {/* 로고 파일 input */}
      <input
        ref={logoFileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={pickLogoFile}
      />

      <TabsRow>
        <TabBtn type="button" $active={tab === "profile"} onClick={() => setTab("profile")}>
          팀정보
        </TabBtn>
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

      {/* ====================== 팀명/로고 탭 ====================== */}
      {tab === "profile" ? (
        <Section>
          {showLogoState ? renderAutoState(logoSaveState, logoSaveMsg) : null}
          {showNameState ? renderAutoState(nameSaveState, nameSaveMsg) : null}

          <Field>
            <Label>팀 로고</Label>

            <LogoEditorRow>
              <LogoPreview>
                {logoUrl ? <LogoPreviewImg src={logoUrl} alt="logo" /> : <LogoPreviewFallback />}
              </LogoPreview>

              <LogoEditorRight>
          

                <BtnRow>
                  <BtnPrimary  style={{flex:"0.5"}}type="button" onClick={onClickPickLogo} disabled={logoBusy}>
                    {logoBusy ? "업로드 중..." : (
                      <BtnInline>
                        <FiCamera size={16} />
                        로고 선택
                      </BtnInline>
                    )}
                  </BtnPrimary>
                </BtnRow>
              </LogoEditorRight>
            </LogoEditorRow>
          </Field>

          <Divider />

          <Field>
            <Label>팀 이름</Label>
            <NameEditRow>
              <ModalInput
                style={{ flex: "1 1 140px", minWidth: 0 }}
                value={nameDraft}
                onChange={(e) => onChangeNameDraft(e.target.value)}
                placeholder="팀 이름"
                disabled={savingName || nameLock.locked}
              />
              <NameCheckBtn
                type="button"
                onClick={handleCheckName}
                disabled={
                  savingName ||
                  nameLock.locked ||
                  !nameChanged ||
                  !nameValid ||
                  nameCheckStatus === "checking"
                }
              >
                {nameCheckStatus === "checking" ? "확인 중..." : "중복체크"}
              </NameCheckBtn>
              <BtnPrimary
                style={{ flex: "0 0 auto", height: 46, borderRadius: 12, padding: "0 16px" }}
                type="button"
                onClick={handleSaveName}
                disabled={
                  savingName ||
                  nameLock.locked ||
                  !nameChanged ||
                  nameCheckStatus !== "available"
                }
              >
                {savingName ? "변경 중..." : "변경"}
              </BtnPrimary>
            </NameEditRow>

            {nameLock.locked ? (
              <NameStatusText>
                팀 이름은 {nameLock.remainingDays}일 후에 변경할 수 있어요.
              </NameStatusText>
            ) : (
              <>
                {nameChanged && nameCheckStatus === "idle" && (
                  <NameStatusText>중복체크 버튼을 눌러 사용 가능한지 확인해 주세요.</NameStatusText>
                )}
                {nameCheckStatus === "available" && (
                  <NameStatusText $tone="ok">사용할 수 있는 팀 이름이에요.</NameStatusText>
                )}
                {nameCheckStatus === "taken" && (
                  <NameStatusText $tone="error">이미 사용 중인 팀 이름이에요.</NameStatusText>
                )}
                {nameCheckStatus === "error" && (
                  <NameStatusText $tone="error">중복 확인에 실패했어요. 잠시 후 다시 시도해 주세요.</NameStatusText>
                )}
                <NameStatusText>팀 이름은 한번 정하면 90일 후에 변경할 수 있어요.</NameStatusText>
              </>
            )}
          </Field>

          <Divider />

          {renderAutoState(regionSaveState, regionSaveMsg)}

          <Field>
            <Label>팀 지역</Label>

            <RegionSelectBtn
              type="button"
              onClick={() => setRegionOpen(true)}
              $muted={!(regionSidoDraft && regionGuDraft)}
            >
              <span>{(regionSidoDraft && regionGuDraft) ? `${regionSidoDraft} ${regionGuDraft}` : "활동 지역 선택"}</span>
              <FiChevronRight size={16} />
            </RegionSelectBtn>

            <RegionPickerSheet
              open={regionOpen}
              onClose={() => setRegionOpen(false)}
              value={{ sido: regionSidoDraft, gu: regionGuDraft }}
              onPick={({ sido, gu }) => {
                setRegionSidoDraft(sido);
                setRegionGuDraft(gu);
              }}
              title="활동 지역 선택"
            />
          </Field>

        </Section>
      ) : null}

      {/* ====================== 소개/홍보 탭 ====================== */}
      {tab === "intro" ? (
        <Section>
          {showIntroState ? renderAutoState(introSaveState, introSaveMsg) : null}

          <Field>
            <Label>팀 활동 패턴</Label>
            <TwoColRow>
              <SelectBox value={activityDays} onChange={(e) => setActivityDays(e.target.value)}>
                <option value="ANY">활동 요일: 상관없음</option>
                <option value="WEEKDAY">활동 요일: 평일 위주</option>
                <option value="WEEKEND">활동 요일: 주말 위주</option>
              </SelectBox>

              <SelectBox value={activityTime} onChange={(e) => setActivityTime(e.target.value)}>
                <option value="ANY">활동 시간: 상관없음</option>
                <option value="MORNING">활동 시간: 오전</option>
                <option value="AFTERNOON">활동 시간: 오후</option>
                <option value="EVENING">활동 시간: 저녁</option>
                <option value="NIGHT">활동 시간: 야간</option>
              </SelectBox>
            </TwoColRow>


          </Field>

          <Field>
            <Label>팀 소개</Label>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예) 전술 맞춰서 뛰는 팀으로 주말 위주 친선 경기와 리그 참여를 목표로 합니다."
            />
          </Field>

          <Field>
            <Label>태그</Label>
            <TagRow>
              {TEAM_TAG_PRESETS.map((tag) => (
                <TagChip
                  key={tag}
                  type="button"
                  $selected={tags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </TagChip>
              ))}
            </TagRow>
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

        </Section>
      ) : null}

      {/* ====================== 멤버 탭 ====================== */}
      {tab === "members" ? (
        <Section>
          <HintText>팀 멤버 관리는 초대로 진행해요.</HintText>

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
            <EmptyState compact text="아직 보낸 초대가 없습니다." />
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
                        {inv.message ? (
                          <InviteMsgLine>{String(inv.message).slice(0, 40)}</InviteMsgLine>
                        ) : null}
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

          <Divider />

          <InviteSectionTitle>현재 멤버</InviteSectionTitle>

          {membersLoading ? (
            <InviteEmpty>불러오는 중...</InviteEmpty>
          ) : (members || []).length === 0 ? (
            <EmptyState compact text="팀 멤버가 없습니다." />
          ) : (
            <InviteList>
              {(members || []).map((m) => {
                const mUid = m?.uid || m?.id || "";
                const isMe = mUid && mUid === uid;
                const busy = kickBusyUid === mUid;

                return (
                  <InviteRow key={mUid || Math.random()}>
                    <InviteLeft>
                      <InviteAvatarWrap>
                        {m?.avatarUrl ? (
                          <InviteAvatar src={m.avatarUrl} alt={m.nickname || "avatar"} />
                        ) : (
                          <AvatarPlaceholder size={34} />
                        )}
                      </InviteAvatarWrap>

                      <InviteText>
                        <InviteName>
                          {m?.nickname || "(닉네임 없음)"} {isMe ? "(나)" : ""}
                        </InviteName>
                        <InviteMeta>{(m?.region || "").trim() || "지역 미지정"}</InviteMeta>
                        {m?.role ? <InviteMsgLine>{String(m.role)}</InviteMsgLine> : null}
                      </InviteText>
                    </InviteLeft>

                    <InviteRight>
                      <KickBtn
                        type="button"
                        onClick={() => onForceKick(mUid)}
                        disabled={!mUid || isMe || !!busy}
                        title={isMe ? "본인은 강제 탈퇴할 수 없습니다." : "강제 탈퇴"}
                      >
                        <FiUserX size={14} />
                        {busy ? "처리 중..." : "강제 탈퇴"}
                      </KickBtn>
                    </InviteRight>
                  </InviteRow>
                );
              })}
            </InviteList>
          )}

        </Section>
      ) : null}

      {/* ====================== 미디어 탭 ====================== */}
      {tab === "media" ? (
        <Section>
          <HintText>사진은 즉시 업로드, 동영상은 유튜브 링크로 추가해요.</HintText>

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
                    searching ? (
                      <ResultEmpty>불러오는 중...</ResultEmpty>
                    ) : (
                      <EmptyState compact text="표시할 선수가 없습니다." />
                    )
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
                <ModalSub>{inviteTarget?.nickname || "선수"} 님에게 보낼 초대 메시지를 작성해 주세요.</ModalSub>

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
    </Shell>
  );
}

/* ====================== styles ====================== */

const Shell = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg};
  padding: 14px 14px calc(40px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TopHint = styled.div`
  padding: 14px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textWeak};
  border-radius: 8px;
  line-height: 1.6;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
`;

const SpinnerWrap = styled.div`
  padding: 28px 0;
  display: flex;
  justify-content: center;
`;

const TeamRowTop = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const HeaderLogo = styled.div`
  width: 54px;
  height: 54px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef0f3"};
  display: grid;
  place-items: center;
`;

const HeaderLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

const TeamNameText = styled.div`
  font-size: 19px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamMetaText = styled.div`
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TopActions = styled.div`
  display: flex;
  gap: 8px;
`;

const TopGhost = styled.button`
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const TopDanger = styled.button`
  flex: 0 0 auto;
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid
    ${({ theme }) =>
      theme.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fca5a5" : "#b91c1c")};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TabsRow = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f1f3f5"};
`;

const TabBtn = styled.button`
  flex: 1;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme.colors.textWeak};
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 700 : 600)};
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  box-shadow: ${({ $active, theme }) =>
    $active ? "0 4px 12px -4px " + theme.colors.primary : "none"};
`;

const Section = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 태그 선택 (팀 생성 화면과 동일) */
const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const TagChip = styled.button`
  border-radius: 999px;
  border: 1px solid
    ${({ $selected, theme }) => ($selected ? theme.colors.primary : theme.colors.border)};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary : theme.colors.card};
  padding: 7px 13px;
  font-size: 12px;
  font-weight: ${({ $selected }) => ($selected ? 700 : 500)};
  color: ${({ $selected, theme }) =>
    $selected ? "#ffffff" : theme.colors.textNormal};
  cursor: pointer;
`;

const TwoColRow = styled.div`
  display: grid;
  gap: 10px;
`;

const SelectBox = styled.select`
  height: 46px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 0 12px;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }
`;

const LabelRow2 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const TextArea = styled.textarea`
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 13px 14px;
  font-size: 14px;
  outline: none;
  min-height: 140px;
  resize: none;
  line-height: 1.5;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
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
  color: ${({ theme }) => theme.colors.textNormal};
`;

const BtnRow = styled.div`
  display: flex;
  gap: 8px;
`;

const BtnGhost = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  cursor: pointer;
  display: grid;
  place-items: center;
`;

const BtnPrimary = styled.button`
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

const HintText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.6;
`;

const NameEditRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
  /* 좁은 화면에서 입력+중복체크+저장 3개가 안 들어가면 줄바꿈(버튼 짤림 방지) */
  flex-wrap: wrap;
`;

const NameCheckBtn = styled.button`
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : theme.colors.primary};
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const NameStatusText = styled.div`
  font-size: 12px;
  margin-top: 4px;
  color: ${({ $tone, theme }) =>
    $tone === "ok"
      ? theme.colors.primary
      : $tone === "error"
      ? "#ef4444"
      : theme.colors.textWeak};
`;

const AutoSaveHint = styled.div`
  font-size: 12px;
  line-height: 1.4;
  color: ${({ $state, theme }) =>
    $state === "saved"
      ? theme.mode === "dark"
        ? "#86efac"
        : "#16a34a"
      : $state === "error"
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#ef4444"
      : theme.colors.textWeak};
`;

/* profile tab */

const LogoEditorRow = styled.div`
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 12px;
  align-items: center;
`;

const LogoPreview = styled.div`
  width: 92px;
  height: 92px;
  border-radius: 16px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const LogoPreviewImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const LogoPreviewFallback = styled.div`
  width: 100%;
  height: 100%;
`;

const LogoEditorRight = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

const BtnInline = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

/* media */

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`;

const MediaItem = styled.div`
  position: relative;
  height: 118px;
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
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
  border-radius: 8px;
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
  height: 118px;
  border-radius: 14px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
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
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#4f46e5")};
  display: grid;
  place-items: center;
  font-size: 22px;
`;

const MediaAddLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* modal */

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 16px;
`;

const Modal = styled.div`
  width: min(520px, 92vw);
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px;
  padding: 18px 16px 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.22);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModalTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const IconBtn = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ModalSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.45;
`;

const ModalInput = styled.input`
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 13px 14px;
  font-size: 14px;
  outline: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.card};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const ModalError = styled.div`
  font-size: 12px;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fca5a5" : "#ef4444")};
`;

/* invite */

const SearchRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const SearchInput = styled(ModalInput)`
  flex: 1;
  min-width: 0; /* input 고유 최소폭 때문에 검색 버튼이 밀려나가는 것 방지 */
`;

const SearchBtn = styled.button`
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
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
  color: ${({ theme }) => theme.colors.textWeak};
  padding: 10px 4px;
  text-align: center;
`;

const InviteMsg = styled.textarea`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
  min-height: 90px;
  resize: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
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
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  border-radius: 12px;
  padding: 14px 14px;
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
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ChoiceRight = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
`;

const PickRow = styled.div`
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;

  &:hover {
    background: ${({ theme }) =>
      theme.mode === "dark" ? theme.colors.surface : "#f8fafc"};
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
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PickMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AvatarBtn = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
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

const InviteSectionTitle = styled.div`
  margin-top: 8px;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const InviteEmpty = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  padding: 10px 2px;
`;

const InviteList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InviteRow = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  border-radius: 14px;
  padding: 12px 12px;
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
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
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
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InviteMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const InviteMsgLine = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InviteRight = styled.div`
  flex-shrink: 0;
`;

const InviteStatus = styled.div`
  font-size: 11px;
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#4f46e5")};
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(99,102,241,0.18)"
      : "rgba(79, 70, 229, 0.12)"};
  padding: 4px 8px;
  border-radius: 999px;
`;

const LineButton = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  border-radius: 14px;
  padding: 14px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  &:active {
    transform: translateY(1px);
  }
`;

const LineLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
`;

const LineTitle = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LineSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LineRight = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
`;


const KickBtn = styled.button`
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid
    ${({ theme }) =>
      theme.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fff1f2"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fca5a5" : "#be123c")};
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const RegionSelectBtn = styled.button`
  height: 46px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f6f7f9"};
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${({ $muted, theme }) =>
    $muted ? theme.colors.textWeak : theme.colors.textStrong};

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.12);
  }
`;
