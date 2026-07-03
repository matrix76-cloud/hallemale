/* eslint-disable */
// src/pages/admin/AdminSettingsAdminsPage.jsx
// 어드민 - 운영자 계정 관리 (목록/추가/삭제/비밀번호 변경)
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listAdminAccounts,
  createAdminAccount,
  deleteAdminAccount,
  changeAdminPassword,
  SUPER_ADMIN,
} from "../../services/adminAccountService";

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

const PrimaryBtn = styled.button`
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  background: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  color: #ffffff;
  cursor: pointer;

  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  overflow: hidden;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 760px;
`;

const COLS = "200px 200px 120px 200px 230px";

const Head = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#f8fafc"};
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#eef2f7"};
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: nowrap;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6"};
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  align-items: center;
`;

const Cell = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
`;

const Mono = styled.div`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
`;

const RolePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  ${({ $role, theme }) => {
    if ($role === "super") {
      return theme?.mode === "dark"
        ? `background: rgba(99,102,241,0.18); color: #c7d2fe;`
        : `background: #eef2ff; color: #4338ca;`;
    }
    return theme?.mode === "dark"
      ? `background: rgba(16,185,129,0.16); color: #6ee7b7;`
      : `background: #ecfdf5; color: #047857;`;
  }}
`;

const ActionRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const SmallBtn = styled.button`
  height: 30px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "rgba(248,113,113,0.16)" : "#fef2f2";
    }
    return theme?.colors?.card || "#ffffff";
  }};
  color: ${({ $variant, theme }) => {
    if ($variant === "danger") {
      return theme?.mode === "dark" ? "#fca5a5" : "#b91c1c";
    }
    return theme?.colors?.textStrong || "#111827";
  }};
  ${({ $variant, theme }) => {
    if ($variant === "danger") {
      const c = theme?.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca";
      return `border-color: ${c};`;
    }
    return "";
  }}

  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const EmptyText = styled.div`
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

// 모달
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
`;

const Modal = styled.div`
  width: min(440px, 92vw);
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  padding: 18px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 24px 64px rgba(15, 23, 42, 0.35)"};
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModalTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const ModalLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const ModalInput = styled.input`
  height: 36px;
  border-radius: 8px;
  padding: 0 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#ffffff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
  }
`;

const ModalActions = styled.div`
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const HelpText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#6b7280"};
  line-height: 1.5;
