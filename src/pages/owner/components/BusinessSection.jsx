/* eslint-disable */
// src/pages/owner/components/BusinessSection.jsx
// 주체 확인 (신뢰 배지) + 정산 계좌 + 통신판매업 신고 — 내정보(OwnerMyPage) 탭 하단
// ※ 정산 계좌는 앱내 결제(PG) 도입으로 부활. 플랫폼이 집금해 이 계좌로 지급한다(모델 A).
// ※ 운영 주체가 학교·기관이면 사업자등록증·개업일자·과세유형이 존재하지 않는다.
//    번호 대신 확인 서류를 받고 어드민이 담당자 연락으로 확인한다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { LuShieldCheck, LuUpload, LuCircleCheck, LuLandmark, LuReceipt } from "react-icons/lu";
import { uploadVenueImage } from "../../../services/venuesService";
import { submitBusinessVerification, isValidBizNo, formatBizNo, verifyBusinessOnline, saveSettlementAccount, saveSalesReport, SETTLEMENT_BANKS, searchSchools } from "../../../services/ownerVenueService";
import { ownerTypeOption } from "../../../constants/ownerType";
import { useUIActions } from "../../../hooks/useUI";
import { Card, SecTitle, Caption, Input, PrimaryBtn, StatBadge, C } from "./od";
import { PLATFORM_FEE_LABEL } from "../../../constants/payments";

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
const Select = styled.select`
  width:100%;box-sizing:border-box;border:1px solid ${C.slate200};border-radius:12px;
  padding:12px;font-size:14px;color:${C.slate800};background:#fff;
`;
const Warn = styled.div`background:#FFFBEB;border:1px solid ${C.amber200 || "#FDE68A"};border-radius:10px;padding:10px 12px;font-size:12.5px;color:${C.slate800};`;

/* 학교 검색 (NEIS) */
const SearchRow = styled.div`display:flex;gap:8px;& > *:first-child{flex:1;min-width:0;}`;
const SmallBtn = styled.button`flex-shrink:0;border:1px solid ${C.violet300};background:#fff;color:${C.violet600};border-radius:12px;padding:0 14px;font-size:13px;font-weight:700;cursor:pointer;&:disabled{opacity:.5;cursor:not-allowed;}`;
const SchoolList = styled.div`display:flex;flex-direction:column;gap:6px;max-height:210px;overflow-y:auto;`;
const SchoolItem = styled.button`
  width:100%;text-align:left;border:1px solid ${C.slate200};background:#fff;border-radius:10px;
  padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;
  &:active{transform:translateY(1px);}
`;
const SchoolName = styled.div`font-size:13.5px;font-weight:700;color:${C.slate800};`;
const SchoolMeta = styled.div`font-size:12px;color:${C.slate500};line-height:1.45;`;
const PickedBox = styled.div`border:1px solid ${C.violet300};background:${C.violet50};border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;`;

const BIZ_STATUS = { none: ["미인증", "default"], pending: ["심사중", "pending"], verified: ["인증완료", "done"], rejected: ["반려", "refund"] };

