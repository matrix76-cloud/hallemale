/* eslint-disable */
// src/services/adminMatchesService.js
// 어드민 - 매칭 관리 (match_requests 라이프사이클 전체)
// pending / accepted / rejected / cancelled / finished
import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

function toStr(v) {
  return String(v || "").trim();
}

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtRelative(dt) {
  const d = toDate(dt);
  if (!d) return "-";
  const ms = Date.now() - d.getTime();
  if (ms < 0) {
    const yy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${yy}-${mm}-${dd}`;
  }
  if (ms < 60 * 1000) return "방금 전";
  if (ms < 60 * 60 * 1000) return `${Math.floor(ms / (60 * 1000))}분 전`;
  const day = 24 * 60 * 60 * 1000;
  if (ms < day) {
    const h = Math.floor(ms / (60 * 60 * 1000));
    return h === 0 ? "오늘" : `${h}시간 전`;
  }
  const days = Math.floor(ms / day);
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}개월 전`;
  return `${Math.floor(mo / 12)}년 전`;
}

function regionToSidoKey(s) {
  const v = toStr(s);
  if (!v) return "";
  const sidos = [
    "서울","경기","인천","부산","대구","광주","대전","울산","세종",
    "강원","충북","충남","전북","전남","경북","경남","제주",
  ];
  for (const sido of sidos) {
    if (v.startsWith(sido)) return sido;
  }
  return v;
}

function pickRegionSido(team, field) {
  return regionToSidoKey(
    toStr(team?.regionSido) ||
      toStr(field?.regionSido) ||
      toStr((team?.region || "").split(" ")[0])
  );
}

function pickPlace(field, team) {
  const addr = toStr(field?.address);
  if (addr) return addr;
  const region = toStr(team?.region);
  return region || "";
}

function pickMatchSize(data = {}) {
  return (
    toStr(data?.matchSize) ||
    toStr(data?.fromLineupSnapshot?.matchSizeKey) ||
    toStr(data?.toLineupSnapshot?.matchSizeKey) ||
    toStr(data?.fromLineupSnapshot?.matchSize) ||
    toStr(data?.toLineupSnapshot?.matchSize) ||
    ""
  );
}

function mapDoc(d) {
  const data = d.data() || {};
  const fromTeam = data?.fromTeamSnapshot || {};
  const toTeam = data?.toTeamSnapshot || {};
  const fromLineup = data?.fromLineupSnapshot || {};
  const toLineup = data?.toLineupSnapshot || {};
  const field = data?.field || {};

  return {
    id: d.id,
    status: toStr(data?.status) || "pending",
    actorClubId: toStr(data?.actorClubId),
    targetClubId: toStr(data?.targetClubId),
    createdAt: toDate(data?.createdAt),
    updatedAt: toDate(data?.updatedAt),
    acceptedAt: toDate(data?.acceptedAt),
    scheduledAt: toDate(data?.scheduledAt),
    actor: {
      clubId: toStr(fromTeam?.clubId || fromTeam?.id),
      name: toStr(fromTeam?.name) || "팀",
      logoUrl: toStr(fromTeam?.logoUrl || ""),
    },
    target: {
      clubId: toStr(toTeam?.clubId || toTeam?.id),
      name: toStr(toTeam?.name) || "팀",
      logoUrl: toStr(toTeam?.logoUrl || ""),
    },
    fromLineupName: toStr(fromLineup?.name),
    toLineupName: toStr(toLineup?.name),
    matchSize: pickMatchSize(data),
    place: pickPlace(field, fromTeam) || pickPlace(field, toTeam),
    regionSido: pickRegionSido(fromTeam, field) || pickRegionSido(toTeam, field),
    actorScore:
      Number.isFinite(Number(data?.myScore)) ? Number(data.myScore) : null,
    targetScore:
      Number.isFinite(Number(data?.oppScore)) ? Number(data.oppScore) : null,
    cancelReason: toStr(data?.cancelReason || data?.rejectReason || ""),
  };
}

const ALLOWED_STATUS = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "finished",
];

/**
 * 매칭 관리 목록
 * - 정렬: createdAt desc
 * - 필터: status / keyword / regionSido (클라이언트 사이드)
 */
export async function fetchAdminMatchRequests({
  status = "all",
  keyword = "",
  regionSido = "all",
  limitCount = 300,
} = {}) {
  const col = collection(db, "match_requests");

  let q1;
  if (status && status !== "all" && ALLOWED_STATUS.includes(status)) {
    q1 = query(
      col,
      where("status", "==", status),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
  } else {
    q1 = query(col, orderBy("createdAt", "desc"), limit(limitCount));
  }

  const snap = await getDocs(q1);
  const docs = snap?.docs || [];
  const rows = docs.map(mapDoc);

  const display = rows.map((r) => {
    const a = r.actorScore;
    const t = r.targetScore;
    const score = a != null && t != null ? `${a} : ${t}` : "-";
    return {
      ...r,
      when: fmtRelative(r.createdAt || r.updatedAt),
      score,
    };
  });

  const k = toStr(keyword).toLowerCase();
  const filtered = display.filter((r) => {
    if (regionSido && regionSido !== "all" && r.regionSido !== regionSido) {
      return false;
    }
    if (!k) return true;
    const hay =
      `${r.actor.name} ${r.target.name} ${r.fromLineupName} ${r.toLineupName} ${r.place} ${r.matchSize}`.toLowerCase();
    return hay.includes(k);
  });

  return { rows: display, filtered };
}

export const STATUS_LABEL = {
  pending: "신청 대기",
  accepted: "수락됨",
  rejected: "거절됨",
  cancelled: "취소됨",
  finished: "완료",
};
