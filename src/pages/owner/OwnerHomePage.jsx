/* eslint-disable */
// src/pages/owner/OwnerHomePage.jsx
// 예약관리 — 주간 캘린더 + 시간대별 슬롯 + 요약 + 승인/반려 + 시간막기 (명세서 3)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { LuChevronLeft, LuChevronRight, LuLock, LuHourglass, LuCheck } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import {
  listReservations, listBlocks, addBlock, removeBlock, setReservationStatus,
  dowToKey, expireMatchReservationIfNeeded,
} from "../../services/ownerVenueService";
import { Page, Card, ScreenTitle, SecTitle, Caption, Chip, StatBadge, C } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";

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
  cursor:${({$k})=>$k==="open"||$k==="blocked"?"pointer":"default"};
  background:${({$k})=>$k==="confirmed"?C.violet50:"#fff"};
  border:1px solid ${({$k})=>$k==="confirmed"?C.violet300:$k==="pending"?C.amber400:C.slate200};
  ${({$k})=>$k==="pending"?`background-image:repeating-linear-gradient(45deg,#FBBF2422,#FBBF2422 6px,transparent 6px,transparent 12px);`:""}
  opacity:${({$k})=>($k==="past"?0.45:1)};
`;
const SlotT=styled.div`font-size:13px;font-weight:700;color:${C.slate800};`;
const SlotS=styled.div`font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;color:${({$k})=>$k==="confirmed"?C.violet600:$k==="pending"?C.amber500:$k==="blocked"?C.slate400:$k==="open"?C.green600:C.slate400};`;
const Resv=styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;`;
const ResvTop=styled.div`display:flex;align-items:center;justify-content:space-between;gap:8px;`;
const ResvName=styled.div`font-size:14px;font-weight:700;color:${C.slate800};`;
const ResvMeta=styled.div`font-size:12px;color:${C.slate500};`;
const Acts=styled.div`display:flex;gap:8px;`;
const SBtn=styled.button`flex:1;height:38px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid ${({$danger})=>$danger?C.red200:C.violet600};background:${({$primary})=>$primary?C.violet600:"transparent"};color:${({$primary,$danger})=>$primary?"#fff":$danger?C.red500:C.violet600};`;
const Empty=styled.div`text-align:center;font-size:13px;color:${C.slate400};padding:18px 0;`;

