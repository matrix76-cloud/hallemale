/* eslint-disable */
// src/pages/owner/components/BusinessSection.jsx
// 사업자 인증 / 통신판매업 / 정산 계좌 (명세서 2) — 구장정보 탭 하단
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { LuShieldCheck, LuScale, LuCreditCard, LuUpload, LuCircleCheck } from "react-icons/lu";
import { uploadVenueImage } from "../../../services/venuesService";
import { submitBusinessVerification, saveSalesReport, saveSettlementAccount } from "../../../services/ownerVenueService";
import { Card, SecTitle, Caption, Input, PrimaryBtn, StatBadge, C } from "./od";

const Field = styled.label`display:flex;flex-direction:column;gap:6px;`;
const Lbl = styled.span`font-size:12.5px;font-weight:700;color:${C.slate500};`;
const Row = styled.div`display:flex;gap:10px;& > *{flex:1;min-width:0;}`;
const Seg = styled.div`display:flex;gap:8px;`;
const SegBtn = styled.button`flex:1;border:1px solid ${({$on})=>$on?C.violet600:C.slate200};background:${({$on})=>$on?C.violet50:"#fff"};color:${({$on})=>$on?C.violet600:C.slate500};border-radius:12px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;`;
const Upload = styled.button`display:flex;align-items:center;justify-content:center;gap:6px;border:1px dashed ${C.violet300};background:transparent;color:${C.violet600};border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;`;
const Done = styled.div`display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:${C.green600};`;
const Info = styled.div`display:flex;justify-content:space-between;font-size:13px;& > span{color:${C.slate500};} & > b{color:${C.slate800};font-weight:700;}`;
const Gate = styled.div`font-size:13px;color:${C.slate500};text-align:center;padding:10px 0;`;
const Reject = styled.div`background:#FEF2F2;border:1px solid ${C.red200};border-radius:10px;padding:10px 12px;font-size:12.5px;color:${C.red500};`;
const Hidden = styled.input`display:none;`;

const BIZ_STATUS = { none: ["미인증", "default"], pending: ["심사중", "pending"], verified: ["인증완료", "done"], rejected: ["반려", "refund"] };

