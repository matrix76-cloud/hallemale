/* eslint-disable */
// src/components/wizard/SignupWizard.jsx
// 가입 흐름 공용 껍데기 — "한 화면에 질문 하나" 형태의 단계형 가입에 쓴다.
//
// 왜 있나: 구장 온보딩은 단계형인데 가입 화면들은 한 화면에 입력이 몰려 있어 톤이 갈렸다.
// 진행바·제목·하단 고정 버튼을 여기 한 곳에 두고 구장주 가입과 사용자앱 가입이 같이 쓴다.
// (구장 온보딩은 자체 Shell 을 계속 쓴다 — 동작 중인 12단계 폼을 건드리는 위험이 더 크다)
//
// 쓰는 법:
//   <WizardShell>
//     <WizardProgress step={2} total={4} />
//     <WizardBody>
//       <WizardTitle>비밀번호를 만들어주세요</WizardTitle>
//       <WizardSub>영문과 숫자를 섞어 8자 이상</WizardSub>
//       ...입력...
//     </WizardBody>
//     <WizardFooter>
//       <WizardBack onClick={prev}>이전</WizardBack>
//       <WizardNext onClick={next} disabled={!ok}>다음</WizardNext>
//     </WizardFooter>
//   </WizardShell>
import styled from "styled-components";

export const WizardShell = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100dvh;
  width: 100%;
  max-width: ${({ theme }) => theme.layout?.maxWidth || 480}px;
  margin: 0 auto;
  background: ${({ theme }) => theme.colors.bg};
  padding-top: env(safe-area-inset-top);
  box-sizing: border-box;
`;

const Track = styled.div`
  height: 4px;
  background: ${({ $track, theme }) => $track || theme.colors.border};
  flex-shrink: 0;
`;
const Bar = styled.div`
  height: 100%;
  background: ${({ $brand, theme }) => $brand || theme.colors.primary};
  border-radius: 0 4px 4px 0;
  transition: width 0.3s ease;
`;

/**
 * step: 1부터 시작하는 현재 단계 / total: 전체 단계 수
 * brand·track: 색 직접 지정 — 인증 게이트처럼 테마를 안 쓰고 라이트로 고정된 화면용.
 */
export function WizardProgress({ step, total, brand, track }) {
  const pct = Math.max(0, Math.min(100, (step / Math.max(1, total)) * 100));
  return (
    <Track $track={track} aria-label={`${total}단계 중 ${step}단계`}>
      <Bar $brand={brand} style={{ width: `${pct}%` }} />
    </Track>
  );
}

const TopFixed = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${({ $z }) => $z || 100};
  padding-top: env(safe-area-inset-top);
`;

/**
 * 화면 최상단에 붙는 진행바 — 이미 자기 레이아웃을 가진 가입 게이트 화면들이
 * 껍데기를 바꾸지 않고도 "이 흐름의 어디쯤"을 보여줄 수 있게 한다.
 */
export function WizardTopProgress({ step, total, brand, track, zIndex }) {
  return (
    <TopFixed $z={zIndex}>
      <WizardProgress step={step} total={total} brand={brand} track={track} />
    </TopFixed>
  );
}

export const WizardBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px max(20px, env(safe-area-inset-left)) 20px max(20px, env(safe-area-inset-right));
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export const WizardTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.35;
  color: ${({ theme }) => theme.colors.textStrong};
`;

export const WizardSub = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
  margin-top: -6px;
`;

export const WizardHint = styled.div`
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

export const WizardFooter = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px max(18px, env(safe-area-inset-left)) calc(14px + env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-right));
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
`;

export const WizardBack = styled.button`
  flex-shrink: 0;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 15px;
  font-weight: 600;
  padding: 8px 4px;
  cursor: pointer;
  font-family: inherit;
`;

export const WizardNext = styled.button`
  flex: 1;
  height: 52px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/** 단계 화면의 기본 입력 — 가입 흐름 전체가 같은 높이·모양을 쓰게 한다 */
export const WizardInput = styled.input`
  width: 100%;
  height: 54px;
  padding: 0 16px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 16px; /* 16px 미만이면 iOS 사파리가 포커스 시 화면을 확대한다 */
  font-family: inherit;
  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary}; }
  &::placeholder { color: ${({ theme }) => theme.colors.textWeak}; }
  &:disabled { opacity: 0.6; }
`;
