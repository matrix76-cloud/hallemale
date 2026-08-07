/* eslint-disable */
// src/pages/owner/OwnerHomePage.jsx
// 예약관리 — 주간 캘린더 + 시간대별 슬롯 + 요약 + 승인/반려 + 시간막기 (명세서 3)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { LuChevronLeft, LuChevronRight, LuLock, LuHourglass, LuCheck, LuPhone, LuCalendarOff, LuRepeat } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import {
  listReservations, listBlocks, addBlock, removeBlock, setReservationStatus,
  rejectReservation, createOwnerReservation,
  cancelReservation, markReservationNoshow,
  addBlockRange, cancelRecurringSeries,
  dowToKey, expireMatchReservationIfNeeded, resolveSlotPrice,
  isPerPerson, clampHeadcount, calcSlotPrice,
} from "../../services/ownerVenueService";
import { useUIActions } from "../../hooks/useUI";
import { formatPhoneE164 as formatPhone } from "../../utils/phone";
import { copyText } from "../../utils/venueLink";
import { track } from "../../utils/analytics";
import { Page, Card, ScreenTitle, SecTitle, Caption, Chip, StatBadge, Input, PrimaryBtn, GhostBtn, DangerBtn, C, OWNER_WIDE_MIN } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerFooter from "./components/OwnerFooter";
import OwnerSpinner from "./components/OwnerSpinner";
import ConfirmDialog from "./components/ConfirmDialog";
import { useConfirm } from "./components/useConfirm";

function toMin(h){const[a,b]=String(h||"0:0").split(":").map(x=>parseInt(x,10)||0);return a*60+b;}
function toHHMM(m){return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;}
function overlap(aS,aE,bS,bE){return toMin(aS)<toMin(bE)&&toMin(aE)>toMin(bS);}
function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function buildSlots(court,dayKey){
  if(!court)return[];const h=court.hours?.[dayKey];if(!h||h.closed)return[];
  const step=court.slotMinutes||60;const out=[];
  for(let t=toMin(h.open);t+step<=toMin(h.close);t+=step)out.push({start:toHHMM(t),end:toHHMM(t+step)});
  return out;
}
const WEEK=["일","월","화","수","목","금","토"];