export default function BusinessSection({ venue, refresh }) {
  const b = venue.business || {};
  const sr = venue.salesReport || {};
  const st = venue.settlement || {};
  const verified = b.status === "verified";

  const [biz, setBiz] = useState({ bizNo: b.bizNo || "", bizName: b.bizName || "", ownerName: b.ownerName || "", openDate: b.openDate || "", taxType: b.taxType || "simple", licenseUrl: b.licenseUrl || "" });
  const [rep, setRep] = useState({ number: sr.number || "", certUrl: sr.certUrl || "" });
  const [acc, setAcc] = useState({ bank: st.bank || "", account: st.account || "", holder: st.holder || "" });
  const [busy, setBusy] = useState("");
  const licRef = React.useRef(null);
  const certRef = React.useRef(null);

  useEffect(() => {
    setBiz({ bizNo: b.bizNo || "", bizName: b.bizName || "", ownerName: b.ownerName || "", openDate: b.openDate || "", taxType: b.taxType || "simple", licenseUrl: b.licenseUrl || "" });
    setRep({ number: sr.number || "", certUrl: sr.certUrl || "" });
    setAcc({ bank: st.bank || "", account: st.account || "", holder: st.holder || "" });
  }, [venue?.id]); // eslint-disable-line

  const upload = async (file, set, key) => {
    try { const { imageUrl } = await uploadVenueImage(file); set((p) => ({ ...p, [key]: imageUrl })); } catch (e) {}
  };

  const submitBiz = async () => {
    setBusy("biz");
    try { await submitBusinessVerification(venue.id, biz); await refresh(); } catch (e) { window.alert && null; } finally { setBusy(""); }
  };
  const submitRep = async () => {
    setBusy("rep");
    try { await saveSalesReport(venue.id, { ...rep, exempt: biz.taxType === "simple" }); await refresh(); } finally { setBusy(""); }
  };
  const submitAcc = async () => {
    setBusy("acc");
    try { await saveSettlementAccount(venue.id, acc); await refresh(); } catch (e) {} finally { setBusy(""); }
  };

  const [bizLabel, bizTone] = BIZ_STATUS[b.status] || BIZ_STATUS.none;
  const isGeneral = biz.taxType === "general";

  return (
    <>
      {/* 사업자 인증 */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SecTitle><LuShieldCheck size={16} /> 사업자 인증</SecTitle>
          <StatBadge $tone={bizTone === "default" ? undefined : bizTone}>{bizLabel}</StatBadge>
        </div>

        {b.status === "rejected" && b.rejectReason && <Reject>반려 사유: {b.rejectReason}</Reject>}

        {verified ? (
          <>
            <Info><span>상호</span><b>{b.bizName || "-"}</b></Info>
            <Info><span>대표자</span><b>{b.ownerName || "-"}</b></Info>
            <Info><span>사업자번호</span><b>{b.bizNo}</b></Info>
            <Info><span>과세유형</span><b>{b.taxType === "general" ? "일반과세자" : "간이과세자"}</b></Info>
            <Done><LuCircleCheck size={16} /> 국세청 확인 완료</Done>
          </>
        ) : b.status === "pending" ? (
          <Caption>제출하신 사업자 정보를 관리자가 확인 중이에요 (영업일 1일). 승인되면 정산 계좌를 등록할 수 있어요.</Caption>
        ) : (
          <>
            <Field><Lbl>사업자등록번호</Lbl><Input value={biz.bizNo} onChange={(e) => setBiz({ ...biz, bizNo: e.target.value })} placeholder="123-45-67890" /></Field>
            <Row>
              <Field><Lbl>상호</Lbl><Input value={biz.bizName} onChange={(e) => setBiz({ ...biz, bizName: e.target.value })} placeholder="○○스포츠" /></Field>
              <Field><Lbl>대표자명</Lbl><Input value={biz.ownerName} onChange={(e) => setBiz({ ...biz, ownerName: e.target.value })} placeholder="홍길동" /></Field>
            </Row>
            <Field><Lbl>개업일자</Lbl><Input type="date" value={biz.openDate} onChange={(e) => setBiz({ ...biz, openDate: e.target.value })} /></Field>
            <Field><Lbl>과세유형</Lbl>
              <Seg>
                <SegBtn $on={biz.taxType === "simple"} onClick={() => setBiz({ ...biz, taxType: "simple" })}>간이과세자</SegBtn>
                <SegBtn $on={biz.taxType === "general"} onClick={() => setBiz({ ...biz, taxType: "general" })}>일반과세자</SegBtn>
              </Seg>
            </Field>
            <Field><Lbl>사업자등록증 사본</Lbl>
              {biz.licenseUrl ? <Done><LuCircleCheck size={16} /> 첨부 완료</Done> : <Upload type="button" onClick={() => licRef.current?.click()}><LuUpload size={15} /> 파일 첨부</Upload>}
              <Hidden ref={licRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], setBiz, "licenseUrl")} />
            </Field>
            <PrimaryBtn type="button" disabled={busy === "biz"} onClick={submitBiz}>{busy === "biz" ? "제출 중…" : "인증 제출"}</PrimaryBtn>
          </>
        )}
      </Card>

      {/* 통신판매업 신고 */}
      <Card>
        <SecTitle><LuScale size={16} /> 통신판매업 신고</SecTitle>
        {isGeneral ? (
          <>
            <Caption>일반과세자는 통신판매업 신고가 <b style={{ color: C.red500 }}>필수</b>예요. (구청/정부24 신고 후 신고번호·신고증 등록)</Caption>
            <Field><Lbl>통신판매업 신고번호</Lbl><Input value={rep.number} onChange={(e) => setRep({ ...rep, number: e.target.value })} placeholder="제 2026-서울○○-1234 호" /></Field>
            <Field><Lbl>신고증 사본</Lbl>
              {rep.certUrl ? <Done><LuCircleCheck size={16} /> 첨부 완료</Done> : <Upload type="button" onClick={() => certRef.current?.click()}><LuUpload size={15} /> 파일 첨부</Upload>}
              <Hidden ref={certRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], setRep, "certUrl")} />
            </Field>
            <PrimaryBtn type="button" disabled={busy === "rep"} onClick={submitRep}>{busy === "rep" ? "저장 중…" : "신고 정보 저장"}</PrimaryBtn>
          </>
        ) : (
          <Caption>간이과세자는 통신판매업 신고 <b style={{ color: C.green600 }}>면제 대상</b>이에요. (직전연도 거래 50회 이상·일반과세 전환 시 신고 의무 발생)</Caption>
        )}
      </Card>

      {/* 정산 계좌 */}
      <Card>
        <SecTitle><LuCreditCard size={16} /> 정산 계좌</SecTitle>
        {!verified ? (
          <Gate>사업자 인증 완료 후 정산 계좌를 등록할 수 있어요.</Gate>
        ) : st.verified ? (
          <>
            <Info><span>은행</span><b>{st.bank}</b></Info>
            <Info><span>계좌번호</span><b>{st.account}</b></Info>
            <Info><span>예금주</span><b>{st.holder}</b></Info>
            <Done><LuCircleCheck size={16} /> 계좌 인증 완료 · 모든 코트 대금이 이 계좌로 정산</Done>
            <PrimaryBtn type="button" style={{ background: "#fff", color: C.violet600, border: `1px solid ${C.violet300}` }} onClick={() => saveSettlementAccount(venue.id, { bank: "", account: "", holder: "" }).then(refresh)}>계좌 변경</PrimaryBtn>
          </>
        ) : (
          <>
            <Row>
              <Field><Lbl>은행</Lbl><Input value={acc.bank} onChange={(e) => setAcc({ ...acc, bank: e.target.value })} placeholder="국민은행" /></Field>
              <Field><Lbl>예금주</Lbl><Input value={acc.holder} onChange={(e) => setAcc({ ...acc, holder: e.target.value })} placeholder="○○스포츠" /></Field>
            </Row>
            <Field><Lbl>계좌번호</Lbl><Input value={acc.account} onChange={(e) => setAcc({ ...acc, account: e.target.value })} placeholder="- 없이 숫자만" /></Field>
            <Caption>상호와 예금주명이 일치하면 1원 인증으로 즉시 등록돼요.</Caption>
            <PrimaryBtn type="button" disabled={busy === "acc"} onClick={submitAcc}>{busy === "acc" ? "등록 중…" : "계좌 등록 (1원 인증)"}</PrimaryBtn>
          </>
        )}
      </Card>
    </>
  );
}
