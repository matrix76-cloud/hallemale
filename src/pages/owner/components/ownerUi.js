/* eslint-disable */
// src/pages/owner/components/ownerUi.js
// 구장 관리자 화면 공용 styled 컴포넌트 — 실체는 od.js 하나로 합쳤다.
//
// 예전엔 이 파일이 앱 테마(다크/라이트)를 따르는 별도 세트였고, od.js 는 고정 팔레트였다.
// 그래서 같은 워크스페이스에서 화면마다 카드·버튼 톤이 달랐다(내정보·알림함만 테마색).
// 구장주 앱은 고정 팔레트로 통일하기로 해 od.js 로 일원화하고, 이 파일은 기존
// import 경로를 유지하기 위한 재수출 껍데기로 남긴다.
export {
  C,
  Page,
  Card,
  ScreenTitle,
  SecTitle,
  SectionTitle,
  Caption,
  SectionDesc,
  PrimaryBtn,
  GhostBtn,
  DangerBtn,
  Chip,
  ChipWrap,
  Input,
  Textarea,
  Select,
  Field,
  Label,
  FieldHint,
  Row,
  Badge,
  StatBadge,
  Money,
} from "./od";
