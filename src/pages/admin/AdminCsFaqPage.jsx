/* eslint-disable */
// src/pages/admin/AdminCsFaqPage.jsx
// CS 답변(FAQ) 관리 — 앱 FAQ 화면과 카카오톡 챗봇이 함께 읽는 단일 출처(csFaq)를 편집한다.
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { listCsFaqAdmin, saveCsFaq, deleteCsFaq } from "../../services/adminCsFaqService";
import { useAuth } from "../../hooks/useAuth";

const AUDIENCES = [
  { key: "user", label: "사용자" },
  { key: "owner", label: "구장주" },
];

function blankItem(audience, order) {
  return {
    id: `${audience}-${Date.now().toString(36)}`,
    audience,
    q: "",
    a: "",
    keywords: [],
    order,
    active: false,
    _isNew: true,
  };
}

export default function AdminCsFaqPage() {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid || "admin";

  const [audience, setAudience] = useState("user");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // 편집 중인 항목(사본)
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      setRows(await listCsFaqAdmin());
    } catch (e) {
      console.error("[AdminCsFaqPage] load failed", e);
      setRows([]);
      setErr(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => r.audience === audience),
    [rows, audience]
  );

  const draftCount = useMemo(
    () => visible.filter((r) => !r.active).length,
    [visible]
  );

  const startEdit = (item) => setEditing({ ...item, keywordText: (item.keywords || []).join(", ") });

  const startNew = () => {
    const nextOrder = (visible.reduce((m, r) => Math.max(m, r.order || 0), 0) || 0) + 10;
    startEdit(blankItem(audience, nextOrder));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await saveCsFaq({
        id: editing.id,
        audience: editing.audience,
        q: editing.q,
        a: editing.a,
        keywords: String(editing.keywordText || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        order: editing.order,
        active: editing.active,
        adminUid,
      });
      setEditing(null);
      await load();
      showAlert("저장되었습니다. 챗봇에는 최대 5분 뒤 반영됩니다.");
    } catch (e) {
      console.error("[AdminCsFaqPage] save failed", e);
      showAlert(e?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing._isNew) return void setEditing(null);
    if (!(await showConfirm("이 항목을 삭제할까요? 앱 FAQ와 챗봇에서 함께 사라집니다."))) return;
    setSaving(true);
    try {
      await deleteCsFaq(editing.id);
      setEditing(null);
      await load();
    } catch (e) {
      console.error("[AdminCsFaqPage] delete failed", e);
      showAlert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>CS 답변(FAQ)</Title>
          <Sub style={{ marginTop: 4 }}>
            앱의 자주 묻는 질문 화면과 카카오톡 채널 챗봇이 이 내용을 그대로 사용합니다.
            노출을 끄면 양쪽 모두에서 사라집니다.
          </Sub>
        </div>

        <Tabs>
          {AUDIENCES.map((a) => (
            <TabBtn
              key={a.key}
              type="button"
              $active={audience === a.key}
              onClick={() => {
                setEditing(null);
                setAudience(a.key);
              }}
            >
              {a.label}
            </TabBtn>
          ))}
        </Tabs>
      </HeaderRow>

      {draftCount > 0 && (
        <Notice>
          비노출 {draftCount}건 — 문구를 확인한 뒤 ‘노출’을 켜야 사용자에게 보입니다.
        </Notice>
      )}

      {loading ? (
        <Card>
          <AdminLoading />
        </Card>
      ) : err ? (
        <Card>
          <Sub>{err}</Sub>
        </Card>
      ) : (
        <Card>
          <Actions style={{ justifyContent: "flex-start" }}>
            <Btn type="button" onClick={startNew} disabled={saving}>
              + 새 항목
            </Btn>
          </Actions>

          {!visible.length ? (
            <Sub>등록된 항목이 없습니다.</Sub>
          ) : (
            <List>
              {visible.map((r) => (
                <Row key={r.id} type="button" onClick={() => startEdit(r)}>
                  <RowMain>
                    <RowQ>{r.q || "(제목 없음)"}</RowQ>
                    <RowMeta>
                      {r.id} · 순서 {r.order}
                      {r.keywords?.length ? ` · 키워드 ${r.keywords.length}개` : ""}
                    </RowMeta>
                  </RowMain>
                  <Badge $on={r.active}>{r.active ? "노출" : "비노출"}</Badge>
                </Row>
              ))}
            </List>
          )}
        </Card>
      )}

      {editing && (
        <Card>
          <Field>
            <Label>질문</Label>
            <Input
              value={editing.q}
              onChange={(e) => setEditing({ ...editing, q: e.target.value })}
              placeholder="매칭은 어떻게 신청하나요?"
            />
          </Field>

          <Field>
            <Label>답변</Label>
            <Textarea
              value={editing.a}
              onChange={(e) => setEditing({ ...editing, a: e.target.value })}
              placeholder="답변 본문을 입력하세요."
            />
            <HelpText>
              {"카카오톡 말풍선에도 그대로 나갑니다. 너무 길면 읽히지 않으니 3~4줄 안쪽을 권합니다."}
            </HelpText>
          </Field>

          <Field>
            <Label>키워드 (쉼표로 구분)</Label>
            <Input
              value={editing.keywordText || ""}
              onChange={(e) => setEditing({ ...editing, keywordText: e.target.value })}
              placeholder="매칭 신청, 라인업, 상대팀"
            />
            <HelpText>
              {"챗봇이 사용자의 말을 이 항목으로 연결할 때 쓰는 단서입니다. 사용자가 실제로 칠 법한 말을 넣어주세요. 질문 문구 자체는 자동으로 검색됩니다."}
            </HelpText>
          </Field>

          <TwoCol>
            <Field>
              <Label>순서</Label>
              <Input
                type="number"
                value={editing.order}
                onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field>
              <Label>노출</Label>
              <Toggle
                type="button"
                $on={editing.active}
                onClick={() => setEditing({ ...editing, active: !editing.active })}
              >
                {editing.active ? "노출 중" : "비노출"}
              </Toggle>
            </Field>
          </TwoCol>

          <Actions>
            <Btn type="button" onClick={handleDelete} disabled={saving}>
              {editing._isNew ? "취소" : "삭제"}
            </Btn>
            <Btn type="button" onClick={() => setEditing(null)} disabled={saving}>
              닫기
            </Btn>
            <Btn type="button" $primary onClick={handleSave} disabled={saving}>
              {saving ? "저장중…" : "저장"}
            </Btn>
          </Actions>
        </Card>
      )}
    </Page>
  );
}

/* ================= styled ================= */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  line-height: 1.6;
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const TabBtn = styled.button`
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  cursor: pointer;
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Notice = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  background: ${({ theme }) => theme?.colors?.surface || "#f9fafb"};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Row = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-top: 1px solid ${({ theme }) => theme?.colors?.border || "#f3f4f6"};
  padding: 12px 2px;
  cursor: pointer;

  &:first-child { border-top: none; }
  &:hover { opacity: 0.75; }
`;

const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

const RowQ = styled.div`
  font-size: 13.5px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const RowMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
`;

const Badge = styled.span`
  flex: none;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  color: ${({ $on, theme }) =>
    $on ? theme?.colors?.textStrong || "#111827" : theme?.colors?.textWeak || "#9ca3af"};
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TwoCol = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  & > * { flex: 1 1 160px; }
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Input = styled.input`
  height: 38px;
  border-radius: 8px;
  padding: 0 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 14px;
  background: ${({ theme }) => (theme?.mode === "dark" ? theme?.colors?.surface : "#ffffff")};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  outline: none;

  &:focus { border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"}; }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 180px;
  padding: 12px 14px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  background: ${({ theme }) => (theme?.mode === "dark" ? theme?.colors?.surface : "#fafafa")};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  box-sizing: border-box;

  &:focus { border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"}; }
`;

const HelpText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  line-height: 1.5;
`;

const Toggle = styled.button`
  height: 38px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $on, theme }) =>
    $on ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $on, theme }) => ($on ? "#ffffff" : theme?.colors?.textNormal || "#6b7280")};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $primary, theme }) =>
    $primary ? theme?.colors?.primary || "#4f46e5" : theme?.colors?.card || "#ffffff"};
  color: ${({ $primary, theme }) => ($primary ? "#ffffff" : theme?.colors?.textStrong || "#111827")};
  ${({ $primary }) => ($primary ? "border-color: transparent;" : "")}

  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
