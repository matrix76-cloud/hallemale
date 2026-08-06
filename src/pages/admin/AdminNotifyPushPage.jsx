/* eslint-disable */
// src/pages/admin/AdminNotifyPushPage.jsx
// 푸시 발송 — 전체 또는 특정 사용자에게 즉시 발송.
// notifications 문서를 만들면 서버 트리거(onNotificationCreated)가 FCM 을 쏘고,
// 실패분은 sendPushTick(스케줄)이 재시도한다. 이 화면은 그 문서를 만드는 입구다.
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  sendAdminPush, searchPushTargets, countPushReachable, getPushResult, listRecentPushes,
} from "../../services/adminPushService";

export default function AdminNotifyPushPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("/notifications");
  const [mode, setMode] = useState("all"); // all | pick
  const [picked, setPicked] = useState([]); // [{uid,label,email,tokens}]
  const [kw, setKw] = useState("");
  const [hits, setHits] = useState(null);
  const [reach, setReach] = useState(null);
  const [busy, setBusy] = useState("");
  const [recent, setRecent] = useState([]);

  const loadRecent = () => listRecentPushes(15).then(setRecent).catch(() => {});
  useEffect(() => {
    countPushReachable().then(setReach).catch(() => setReach(null));
    loadRecent();
  }, []);

  const doSearch = async () => {
    setBusy("search");
    try { setHits(await searchPushTargets(kw)); }
    catch (e) { showAlert(e?.message || "조회 실패"); }
    finally { setBusy(""); }
  };

  const add = (u) => {
    setPicked((p) => (p.some((x) => x.uid === u.uid) ? p : [...p, u]));
    setHits(null); setKw("");
  };

  const send = async () => {
    if (!title.trim()) return showAlert("제목을 입력해주세요.");
    if (mode === "pick" && picked.length === 0) return showAlert("받을 사람을 선택해주세요.");

    const who = mode === "all"
      ? `전체 사용자${reach != null ? ` (푸시 수신 가능 ${reach}명)` : ""}`
      : `${picked.length}명 (${picked.map((p) => p.label).join(", ").slice(0, 60)})`;
    // 전체 발송은 되돌릴 수 없다 — 대상과 문구를 그대로 보여주고 한 번 더 묻는다
    if (!await showConfirm(`푸시를 발송할까요?\n\n대상: ${who}\n제목: ${title}\n본문: ${body || "(없음)"}\n\n발송 후에는 취소할 수 없어요.`)) return;

    setBusy("send");
    try {
      const { id } = await sendAdminPush({
        title, body, deepLink,
        targetIds: mode === "pick" ? picked.map((p) => p.uid) : [],
      });
      // 트리거가 status 를 바꾸는 데 잠깐 걸린다 → 잠시 뒤 결과를 한 번 읽어 보여준다
      setTimeout(async () => {
        const r = await getPushResult(id).catch(() => null);
        showAlert(
          r?.status === "sent" ? "발송 완료 — 기기로 전송됐어요."
            : r?.status === "skipped" ? `발송되지 않았어요 — ${r.failReason || "받을 사람이 없어요(기기 토큰 없음 또는 알림 꺼짐)"}`
              : r?.status === "failed" ? `발송 실패 — ${r.failReason || "사유 미상"}`
                : "발송 요청을 큐에 넣었어요. 잠시 후 발송 로그에서 결과를 확인하세요.",
        );
        loadRecent();
      }, 2500);
      setTitle(""); setBody(""); setPicked([]);
      showAlert("발송을 요청했어요.");
    } catch (e) {
      showAlert(e?.message || "발송에 실패했어요.");
    } finally { setBusy(""); }
  };

  return (
    <Page>
      <HeaderRow>
        <Title>푸시 발송</Title>
        <Sub>{reach == null ? "수신 가능 인원 확인 중…" : `푸시 수신 가능 ${reach}명`}</Sub>
      </HeaderRow>

      <Card>
        <CardTitle>대상</CardTitle>
        <Seg>
          <SegBtn $on={mode === "all"} onClick={() => setMode("all")}>전체 발송</SegBtn>
          <SegBtn $on={mode === "pick"} onClick={() => setMode("pick")}>특정 사용자</SegBtn>
        </Seg>

        {mode === "pick" && (
          <>
            <Row>
              <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="닉네임·이름·이메일로 검색 (2자 이상)"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }} />
              <Btn type="button" onClick={doSearch} disabled={busy === "search" || kw.trim().length < 2}>
                {busy === "search" ? "찾는 중…" : "찾기"}
              </Btn>
            </Row>
            {hits && hits.length === 0 && <Hint>검색 결과가 없어요.</Hint>}
            {hits && hits.length > 0 && (
              <HitList>
                {hits.map((u) => (
                  <Hit key={u.uid} type="button" onClick={() => add(u)}>
                    <b>{u.label}</b>
                    <span>{u.email || u.uid.slice(0, 10)} · 기기 {u.tokens}대</span>
                  </Hit>
                ))}
              </HitList>
            )}
            {picked.length > 0 && (
              <Picked>
                {picked.map((u) => (
                  <Tag key={u.uid}>
                    {u.label}{u.tokens === 0 ? " (기기 없음)" : ""}
                    <X type="button" onClick={() => setPicked((p) => p.filter((x) => x.uid !== u.uid))}>×</X>
                  </Tag>
                ))}
              </Picked>
            )}
          </>
        )}
        {mode === "all" && <Hint>푸시 알림을 허용하고 기기 토큰이 등록된 사용자 전원에게 갑니다.</Hint>}
      </Card>

      <Card>
        <CardTitle>내용</CardTitle>
        <Field><Label>제목</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이번 주말 매칭 열렸어요" maxLength={40} />
        </Field>
        <Field><Label>본문</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="알림에 표시될 내용" maxLength={120} />
        </Field>
        <Field><Label>눌렀을 때 이동할 경로</Label>
          <Input value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="/notifications" />
          <Hint>앱 내 경로를 적어요. 예: /notifications · /matching · /venues</Hint>
        </Field>

        <Preview>
          <PvTitle>{title || "제목이 여기에 표시돼요"}</PvTitle>
          <PvBody>{body || "본문이 여기에 표시돼요"}</PvBody>
        </Preview>

        <SendBtn type="button" onClick={send} disabled={busy === "send" || !title.trim()}>
          {busy === "send" ? "발송 중…" : mode === "all" ? "전체 발송" : `${picked.length}명에게 발송`}
        </SendBtn>
      </Card>

      <Card>
        <CardTitle>최근 발송</CardTitle>
        {recent.length === 0 ? (
          <Hint>아직 발송 이력이 없어요.</Hint>
        ) : (
          <Table>
            <thead>
              <tr><th>제목</th><th>대상</th><th>상태</th><th>시각</th></tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.title || "-"}</td>
                  <td>{r.targetType === "ALL" ? "전체" : `${r.targetCount}명`}</td>
                  <td>{r.status || "queued"}</td>
                  <td>{r.createdAt ? r.createdAt.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  );
}

