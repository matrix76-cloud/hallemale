/* eslint-disable */
// src/services/adminMatchesService.js
// 어드민 - 매칭 관리 (match_requests 라이프사이클 전체)
// pending / accepted / rejected / cancelled / finished
import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
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

  const snap = hasMock("myMatchDocs") ? mockQuerySnap(mockData("myMatchDocs")) : await getDocs(q1);
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

/**
 * 어드민 - 매칭 분쟁/신고 목록.
 *
 * 새 컬렉션을 만들지 않는다. 분쟁은 이미 두 곳에 기록되고 있다:
 *   · 결과 이의제기 — disputeMatchResult 가 match_requests 에 disputeCount·disputedAt 을 남긴다.
 *     (결과를 초기화하고 재입력을 열어주므로, 이의가 반복되는 경기 = 합의가 안 되는 경기다)
 *   · 노쇼 — 구장주가 예약을 noshow 로 처리하면 venueReservations.status 에 남는다.
 *     매칭 예약(matchId 보유)만 매칭 분쟁으로 본다.
 *
 * 인덱스를 늘리지 않으려고 서버 where 대신 최근 문서를 받아 메모리에서 거른다
 * (이 서비스의 다른 조회와 같은 방식).
 */
export async function fetchMatchIssues({ limitCount = 300 } = {}) {
  // ── 결과 이의제기 ──
  const mSnap = hasMock("myMatchDocs")
    ? mockQuerySnap(mockData("myMatchDocs"))
    : await getDocs(query(collection(db, "match_requests"), orderBy("createdAt", "desc"), limit(limitCount)));

  const disputes = [];
  (mSnap?.docs || []).forEach((d) => {
    const raw = d.data() || {};
    const count = Number(raw?.disputeCount || 0);
    if (count <= 0) return;
    const m = mapDoc(d);
    disputes.push({
      kind: "dispute",
      id: m.id,
      count,
      at: toDate(raw?.disputedAt) || m.updatedAt,
      status: m.status,
      teams: `${m.actor.name} vs ${m.target.name}`,
      place: m.place,
      scheduledAt: m.scheduledAt,
      // 이의 후 결과가 다시 채워졌으면 합의된 것, 비어 있으면 아직 재입력 대기다
      resolved: !!toStr(raw?.resultState),
      score: m.actorScore != null && m.targetScore != null ? `${m.actorScore} : ${m.targetScore}` : "-",
    });
  });

  // ── 노쇼(매칭 예약) ──
  const rSnap = hasMock("venueReservationDocs")
    ? mockQuerySnap(mockData("venueReservationDocs"))
    : await getDocs(query(collection(db, "venueReservations"), orderBy("createdAt", "desc"), limit(limitCount)));

  const noshows = [];
  (rSnap?.docs || []).forEach((d) => {
    const raw = d.data() || {};
    if (toStr(raw?.status) !== "noshow") return;
    if (!toStr(raw?.matchId)) return; // 일반 예약 노쇼는 구장 쪽 소관
    noshows.push({
      kind: "noshow",
      id: d.id,
      matchId: toStr(raw.matchId),
      at: toDate(raw?.updatedAt) || toDate(raw?.createdAt),
      teams: toStr(raw?.teamName) || toStr(raw?.userName) || "-",
      place: toStr(raw?.venueName),
      when: `${toStr(raw?.date)} ${toStr(raw?.startTime)}~${toStr(raw?.endTime)}`.trim(),
      reservationCode: toStr(raw?.reservationCode),
      price: Number(raw?.price || 0),
    });
  });

  const byAt = (a, b) => (b.at?.getTime?.() || 0) - (a.at?.getTime?.() || 0);
  disputes.sort(byAt);
  noshows.sort(byAt);
  return { disputes, noshows };
}

export const STATUS_LABEL = {
  pending: "신청 대기",
  accepted: "수락됨",
  rejected: "거절됨",
  cancelled: "취소됨",
  finished: "완료",
};