export default function OwnerHomePage(){
  const {venue,loading:ownerLoading,refresh:ownerRefresh}=useOwner();
  const courts=venue?.courts||[];
  const today=useMemo(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());},[]);
  const [courtId,setCourtId]=useState(courts[0]?.id||"");
  const [weekOff,setWeekOff]=useState(0);
  const [date,setDate]=useState(ymd(today));
  const [reservations,setReservations]=useState([]);
  const [blocks,setBlocks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);

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

  const dayKey=useMemo(()=>dowToKey(new Date(date).getDay()),[date]);
  const dayHours=court?.hours?.[dayKey];
  const isClosed=!dayHours||dayHours.closed;
  const slots=useMemo(()=>buildSlots(court,dayKey),[court,dayKey]);
  const dayResv=useMemo(()=>reservations.filter(r=>r.date===date),[reservations,date]);
  const dayBlocks=useMemo(()=>blocks.filter(b=>b.date===date),[blocks,date]);
  const nowMin=useMemo(()=>{const n=new Date();return{today:ymd(n),min:n.getHours()*60+n.getMinutes()};},[]);

  const slotKind=(s)=>{
    const cf=dayResv.find(r=>r.status==="confirmed"&&overlap(s.start,s.end,r.startTime,r.endTime));
    if(cf)return{k:"confirmed",r:cf};
    const pd=dayResv.find(r=>["requested","pending"].includes(r.status)&&overlap(s.start,s.end,r.startTime,r.endTime));
    if(pd)return{k:"pending",r:pd};
    const bl=dayBlocks.find(b=>overlap(s.start,s.end,b.startTime,b.endTime));
    if(bl)return{k:"blocked",b:bl};
    if(date===nowMin.today&&toMin(s.start)<=nowMin.min)return{k:"past"};
    return{k:"open"};
  };
  const dayCounts=(dStr)=>{const rs=reservations.filter(r=>r.date===dStr);return{cf:rs.filter(r=>r.status==="confirmed").length,pd:rs.filter(r=>["requested","pending"].includes(r.status)).length};};

  const onSlot=async(s,info)=>{
    if(busy)return;
    if(info.k==="open"){setBusy(true);try{await addBlock({venueId:venue.id,courtId:court.id,date,startTime:s.start,endTime:s.end});await load();}catch(e){}finally{setBusy(false);}}
    else if(info.k==="blocked"){setBusy(true);try{await removeBlock(info.b.id);await load();}catch(e){}finally{setBusy(false);}}
  };
  const changeResv=async(id,st)=>{setBusy(true);try{await setReservationStatus(id,st);await load();}catch(e){}finally{setBusy(false);}};

  if(ownerLoading)return <Page><OwnerSpinner label="불러오는 중…"/></Page>;
  if(!venue||venue.status!=="approved")return <Page><VenueGateNotice venue={venue} refresh={ownerRefresh}/></Page>;
  if(!courts.length)return <Page><Card><Empty>등록된 코트가 없어요. '구장정보'에서 코트를 추가해주세요.</Empty></Card></Page>;

  const sum=slots.reduce((a,s)=>{const k=slotKind(s).k;if(k==="confirmed")a.cf++;else if(k==="pending")a.pd++;else if(k==="blocked")a.bl++;else if(k==="open")a.op++;return a;},{cf:0,pd:0,bl:0,op:0});
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
        <Caption>빈 슬롯을 누르면 예약을 막을 수 있어요(타 채널 선점 등). 막은 슬롯을 다시 누르면 해제.</Caption>
        {loading?<OwnerSpinner label="불러오는 중…"/>:isClosed?<Empty>이 요일은 휴무예요.</Empty>:slots.length===0?<Empty>운영시간이 없어요.</Empty>:(
          <Grid>
            {slots.map((s,i)=>{const info=slotKind(s);return(
              <Slot key={i} $k={info.k} onClick={()=>onSlot(s,info)}>
                <SlotT>{s.start}~{s.end}</SlotT>
                <SlotS $k={info.k}>
                  {info.k==="confirmed"?<><LuCheck size={12}/>확정</>
                  :info.k==="pending"?<><LuHourglass size={12}/>{info.r?.status==="pending"?"결제대기":"승인대기"}</>
                  :info.k==="blocked"?<><LuLock size={12}/>막힘</>
                  :info.k==="past"?"지남"
                  :<>예약가능 · {court.pricePerHour?Number(court.pricePerHour).toLocaleString()+"원":"무료"}</>}
                </SlotS>
              </Slot>
            );})}
          </Grid>
        )}
      </Card>

      <Card>
        <SecTitle>승인 대기 {requested.length>0&&`(${requested.length})`}</SecTitle>
        {requested.length===0?<Empty>승인 대기 중인 예약이 없어요.</Empty>:requested.map(r=>(
          <Resv key={r.id}>
            <ResvTop>
              <ResvName>{r.teamName||r.userName||"예약자"}</ResvName>
              <StatBadge $tone="pending"><LuHourglass size={11}/>승인대기</StatBadge>
            </ResvTop>
            <ResvMeta>{r.startTime}~{r.endTime}{r.price?` · ${r.price.toLocaleString()}원`:""}{r.phone?` · ${r.phone}`:""}</ResvMeta>
            <Acts>
              <SBtn $primary onClick={()=>changeResv(r.id,"confirmed")} disabled={busy}>승인</SBtn>
              <SBtn $danger onClick={()=>changeResv(r.id,"rejected")} disabled={busy}>반려·환불</SBtn>
            </Acts>
          </Resv>
        ))}
      </Card>
    </Page>
  );
}
