/* eslint-disable */
// src/pages/admin/AdminUpdatesPage.jsx
// 앱 업데이트 — app_updates 에 새 버전을 등록하는 화면.
//
// 등록하면 접속 중인 사용자의 VersionChecker(App.js)가 최신 문서를 읽어
// 자기 로컬 버전보다 높으면 토스트를 띄우고 캐시를 비운 뒤 새로고침한다.
// 배포된 코드를 바꾸는 게 아니라 "이미 배포한 코드를 강제로 다시 읽게 하는" 스위치다.
// 그래서 순서가 중요하다: 배포 먼저 → 그 다음 여기서 버전 등록.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { IoInformationCircleOutline } from "react-icons/io5";
import AdminLoading from "../../components/admin/AdminLoading";
import { showAlert, showConfirm } from "../../utils/appDialog";
import {
  listAppUpdates, publishAppUpdate, deleteAppUpdate, isValidVersion,
} from "../../services/adminUpdatesService";

// 마지막 자리만 +1 한 다음 버전 — 입력 편의를 위한 기본값일 뿐 강제하지 않는다
function nextVersion(v) {
  const parts = String(v || "").split(".");
  if (!parts.length || !isValidVersion(v)) return "1.0.0";
  parts[parts.length - 1] = String((parseInt(parts[parts.length - 1], 10) || 0) + 1);
  return parts.join(".");
}

const fmt = (d) =>
  d ? d.toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

