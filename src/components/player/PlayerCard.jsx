/* eslint-disable */
// src/components/player/PlayerCard.jsx
import React from "react";
import styled from "styled-components";

const Card = styled.button`
  border: none;
  background: #ffffff;
  border-radius: 18px;
  padding: 14px 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  text-align: center;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  }
`;

const AvatarWrap = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 999px;
  overflow: hidden;
  background: linear-gradient(145deg, #f3f4ff, #e5f0ff);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Name = styled.div`
  margin-top: 2px;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
`;

const RoleText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const MetaText = styled.div`
  margin-top: 2px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

// 포지션 + 레벨 텍스트
function buildRoleText(player) {
  const position =
    player.position || player.mainPosition || player.role || player.spot;

  const bits = [];
  if (position) bits.push(position); // 센터/가드/포워드 등
  if (player.level) bits.push(player.level); // 프로/중급/입문 등

  const joined = bits.join(" · ");

  // 카드에 포지션은 반드시 보여야 해서, 없으면 기본 문구
  return joined || "포지션 미정";
}

// 키/몸무게 텍스트
function buildMetaText(player) {
  const bits = [];
  if (player.heightCm) bits.push(`${player.heightCm}cm`);
  if (player.weightKg) bits.push(`${player.weightKg}kg`);
  return bits.join(" · ");
}

export default function PlayerCard({ player, onClick }) {
  if (!player) return null;

  const name = player.name || player.nickName || player.displayName || "선수";
  const avatarUrl = player.avatarUrl || player.photoUrl;

  const roleText = buildRoleText(player); // 항상 문자열
  const metaText = buildMetaText(player); // 없으면 빈 문자열

  return (
    <Card type="button" onClick={onClick}>
      <AvatarWrap>
        {avatarUrl && <AvatarImg src={avatarUrl} alt={name} />}
      </AvatarWrap>
      <Name>{name}</Name>
      <RoleText>{roleText}</RoleText>
      {metaText && <MetaText>{metaText}</MetaText>}
    </Card>
  );
}
