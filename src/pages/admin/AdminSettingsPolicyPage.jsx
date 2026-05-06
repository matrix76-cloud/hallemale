/* eslint-disable */
// src/pages/admin/AdminSettingsPolicyPage.jsx
// 어드민 - 약관/정책 (개인정보 처리지침 / 이용약관) 편집
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import { getLegalDoc, saveLegalDoc } from "../../services/legalService";
import { LEGAL_DEFAULTS } from "../../data/legalDefaults";

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
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 480px;
  padding: 12px 14px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#fafafa"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const HelpText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  line-height: 1.5;
  white-space: pre-line;
`;

const MetaRow = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  flex-wrap: wrap;
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
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
  ${({ $primary }) => ($primary ? "border-color: transparent;" : "")}

  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const TYPE_LABEL = {
  privacy: "개인정보 처리지침",
  terms: "이용약관",
};

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminSettingsPolicyPage() {
  const [type, setType] = useState("privacy"); // 'privacy' | 'terms'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [meta, setMeta] = useState({ updatedAt: null, updatedBy: "" });
  const [dirty, setDirty] = useState(false);

  const load = async (t = type) => {
    setLoading(true);
    setDirty(false);
    try {
      let doc = await getLegalDoc(t);

      // DB에 데이터 없으면 기본 본문으로 자동 시드 (1회)
      if (!doc) {
        const def = LEGAL_DEFAULTS[t];
        if (def && def.content) {
          try {
            await saveLegalDoc({
              type: t,
              title: def.title || TYPE_LABEL[t],
              content: def.content,
              byAdmin: "admin",
            });
            doc = await getLegalDoc(t);
          } catch (seedErr) {
            console.warn("[AdminSettingsPolicyPage] auto-seed failed:", seedErr?.message || seedErr);
          }
        }
      }

      if (doc) {
        setTitle(doc.title || TYPE_LABEL[t] || "");
        setContent(doc.content || "");
        setMeta({ updatedAt: doc.updatedAt, updatedBy: doc.updatedBy });
      } else {
        setTitle(TYPE_LABEL[t] || "");
        setContent("");
        setMeta({ updatedAt: null, updatedBy: "" });
      }
    } catch (e) {
      console.error("[AdminSettingsPolicyPage] load failed", e);
      window.alert(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fillDefault = () => {
    const def = LEGAL_DEFAULTS[type];
    if (!def) return;
    if (content && !window.confirm("현재 입력 내용을 기본 템플릿으로 덮어쓸까요?")) return;
    setTitle(def.title || TYPE_LABEL[type]);
    setContent(def.content || "");
    setDirty(true);
  };

  useEffect(() => {
    load(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const switchType = (next) => {
    if (next === type) return;
    if (dirty && !window.confirm("저장하지 않은 변경사항이 있습니다. 다른 문서로 이동할까요?")) {
      return;
    }
    setType(next);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      if (!window.confirm("내용이 비어있습니다. 그래도 저장하시겠습니까?")) return;
    }
    setSaving(true);
    try {
      await saveLegalDoc({ type, title: title || TYPE_LABEL[type], content });
      window.alert("저장되었습니다.");
      await load(type);
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>약관/정책</Title>
          <Sub style={{ marginTop: 4 }}>
            개인정보 처리지침과 이용약관을 작성·수정합니다. 사용자 마이페이지에서 그대로 노출됩니다.
          </Sub>
        </div>

        <Tabs>
          <TabBtn type="button" $active={type === "privacy"} onClick={() => switchType("privacy")}>
            개인정보 처리지침
          </TabBtn>
          <TabBtn type="button" $active={type === "terms"} onClick={() => switchType("terms")}>
            이용약관
          </TabBtn>
        </Tabs>
      </HeaderRow>

      {loading ? (
        <Card>
          <AdminLoading />
        </Card>
      ) : (
        <Card>
          <Field>
            <Label>제목</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              placeholder={TYPE_LABEL[type]}
            />
          </Field>

          <Field>
            <Label>본문</Label>
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              placeholder={`${TYPE_LABEL[type]} 본문을 입력하세요.\n\n빈 줄로 문단을 구분할 수 있습니다.`}
            />
            <HelpText>
              {`줄바꿈은 그대로 사용자 화면에 보입니다.\n빈 줄을 넣으면 문단이 분리됩니다.`}
            </HelpText>
          </Field>

          <MetaRow>
            <span>마지막 수정: {fmtYmdHm(meta.updatedAt)}</span>
            {meta.updatedBy && <span>수정자: {meta.updatedBy}</span>}
          </MetaRow>

          <Actions>
            <Btn type="button" onClick={fillDefault} disabled={saving}>
              기본 템플릿
            </Btn>
            <Btn type="button" onClick={() => load(type)} disabled={saving}>
              되돌리기
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