const Page = styled.div`display:flex;flex-direction:column;gap:16px;`;
const HeaderRow = styled.div`display:flex;align-items:baseline;justify-content:space-between;gap:12px;`;
const Title = styled.h1`margin:0;font-size:18px;font-weight:700;color:${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Sub = styled.div`font-size:12px;color:${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const Card = styled.section`
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;
`;
const CardTitle = styled.div`font-size:14px;font-weight:700;color:${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Seg = styled.div`display:flex;gap:8px;`;
const SegBtn = styled.button`
  flex:1;height:38px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;
  border:1px solid ${({ $on, theme }) => ($on ? "#4f46e5" : theme?.colors?.border || "#e5e7eb")};
  background:${({ $on }) => ($on ? "#eef2ff" : "#fff")};
  color:${({ $on }) => ($on ? "#4f46e5" : "#6b7280")};
`;
const Field = styled.label`display:flex;flex-direction:column;gap:6px;`;
const Label = styled.span`font-size:12.5px;font-weight:700;color:${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const Row = styled.div`display:flex;gap:8px;& > *:first-child{flex:1;min-width:0;}`;
const Input = styled.input`
  height:38px;padding:0 12px;border-radius:8px;font-size:13px;font-family:inherit;
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  color:${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;
const Textarea = styled.textarea`
  min-height:72px;padding:10px 12px;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  color:${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;
const Btn = styled.button`
  flex-shrink:0;height:38px;padding:0 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};background:#fff;color:#374151;
  &:disabled{opacity:.5;cursor:not-allowed;}
`;
const SendBtn = styled.button`
  height:44px;border:none;border-radius:8px;background:#4f46e5;color:#fff;
  font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;margin-top:4px;
  &:disabled{opacity:.5;cursor:not-allowed;}
`;
const Hint = styled.div`font-size:12px;color:${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};line-height:1.5;`;
const HitList = styled.div`display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;`;
const Hit = styled.button`
  text-align:left;border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};background:#fff;
  border-radius:8px;padding:8px 10px;cursor:pointer;display:flex;flex-direction:column;gap:2px;font-family:inherit;
  & > b{font-size:13px;color:#111827;} & > span{font-size:11.5px;color:#6b7280;}
`;
const Picked = styled.div`display:flex;flex-wrap:wrap;gap:6px;`;
const Tag = styled.span`
  display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#4f46e5;
  border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700;
`;
const X = styled.button`border:none;background:none;color:#4f46e5;cursor:pointer;font-size:14px;line-height:1;padding:0;`;
const Preview = styled.div`
  border:1px dashed ${({ theme }) => theme?.colors?.border || "#e5e7eb"};border-radius:8px;padding:10px 12px;background:#fafafa;
`;
const PvTitle = styled.div`font-size:13px;font-weight:800;color:#111827;`;
const PvBody = styled.div`font-size:12.5px;color:#4b5563;margin-top:2px;`;
const Table = styled.table`
  width:100%;border-collapse:collapse;font-size:12.5px;
  & th{text-align:left;color:#6b7280;font-weight:600;padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
  & td{padding:7px 8px;border-bottom:1px solid #f3f4f6;color:#111827;}
`;
