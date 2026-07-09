/* eslint-disable */
// src/pages/owner/components/BusinessSection.jsx
// 사업자 인증 (신뢰 배지) — 구장정보 탭 하단
// ※ 예약 전용(현장 정산) 전환으로 통신판매업 신고·정산 계좌 카드는 제거됨
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { LuShieldCheck, LuUpload, LuCircleCheck } from "react-icons/lu";
import { uploadVenueImage } from "../../../services/venuesService";
import { submitBusinessVerification, isValidBizNo, formatBizNo, verifyBusinessOnline } from "../../../services/ownerVenueService";
import { useUIActions } from "../../../hooks/useUI";
import { Card, SecTitle, Caption, Input, PrimaryBtn, StatBadge, C } from "./od";

const Field = styled.label`display:flex;flex-direction:column;gap:6px;`;
const Lbl = styled.span`font-size:12.5px;font-weight:700;color:${C.slate500};`;
const Row = styled.div`display:flex;gap:10px;& > *{flex:1;min-width:0;}`;
const Seg = styled.div`display:flex;gap:8px;`;
const SegBtn = styled.button`flex:1;border:1px solid ${({$on})=>$on?C.violet600:C.slate200};background:${({$on})=>$on?C.violet50:"#fff"};color:${({$on})=>$on?C.violet600:C.slate500};border-radius:12px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;`;
const Upload = styled.button`display:flex;align-items:center;justify-content:center;gap:6px;border:1px dashed ${C.violet300};background:transparent;color:${C.violet600};border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;`;
const Done = styled.div`display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:${C.green600};`;
const Info = styled.div`display:flex;justify-content:space-between;font-size:13px;& > span{color:${C.slate500};} & > b{color:${C.slate800};font-weight:700;}`;
const Reject = styled.div`background:#FEF2F2;border:1px solid ${C.red200};border-radius:10px;padding:10px 12px;font-size:12.5px;color:${C.red500};`;
const Hidden = styled.input`display:none;`;

const BIZ_STATUS = { none: ["미인증", "default"], pending: ["심사중", "pending"], verified: ["인증완료", "done"], rejected: ["반려", "refund"] };

export default function BusinessSection({ venue, refresh }) {
  const { showToast } = useUIActions() || {};
  const toast = (m) => { if (showToast) showToast({ message: m }); };
  const b = venue.business || {};
  const verified = b.status === "verified";

  const [biz, setBiz] = useState({ bizNo: b.bizNo || "", bizName: b.bizName || "", ownerName: b.ownerName || "", openDate: b.openDate || "", taxType: b.taxType || "simple", licenseUrl: b.licenseUrl || "" });
  const [busy, setBusy] = useState("");
  const licRef = React.useRef(null);

  useEffect(() => {
    setBiz({ bizNo: b.bizNo || "", bizName: b.bizName || "", ownerName: b.ownerName || "", openDate: b.openDate || "", taxType: b.taxType || "simple", licenseUrl: b.licenseUrl || "" });
  }, [venue?.id]); // eslint-disable-line

  const upload = async (file, set, key) => {
    try { const { imageUrl } = await uploadVenueImage(file); set((p) => ({ ...p, [key]: imageUrl })); } catch (e) {}
  };

  const submitBiz = async () => {
    setBusy("biz");
    try {
      // 1) 체크섬·필수값 검증 후 pending 저장
      await submitBusinessVerification(venue.id, biz);
      // 2) 국세청 진위확인 시도 (키 설정 시 자동 승인/반려, 미설정 시 수동 폴백)
      const r = await verifyBusinessOnline({
        venueId: venue.id, bizNo: biz.bizNo, ownerName: biz.ownerName,
        openDate: biz.openDate, bizName: biz.bizName,
      });
      await refresh();
      if (r?.configured && r?.valid === true) toast("국세청 진위확인 완료! 사업자 인증이 승인됐어요.");
      else if (r?.configured && r?.valid === false) toast(r.reason || "국세청 정보와 일치하지 않아요. 정보를 확인해주세요.");
      else toast("사업자 인증을 제출했어요. 확인 후 승인돼요.");
    } catch (e) {
      toast(e?.message || "제출에 실패했어요.");
    } finally { setBusy(""); }
  };
  const [bizLabel, bizTone] = BIZ_STATUS[b.status] || BIZ_STATUS.none;

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
          <Caption>제출하신 사업자 정보를 관리자가 확인 중이에요 (영업일 1일).</Caption>
        ) : (
          <>
            <Field><Lbl>사업자등록번호</Lbl>
              <Input value={biz.bizNo} onChange={(e) => setBiz({ ...biz, bizNo: formatBizNo(e.target.value) })} placeholder="123-45-67890" inputMode="numeric" />
              {biz.bizNo && (
                isValidBizNo(biz.bizNo)
                  ? <Done><LuCircleCheck size={15} /> 번호 형식 확인됨</Done>
                  : <span style={{ fontSize: 12, color: C.red500, fontWeight: 600 }}>사업자등록번호 10자리를 정확히 입력해주세요.</span>
              )}
            </Field>
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
    </>
  );
}
