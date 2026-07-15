/* eslint-disable */
// src/pages/owner/OwnerHomePage.jsx
// 예약관리 — 주간 캘린더 + 시간대별 슬롯 + 요약 + 승인/반려 + 시간막기 (명세서 3)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { LuChevronLeft, LuChevronRight, LuLock, LuHourglass, LuCheck, LuPhone } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import {
  listReservations, listBlocks, addBlock, removeBlock, setReservationStatus,
  rejectReservation, createOwnerReservation,
  cancelReservation, markReservationNoshow,
  dowToKey, expireMatchReservationIfNeeded, resolveSlotPrice,
} from "../../services/ownerVenueService";
import { useUIActions } from "../../hooks/useUI";
import { formatPhoneE164 as formatPhone } from "../../utils/phone";
import { track } from "../../utils/analytics";
import { Page, Card, ScreenTitle, SecTitle, Caption, Chip, StatBadge, Input, PrimaryBtn, GhostBtn, DangerBtn, C } from "./components/od";
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
const Grid=styled.div`display:grid;grid-template-columns:repeat(2,1fr);gap:8px;`;
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
const SheetTitle=styled.div`font-size:17px;font-weight:800;color:${C.slate800};display:flex;align-items:center;justify-content:space-between;`;
const X=styled.button`border:none;background:transparent;color:${C.slate400};font-size:24px;cursor:pointer;line-height:1;`;
const DRow=styled.div`display:flex;justify-content:space-between;gap:10px;font-size:14px;align-items:center;& > span{color:${C.slate500};} & > b{color:${C.slate800};font-weight:700;text-align:right;}`;
const Call=styled.a`display:flex;align-items:center;justify-content:center;gap:7px;height:48px;border-radius:12px;background:${C.violet600};color:#fff;font-size:15px;font-weight:800;text-decoration:none;margin-top:4px;`;
const DoneBtn=styled.button`height:46px;border-radius:12px;border:1px solid ${C.slate200};background:#fff;color:${C.slate800};font-size:14px;font-weight:700;cursor:pointer;`;
const Field=styled.label`display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:${C.slate500};`;
const NoteArea=styled.textarea`border:1px solid ${C.slate200};border-radius:12px;padding:11px 12px;font-size:14px;color:${C.slate800};font-family:inherit;resize:vertical;min-height:76px;&:focus{outline:none;border-color:${C.violet300};}`;
const PickRow=styled.div`display:flex;gap:8px;flex-wrap:wrap;`;
const SmallChip=styled(Chip)`padding:7px 12px;font-size:12.5px;`;
const SheetBtns=styled.div`display:flex;gap:8px;margin-top:4px;`;
const ChooseBtn=styled.button`flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 10px;border-radius:14px;border:1px solid ${C.slate200};background:#fff;color:${C.slate800};font-size:14px;font-weight:700;cursor:pointer;&:active{transform:translateY(1px);}& > small{font-size:11px;font-weight:600;color:${C.slate500};}`;
const RecurBadge=styled.span`display:inline-flex;align-items:center;gap:3px;border:1px solid ${C.violet300};color:${C.violet600};border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;`;

