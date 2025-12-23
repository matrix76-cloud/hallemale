/* eslint-disable */
// src/services/counterpartService.js
// 상대 이름/아바타 + 소속팀(가능하면 clubs/{clubId}까지 조회) 메타 공용 서비스 (캐시 포함)

import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { images } from "../utils/imageAssets";

const _userCache = new Map();
const _clubCache = new Map();

function pickName(data) {
  const v =
    String(data?.nickname || "").trim() ||
    String(data?.name || "").trim() ||
    String(data?.displayName || "").trim();
  return v || "상대";
}

function pickAvatar(data) {
  const v =
    String(data?.avatarUrl || "").trim() ||
    String(data?.photoUrl || "").trim() ||
    String(data?.profileImageUrl || "").trim();
  return v || images.defaultAvatar || images.logo;
}

function pickClubId(data) {
  const v =
    String(data?.clubId || "").trim() ||
    String(data?.teamId || "").trim() ||
    String(data?.currentClubId || "").trim();
  return v || "";
}

function pickTeamMetaFromUser(data) {
  const teamName =
    String(data?.clubName || "").trim() ||
    String(data?.teamName || "").trim() ||
    "";

  const teamLogoUrl =
    String(data?.clubLogoUrl || "").trim() ||
    String(data?.teamLogoUrl || "").trim() ||
    "";

  const teamLogoKey = String(data?.clubLogoKey || "").trim() || "";

  return {
    teamName,
    teamLogoUrl,
    teamLogoKey,
  };
}

async function getClubMeta(clubId) {
  const id = String(clubId || "").trim();
  if (!id) return { teamName: "", teamLogo: "" };

  if (_clubCache.has(id)) return _clubCache.get(id);

  try {
    const ref = doc(db, "clubs", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const fallback = { teamName: "", teamLogo: "" };
      _clubCache.set(id, fallback);
      return fallback;
    }

    const data = snap.data() || {};
    const teamName = String(data?.name || data?.clubName || "").trim();

    const teamLogo =
      String(data?.logoUrl || "").trim() ||
      String(data?.photoUrl || "").trim() ||
      (data?.logoKey && images[data.logoKey] ? images[data.logoKey] : "") ||
      "";

    const meta = { teamName: teamName || "", teamLogo: teamLogo || "" };
    _clubCache.set(id, meta);
    return meta;
  } catch (e) {
    const fallback = { teamName: "", teamLogo: "" };
    _clubCache.set(id, fallback);
    return fallback;
  }
}

export async function getUserPublicMeta(uid) {
  const key = String(uid || "").trim();
  if (!key) {
    return {
      name: "상대",
      avatar: images.defaultAvatar || images.logo,
      teamName: "",
      teamLogo: "",
      clubId: "",
    };
  }

  if (_userCache.has(key)) return _userCache.get(key);

  try {
    const ref = doc(db, "users", key);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const fallback = {
        name: "상대",
        avatar: images.defaultAvatar || images.logo,
        teamName: "",
        teamLogo: "",
        clubId: "",
      };
      _userCache.set(key, fallback);
      return fallback;
    }

    const data = snap.data() || {};
    const name = pickName(data);
    const avatar = pickAvatar(data);

    const clubId = pickClubId(data);
    const userTeam = pickTeamMetaFromUser(data);

    let teamName = userTeam.teamName || "";
    let teamLogo =
      userTeam.teamLogoUrl ||
      (userTeam.teamLogoKey && images[userTeam.teamLogoKey]
        ? images[userTeam.teamLogoKey]
        : "") ||
      "";

    // ✅ users에 teamName/logo 없으면 clubs/{clubId}로 보강
    if ((!teamName || !teamLogo) && clubId) {
      const clubMeta = await getClubMeta(clubId);
      if (!teamName) teamName = clubMeta.teamName || "";
      if (!teamLogo) teamLogo = clubMeta.teamLogo || "";
    }

    const meta = {
      name,
      avatar,
      clubId,
      teamName,
      teamLogo,
    };

    _userCache.set(key, meta);
    return meta;
  } catch (e) {
    const fallback = {
      name: "상대",
      avatar: images.defaultAvatar || images.logo,
      teamName: "",
      teamLogo: "",
      clubId: "",
    };
    _userCache.set(key, fallback);
    return fallback;
  }
}

export function getOtherUidFromRoom({ myUid, room }) {
  const me = String(myUid || "").trim();
  const uids = Array.isArray(room?.participantUids) ? room.participantUids : [];
  return uids.find((u) => u && String(u) !== me) || "";
}

export function clearCounterpartCache() {
  _userCache.clear();
  _clubCache.clear();
}
