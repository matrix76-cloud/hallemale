/* eslint-disable */
// src/components/team/TeamMembersSection.jsx
// ✅ 팀원 리스트: 이름 옆 "팀장" pill 표시
// - member.isTeamCaptain === true 일 때 표시
// - onPlayerClick(member) 그대로 호출

import React from "react";
import styled from "styled-components";
import { images, playerAvatars } from "../../utils/imageAssets";
import PositionChip from "../common/PositionChip";
import EmptyState from "../common/EmptyState";
import AvatarPlaceholder from "../common/AvatarPlaceholder";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`;

const MemberCard = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 10px 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  text-align: left;
  color: ${({ theme }) => theme.colors.textNormal};

  &:active {
    transform: translateY(1px);
  }
`;

const Avatar = styled.img`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  flex-shrink: 0;
`;

const Meta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
`;

const Name = styled.div`
  min-width: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CaptainPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

const SubRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const SubText = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function safeString(v) {
  return String(v || "").trim();
}

function positionLabel(pos) {
  const p = safeString(pos);
  if (p === "guard") return "가드";
  if (p === "forward") return "포워드";
  if (p === "center") return "센터";
  return "";
}

export default function TeamMembersSection({ members = [], onPlayerClick }) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) {
    return <EmptyState compact text="등록된 팀원이 없습니다." />;
  }

  return (
    <Wrap>
      <Grid>
        {list.map((m, idx) => {
          const uid = safeString(m?.userId || m?.id);
          const name = safeString(m?.nickname) || safeString(m?.name) || "팀원";

          const avatarSrc =
            playerAvatars[uid] ||
            safeString(m?.avatarUrl) ||
            safeString(m?.photoUrl) ||
            "";

          const posLabel = positionLabel(m?.mainPosition);

          return (
            <MemberCard
              key={uid || idx}
              type="button"
              onClick={() => onPlayerClick && onPlayerClick(m)}
              title={name}
            >
              {avatarSrc ? (
                <Avatar src={avatarSrc} alt={name} />
              ) : (
                <AvatarPlaceholder size={44} />
              )}

              <Meta>
                <NameRow>
                  <Name>{name}</Name>
                  {m?.isTeamCaptain === true ? <CaptainPill>팀장</CaptainPill> : null}
                </NameRow>

                <SubRow>
                  {posLabel ? <PositionChip label={posLabel} size="sm" /> : null}
                  {m?.region ? <SubText>{safeString(m.region)}</SubText> : null}
                </SubRow>
              </Meta>
            </MemberCard>
          );
        })}
      </Grid>
    </Wrap>
  );
}