`;

function fmtYmdHm(d) {
  if (!d) return "-";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function AdminSettingsAdminsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createId, setCreateId] = useState("");
  const [createPw, setCreatePw] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState(null); // { id, name }
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listAdminAccounts();
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[AdminSettingsAdminsPage] load failed", e);
      showAlert(e?.message || "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const myAdminId = useMemo(() => {
    try {
      const raw = localStorage.getItem("HALLE_ADMIN_USER");
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return String(parsed?.id || "");
    } catch (e) {
      return "";
    }
  }, []);

  const openCreate = () => {
    setCreateId("");
    setCreatePw("");
    setCreateName("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (createBusy) return;
    setCreateOpen(false);
  };

  const handleCreate = async () => {
    setCreateBusy(true);
    try {
      await createAdminAccount({
        id: createId,
        password: createPw,
        name: createName,
        byAdmin: myAdminId || "admin",
      });
      setCreateOpen(false);
      await load();
    } catch (e) {
      showAlert(e?.message || "추가에 실패했습니다.");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDelete = async (r) => {
    if (!r?.id || busyId) return;
    if (r.role === "super") {
      showAlert("최고 관리자는 삭제할 수 없습니다.");
      return;
    }
    if (r.id === myAdminId) {
      showAlert("현재 로그인된 본인 계정은 삭제할 수 없습니다.");
      return;
    }
    if (!await showConfirm(`'${r.name}' (${r.id}) 운영자 계정을 삭제하시겠습니까?`)) return;
    setBusyId(r.id);
    try {
      await deleteAdminAccount({ id: r.id });
      await load();
    } catch (e) {
      showAlert(e?.message || "삭제에 실패했습니다.");
    } finally {
      setBusyId("");
    }
  };

  const openPw = (r) => {
    setPwTarget({ id: r.id, name: r.name });
    setPwValue("");
    setPwOpen(true);
  };

  const closePw = () => {
    if (pwBusy) return;
    setPwOpen(false);
    setPwTarget(null);
    setPwValue("");
  };

  const handleChangePw = async () => {
    if (!pwTarget?.id) return;
    setPwBusy(true);
    try {
      await changeAdminPassword({ id: pwTarget.id, newPassword: pwValue });
      showAlert("비밀번호가 변경되었습니다.");
      closePw();
    } catch (e) {
      showAlert(e?.message || "비밀번호 변경에 실패했습니다.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>운영자 계정</Title>
          <Sub style={{ marginTop: 4 }}>
            운영자 계정을 추가/삭제하거나 비밀번호를 변경할 수 있습니다.
            최고 관리자(<Mono as="span">{SUPER_ADMIN}</Mono>)는 삭제할 수 없습니다.
          </Sub>
        </div>
        <PrimaryBtn type="button" onClick={openCreate}>+ 운영자 추가</PrimaryBtn>
      </HeaderRow>

      {loading ? (
        <Card>
          <AdminLoading />
        </Card>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <Head>
                <div>아이디</div>
                <div>이름</div>
                <div>권한</div>
                <div>등록일</div>
                <div>관리</div>
              </Head>

              {rows.map((r) => {
                const isSuper = r.role === "super";
                const isMe = r.id === myAdminId;
                return (
                  <Row key={r.id}>
                    <Cell>
                      <Mono>{r.id}{isMe ? " (나)" : ""}</Mono>
                    </Cell>
                    <Cell>{r.name}</Cell>
                    <Cell>
                      <RolePill $role={r.role}>
                        {isSuper ? "최고 관리자" : "운영자"}
                      </RolePill>
                    </Cell>
                    <Cell>
                      <Mono>{fmtYmdHm(r.createdAt)}</Mono>
                    </Cell>
                    <Cell>
                      <ActionRow>
                        <SmallBtn type="button" onClick={() => openPw(r)} disabled={busyId === r.id}>
                          비밀번호 변경
                        </SmallBtn>
                        <SmallBtn
                          type="button"
                          $variant="danger"
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id || isSuper || isMe}
                          title={isSuper ? "최고 관리자는 삭제할 수 없습니다" : isMe ? "본인 계정은 삭제할 수 없습니다" : ""}
                        >
                          삭제
                        </SmallBtn>
                      </ActionRow>
                    </Cell>
                  </Row>
                );
              })}

              {!rows.length && (
                <EmptyText>등록된 운영자가 없습니다.</EmptyText>
              )}
            </Table>
          </TableWrap>
        </Card>
      )}

      {createOpen && (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget) closeCreate(); }}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>운영자 추가</ModalTitle>
            <Field>
              <ModalLabel>아이디</ModalLabel>
              <ModalInput
                type="text"
                value={createId}
                onChange={(e) => setCreateId(e.target.value)}
                placeholder="영문/숫자/_/- 3~20자"
                disabled={createBusy}
                autoFocus
              />
            </Field>
            <Field>
              <ModalLabel>이름</ModalLabel>
              <ModalInput
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="홍길동"
                disabled={createBusy}
              />
            </Field>
            <Field>
              <ModalLabel>비밀번호</ModalLabel>
              <ModalInput
                type="password"
                value={createPw}
                onChange={(e) => setCreatePw(e.target.value)}
                placeholder="최소 4자 이상"
                disabled={createBusy}
              />
              <HelpText>등록 후 해당 아이디/비밀번호로 어드민 로그인이 가능합니다.</HelpText>
            </Field>
            <ModalActions>
              <SmallBtn type="button" onClick={closeCreate} disabled={createBusy}>취소</SmallBtn>
              <PrimaryBtn
                type="button"
                onClick={handleCreate}
                disabled={createBusy || !createId.trim() || !createPw.trim()}
              >
                {createBusy ? "추가중…" : "추가"}
              </PrimaryBtn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}

      {pwOpen && pwTarget && (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget) closePw(); }}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>비밀번호 변경</ModalTitle>
            <Field>
              <ModalLabel>대상</ModalLabel>
              <Mono>{pwTarget.name} ({pwTarget.id})</Mono>
            </Field>
            <Field>
              <ModalLabel>새 비밀번호</ModalLabel>
              <ModalInput
                type="password"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                placeholder="최소 4자 이상"
                disabled={pwBusy}
                autoFocus
              />
            </Field>
            <ModalActions>
              <SmallBtn type="button" onClick={closePw} disabled={pwBusy}>취소</SmallBtn>
              <PrimaryBtn
                type="button"
                onClick={handleChangePw}
                disabled={pwBusy || !pwValue.trim()}
              >
                {pwBusy ? "변경중…" : "변경"}
              </PrimaryBtn>
            </ModalActions>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}