export default function OwnerHomePage(){
  const {venue,loading:ownerLoading,refresh:ownerRefresh}=useOwner();
  const {showToast}=useUIActions()||{};
  const toast=(m)=>{if(showToast)showToast({message:m});};
  const {confirmState,ask,closeConfirm}=useConfirm();
  const nm=(r)=>r?.teamName||r?.userName||(r?.matchId?`${r?.teamAName||"팀A"} vs ${r?.teamBName||"팀B"}`:"이");
  const courts=venue?.courts||[];
  const today=useMemo(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());},[]);
  const [courtId,setCourtId]=useState(courts[0]?.id||"");
  const [weekOff,setWeekOff]=useState(0);
  const [date,setDate]=useState(ymd(today));
  const [reservations,setReservations]=useState([]);
  const [blocks,setBlocks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [detailResv,setDetailResv]=useState(null); // 예약 상세 팝업
  const [approveTarget,setApproveTarget]=useState(null); // 승인 대상 예약 (안내글 입력 모달)
  const [approveNote,setApproveNote]=useState("");
  const [slotSheet,setSlotSheet]=useState(null); // 빈 슬롯 탭 → 액션 선택 {s}
  const [bookForm,setBookForm]=useState(null); // 수동예약 폼 {s,name,phone,price,method,weeks,memo}

  const court=courts.find(c=>c.id===courtId)||courts[0]||null;

  const weekDays=useMemo(()=>{
    const base=new Date(today);base.setDate(base.getDate()-base.getDay()+weekOff*7);
    return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);return{date:ymd(d),num:d.getDate(),dow:d.getDay()};});
  },[today,weekOff]);

  const load=async()=>{
    if(!venue?.id||!court?.id)return;
    setLoading(true);
    try{
      const [rs,bs]=await Promise.all([
        listReservations({venueId:venue.id,courtId:court.id}),
        listBlocks({venueId:venue.id,courtId:court.id}),
      ]);
      const ids=[...new Set(rs.filter(r=>r.status==="pending"&&r.matchId).map(r=>r.matchId))];
      if(ids.length)await Promise.all(ids.map(id=>expireMatchReservationIfNeeded(id).catch(()=>{})));
      setReservations(rs);setBlocks(bs);
    }catch(e){setReservations([]);setBlocks([]);}finally{setLoading(false);}
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

  const onSlot=async(s,info)=>{
    if(busy)return;
    if(info.k==="confirmed"||info.k==="pending"||info.k==="done"){ if(info.r) setDetailResv(info.r); return; }
    if(info.k==="open"){ setSlotSheet({s}); return; }
    if(info.k==="blocked"){if(date<nowMin.today)return;setBusy(true);try{await removeBlock(info.b.id);await load();}catch(e){}finally{setBusy(false);}}
  };
  // 빈 슬롯 액션: 직접 예약 / 시간 막기
  const doBlock=async(s)=>{setSlotSheet(null);setBusy(true);try{await addBlock({venueId:venue.id,courtId:court.id,date,startTime:s.start,endTime:s.end});await load();}catch(e){}finally{setBusy(false);}};
  const openBookForm=(s)=>{const p=resolveSlotPrice(court,date,s.start);setSlotSheet(null);setBookForm({s,name:"",phone:"",price:String(p||0),weeks:1,memo:""});};
  const submitBook=async()=>{
    const f=bookForm; if(!f)return;
    setBusy(true);
    try{
      const {created,skipped}=await createOwnerReservation({
        venue,court,date,startTime:f.s.start,endTime:f.s.end,
        customerName:f.name,phone:f.phone,memo:f.memo,
        price:Number(f.price)||0,repeatWeeks:Number(f.weeks)||1,
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
  const approveResv=(r)=>{ setApproveNote(""); setApproveTarget(r); };
  const submitApprove=async()=>{
    const r=approveTarget; if(!r)return;
    setBusy(true);
    try{
      await setReservationStatus(r.id,"confirmed",{ownerNote:approveNote.trim()});
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
    setBusy(true);try{await rejectReservation(r.id);track("owner_reservation_reject", { is_match: isMatch });await load();toast("예약을 반려했어요.");}catch(e){toast(e?.message||"반려에 실패했어요.");}finally{setBusy(false);}
  };
  const markDone=async(r)=>{
    if(!await ask({title:"이용 완료 처리",message:`${nm(r)} 예약을 이용 완료로 처리할까요?`,confirmLabel:"완료 처리"}))return;
    setBusy(true);try{await setReservationStatus(r.id,"done");await load();setDetailResv(null);toast("이용 완료로 처리했어요.");}catch(e){toast(e?.message||"처리에 실패했어요.");}finally{setBusy(false);}
  };
  const noshowResv=async(r)=>{
    if(!await ask({title:"노쇼 처리",message:`${nm(r)} 예약을 노쇼로 처리할까요?\n노쇼 이력이 기록돼요.`,confirmLabel:"노쇼 처리",danger:true}))return;
    setBusy(true);try{await markReservationNoshow(r.id);await load();setDetailResv(null);toast("노쇼로 처리했어요.");}catch(e){toast(e?.message||"처리에 실패했어요.");}finally{setBusy(false);}
  };
  const cancelResv=async(r)=>{
    if(!await ask({title:"예약 취소",message:`${nm(r)} 예약을 취소할까요?`,confirmLabel:"예약 취소",danger:true}))return;
    setBusy(true);try{await cancelReservation(r.id);await load();setDetailResv(null);toast("예약을 취소했어요.");}catch(e){toast(e?.message||"취소에 실패했어요.");}finally{setBusy(false);}
  };

  if(ownerLoading)return <Page><OwnerSpinner label="불러오는 중…"/></Page>;
  if(!venue||venue.status!=="approved")return <Page><VenueGateNotice venue={venue} refresh={ownerRefresh}/></Page>;
  if(!courts.length)return <Page><Card><Empty>등록된 코트가 없어요. '구장정보'에서 코트를 추가해주세요.</Empty></Card></Page>;

  const sum=slots.reduce((a,s)=>{const k=slotKind(s).k;if(k==="confirmed"||k==="done")a.cf++;else if(k==="pending")a.pd++;else if(k==="blocked")a.bl++;else if(k==="open")a.op++;return a;},{cf:0,pd:0,bl:0,op:0});
  const requested=dayResv.filter(r=>r.status==="requested");

  return (
    <Page>
      <ScreenTitle>예약관리</ScreenTitle>

      <ChipRow>
        {courts.map(c=>{const cnt=reservations.filter(r=>r.courtId===c.id&&r.status==="requested").length;return(
          <CourtChip key={c.id} $on={c.id===court?.id} onClick={()=>setCourtId(c.id)}>
            {c.name}{cnt>0&&<ChipBadge>{cnt>9?"9+":cnt}</ChipBadge>}
          </CourtChip>
        );})}
      </ChipRow>

      <Card>
        <WeekHead>
          <WeekNav onClick={()=>setWeekOff(w=>w-1)}><LuChevronLeft size={20}/></WeekNav>
          <WeekLabel>{weekDays[0]?.date.slice(5).replace("-",".")} ~ {weekDays[6]?.date.slice(5).replace("-",".")}</WeekLabel>
          <WeekNav onClick={()=>setWeekOff(w=>w+1)}><LuChevronRight size={20}/></WeekNav>
        </WeekHead>
        <Days>
          {weekDays.map(d=>{const c=dayCounts(d.date);return(
            <Day key={d.date} $on={d.date===date} onClick={()=>setDate(d.date)}>
              <DayWd $dow={d.dow}>{WEEK[d.dow]}</DayWd>
              <DayNum $on={d.date===date}>{d.num}</DayNum>
              <Dots>{c.cf>0&&<Dot $c={C.violet600}/>}{c.pd>0&&<Dot $c={C.amber500}/>}</Dots>
            </Day>
          );})}
        </Days>
      </Card>

      <Summary>
        <Sum><SumN $c={C.violet600}>{sum.cf}</SumN><SumL>확정</SumL></Sum>
        <Sum><SumN $c={C.amber500}>{sum.pd}</SumN><SumL>대기</SumL></Sum>
        <Sum><SumN $c={C.slate400}>{sum.bl}</SumN><SumL>막기</SumL></Sum>
        <Sum><SumN $c={C.green600}>{sum.op}</SumN><SumL>가능</SumL></Sum>
      </Summary>

      <Card>
        <SecTitle>{date.slice(5).replace("-",".")} 시간대</SecTitle>
        <Caption>빈 슬롯을 누르면 전화·현장 예약을 직접 넣거나 시간을 막을 수 있어요. 막은 슬롯을 다시 누르면 해제.</Caption>
        {loading?<OwnerSpinner label="불러오는 중…"/>:isClosed?<Empty>이 요일은 휴무예요.</Empty>:slots.length===0?<Empty>운영시간이 없어요.</Empty>:(
          <Grid>
            {slots.map((s,i)=>{const info=slotKind(s);return(
              <Slot key={i} $k={info.k} onClick={()=>onSlot(s,info)}>
                <SlotT>{s.start}~{s.end}</SlotT>
                <SlotS $k={info.k}>
                  {info.k==="confirmed"?<><LuCheck size={12}/>확정</>
                  :info.k==="done"?<><LuCheck size={12}/>사용</>
                  :info.k==="pending"?<><LuHourglass size={12}/>승인대기</>
                  :info.k==="blocked"?<><LuLock size={12}/>막힘</>
                  :info.k==="past"?"지남"
                  :<>예약가능 · {(()=>{const p=resolveSlotPrice(court,date,s.start);return p?Number(p).toLocaleString()+"원":"무료";})()}</>}
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
            <ResvMeta>{r.startTime}~{r.endTime}{r.price?` · ${r.price.toLocaleString()}원 (현장 정산)`:""}{!isMatch&&r.phone?` · ${formatPhone(r.phone)}`:""}</ResvMeta>
            {date<nowMin.today ? (
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
        const label=r.status==="confirmed"?"예약 확정":r.status==="requested"?"승인 대기":r.status==="pending"?"승인 대기":r.status==="done"?"이용 완료":r.status;
        const tone=r.status==="confirmed"?"confirmed":(r.status==="requested"||r.status==="pending")?"pending":"done";
        return (
          <Overlay onClick={()=>setDetailResv(null)}>
            <Sheet onClick={e=>e.stopPropagation()}>
              <SheetTitle>
                <span style={{display:"flex",alignItems:"center",gap:8}}>예약 정보 {r.recurringId&&<RecurBadge><LuHourglass size={11}/>정기</RecurBadge>}</span>
                <X onClick={()=>setDetailResv(null)}>×</X>
              </SheetTitle>
              <DRow><span>상태</span><StatBadge $tone={tone}>{label}</StatBadge></DRow>
              <DRow><span>일시</span><b>{r.date} {r.startTime}~{r.endTime}</b></DRow>
              <DRow><span>코트</span><b>{r.courtName||court?.name||"-"}</b></DRow>
              <DRow><span>이용료</span><b>{(r.price||r.splitTotal||0).toLocaleString()}원 (현장 정산)</b></DRow>
              {!isMatch&&r.memo&&<DRow><span>메모</span><b style={{fontWeight:600}}>{r.memo}</b></DRow>}

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
                  <DRow><span>정산</span><b>현장에서 두 팀이 직접 정산</b></DRow>
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
              <ChooseBtn onClick={()=>openBookForm(slotSheet.s)}>📞 직접 예약<small>전화·현장 예약 등록</small></ChooseBtn>
              <ChooseBtn onClick={()=>doBlock(slotSheet.s)} disabled={busy}>🔒 시간 막기<small>예약 불가로 잠금</small></ChooseBtn>
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

      {approveTarget && (
        <Overlay onClick={()=>!busy&&setApproveTarget(null)}>
          <Sheet onClick={e=>e.stopPropagation()}>
            <SheetTitle>예약 승인<X onClick={()=>!busy&&setApproveTarget(null)}>×</X></SheetTitle>
            <Caption>{nm(approveTarget)} 예약을 승인해요. 예약자에게 전할 안내글을 남길 수 있어요. (선택)</Caption>
            <Field>안내글 (선택)
              <NoteArea value={approveNote} onChange={e=>setApproveNote(e.target.value)} maxLength={300}
                placeholder={"예: 정문 옆 주차장을 이용해주세요. 농구화 필수입니다."} />
            </Field>
            <PrimaryBtn onClick={submitApprove} disabled={busy}>{busy?"승인 중…":"승인하기"}</PrimaryBtn>
            <GhostBtn onClick={()=>!busy&&setApproveTarget(null)} disabled={busy}>취소</GhostBtn>
          </Sheet>
        </Overlay>
      )}

      <ConfirmDialog state={confirmState} onConfirm={()=>closeConfirm(true)} onCancel={()=>closeConfirm(false)} />
    </Page>
  );
}
