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

/* 아바타 + 왕관 오버레이용 래퍼 */
const AvatarBox = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
`;

const Avatar = styled.img`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

/* 선수 랭킹 1~3위: 프로필 사진 위에 겹쳐 배치되는 왕관 (개인 랭킹과 동일 스타일) */
const Crown = styled.img`
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
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

export default function TeamMembersSection({ members = [], onPlayerClick, rankMap = null }) {
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

          const playerRank = rankMap && uid ? rankMap.get(uid) : null;
          const showCrown = !!playerRank && playerRank <= 3;

          return (
            <MemberCard
              key={uid || idx}
              type="button"
              onClick={() => onPlayerClick && onPlayerClick(m)}
              title={name}
            >
              <AvatarBox>
                {showCrown ? <Crown src={images.logo} alt={`${playerRank}위`} /> : null}
                {avatarSrc ? (
                  <Avatar src={avatarSrc} alt={name} />
                ) : (
                  <AvatarPlaceholder size={44} />
                )}
              </AvatarBox>

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