const ChipRow=styled.div`display:flex;gap:8px;overflow-x:auto;&::-webkit-scrollbar{display:none;}`;
const CourtChip=styled(Chip)`position:relative;`;
const ChipBadge=styled.span`position:absolute;top:-5px;right:-4px;min-width:15px;height:15px;padding:0 3px;border-radius:999px;background:${C.amber500};color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;`;
const WeekHead=styled.div`display:flex;align-items:center;justify-content:space-between;`;
const WeekNav=styled.button`border:none;background:transparent;color:${C.slate500};cursor:pointer;display:flex;padding:4px;`;
const WeekLabel=styled.div`font-size:13.5px;font-weight:700;color:${C.slate800};`;
const Days=styled.div`display:grid;grid-template-columns:repeat(7,1fr);gap:6px;`;
const Day=styled.button`border:1px solid ${({$on})=>($on?C.violet600:"transparent")};background:${({$on})=>($on?C.violet50:"transparent")};border-radius:12px;padding:6px 0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;`;
const DayWd=styled.div`font-size:10px;color:${({$dow})=>($dow===0?C.red500:$dow===6?C.violet600:C.slate400)};font-weight:600;`;
const DayNum=styled.div`font-size:15px;font-weight:700;color:${({$on})=>($on?C.violet600:C.slate800)};`;
const Dots=styled.div`display:flex;gap:3px;height:6px;align-items:center;`;
const Dot=styled.span`width:5px;height:5px;border-radius:999px;background:${({$c})=>$c};`;
const Summary=styled.div`display:grid;grid-template-columns:repeat(4,1fr);gap:8px;`;
const Sum=styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:10px 6px;text-align:center;background:#fff;`;
const SumN=styled.div`font-size:18px;font-weight:800;color:${({$c})=>$c||C.slate800};`;
const SumL=styled.div`font-size:11px;color:${C.slate500};margin-top:2px;`;
// 시간 슬롯 — 모바일 2열, 데스크톱은 폭이 넓어지므로 4열로 펴서 하루가 한눈에 들어오게.
const Grid=styled.div`
  display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
  @media (min-width:${OWNER_WIDE_MIN}px){grid-template-columns:repeat(4,1fr);}
`;
const Slot=styled.button`
  display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:11px 12px;border-radius:12px;
  cursor:${({$k})=>$k==="open"||$k==="blocked"||$k==="confirmed"||$k==="pending"||$k==="done"?"pointer":"default"};
  background:${({$k})=>$k==="confirmed"?C.violet50:$k==="done"?"#F8FAFC":"#fff"};
  border:1px solid ${({$k})=>$k==="confirmed"?C.violet300:$k==="pending"?C.amber400:C.slate200};
  ${({$k})=>$k==="pending"?`background-image:repeating-linear-gradient(45deg,#FBBF2422,#FBBF2422 6px,transparent 6px,transparent 12px);`:""}
  opacity:${({$k})=>($k==="past"?0.45:1)};
`;
const SlotT=styled.div`font-size:13px;font-weight:700;color:${C.slate800};`;
const SlotS=styled.div`font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;color:${({$k})=>$k==="confirmed"?C.violet600:$k==="pending"?C.amber500:$k==="done"?C.green600:$k==="blocked"?C.slate400:$k==="open"?C.green600:C.slate400};`;
const SlotTeam=styled.div`font-size:10.5px;font-weight:600;color:${C.slate500};max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
const Resv=styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;`;
const ResvTop=styled.div`display:flex;align-items:center;justify-content:space-between;gap:8px;`;
const ResvName=styled.div`font-size:14px;font-weight:700;color:${C.slate800};`;
const ResvMeta=styled.div`font-size:12px;color:${C.slate500};`;
const Acts=styled.div`display:flex;gap:8px;`;
const SBtn=styled.button`flex:1;height:38px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid ${({$danger})=>$danger?C.red200:C.violet600};background:${({$primary})=>$primary?C.violet600:"transparent"};color:${({$primary,$danger})=>$primary?"#fff":$danger?C.red500:C.violet600};`;
const Empty=styled.div`text-align:center;font-size:13px;color:${C.slate400};padding:18px 0;`;
const Overlay=styled.div`position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:200;`;
const Sheet=styled.div`
  box-sizing:border-box;
  width:100%;max-width:448px;max-height:85vh;overflow-y:auto;
  background:#fff;border-radius:20px 20px 0 0;
  padding-top:22px;
  padding-bottom:calc(24px + env(safe-area-inset-bottom));
  padding-left:24px;
  padding-right:24px;
  display:flex;flex-direction:column;gap:13px;
`;
const TeamBlock=styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;`;
const TeamName=styled.div`font-size:14px;font-weight:800;color:${C.slate800};display:flex;align-items:center;justify-content:space-between;gap:8px;`;
const MiniCall=styled.a`display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:${C.violet600};text-decoration:none;`;
// 승인 대기 카드의 연락처 줄 — 승인 전에 예약자에게 확인 전화를 걸 수 있어야 한다.
const ContactRow=styled.div`display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:2px;`;
const NoPhone=styled.span`font-size:12px;color:${C.slate400};`;
const SheetTitle=styled.div`font-size:17px;font-weight:800;color:${C.slate800};display:flex;align-items:center;justify-content:space-between;`;
const X=styled.button`border:none;background:transparent;color:${C.slate400};font-size:24px;cursor:pointer;line-height:1;`;
/* 상태 오버라인 — 제목 위 작은 컬러 텍스트. 배지·행으로 두면 다른 항목과 같은 무게로 묻힌다. */
const SheetHeadL=styled.div`display:flex;flex-direction:column;gap:3px;min-width:0;`;
const StatusOverline=styled.div`
  font-size:11.5px;font-weight:800;letter-spacing:-0.2px;
  color:${({$tone})=>$tone==="confirmed"?C.green600:$tone==="pending"?C.amber500:C.slate500};
`;
const DRow=styled.div`display:flex;justify-content:space-between;gap:10px;font-size:14px;align-items:center;& > span{color:${C.slate500};} & > b{color:${C.slate800};font-weight:700;text-align:right;}`;
// 예약번호 — 예약자·어드민과 공유하는 조회 키라 등폭으로 보여주고 바로 복사할 수 있게 한다.
const CodeVal=styled.b`display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:-0.2px;`;
const PriceVal=styled.b`font-size:17px;font-weight:900;letter-spacing:-0.3px;font-variant-numeric:tabular-nums;color:${C.slate800};`;
const CopyBtn=styled.button`border:1px solid ${C.slate200};background:#fff;color:${C.slate500};border-radius:7px;padding:2px 7px;font-size:11px;font-weight:700;cursor:pointer;`;
const Call=styled.a`display:flex;align-items:center;justify-content:center;gap:7px;height:48px;border-radius:12px;background:${C.violet600};color:#fff;font-size:15px;font-weight:800;text-decoration:none;margin-top:4px;`;
const DoneBtn=styled.button`height:46px;border-radius:12px;border:1px solid ${C.slate200};background:#fff;color:${C.slate800};font-size:14px;font-weight:700;cursor:pointer;`;
const Field=styled.label`display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:${C.slate500};`;
const NoteArea=styled.textarea`border:1px solid ${C.slate200};border-radius:12px;padding:11px 12px;font-size:14px;color:${C.slate800};font-family:inherit;resize:vertical;min-height:76px;&:focus{outline:none;border-color:${C.violet300};}`;
const PickRow=styled.div`display:flex;gap:8px;flex-wrap:wrap;`;
const SmallChip=styled(Chip)`padding:7px 12px;font-size:12.5px;`;
const SheetBtns=styled.div`display:flex;gap:8px;margin-top:4px;`;
const ChooseBtn=styled.button`flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 10px;border-radius:14px;border:1px solid ${C.slate200};background:#fff;color:${C.slate800};font-size:14px;font-weight:700;cursor:pointer;&:active{transform:translateY(1px);}& > small{font-size:11px;font-weight:600;color:${C.slate500};}`;
const RecurBadge=styled.span`display:inline-flex;align-items:center;gap:3px;border:1px solid ${C.violet300};color:${C.violet600};border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;`;
// 카드 제목 줄 오른쪽에 붙는 보조 액션 (휴무 설정 등)
const CardHead=styled.div`display:flex;align-items:center;justify-content:space-between;gap:8px;`;
// 주간/월간 전환
const ViewToggle=styled.div`display:flex;gap:6px;`;
const ViewBtn=styled.button`flex:1;border:1px solid ${({$on})=>$on?C.violet600:C.slate200};background:${({$on})=>$on?C.violet50:"#fff"};color:${({$on})=>$on?C.violet600:C.slate500};border-radius:10px;padding:7px;font-size:12.5px;font-weight:700;cursor:pointer;`;
const MonthWd=styled.div`text-align:center;font-size:10.5px;font-weight:700;color:${({$dow})=>($dow===0?C.red500:$dow===6?C.violet600:C.slate400)};`;
// 예약 검색 결과 줄
const SearchRow=styled.div`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid ${C.slate200};cursor:pointer;&:last-of-type{border-bottom:none;}&:active{background:#fafafa;}`;
const ItemL=styled.div`display:flex;flex-direction:column;gap:2px;min-width:0;`;
const ItemT=styled.div`font-size:13.5px;font-weight:700;color:${C.slate800};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
const ItemS=styled.div`font-size:11.5px;color:${C.slate500};`;
// 예약 상태 한글 표기 (검색 결과 뱃지)
const STATUS_LABEL={requested:"승인대기",pending:"결제대기",confirmed:"확정",done:"이용완료",cancelled:"취소",rejected:"반려",noshow:"노쇼"};
const HeadBtn=styled.button`display:inline-flex;align-items:center;gap:4px;flex-shrink:0;border:1px solid ${C.slate200};background:#fff;color:${C.slate500};border-radius:9px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;&:active{transform:translateY(1px);}`;

export default function OwnerHomePage(){
  const navigate=useNavigate();
  const {venue,loading:ownerLoading,refresh:ownerRefresh}=useOwner();
  const {showToast}=useUIActions()||{};
  const toast=(m)=>{if(showToast)showToast({message:m});};
  const {confirmState,ask,closeConfirm}=useConfirm();
  const nm=(r)=>r?.teamName||r?.userName||(r?.matchId?`${r?.teamAName||"팀A"} vs ${r?.teamBName||"팀B"}`:"이");
  const copyCode=async(code)=>{toast((await copyText(code))?"예약번호를 복사했어요.":"예약번호 복사에 실패했어요.");};
  const courts=venue?.courts||[];
  const today=useMemo(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());},[]);
  const [courtId,setCourtId]=useState(courts[0]?.id||"");
  const [weekOff,setWeekOff]=useState(0);
  const [date,setDate]=useState(ymd(today));
  const [reservations,setReservations]=useState([]);
  const [pendingAll,setPendingAll]=useState([]); // 구장 전체(전 코트·전 날짜) 승인대기 — 큐/배지용
  const [blocks,setBlocks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [detailResv,setDetailResv]=useState(null); // 예약 상세 팝업
  const [approveTarget,setApproveTarget]=useState(null); // 승인 대상 예약 (안내글 입력 모달)
  const [approveNote,setApproveNote]=useState("");
  const [slotSheet,setSlotSheet]=useState(null); // 빈 슬롯 탭 → 액션 선택 {s}
  const [bookForm,setBookForm]=useState(null); // 수동예약 폼 {s,name,phone,price,method,weeks,memo}
  const [offSheet,setOffSheet]=useState(null); // 기간 휴무 폼 {from,to,allDay,start,end,scope}
  const [allRows,setAllRows]=useState([]);     // 구장 전체 예약(전 코트·전 상태) — 검색용
  const [searchQ,setSearchQ]=useState("");     // 예약 검색어 (이름·연락처·예약번호)
  const [calView,setCalView]=useState("week"); // week | month

  const court=courts.find(c=>c.id===courtId)||courts[0]||null;
  const perPerson=isPerPerson(court); // 1인 요금제 코트 — 금액이 인원에 따라 달라진다

  const weekDays=useMemo(()=>{
    const base=new Date(today);base.setDate(base.getDate()-base.getDay()+weekOff*7);
    return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);return{date:ymd(d),num:d.getDate(),dow:d.getDay()};});
  },[today,weekOff]);

  const load=async()=>{
    if(!venue?.id||!court?.id)return;
    setLoading(true);
    try{
      const [rsAll,bs]=await Promise.all([
        listReservations({venueId:venue.id}),                  // 구장 전체(전 코트) — 승인대기 큐/배지가 미래·타코트 요청을 놓치지 않게
        listBlocks({venueId:venue.id,courtId:court.id}),
      ]);
      const ids=[...new Set(rsAll.filter(r=>r.status==="pending"&&r.matchId).map(r=>r.matchId))];
      if(ids.length)await Promise.all(ids.map(id=>expireMatchReservationIfNeeded(id).catch(()=>{})));
      setReservations(rsAll.filter(r=>r.courtId===court.id)); // 시간표 그리드는 선택 코트만
      setPendingAll(rsAll.filter(r=>r.status==="requested")); // 승인 대기는 전 코트·전 날짜
      setAllRows(rsAll);                                     // 검색은 구장 전체·전 상태 대상
      setBlocks(bs); // 막아둔 시간 — 이걸 담지 않으면 막아도 "예약가능"으로 보이고 해제도 못 한다
    }catch(e){setReservations([]);setPendingAll([]);setAllRows([]);setBlocks([]);}finally{setLoading(false);}
  };
  useEffect(()=>{load();/*eslint-disable-next-line*/},[venue?.id,courtId]);

  const dayKey=useMemo(()=>dowToKey(new Date(`${date}T00:00:00`).getDay()),[date]);
  const dayHours=court?.hours?.[dayKey];
  const isClosed=!dayHours||dayHours.closed;
  const slots=useMemo(()=>buildSlots(court,dayKey),[court,dayKey]);
  const dayResv=useMemo(()=>reservations.filter(r=>r.date===date),[reservations,date]);
  const dayBlocks=useMemo(()=>blocks.filter(b=>b.date===date),[blocks,date]);
  const nowMin=useMemo(()=>{const n=new Date();return{today:ymd(n),min:n.getHours()*60+n.getMinutes()};},[]);

  const slotKind=(s)=>{
    const dn=dayResv.find(r=>r.status==="done"&&overlap(s.start,s.end,r.startTime,r.endTime));
    if(dn)return{k:"done",r:dn};
    const cf=dayResv.find(r=>r.status==="confirmed"&&overlap(s.start,s.end,r.startTime,r.endTime));
    if(cf)return{k:"confirmed",r:cf};
    const pd=dayResv.find(r=>["requested","pending"].includes(r.status)&&overlap(s.start,s.end,r.startTime,r.endTime));
    if(pd)return{k:"pending",r:pd};
    const bl=dayBlocks.find(b=>overlap(s.start,s.end,b.startTime,b.endTime));
    if(bl)return{k:"blocked",b:bl};
    if(date<nowMin.today||(date===nowMin.today&&toMin(s.start)<=nowMin.min))return{k:"past"};
    return{k:"open"};
  };
  const slotTeam=(r)=>{ if(!r)return""; if(r.matchId)return `${r.teamAName||"팀A"} vs ${r.teamBName||"팀B"}`; return r.teamName||r.userName||"예약"; };
  const dayCounts=(dStr)=>{const rs=reservations.filter(r=>r.date===dStr);return{cf:rs.filter(r=>r.status==="confirmed").length,pd:rs.filter(r=>["requested","pending"].includes(r.status)).length};};

  // 월간 뷰 — 선택한 날짜가 속한 달. 앞쪽 빈칸(null)은 요일 맞추기용.
  const monthCells=useMemo(()=>{
    const b=new Date(`${date}T00:00:00`);
    if(Number.isNaN(b.getTime()))return[];
    const y=b.getFullYear(),m=b.getMonth();
    const lead=new Date(y,m,1).getDay();
    const total=new Date(y,m+1,0).getDate();
    const cells=Array.from({length:lead},()=>null);
    for(let d=1;d<=total;d++)cells.push(ymd(new Date(y,m,d)));
    return cells;
  },[date]);
  const shiftMonth=(delta)=>{
    const b=new Date(`${date}T00:00:00`);
    if(Number.isNaN(b.getTime()))return;
    setDate(ymd(new Date(b.getFullYear(),b.getMonth()+delta,1)));
  };

  // 오늘 요약 — 구장 전체(전 코트) 기준. 코트를 고르기 전에 오늘 상태부터 보여준다.
  const todaySummary=useMemo(()=>{
    const rows=allRows.filter(r=>r.date===nowMin.today);
    const live=rows.filter(r=>["confirmed","done"].includes(r.status));
    const remaining=live.filter(r=>r.status==="confirmed"&&toMin(r.endTime)>nowMin.min)
      .sort((a,b)=>toMin(a.startTime)-toMin(b.startTime));
    return {
      confirmed: live.length,
      remaining: remaining.length,
      doneOrPast: live.length-remaining.length,
      next: remaining[0]||null,
    };
  },[allRows,nowMin]);
  const todayLabel=`${Number(nowMin.today.slice(5,7))}.${Number(nowMin.today.slice(8))}`;
  const goToday=()=>{setWeekOff(0);setDate(nowMin.today);};

  // 예약 찾기 — 전화 문의 응대용. 이름·팀명·연락처·예약번호·메모까지 훑는다.
  const searchHits=useMemo(()=>{
    const q=searchQ.trim().toLowerCase();
    if(q.length<2)return[];
    const digits=q.replace(/[^0-9]/g,"");
    const hit=(r)=>{
      const text=[r.userName,r.teamName,r.teamAName,r.teamBName,r.reservationCode,r.memo].filter(Boolean).join(" ").toLowerCase();
      if(text.includes(q))return true;
      if(digits.length>=3){
        const phones=[r.phone,r.teamALeaderPhone,r.teamBLeaderPhone].filter(Boolean).map(p=>String(p).replace(/[^0-9]/g,""));
        if(phones.some(p=>p.includes(digits)))return true;
      }
      return false;
    };
    return [...allRows].filter(hit).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(a.startTime<b.startTime?1:-1));
  },[allRows,searchQ]);
  const searchMore=Math.max(0,searchHits.length-20);

  const onSlot=async(s,info)=>{
    if(busy)return;
    if(info.k==="confirmed"||info.k==="pending"||info.k==="done"){ if(info.r) setDetailResv(info.r); return; }
    if(info.k==="open"){ setSlotSheet({s}); return; }
    if(info.k==="blocked"){
      if(date<nowMin.today)return;
      // 하루 통째로 막아둔 휴무는 슬롯 하나만 푸는 게 아니라 그날 전체가 열린다 → 먼저 확인.
      const wholeDay=toMin(info.b.startTime)<=0&&toMin(info.b.endTime)>=1440;
      if(wholeDay&&!await ask({title:"휴무 해제",message:`${date} ${court?.name} 은(는) 하루 종일 휴무예요.\n해제하면 그날 전체가 다시 예약 가능해져요.`,confirmLabel:"해제"}))return;
      setBusy(true);
      try{await removeBlock(info.b.id);await load();toast(wholeDay?"휴무를 해제했어요.":"막아둔 시간을 해제했어요.");}
      catch(e){toast(e?.message||"해제에 실패했어요.");}
      finally{setBusy(false);}
    }
  };
  // 빈 슬롯 액션: 직접 예약 / 시간 막기
  const doBlock=async(s)=>{setSlotSheet(null);setBusy(true);try{await addBlock({venueId:venue.id,courtId:court.id,date,startTime:s.start,endTime:s.end});await load();toast("이 시간을 막았어요.");}catch(e){toast(e?.message||"시간을 막지 못했어요.");}finally{setBusy(false);}};

  // 기간 휴무 — 공사·대회·명절처럼 여러 날을 한 번에 닫는다.
  const openOffSheet=()=>setOffSheet({from:date,to:date,allDay:true,start:"09:00",end:"18:00",scope:"court"});
  const submitOff=async()=>{
    const f=offSheet; if(!f)return;
    setBusy(true);
    try{
      const courtIds=f.scope==="all"?courts.map(c=>c.id):[court.id];
      const {created,skipped}=await addBlockRange({
        venueId:venue.id,courtIds,fromDate:f.from,toDate:f.to,
        allDay:f.allDay,startTime:f.start,endTime:f.end,
      });
      setOffSheet(null);
      await load();
      toast(created.length
        ? `휴무 ${created.length}건을 등록했어요${skipped.length?` (예약이 있어 ${skipped.length}건 제외)`:""}.`
        : "이미 예약이 있어 막지 못했어요. 예약을 먼저 처리해주세요.");
    }catch(e){toast(e?.message||"휴무 설정에 실패했어요.");}
    finally{setBusy(false);}
  };
  // 정기대관 남은 회차 일괄 취소
  const cancelSeries=async(r)=>{
    if(!await ask({title:"정기대관 전체 취소",message:`${nm(r)}의 정기대관 중 오늘 이후 남은 예약을 모두 취소할까요?\n지난 회차는 기록으로 남아요.`,confirmLabel:"모두 취소",danger:true}))return;
    setBusy(true);
    try{
      const {cancelled}=await cancelRecurringSeries(r.recurringId,{venueId:venue.id});
      await load(); setDetailResv(null);
      toast(cancelled?`정기대관 ${cancelled}건을 취소했어요.`:"취소할 남은 예약이 없어요.");
    }catch(e){toast(e?.message||"취소에 실패했어요.");}
    finally{setBusy(false);}
  };
  // 직접 예약 폼 — 인원제 코트는 최소 인원으로 시작하고, 인원을 바꾸면 금액을 다시 계산한다.
  const openBookForm=(s)=>{
    const heads=clampHeadcount(court,court?.minHeadcount);
    const p=calcSlotPrice(court,s.start,s.end,date,heads);
    setSlotSheet(null);
    setBookForm({s,name:"",phone:"",price:String(p||0),weeks:1,memo:"",heads});
  };
  const setBookHeads=(n)=>setBookForm(f=>{
    if(!f)return f;
    const heads=clampHeadcount(court,n);
    return {...f,heads,price:String(calcSlotPrice(court,f.s.start,f.s.end,date,heads)||0)};
  });
  const submitBook=async()=>{
    const f=bookForm; if(!f)return;
    setBusy(true);
    try{
      const {created,skipped}=await createOwnerReservation({
        venue,court,date,startTime:f.s.start,endTime:f.s.end,
        customerName:f.name,phone:f.phone,memo:f.memo,
        price:Number(f.price)||0,repeatWeeks:Number(f.weeks)||1,headcount:f.heads,
      });
      setBookForm(null);
      await load();
      const msg=created.length>1
        ? `정기대관 ${created.length}건을 등록했어요${skipped.length?` (겹쳐서 ${skipped.length}건 제외)`:""}.`
        : (created.length?"예약을 등록했어요.":"이미 예약된 시간이라 등록하지 못했어요.");
      toast(msg);
    }catch(e){toast(e?.message||"예약 등록에 실패했어요.");}
    finally{setBusy(false);}
  };
  // 승인 시 예약자에게 남길 안내글을 입력받는 모달을 연다 (안내글은 선택).
  // 구장정보에 등록해둔 기본 안내문으로 미리 채운다 — 매번 같은 입장 안내를 다시 쓰지 않도록.
  const approveResv=(r)=>{ setApproveNote(venue?.defaultOwnerNote||""); setApproveTarget(r); };
  const submitApprove=async()=>{
    const r=approveTarget; if(!r)return;
    setBusy(true);
    try{
      await setReservationStatus(r.id,"confirmed",{ownerNote:approveNote.trim(),asOwner:true});
      track("owner_reservation_approve", { is_match: !!r.matchId }); // 운영 전환 — 예약 승인
      await load();
      setApproveTarget(null); setDetailResv(null);
      toast("예약을 승인했어요.");
    }catch(e){toast(e?.message||"승인에 실패했어요.");}
    finally{setBusy(false);}
  };
  const rejectResv=async(r)=>{
    const isMatch=!!r.matchId;
    if(!await ask({title:"예약 반려",message:`${nm(r)} 예약을 반려할까요?${isMatch?"\n두 팀에 반려 알림이 가고, 다른 구장·시간으로 다시 제안할 수 있어요.":""}`,confirmLabel:"반려",danger:true}))return;
    setBusy(true);try{await rejectReservation(r.id,{by:"owner"});track("owner_reservation_reject", { is_match: isMatch });await load();toast("예약을 반려했어요.");}catch(e){toast(e?.message||"반려에 실패했어요.");}finally{setBusy(false);}
  };
  const markDone=async(r)=>{
    if(!await ask({title:"이용 완료 처리",message:`${nm(r)} 예약을 이용 완료로 처리할까요?`,confirmLabel:"완료 처리"}))return;
    setBusy(true);try{await setReservationStatus(r.id,"done",{asOwner:true});await load();setDetailResv(null);toast("이용 완료로 처리했어요.");}catch(e){toast(e?.message||"처리에 실패했어요.");}finally{setBusy(false);}
  };
  const noshowResv=async(r)=>{
    if(!await ask({title:"노쇼 처리",message:`${nm(r)} 예약을 노쇼로 처리할까요?\n노쇼 이력이 기록돼요.`,confirmLabel:"노쇼 처리",danger:true}))return;
    setBusy(true);try{await markReservationNoshow(r.id);await load();setDetailResv(null);toast("노쇼로 처리했어요.");}catch(e){toast(e?.message||"처리에 실패했어요.");}finally{setBusy(false);}
  };
  const cancelResv=async(r)=>{
    if(!await ask({title:"예약 취소",message:`${nm(r)} 예약을 취소할까요?`,confirmLabel:"예약 취소",danger:true}))return;
    setBusy(true);try{await cancelReservation(r.id,{by:"owner"});await load();setDetailResv(null);toast("예약을 취소했어요.");}catch(e){toast(e?.message||"취소에 실패했어요.");}finally{setBusy(false);}
  };

  if(ownerLoading)return <Page><OwnerSpinner label="불러오는 중…"/></Page>;
  if(!venue||venue.status!=="approved")return <Page><VenueGateNotice venue={venue} refresh={ownerRefresh}/></Page>;
  if(!courts.length)return <Page><Card><Empty>등록된 코트가 없어요. '구장정보'에서 코트를 추가해주세요.</Empty></Card></Page>;

  const sum=slots.reduce((a,s)=>{const k=slotKind(s).k;if(k==="confirmed"||k==="done")a.cf++;else if(k==="pending")a.pd++;else if(k==="blocked")a.bl++;else if(k==="open")a.op++;return a;},{cf:0,pd:0,bl:0,op:0});
  // 승인 대기 큐: 구장 전체(전 코트·전 날짜) requested를 날짜→시간 순으로
  const requested=[...pendingAll].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.startTime<b.startTime?-1:1);

  return (
    <Page>
      <ScreenTitle>예약관리</ScreenTitle>

      {/* 정산 계좌는 승인 후에 받는다(온보딩에서 뺐다) → 승인 직후 여기서 한 번 붙잡는다.
          계좌가 없으면 예약은 받아도 돈을 보낼 방법이 없다. */}
      {!venue.settlement?.account && (
        <Card>
          <SecTitle>정산 계좌를 등록해주세요</SecTitle>
          <Caption>승인이 끝났어요. 계좌를 등록해야 예약 대금을 지급받을 수 있어요. 내정보 탭에서 1분이면 끝나요.</Caption>
          <PrimaryBtn type="button" onClick={()=>navigate("/owner/my")}>지금 등록하기</PrimaryBtn>
        </Card>
      )}

      {/* 오늘 먼저 — 사장님이 아침에 확인하는 건 "오늘 몇 건, 지금 뭘 처리해야 하나"다. */}
      <Card>
        <CardHead>
          <SecTitle style={{margin:0}}>오늘 {todayLabel}</SecTitle>
          {date!==nowMin.today&&<HeadBtn type="button" onClick={goToday}>오늘로</HeadBtn>}
        </CardHead>
        <Summary>
          <Sum><SumN $c={C.violet600}>{todaySummary.confirmed}</SumN><SumL>오늘 확정</SumL></Sum>
          <Sum><SumN $c={C.amber500}>{pendingAll.length}</SumN><SumL>승인 대기</SumL></Sum>
          <Sum><SumN $c={C.green600}>{todaySummary.remaining}</SumN><SumL>남은 예약</SumL></Sum>
          <Sum><SumN $c={C.slate400}>{todaySummary.doneOrPast}</SumN><SumL>지난 예약</SumL></Sum>
        </Summary>
        {todaySummary.next
          ? <Caption>다음 예약 {todaySummary.next.startTime}~{todaySummary.next.endTime} · {todaySummary.next.courtName||"코트"} · {nm(todaySummary.next)}</Caption>
          : <Caption>{todaySummary.confirmed?"오늘 남은 예약이 없어요.":"오늘은 아직 예약이 없어요."}</Caption>}
      </Card>

      <ChipRow>
        {courts.map(c=>{const cnt=pendingAll.filter(r=>r.courtId===c.id).length;return(
          <CourtChip key={c.id} $on={c.id===court?.id} onClick={()=>setCourtId(c.id)}>
            {c.name}{cnt>0&&<ChipBadge>{cnt>9?"9+":cnt}</ChipBadge>}
          </CourtChip>
        );})}
      </ChipRow>

      <Card>
        <WeekHead>
          <WeekNav onClick={()=>calView==="week"?setWeekOff(w=>w-1):shiftMonth(-1)}><LuChevronLeft size={20}/></WeekNav>
          <WeekLabel>
            {calView==="week"
              ? `${weekDays[0]?.date.slice(5).replace("-",".")} ~ ${weekDays[6]?.date.slice(5).replace("-",".")}`
              : `${date.slice(0,4)}년 ${Number(date.slice(5,7))}월`}
          </WeekLabel>
          <WeekNav onClick={()=>calView==="week"?setWeekOff(w=>w+1):shiftMonth(1)}><LuChevronRight size={20}/></WeekNav>
        </WeekHead>

        {/* 주간은 오늘 중심 운영, 월간은 다음 달 대관 현황 파악용 */}
        <ViewToggle>
          <ViewBtn type="button" $on={calView==="week"} onClick={()=>setCalView("week")}>주간</ViewBtn>
          <ViewBtn type="button" $on={calView==="month"} onClick={()=>setCalView("month")}>월간</ViewBtn>
        </ViewToggle>

        {calView==="week"?(
          <Days>
            {weekDays.map(d=>{const c=dayCounts(d.date);return(
              <Day key={d.date} $on={d.date===date} onClick={()=>setDate(d.date)}>
                <DayWd $dow={d.dow}>{WEEK[d.dow]}</DayWd>
                <DayNum $on={d.date===date}>{d.num}</DayNum>
                <Dots>{c.cf>0&&<Dot $c={C.violet600}/>}{c.pd>0&&<Dot $c={C.amber500}/>}</Dots>
              </Day>
            );})}
          </Days>
        ):(
          <>
            <Days>
              {WEEK.map((w,i)=><MonthWd key={w} $dow={i}>{w}</MonthWd>)}
            </Days>
            <Days>
              {monthCells.map((cell,i)=>{
                if(!cell)return <span key={`e${i}`}/>;
                const c=dayCounts(cell);
                const dow=new Date(`${cell}T00:00:00`).getDay();
                return(
                  <Day key={cell} $on={cell===date} onClick={()=>setDate(cell)}>
                    <DayNum $on={cell===date} style={{fontSize:14,color:cell===date?C.violet600:dow===0?C.red500:C.slate800}}>{Number(cell.slice(8))}</DayNum>
                    <Dots>{c.cf>0&&<Dot $c={C.violet600}/>}{c.pd>0&&<Dot $c={C.amber500}/>}</Dots>
                  </Day>
                );
              })}
            </Days>
            <Caption>보라 점 = 확정, 노랑 점 = 대기 ({court?.name} 기준). 날짜를 누르면 그날 시간표를 봐요.</Caption>
          </>
        )}
      </Card>

      {/* 예약 찾기 — 전화 문의 응대용. 이름·연락처·예약번호 어느 것으로도 찾는다. */}
      <Card>
        <SecTitle>예약 찾기</SecTitle>
        <Input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="예약자·팀 이름, 연락처 뒷자리, 예약번호" />
        {searchQ.trim().length>0&&(
          searchHits.length===0
            ? <Empty>{searchQ.trim().length<2?"두 글자 이상 입력해주세요.":"찾는 예약이 없어요."}</Empty>
            : <>
                {searchHits.slice(0,20).map(r=>(
                  <SearchRow key={r.id} onClick={()=>setDetailResv(r)}>
                    <ItemL>
                      <ItemT>{nm(r)}</ItemT>
                      <ItemS>{r.date} {r.startTime}~{r.endTime} · {r.courtName||"코트"}{r.reservationCode?` · ${r.reservationCode}`:""}</ItemS>
                    </ItemL>
                    <StatBadge $tone={r.status==="confirmed"?"confirmed":r.status==="done"?"done":(r.status==="requested"||r.status==="pending")?"pending":"refund"}>
                      {STATUS_LABEL[r.status]||r.status}
                    </StatBadge>
                  </SearchRow>
                ))}
                {searchMore>0&&<Caption>가장 최근 20건만 보여요 (총 {searchHits.length}건).</Caption>}
              </>
        )}
      </Card>

      <Summary>
        <Sum><SumN $c={C.violet600}>{sum.cf}</SumN><SumL>확정</SumL></Sum>
        <Sum><SumN $c={C.amber500}>{sum.pd}</SumN><SumL>대기</SumL></Sum>
        <Sum><SumN $c={C.slate400}>{sum.bl}</SumN><SumL>막기</SumL></Sum>
        <Sum><SumN $c={C.green600}>{sum.op}</SumN><SumL>가능</SumL></Sum>
      </Summary>

      <Card>
        <CardHead>
          <SecTitle style={{margin:0}}>{date.slice(5).replace("-",".")} 시간대</SecTitle>
          <HeadBtn type="button" onClick={openOffSheet}><LuCalendarOff size={13}/> 휴무 설정</HeadBtn>
        </CardHead>
        <Caption>빈 슬롯을 누르면 전화·현장 예약을 직접 넣거나 시간을 막을 수 있어요. 막은 슬롯을 다시 누르면 해제.</Caption>
        {loading?<OwnerSpinner label="불러오는 중…"/>:isClosed?<Empty>이 요일은 휴무예요.</Empty>:slots.length===0?<Empty>운영시간이 없어요.</Empty>:(
          <Grid>
            {slots.map((s,i)=>{const info=slotKind(s);return(
              <Slot key={i} $k={info.k} onClick={()=>onSlot(s,info)}>
                <SlotT>{s.start}~{s.end}</SlotT>
                <SlotS $k={info.k}>
                  {/* 승인 뒤(pending)는 예약자 결제를 기다리는 단계다. requested 와 같은 글자를 쓰면
                      승인을 눌러도 화면이 안 변해서 승인이 안 된 것처럼 보인다. */}
                  {info.k==="confirmed"?<><LuCheck size={12}/>확정</>
                  :info.k==="done"?<><LuCheck size={12}/>사용</>
                  :info.k==="pending"?<><LuHourglass size={12}/>{info.r?.status==="pending"?"결제대기":"승인대기"}</>
                  :info.k==="blocked"?<><LuLock size={12}/>막힘</>
                  :info.k==="past"?"지남"
                  :<>예약가능 · {(()=>{const p=resolveSlotPrice(court,date,s.start);if(!p)return"무료";return `${perPerson?"1인 ":""}${Number(p).toLocaleString()}원`;})()}</>}
                </SlotS>
                {info.r&&<SlotTeam>{slotTeam(info.r)}</SlotTeam>}
              </Slot>
            );})}
          </Grid>
        )}
      </Card>

      <Card>
        <SecTitle>승인 대기 {requested.length>0&&`(${requested.length})`}</SecTitle>
        {requested.length===0?<Empty>승인 대기 중인 예약이 없어요.</Empty>:requested.map(r=>{const isMatch=!!r.matchId;return(
          <Resv key={r.id}>
            <ResvTop>
              <ResvName>{isMatch?`${r.teamAName||"팀A"} vs ${r.teamBName||"팀B"}`:(r.teamName||r.userName||"예약자")}</ResvName>
              <StatBadge $tone="pending"><LuHourglass size={11}/>{isMatch?"매칭 승인대기":"승인대기"}</StatBadge>
            </ResvTop>
            <ResvMeta>{r.date?.slice(5).replace("-",".")} · {r.courtName||court?.name||"코트"} · {r.startTime}~{r.endTime}{r.headcount>0?` · ${r.headcount}명`:""}{r.price?` · ${r.price.toLocaleString()}원`:""}</ResvMeta>
            <ContactRow>
              {isMatch ? (
                [{n:r.teamAName||"팀A",p:r.teamALeaderPhone},{n:r.teamBName||"팀B",p:r.teamBLeaderPhone}].map((t,i)=>(
                  t.p
                    ? <MiniCall key={i} href={`tel:${t.p}`}><LuPhone size={12}/>{t.n} {formatPhone(t.p)}</MiniCall>
                    : <NoPhone key={i}>{t.n} 연락처 미등록</NoPhone>
                ))
              ) : r.phone ? (
                <MiniCall href={`tel:${r.phone}`}><LuPhone size={12}/>{r.userName||r.teamName||"예약자"} {formatPhone(r.phone)}</MiniCall>
              ) : (
                <NoPhone>연락처 미등록</NoPhone>
              )}
            </ContactRow>
            {r.date<nowMin.today ? (
              <Caption>지난 요청 · 처리할 수 없어요</Caption>
            ) : (
              <Acts>
                <SBtn $primary onClick={()=>approveResv(r)} disabled={busy}>승인</SBtn>
                <SBtn $danger onClick={()=>rejectResv(r)} disabled={busy}>반려</SBtn>
              </Acts>
            )}
          </Resv>
        );})}
      </Card>

      <OwnerFooter />

      {detailResv && (()=>{
        const r=detailResv;
        const isMatch=!!r.matchId;
        // pending = 내가 승인했고 예약자가 결제하는 중. requested(내 승인 대기)와 구분해야 한다.
        const label=r.status==="confirmed"?"예약 확정":r.status==="requested"?"승인 대기":r.status==="pending"?"결제 대기":r.status==="done"?"이용 완료":r.status;
        const tone=r.status==="confirmed"?"confirmed":(r.status==="requested"||r.status==="pending")?"pending":"done";
        return (
          <Overlay onClick={()=>setDetailResv(null)}>
            <Sheet onClick={e=>e.stopPropagation()}>
              <SheetTitle>
                <SheetHeadL>
                  <StatusOverline $tone={tone}>{label}</StatusOverline>
                  <span style={{display:"flex",alignItems:"center",gap:8}}>예약 정보 {r.recurringId&&<RecurBadge><LuHourglass size={11}/>정기</RecurBadge>}</span>
                </SheetHeadL>
                <X onClick={()=>setDetailResv(null)}>×</X>
              </SheetTitle>
              {r.status==="pending"&&(
                <DRow><span>안내</span><b style={{fontWeight:600,color:C.slate500}}>
                  예약자가 결제하면 확정돼요.{r.paymentDeadline?` (${new Date(r.paymentDeadline).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}까지)`:""}
                </b></DRow>
              )}
              {r.reservationCode&&(
                <DRow><span>예약번호</span><CodeVal>
                  {r.reservationCode}
                  <CopyBtn type="button" onClick={()=>copyCode(r.reservationCode)}>복사</CopyBtn>
                </CodeVal></DRow>
              )}
              <DRow><span>일시</span><b>{r.date} {r.startTime}~{r.endTime}</b></DRow>
              <DRow><span>코트</span><b>{r.courtName||court?.name||"-"}</b></DRow>
              {r.headcount>0&&(
                <DRow><span>인원</span><b>{r.headcount}명{r.unitPrice?` · 1인 ${Number(r.unitPrice).toLocaleString()}원`:""}</b></DRow>
              )}
              <DRow><span>이용료</span><PriceVal>{(r.price||r.splitTotal||0).toLocaleString()}원</PriceVal></DRow>
              {!isMatch&&r.memo&&<DRow><span>메모</span><b style={{fontWeight:600}}>{r.memo}</b></DRow>}
              {r.userNote&&<DRow><span>요청사항</span><b style={{fontWeight:600}}>{r.userNote}</b></DRow>}

              {isMatch ? (
                <>
                  <DRow style={{marginTop:2}}><span style={{fontWeight:700,color:C.slate800}}>매칭 · 두 팀</span></DRow>
                  {[
                    {name:r.teamAName||"팀A", who:r.teamALeaderName, phone:r.teamALeaderPhone},
                    {name:r.teamBName||"팀B", who:r.teamBLeaderName, phone:r.teamBLeaderPhone},
                  ].map((t,i)=>(
                    <TeamBlock key={i}>
                      <TeamName>{t.name}</TeamName>
                      <DRow><span>팀장</span><b>{t.who||"-"}</b></DRow>
                      {t.phone
                        ? <DRow><span>연락처</span><MiniCall href={`tel:${t.phone}`}><LuPhone size={13}/> {formatPhone(t.phone)}</MiniCall></DRow>
                        : <DRow><span>연락처</span><b style={{color:C.slate400}}>미등록</b></DRow>}
                    </TeamBlock>
                  ))}
                </>
              ) : (
                <>
                  <DRow><span>팀명</span><b>{r.teamName||"-"}</b></DRow>
                  {r.userName && <DRow><span>예약자 (대화명)</span><b>{r.userName}</b></DRow>}
                  {r.phone
                    ? <Call href={`tel:${r.phone}`}><LuPhone size={16}/> {formatPhone(r.phone)} 전화걸기</Call>
                    : <DRow><span>연락처</span><b style={{color:C.slate400}}>미등록</b></DRow>}
                </>
              )}

              {r.date<nowMin.today && r.status==="confirmed" && (
                <Caption style={{marginTop:4}}>지난 예약이에요. 이용 결과(완료·노쇼)를 기록하면 통계에 반영돼요.</Caption>
              )}

              {/* 정기대관은 회차가 여러 건이라 한 건씩 취소하면 끝이 없다 → 시리즈 통째 취소를 붙인다. */}
              {r.recurringId && r.status==="confirmed" && r.date>=nowMin.today && (
                <GhostBtn onClick={()=>cancelSeries(r)} disabled={busy} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <LuRepeat size={14}/> 정기대관 남은 회차 모두 취소
                </GhostBtn>
              )}

              {r.status==="confirmed" && (
                <>
                  <DoneBtn onClick={()=>markDone(r)} disabled={busy}>이용 완료 처리</DoneBtn>
                  <SheetBtns>
                    <GhostBtn style={{flex:1}} onClick={()=>noshowResv(r)} disabled={busy}>노쇼 처리</GhostBtn>
                    {r.date>=nowMin.today && <DangerBtn style={{flex:1}} onClick={()=>cancelResv(r)} disabled={busy}>예약 취소</DangerBtn>}
                  </SheetBtns>
                </>
              )}
            </Sheet>
          </Overlay>
        );
      })()}

      {slotSheet && (
        <Overlay onClick={()=>setSlotSheet(null)}>
          <Sheet onClick={e=>e.stopPropagation()}>
            <SheetTitle>{slotSheet.s.start}~{slotSheet.s.end} <X onClick={()=>setSlotSheet(null)}>×</X></SheetTitle>
            <Caption>{date.slice(5).replace("-",".")} · {court?.name} — 이 시간에 무엇을 할까요?</Caption>
            <SheetBtns>
              <ChooseBtn onClick={()=>openBookForm(slotSheet.s)}><LuPhone size={20}/>직접 예약<small>전화·현장 예약 등록</small></ChooseBtn>
              <ChooseBtn onClick={()=>doBlock(slotSheet.s)} disabled={busy}><LuLock size={20}/>시간 막기<small>예약 불가로 잠금</small></ChooseBtn>
            </SheetBtns>
          </Sheet>
        </Overlay>
      )}

      {bookForm && (
        <Overlay onClick={()=>setBookForm(null)}>
          <Sheet onClick={e=>e.stopPropagation()}>
            <SheetTitle>직접 예약 추가 <X onClick={()=>setBookForm(null)}>×</X></SheetTitle>
            <DRow><span>일시</span><b>{date} {bookForm.s.start}~{bookForm.s.end}</b></DRow>
            <DRow><span>코트</span><b>{court?.name||"-"}</b></DRow>
            <Field>예약자/팀 이름
              <Input value={bookForm.name} onChange={e=>setBookForm(f=>({...f,name:e.target.value}))} placeholder="예: 번개농구팀 / 홍길동" />
            </Field>
            <Field>연락처
              <Input value={bookForm.phone} onChange={e=>setBookForm(f=>({...f,phone:e.target.value}))} placeholder="010-0000-0000" inputMode="tel" />
            </Field>
            {perPerson&&(
              <Field>이용 인원
                <PickRow>
                  <SmallChip onClick={()=>setBookHeads(bookForm.heads-1)}>−</SmallChip>
                  <SmallChip $on>{bookForm.heads}명</SmallChip>
                  <SmallChip onClick={()=>setBookHeads(bookForm.heads+1)}>＋</SmallChip>
                </PickRow>
                <Caption>1인 {Number(resolveSlotPrice(court,date,bookForm.s.start)||0).toLocaleString()}원 × {bookForm.heads}명 — 금액은 자동 계산되고, 필요하면 아래에서 고쳐도 돼요.</Caption>
              </Field>
            )}
            <Field>이용료(원)
              <Input value={bookForm.price} onChange={e=>setBookForm(f=>({...f,price:e.target.value.replace(/[^0-9]/g,"")}))} inputMode="numeric" />
            </Field>
            <Field>정기대관 (매주 반복)
              <PickRow>
                {[1,2,4,8,12].map(w=>(
                  <SmallChip key={w} $on={Number(bookForm.weeks)===w} onClick={()=>setBookForm(f=>({...f,weeks:w}))}>{w===1?"1회":`${w}주`}</SmallChip>
                ))}
              </PickRow>
            </Field>
            <Field>메모 (선택)
              <Input value={bookForm.memo} onChange={e=>setBookForm(f=>({...f,memo:e.target.value}))} placeholder="예: 정기 대관, 예약금 입금 확인" />
            </Field>
            <PrimaryBtn onClick={submitBook} disabled={busy}>
              {Number(bookForm.weeks)>1?`${bookForm.weeks}주 정기대관 등록`:"예약 등록"}
            </PrimaryBtn>
          </Sheet>
        </Overlay>
      )}

      {offSheet && (
        <Overlay onClick={()=>!busy&&setOffSheet(null)}>
          <Sheet onClick={e=>e.stopPropagation()}>
            <SheetTitle>휴무 설정<X onClick={()=>!busy&&setOffSheet(null)}>×</X></SheetTitle>
            <Caption>공사·대회·명절처럼 여러 날을 한 번에 닫을 때 써요. 이미 예약이 잡힌 날은 건너뛰고 알려드려요.</Caption>
            <Field>시작일
              <Input type="date" value={offSheet.from} onChange={e=>setOffSheet(f=>({...f,from:e.target.value,to:f.to<e.target.value?e.target.value:f.to}))} />
            </Field>
            <Field>종료일
              <Input type="date" value={offSheet.to} min={offSheet.from} onChange={e=>setOffSheet(f=>({...f,to:e.target.value}))} />
            </Field>
            <Field>시간
              <PickRow>
                <SmallChip $on={offSheet.allDay} onClick={()=>setOffSheet(f=>({...f,allDay:true}))}>하루 종일</SmallChip>
                <SmallChip $on={!offSheet.allDay} onClick={()=>setOffSheet(f=>({...f,allDay:false}))}>시간대 지정</SmallChip>
              </PickRow>
            </Field>
            {!offSheet.allDay && (
              <PickRow>
                <Input type="time" value={offSheet.start} onChange={e=>setOffSheet(f=>({...f,start:e.target.value}))} style={{flex:1}} />
                <Input type="time" value={offSheet.end} onChange={e=>setOffSheet(f=>({...f,end:e.target.value}))} style={{flex:1}} />
              </PickRow>
            )}
            {courts.length>1 && (
              <Field>대상 코트
                <PickRow>
                  <SmallChip $on={offSheet.scope==="court"} onClick={()=>setOffSheet(f=>({...f,scope:"court"}))}>{court?.name}만</SmallChip>
                  <SmallChip $on={offSheet.scope==="all"} onClick={()=>setOffSheet(f=>({...f,scope:"all"}))}>전체 코트 ({courts.length})</SmallChip>
                </PickRow>
              </Field>
            )}
            <PrimaryBtn onClick={submitOff} disabled={busy}>{busy?"설정 중…":"휴무로 막기"}</PrimaryBtn>
            <GhostBtn onClick={()=>!busy&&setOffSheet(null)} disabled={busy}>취소</GhostBtn>
          </Sheet>
        </Overlay>
      )}

      {approveTarget && (
        <Overlay onClick={()=>!busy&&setApproveTarget(null)}>
          <Sheet onClick={e=>e.stopPropagation()}>
            <SheetTitle>예약 승인<X onClick={()=>!busy&&setApproveTarget(null)}>×</X></SheetTitle>
            <Caption>{nm(approveTarget)} 예약을 승인해요. 예약자에게 전할 안내글을 남길 수 있어요. (선택)</Caption>
            <Field>안내글 (선택)
              <NoteArea value={approveNote} onChange={e=>setApproveNote(e.target.value)} maxLength={300}
                placeholder={"예: 정문 옆 주차장을 이용해주세요. 농구화 필수입니다."} />
            </Field>
            <Caption>
              {venue?.defaultOwnerNote
                ? "구장정보에 등록한 기본 안내문이에요. 이 예약에만 다르게 쓰려면 고쳐도 돼요."
                : "구장정보 > 예약 확정 안내문에 등록해두면 승인할 때 자동으로 채워져요."}
            </Caption>
            <PrimaryBtn onClick={submitApprove} disabled={busy}>{busy?"승인 중…":"승인하기"}</PrimaryBtn>
            <GhostBtn onClick={()=>!busy&&setApproveTarget(null)} disabled={busy}>취소</GhostBtn>
          </Sheet>
        </Overlay>
      )}

      <ConfirmDialog state={confirmState} onConfirm={()=>closeConfirm(true)} onCancel={()=>closeConfirm(false)} />
    </Page>
  );
}