export default function AdminUpdatesPage() {
  const [rows, setRows] = useState(null);
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState("");

  const latest = rows?.[0]?.version || "";

  const load = () =>
    listAppUpdates(30)
      .then((r) => {
        setRows(r);
        setVersion((v) => v || nextVersion(r?.[0]?.version));
      })
      .catch(() => setRows([]));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const versionError = useMemo(() => {
    if (!version.trim()) return "";
    if (!isValidVersion(version)) return "숫자와 점으로만 적어주세요. (예: 1.2.3)";
    return "";
  }, [version]);

  if (rows === null) return <AdminLoading />;

  const publish = async () => {
    const v = version.trim();
    if (!isValidVersion(v)) return showAlert("버전은 숫자와 점으로만 적어주세요. (예: 1.2.3)");

    // 접속 중인 사용자 화면이 전부 새로고침된다 — 되돌릴 수 없으니 한 번 더 묻는다
    const ok = await showConfirm(
      `v${v} 로 업데이트를 알릴까요?\n\n` +
      `${latest ? `현재 최신: v${latest}\n` : ""}` +
      `안내 문구: ${content.trim() || "(없음)"}\n\n` +
      `지금 앱을 켜 둔 사용자는 안내 토스트를 본 뒤 화면이 자동으로 새로고침돼요.\n` +
      `새 코드 배포를 끝낸 뒤에 눌러주세요.`,
    );
    if (!ok) return;

    setBusy("publish");
    try {
      await publishAppUpdate({ version: v, content, latest });
      setContent("");
      await load();
      setVersion(nextVersion(v));
      showAlert("등록했어요. 접속 중인 사용자부터 순차적으로 새로고침돼요.");
    } catch (e) {
      showAlert(e?.message || "등록에 실패했어요.");
    } finally { setBusy(""); }
  };

  const remove = async (r) => {
    const ok = await showConfirm(
      `v${r.version} 기록을 지울까요?\n\n` +
      `이미 새로고침된 사용자는 되돌아가지 않아요. 잘못 올린 버전 때문에 다음 업데이트가 ` +
      `안 걸리는 걸 푸는 용도예요.`,
    );
    if (!ok) return;
    setBusy(r.id);
    try {
      await deleteAppUpdate(r.id);
      await load();
    } catch (e) {
      showAlert(e?.message || "삭제에 실패했어요.");
    } finally { setBusy(""); }
  };

  return (
    <Page>
      <HeaderRow>
        <Title>앱 업데이트</Title>
        <Sub>{latest ? `현재 최신 v${latest}` : "등록된 버전 없음"}</Sub>
      </HeaderRow>

      <Card>
        <CardTitle>새 버전 등록</CardTitle>
        <Field>
          <Label>버전</Label>
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.2.3"
            inputMode="decimal"
          />
          {versionError
            ? <Warn>{versionError}</Warn>
            : <Hint>{latest ? `현재 최신은 v${latest} 예요. 이보다 높아야 새로고침이 걸려요.` : "첫 버전이에요."}</Hint>}
        </Field>
        <Field>
          <Label>안내 문구</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예: 매칭 화면이 빨라졌어요"
            maxLength={80}
          />
        </Field>

        <Preview>
          <PvIcon><IoInformationCircleOutline size={20} color="#2563eb" /></PvIcon>
          <div>
            <PvTitle>새로운 버전으로 업데이트 중... (v{version.trim() || "0.0.0"})</PvTitle>
            {content.trim() ? <PvBody>{content.trim()}</PvBody> : null}
          </div>
        </Preview>

        <SendBtn type="button" onClick={publish} disabled={busy === "publish" || !!versionError || !version.trim()}>
          {busy === "publish" ? "등록 중…" : "업데이트 알리기"}
        </SendBtn>
      </Card>

      <Card>
        <CardTitle>등록된 버전</CardTitle>
        {rows.length === 0 ? (
          <Hint>아직 등록된 버전이 없어요.</Hint>
        ) : (
          <Table>
            <thead>
              <tr><th>버전</th><th>안내 문구</th><th>등록 시각</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <b>v{r.version || "-"}</b>
                    {i === 0 && <Badge>최신</Badge>}
                  </td>
                  <td>{r.content || "-"}</td>
                  <td>{fmt(r.createdAt)}</td>
                  <td>
                    <DelBtn type="button" onClick={() => remove(r)} disabled={busy === r.id}>
                      {busy === r.id ? "삭제 중…" : "삭제"}
                    </DelBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Note>
        여기서 버전을 올리면 <b>새 코드가 배포되는 게 아니라</b>, 이미 배포된 코드를 사용자가 다시 읽도록
        강제 새로고침이 걸려요. 반드시 <b>배포를 끝낸 뒤</b>에 등록해 주세요.
        <br />
        앱을 처음 켜는 사용자는 최신 버전을 저장만 하고 새로고침하지 않아요. 새로고침은 이미 이전 버전을
        보고 있던 사용자에게만 일어나요.
      </Note>
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
  border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;overflow-x:auto;
`;
const CardTitle = styled.div`font-size:14px;font-weight:700;color:${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Field = styled.label`display:flex;flex-direction:column;gap:6px;`;
const Label = styled.span`font-size:12.5px;font-weight:700;color:${({ theme }) => theme?.colors?.textNormal || "#4b5563"};`;
const Input = styled.input`
  height:38px;padding:0 12px;border-radius:8px;font-size:13px;font-family:inherit;
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  color:${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;
const Textarea = styled.textarea`
  min-height:60px;padding:10px 12px;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background:${({ theme }) => theme?.colors?.card || "#fff"};
  color:${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;
const Hint = styled.div`font-size:12px;color:${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};line-height:1.5;`;
const Warn = styled.div`font-size:12px;color:#b91c1c;line-height:1.5;`;
const SendBtn = styled.button`
  height:44px;border:none;border-radius:8px;background:#4f46e5;color:#fff;
  font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;margin-top:4px;
  &:disabled{opacity:.5;cursor:not-allowed;}
`;
const Preview = styled.div`
  border:1px dashed ${({ theme }) => theme?.colors?.border || "#e5e7eb"};border-radius:12px;padding:12px 14px;
  background:#fafafa;display:flex;gap:10px;align-items:flex-start;
`;
const PvIcon = styled.div`display:flex;flex-shrink:0;`;
const PvTitle = styled.div`font-size:13px;font-weight:600;color:#111;`;
const PvBody = styled.div`font-size:12px;color:#555;margin-top:2px;`;
const Table = styled.table`
  width:100%;border-collapse:collapse;font-size:12.5px;
  & th{text-align:left;color:#6b7280;font-weight:600;padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
  & td{padding:7px 8px;border-bottom:1px solid #f3f4f6;color:#111827;vertical-align:top;}
`;
const Badge = styled.span`
  display:inline-block;margin-left:6px;border-radius:999px;padding:1px 7px;
  background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:700;
`;
const DelBtn = styled.button`
  border:1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};background:#fff;color:#b91c1c;
  border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;
  &:disabled{opacity:.5;cursor:not-allowed;}
`;
const Note = styled.div`
  font-size:12px;color:${({ theme }) => theme?.colors?.textWeak || "#6b7280"};line-height:1.7;
  background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:10px 12px;
`;
