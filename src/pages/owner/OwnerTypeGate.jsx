/* eslint-disable */
// src/pages/owner/OwnerTypeGate.jsx
// 구장주 가입 직후 1회 노출되는 운영 주체 확인 게이트.
// 동의 게이트보다 먼저 온다 — 동의 문구("만 19세 이상 사업자 본인입니다")부터
// 주체에 따라 달라져야 해서, 주체를 모르는 상태로는 뒤 화면을 그릴 수 없다.
// 선택값은 계정(users/{uid}.ownerType)에 남고 이후 온보딩·인증 서류가 이 값으로 갈린다.
import React, { useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { showAlert } from "../../utils/appDialog";
import { useOwner } from "../../context/OwnerContext";
import { saveOwnerType } from "../../services/userService";
import { OWNER_TYPE_OPTIONS } from "../../constants/ownerType";
import { track } from "../../utils/analytics";
import { C } from "./components/od";
import { images } from "../../utils/imageAssets";

export default function OwnerTypeGate() {
  const navigate = useNavigate();
  const { uid, refresh, signOut } = useOwner();

  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!picked || busy) return;
    if (!uid) {
      showAlert("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await saveOwnerType({ uid, ownerType: picked });
      track("owner_type_select", { ownerType: picked }); // 공급 유입 구성(민간/학교/기관) 파악
      await refresh();
      // refresh 후 userDoc이 갱신되면 상위 게이트가 통과시켜 동의 → 온보딩으로 넘어간다.
    } catch (e) {
      showAlert(e?.message || "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
    navigate("/owner/login", { replace: true });
  };

  return (
    <Wrap>
      <Inner>
        <Hero>
          <Logo src={images.logo} alt="할래말래" />
          <Title>어떤 곳을 운영하세요?</Title>
          <Sub>고른 내용에 맞춰 등록에 필요한 정보만 여쭤볼게요.</Sub>
        </Hero>

        <TypeList>
          {OWNER_TYPE_OPTIONS.map((o) => (
            <TypeCard
              key={o.key}
              type="button"
              $on={picked === o.key}
              onClick={() => setPicked(o.key)}
              disabled={busy}
            >
              <TypeLabel>{o.label}</TypeLabel>
              <TypeDesc>{o.desc}</TypeDesc>
            </TypeCard>
          ))}
        </TypeList>

        <Spacer />

        <Hint>선택한 주체는 나중에 1:1 문의로 변경할 수 있어요.</Hint>

        <SubmitBtn type="button" $on={!!picked} disabled={!picked || busy} onClick={handleSubmit}>
          {busy ? "저장중…" : "다음"}
        </SubmitBtn>

        <SignOutBtn type="button" onClick={handleSignOut} disabled={busy}>
          나중에 하기 · 로그아웃
        </SignOutBtn>
      </Inner>
    </Wrap>
  );
}

/* ===================== styles ===================== */

const Wrap = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${C.white};
  display: flex;
  justify-content: center;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
`;

const Inner = styled.div`
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  padding-top: 48px;
`;

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 28px;
`;

const Logo = styled.img`width: 56px; height: 56px; object-fit: contain; margin-bottom: 6px;`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: ${C.slate800};
`;

const Sub = styled.p`
  margin: 0;
  font-size: 13.5px;
  color: ${C.slate500};
  text-align: center;
`;

const TypeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TypeCard = styled.button`
  width: 100%;
  text-align: left;
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1.5px solid ${({ $on }) => ($on ? C.violet600 : C.slate200)};
  background: ${({ $on }) => ($on ? C.violet50 : C.white)};
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const TypeLabel = styled.div`
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${C.slate800};
`;

const TypeDesc = styled.div`
  font-size: 13px;
  line-height: 1.45;
  color: ${C.slate500};
`;

const Spacer = styled.div`flex: 1 1 auto; min-height: 24px;`;

const Hint = styled.div`
  font-size: 12.5px;
  color: ${C.slate400};
  text-align: center;
  margin-bottom: 10px;
`;

const SubmitBtn = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
  background: ${({ $on }) => ($on ? C.violet600 : C.slate400)};
  transition: background 0.15s, transform 0.1s;
  &:active { transform: translateY(1px); }
  &:disabled { cursor: not-allowed; }
`;

const SignOutBtn = styled.button`
  width: 100%;
  margin-top: 10px;
  background: none;
  border: none;
  font-size: 12.5px;
  color: ${C.slate400};
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  padding: 6px 0;
`;