export default function BusinessSection({ venue, refresh, ownerType }) {
  const { showToast } = useUIActions() || {};
  const toast = (m) => { if (showToast) showToast({ message: m }); };
  const b = venue.business || {};
  const verified = b.status === "verified";
  const opt = ownerTypeOption(ownerType);
  const needsBizNo = opt.needsBizNo;

  const st = venue.settlement || {};
  const sr = venue.salesReport || {};

  const [biz, setBiz] = useState({ bizNo: b.bizNo || "", bizName: b.bizName || "", ownerName: b.ownerName || "", openDate: b.openDate || "", taxType: b.taxType || "simple", licenseUrl: b.licenseUrl || "" });
  const [acct, setAcct] = useState({ bank: st.bank || "", account: st.account || "", holder: st.holder || "", taxEmail: st.taxEmail || "" });
  const [sales, setSales] = useState({ number: sr.number || "", certUrl: sr.certUrl || "", exempt: sr.exempt === true });
  const [editAcct, setEditAcct] = useState(false);
  const [editSales, setEditSales] = useState(false);
  const [busy, setBusy] = useState("");
  const licRef = React.useRef(null);
  const certRef = React.useRef(null);

  // ── 학교 검색(NEIS) ──
  // 학교는 사업자등록번호가 없어 국세청 대조를 못 한다. 대신 실재 학교를 골라 대표번호를
  // 서버가 준 값으로 고정하고, 심사자가 그 번호로 담당자인지 확인한다.
  const isSchool = opt.key === "school";
  const [schoolQ, setSchoolQ] = useState("");
  const [schoolHits, setSchoolHits] = useState(null); // null=검색 전, []=결과 없음
  const [picked, setPicked] = useState(b.school || null);
  const [neisOff, setNeisOff] = useState(false); // 키 미설정/미배포 → 자유 입력 폴백

  const doSearchSchool = async () => {
    setBusy("school");
    try {
      const r = await searchSchools(schoolQ);
      if (r?.configured === false) { setNeisOff(true); setSchoolHits(null); return; }
      setSchoolHits(Array.isArray(r?.schools) ? r.schools : []);
    } finally { setBusy(""); }
  };

  const pickSchool = (s) => {
    setPicked(s);
    setSchoolHits(null);
    setBiz((p) => ({ ...p, bizName: s.name }));
  };

  useEffect(() => {
    setBiz({ bizNo: b.bizNo || "", bizName: b.bizName || "", ownerName: b.ownerName || "", openDate: b.openDate || "", taxType: b.taxType || "simple", licenseUrl: b.licenseUrl || "" });
    setAcct({ bank: st.bank || "", account: st.account || "", holder: st.holder || "", taxEmail: st.taxEmail || "" });
    setSales({ number: sr.number || "", certUrl: sr.certUrl || "", exempt: sr.exempt === true });
    setEditAcct(false);
    setEditSales(false);
    setPicked(b.school || null);
    setSchoolQ("");
    setSchoolHits(null);
  }, [venue?.id]); // eslint-disable-line

  const submitAcct = async () => {
    setBusy("acct");
    try {
      await saveSettlementAccount(venue.id, acct);
      await refresh();
      setEditAcct(false);
      toast("정산 계좌를 저장했어요.");
    } catch (e) {
      toast(e?.message || "저장에 실패했어요.");
    } finally { setBusy(""); }
  };

  const submitSales = async () => {
    setBusy("sales");
    try {
      await saveSalesReport(venue.id, sales);
      await refresh();
      setEditSales(false);
      toast(sales.exempt ? "면제 대상으로 저장했어요." : "통신판매업 신고번호를 저장했어요.");
    } catch (e) {
      toast(e?.message || "저장에 실패했어요.");
    } finally { setBusy(""); }
  };

  const hasAcct = !!(st.bank && st.account);
  const hasSales = !!(sr.number || sr.exempt);
  // 예금주가 사업자 대표자와 다르면 지급이 반려될 수 있어 미리 경고한다(막지는 않는다 —
  // 법인 계좌처럼 상호로 된 계좌도 있어서).
  const holderMismatch = !!(acct.holder && b.ownerName && acct.holder !== b.ownerName && acct.holder !== b.bizName);

  const upload = async (file, set, key) => {
    try { const { imageUrl } = await uploadVenueImage(file, { asOwner: true }); set((p) => ({ ...p, [key]: imageUrl })); } catch (e) {}
  };

  const submitBiz = async () => {
    setBusy("biz");
    try {
      // 1) 체크섬·필수값 검증 후 pending 저장 (학교·기관은 번호 대신 서류 필수)
      await submitBusinessVerification(venue.id, { ...biz, ownerType: opt.key, school: picked });
      // 2) 국세청 진위확인은 사업자등록번호가 있는 주체만 — 학교·기관은 어드민 수동 확인.
      if (!needsBizNo) {
        await refresh();
        toast(`${opt.verifyTitle} 서류를 제출했어요. 담당자 연락으로 확인 후 승인돼요.`);
        return;
      }
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
      {/* 주체 확인 — 사업자는 국세청 진위확인, 학교·기관은 서류 + 담당자 확인 */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SecTitle><LuShieldCheck size={16} /> {opt.verifyTitle}</SecTitle>
          <StatBadge $tone={bizTone === "default" ? undefined : bizTone}>{bizLabel}</StatBadge>
        </div>

        {b.status === "rejected" && b.rejectReason && <Reject>반려 사유: {b.rejectReason}</Reject>}

        {verified ? (
          <>
            <Info><span>{opt.orgLabel}</span><b>{b.bizName || "-"}</b></Info>
            <Info><span>{opt.personLabel}</span><b>{b.ownerName || "-"}</b></Info>
            {needsBizNo ? (
              <>
                <Info><span>사업자번호</span><b>{b.bizNo}</b></Info>
                <Info><span>과세유형</span><b>{b.taxType === "general" ? "일반과세자" : "간이과세자"}</b></Info>
                <Done><LuCircleCheck size={16} /> 국세청 확인 완료</Done>
              </>
            ) : (
              <>
                {b.bizNo && <Info><span>고유번호</span><b>{b.bizNo}</b></Info>}
                <Done><LuCircleCheck size={16} /> 담당자 확인 완료</Done>
              </>
            )}
          </>
        ) : b.status === "pending" ? (
          <Caption>
            {needsBizNo
              ? "제출하신 사업자 정보를 관리자가 확인 중이에요 (영업일 1일)."
              : "제출하신 서류를 관리자가 확인 중이에요. 담당자 연락처로 확인 연락을 드려요 (영업일 1~2일)."}
          </Caption>
        ) : (
          <>
            {needsBizNo ? (
              <Field><Lbl>사업자등록번호</Lbl>
                <Input value={biz.bizNo} onChange={(e) => setBiz({ ...biz, bizNo: formatBizNo(e.target.value) })} placeholder="123-45-67890" inputMode="numeric" />
                {biz.bizNo && (
                  isValidBizNo(biz.bizNo)
                    ? <Done><LuCircleCheck size={15} /> 번호 형식 확인됨</Done>
                    : <span style={{ fontSize: 12, color: C.red500, fontWeight: 600 }}>사업자등록번호 10자리를 정확히 입력해주세요.</span>
                )}
              </Field>
            ) : (
              <Field><Lbl>고유번호 <span style={{ fontWeight: 500, color: C.slate400 }}>(선택)</span></Lbl>
                <Input value={biz.bizNo} onChange={(e) => setBiz({ ...biz, bizNo: e.target.value.replace(/[^0-9-]/g, "") })} placeholder="고유번호증에 적힌 번호" inputMode="numeric" />
              </Field>
            )}
            {isSchool && !neisOff ? (
              <>
                <Field><Lbl>{opt.orgLabel}</Lbl>
                  {picked ? (
                    <PickedBox>
                      <SchoolName>{picked.name}</SchoolName>
                      <SchoolMeta>{[picked.kind, picked.foundKind].filter(Boolean).join(" · ")}</SchoolMeta>
                      <SchoolMeta>{picked.address}</SchoolMeta>
                      <SchoolMeta><b>대표번호 {picked.tel || "-"}</b></SchoolMeta>
                      <SmallBtn type="button" style={{ alignSelf: "flex-start", marginTop: 4, padding: "6px 12px" }}
                        onClick={() => { setPicked(null); setSchoolQ(""); }}>다시 찾기</SmallBtn>
                    </PickedBox>
                  ) : (
                    <>
                      <SearchRow>
                        <Input value={schoolQ} onChange={(e) => setSchoolQ(e.target.value)} placeholder={opt.orgPlaceholder}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearchSchool(); } }} />
                        <SmallBtn type="button" disabled={busy === "school" || schoolQ.trim().length < 2} onClick={doSearchSchool}>
                          {busy === "school" ? "찾는 중…" : "찾기"}
                        </SmallBtn>
                      </SearchRow>
                      {schoolHits && schoolHits.length === 0 && (
                        <Caption>검색 결과가 없어요. 학교명을 다시 확인해 주세요.</Caption>
                      )}
                      {schoolHits && schoolHits.length > 0 && (
                        <SchoolList>
                          {schoolHits.map((s) => (
                            <SchoolItem key={s.code} type="button" onClick={() => pickSchool(s)}>
                              <SchoolName>{s.name}</SchoolName>
                              <SchoolMeta>{[s.kind, s.foundKind].filter(Boolean).join(" · ")} · {s.address}</SchoolMeta>
                            </SchoolItem>
                          ))}
                        </SchoolList>
                      )}
                    </>
                  )}
                  <Caption>목록에서 고른 학교의 대표번호로 담당자 확인 연락을 드려요.</Caption>
                </Field>
                <Field><Lbl>{opt.personLabel}</Lbl><Input value={biz.ownerName} onChange={(e) => setBiz({ ...biz, ownerName: e.target.value })} placeholder={opt.personPlaceholder} /></Field>
              </>
            ) : (
              <Row>
                <Field><Lbl>{opt.orgLabel}</Lbl><Input value={biz.bizName} onChange={(e) => setBiz({ ...biz, bizName: e.target.value })} placeholder={opt.orgPlaceholder} /></Field>
                <Field><Lbl>{opt.personLabel}</Lbl><Input value={biz.ownerName} onChange={(e) => setBiz({ ...biz, ownerName: e.target.value })} placeholder={opt.personPlaceholder} /></Field>
              </Row>
            )}
            {needsBizNo && (
              <>
                <Field><Lbl>개업일자</Lbl><Input type="date" value={biz.openDate} onChange={(e) => setBiz({ ...biz, openDate: e.target.value })} /></Field>
                <Field><Lbl>과세유형</Lbl>
                  <Seg>
                    <SegBtn $on={biz.taxType === "simple"} onClick={() => setBiz({ ...biz, taxType: "simple" })}>간이과세자</SegBtn>
                    <SegBtn $on={biz.taxType === "general"} onClick={() => setBiz({ ...biz, taxType: "general" })}>일반과세자</SegBtn>
                  </Seg>
                </Field>
              </>
            )}
            <Field><Lbl>{opt.docLabel}</Lbl>
              {biz.licenseUrl ? <Done><LuCircleCheck size={16} /> 첨부 완료</Done> : <Upload type="button" onClick={() => licRef.current?.click()}><LuUpload size={15} /> 파일 첨부</Upload>}
              <Hidden ref={licRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], setBiz, "licenseUrl")} />
            </Field>
            <PrimaryBtn type="button" disabled={busy === "biz"} onClick={submitBiz}>{busy === "biz" ? "제출 중…" : "인증 제출"}</PrimaryBtn>
          </>
        )}
      </Card>

      {/* 정산 계좌 — 앱내 결제로 받은 대금을 지급받을 계좌 */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SecTitle><LuLandmark size={16} /> 정산 계좌</SecTitle>
          {hasAcct && <StatBadge $tone="done">등록완료</StatBadge>}
        </div>

        {hasAcct && !editAcct ? (
          <>
            <Info><span>은행</span><b>{st.bank}</b></Info>
            <Info><span>계좌번호</span><b>{st.account}</b></Info>
            <Info><span>예금주</span><b>{st.holder}</b></Info>
            {st.taxEmail && <Info><span>세금계산서</span><b>{st.taxEmail}</b></Info>}
            {st.verified
              ? <Done><LuCircleCheck size={16} /> 예금주 확인 완료</Done>
              : <Caption>첫 지급 전에 관리자가 예금주를 대조해요. 확인 전에도 예약·정산 집계는 그대로 쌓여요.</Caption>}
            <Caption>앱에서 결제된 금액에서 플랫폼 이용료 {PLATFORM_FEE_LABEL}를 뺀 금액을 이 계좌로 지급해요. 입점비·월정액은 없어요.</Caption>
            <PrimaryBtn type="button" onClick={() => setEditAcct(true)}>계좌 변경</PrimaryBtn>
          </>
        ) : (
          <>
            <Caption>{opt.accountHint}</Caption>
            <Field><Lbl>은행</Lbl>
              <Select value={acct.bank} onChange={(e) => setAcct({ ...acct, bank: e.target.value })}>
                <option value="">은행 선택</option>
                {SETTLEMENT_BANKS.map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field><Lbl>계좌번호</Lbl>
              <Input
                value={acct.account}
                onChange={(e) => setAcct({ ...acct, account: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="'-' 없이 숫자만"
                inputMode="numeric"
              />
            </Field>
            <Field><Lbl>예금주</Lbl>
              <Input value={acct.holder} onChange={(e) => setAcct({ ...acct, holder: e.target.value })} placeholder="홍길동" />
            </Field>
            {/* 정산 명세·세금계산서를 보낼 곳. 로그인 이메일과 다른 경우가 많아 따로 받는다. */}
            <Field><Lbl>세금계산서 받을 이메일</Lbl>
              <Input value={acct.taxEmail} onChange={(e) => setAcct({ ...acct, taxEmail: e.target.value })} placeholder="tax@example.com" inputMode="email" />
            </Field>
            {holderMismatch && (
              <Warn>예금주가 {opt.personLabel}({b.ownerName})과 달라요. 명의가 다르면 지급이 보류될 수 있어요.</Warn>
            )}
            {st.verified && <Caption>계좌를 바꾸면 예금주 확인을 다시 받아요.</Caption>}
            <PrimaryBtn type="button" disabled={busy === "acct"} onClick={submitAcct}>
              {busy === "acct" ? "저장 중…" : "계좌 저장"}
            </PrimaryBtn>
          </>
        )}
      </Card>

      {/* 통신판매업 신고 — 구장 상세의 판매자 정보에 신고번호로 노출된다(전자상거래법 표시).
          학교·기관은 통신판매업 신고 대상이 아니라 사업자 주체에게만 묻는다. */}
      {needsBizNo && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SecTitle><LuReceipt size={16} /> 통신판매업 신고</SecTitle>
            {hasSales && <StatBadge $tone="done">{sr.exempt ? "면제" : "등록완료"}</StatBadge>}
          </div>

          {hasSales && !editSales ? (
            <>
              {sr.exempt
                ? <Caption>간이과세자 면제 대상으로 등록돼 있어요.</Caption>
                : <Info><span>신고번호</span><b>{sr.number}</b></Info>}
              <PrimaryBtn type="button" onClick={() => setEditSales(true)}>정보 변경</PrimaryBtn>
            </>
          ) : (
            <>
              <Caption>구장 상세의 판매자 정보에 표시돼요. 시·군·구청에 신고하고 받은 번호를 적어주세요.</Caption>
              <Seg>
                <SegBtn $on={!sales.exempt} onClick={() => setSales({ ...sales, exempt: false })}>신고번호 있음</SegBtn>
                <SegBtn $on={sales.exempt} onClick={() => setSales({ ...sales, exempt: true })}>면제 대상</SegBtn>
              </Seg>
              {sales.exempt ? (
                <Caption>직전 연도 매출이 기준 미만인 간이과세자는 신고 의무가 없어요. 일반과세자로 바뀌면 신고 후 등록해주세요.</Caption>
              ) : (
                <>
                  <Field><Lbl>신고번호</Lbl>
                    <Input value={sales.number} onChange={(e) => setSales({ ...sales, number: e.target.value })} placeholder="예: 2026-서울강남-01234" />
                  </Field>
                  <Field><Lbl>신고증 사본 <span style={{ fontWeight: 500, color: C.slate400 }}>(선택)</span></Lbl>
                    {sales.certUrl ? <Done><LuCircleCheck size={16} /> 첨부 완료</Done> : <Upload type="button" onClick={() => certRef.current?.click()}><LuUpload size={15} /> 파일 첨부</Upload>}
                    <Hidden ref={certRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], setSales, "certUrl")} />
                  </Field>
                </>
              )}
              <PrimaryBtn type="button" disabled={busy === "sales" || (!sales.exempt && !sales.number.trim())} onClick={submitSales}>
                {busy === "sales" ? "저장 중…" : "저장"}
              </PrimaryBtn>
            </>
          )}
        </Card>
      )}
    </>
  );
}
