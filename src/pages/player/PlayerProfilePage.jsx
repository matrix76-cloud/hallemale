/* eslint-disable */
// src/pages/player/PlayerProfilePage.jsx
// ✅ HeroName 옆 "팀장" pill 추가 (player.isTeamCaptain === true)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { FiStar, FiMapPin } from "react-icons/fi";
import { TbBallBasketball } from "react-icons/tb";

import { images } from "../../utils/imageAssets";
import { getPlayerProfile } from "../../services/playerService";

import { useAuth } from "../../hooks/useAuth";
import { setFavoritePlayer } from "../../services/favoriteService";
import { getOrCreateDmRoom } from "../../services/chatService";

/* =============== 헬퍼: 포지션/실력 라벨 =============== */

const POSITION_LABEL = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로급",
};

const SKILL_COLOR = {
  beginner: { bg: "#e5e7eb", color: "#4b5563" },
  amateur: { bg: "#dbeafe", color: "#1d4ed8" },
  intermediate: { bg: "#dcfce7", color: "#15803d" },
  advanced: { bg: "#fee2e2", color: "#b91c1c" },
  pro: { bg: "#fef3c7", color: "#92400e" },
};

const getAge = (birthYear) => {
  if (!birthYear) return null;
  const now = new Date();
  const year = now.getFullYear();
  const age = year - birthYear;
  if (age < 0 || age > 80) return null;
  return age;
};

/* =============== 레이아웃 공통 =============== */

const Page = styled.div`
  min-height: 100vh;
  background: #f3f4f6;
  display: flex;
  flex-direction: column;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: 110px;
`;

/* =============== 상단 히어로 (선수 프로필) =============== */

const HeroWrap = styled.div`
  position: relative;
  width: 100%;
  height: 180px;
  background: linear-gradient(135deg, #0f766e 0%, #14b8a6 40%, #0f172a 100%);
  color: #ecfeff;
  overflow: hidden;
`;

const HeroTeamBgCircle = styled.div`
  position: absolute;
  right: -40px;
  bottom: -40px;
  width: 190px;
  height: 190px;
  border-radius: 999px;
  overflow: hidden;
  opacity: 0.22;
  pointer-events: none;
  filter: blur(0.5px);
  z-index: 1;
`;

const HeroTeamBgImg = styled.img`
  width: 120%;
  height: 120%;
  object-fit: cover;
  transform: scale(1.03);
`;

const HeroInner = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 24px 16px 10px;
  gap: 16px;
  z-index: 2;
`;

const HeroLeftCol = styled.div`
  flex: 1.8;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const HeroRightCol = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  height: 100%;
  gap: 8px;
`;

const HeroTopBlock = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const AvatarCircle = styled.div`
  width: 62px;
  height: 62px;
  border-radius: 24px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const HeroTitleBlock = styled.div`
  min-width: 0;
`;

/* ✅ 이름 + 팀장 뱃지 Row */
const HeroNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const HeroName = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #ecfeff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* ✅ 팀장 pill */
const CaptainPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

const HeroMetaRow = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: #a5f3fc;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const HeroChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  margin-top: 10px;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const HeroChip = styled.span`
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.35);
  color: #e0f2fe;
  white-space: nowrap;
`;

const SkillChip = styled.span`
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  ${({ $skill }) => {
    const style = SKILL_COLOR[$skill] || {
      bg: "rgba(15,23,42,0.25)",
      color: "#e0f2fe",
    };
    return `
      background: ${style.bg};
      color: ${style.color};
    `;
  }}
`;

const FavoriteButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 6px 6px;
  font-size: 11px;
  font-weight: 500;
  background: #fef3c7;
  color: #92400e;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.35);

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

/* =============== 컨텐츠 래퍼 =============== */

const ContentWrap = styled.div`
  padding: 16px 16px 0;
`;

const Section = styled.section`
  margin-top: 12px;
  background: #ffffff;
  border-radius: 20px;
  padding: 14px 16px 16px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
`;

const SectionHeaderRow = styled.div`
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionIconCircle = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  overflow: hidden;
  background: #e0f2fe;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SectionIconImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const SectionTitleText = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #111827;
`;

const SectionMeta = styled.span`
  font-size: 11px;
  color: #9ca3af;
`;

const AboutText = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
  white-space: pre-line;
`;

const MetaGrid = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  font-size: 12px;
  color: #6b7280;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const MetaLabel = styled.span`
  color: #9ca3af;
`;

const MetaValue = styled.span`
  color: #374151;
  font-weight: 500;
`;

const TeamInfoRow = styled.div`
  font-size: 13px;
  color: #4b5563;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
`;

const TeamBasicRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TeamLogoCircle = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamNameText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #111827;
`;

const TeamMetaText = styled.div`
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MediaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
`;

const MediaItem = styled.div`
  width: 100%;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const MediaCard = styled.div`
  width: 100%;
  height: 180px;
  border-radius: 12px;
  overflow: hidden;
  background: #e5e7eb;
  position: relative;
  cursor: pointer;
`;

const MediaImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const MediaTitle = styled.div`
  font-size: 11px;
  color: #4b5563;
  line-height: 1.4;
`;

const PlaceholderText = styled.div`
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
`;

/* 하단 CTA */

const BottomBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px 16px;
  background: linear-gradient(to top, #ffffff, rgba(255, 255, 255, 0.92));
  box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.12);
  z-index: 10;
`;

const CTAButton = styled.button`
  width: 100%;
  border: 1px solid rgba(15, 118, 110, 0.35);
  border-radius: 999px;
  height: 44px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  background: #ffffff;
  color: #0f766e;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const BottomRow = styled.div`
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 8px;
`;

const StateWrap = styled.div`
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
`;

/* =============== 페이지 컴포넌트 =============== */

export default function PlayerProfilePage() {
  const nav = useNavigate();
  const { playerId } = useParams();

  const { firebaseUser, userDoc, refreshUser } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);

  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const p = await getPlayerProfile(playerId);
        if (!alive) return;
        setPlayer(p || null);

        console.log("player information", p);
      } catch (e) {
        console.warn("[PlayerProfilePage] load failed:", e?.message || e);
        if (!alive) return;
        setPlayer(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [playerId]);

  useEffect(() => {
    const ids = Array.isArray(userDoc?.favoritePlayerIds) ? userDoc.favoritePlayerIds : [];
    setFav(ids.includes(String(playerId)));
  }, [userDoc?.favoritePlayerIds, playerId]);

  const isSelf = useMemo(() => {
    if (!myUid || !playerId) return false;
    return String(myUid) === String(playerId);
  }, [myUid, playerId]);

  const onFavoritePlayer = async () => {
    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!playerId) return;
    if (isSelf) return;

    const next = !fav;
    setFav(next);

    try {
      setFavBusy(true);
      await setFavoritePlayer({
        uid: myUid,
        playerUid: String(playerId),
        isFavorite: next,
      });
      refreshUser && (await refreshUser());
    } catch (e) {
      console.warn("[PlayerProfilePage] setFavoritePlayer failed:", e?.message || e);
      setFav(!next);
      alert("즐겨찾기 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setFavBusy(false);
    }
  };

  const onMatchWithPlayer = async () => {
    if (!playerId) return;

    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (isSelf) return;

    if (chatBusy) return;

    const otherUid = String(player?.uid || player?.userId || playerId || "").trim();
    if (!otherUid) {
      alert("상대 정보를 확인할 수 없습니다.");
      return;
    }

    try {
      setChatBusy(true);

      const chatId = await getOrCreateDmRoom({
        myUid: String(myUid),
        otherUid,
        createdFrom: "playerProfile",
        createdFromRefId: String(playerId || ""),
      });

      nav(`/chats/${chatId}`);
    } catch (e) {
      console.warn("[PlayerProfilePage] open chat failed:", e?.message || e);
      alert("채팅을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setChatBusy(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <StateWrap>불러오는 중...</StateWrap>
      </Page>
    );
  }

  if (!player) {
    return (
      <Page>
        <StateWrap>선수 정보를 찾을 수 없습니다.</StateWrap>
      </Page>
    );
  }

  const age = getAge(player.birthYear);
  const positionLabel =
    (player.mainPosition && POSITION_LABEL[player.mainPosition]) || "포지션 미정";
  const skillLabel =
    (player.skillLevel && SKILL_LABEL[player.skillLevel]) || "실력 정보 없음";

  const avatarSrc =
    player.photoUrl || player.avatarUrl || images.playerDefaultAvatar || images.logo;

  const teamLogoSrc = player.clubLogoUrl || images.logo;

  const mediaList = Array.isArray(player.media) ? player.media : [];

  const onViewTeam = () => {
    if (!player.clubId) return;
    nav(`/team/${player.clubId}`);
  };

  const onMediaClick = (m) => {
    if (m?.url) window.open(m.url, "_blank");
  };

  return (
    <Page>
      <ScrollArea>
        <HeroWrap>
          <HeroTeamBgCircle>
            <HeroTeamBgImg src={teamLogoSrc} alt={player.clubName || "소속 팀"} />
          </HeroTeamBgCircle>

          <HeroInner>
            <HeroLeftCol>
              <HeroTopBlock>
                <AvatarCircle>
                  <AvatarImg src={avatarSrc} alt={`${player.nickname} 프로필`} />
                </AvatarCircle>

                <HeroTitleBlock>
                  <HeroNameRow>
                    <HeroName>{player.nickname}</HeroName>
                    {player.isTeamCaptain === true ? <CaptainPill>팀장</CaptainPill> : null}
                  </HeroNameRow>

                  <HeroMetaRow>
                    {age && <span>{age}세</span>}
                    {player.heightCm && <span>{player.heightCm}cm</span>}
                    {player.weightKg && <span>{player.weightKg}kg</span>}
                    {player.clubName && <span>{player.clubName}</span>}
                  </HeroMetaRow>
                </HeroTitleBlock>
              </HeroTopBlock>

              <HeroChipRow>
                <HeroChip>{positionLabel}</HeroChip>
                <SkillChip $skill={player.skillLevel}>{skillLabel}</SkillChip>
                {player.region && (
                  <HeroChip>
                    <FiMapPin size={10} />
                    {player.region}
                  </HeroChip>
                )}
              </HeroChipRow>
            </HeroLeftCol>

            <HeroRightCol>
              {!isSelf && (
                <FavoriteButton onClick={onFavoritePlayer} disabled={favBusy}>
                  <FiStar size={13} color={fav ? "#f59e0b" : "#92400e"} />
                  {fav ? "즐겨찾기 해제" : "즐겨찾기"}
                </FavoriteButton>
              )}
            </HeroRightCol>
          </HeroInner>
        </HeroWrap>

        <ContentWrap>
          <Section>
            <SectionHeaderRow>
              <SectionHeaderLeft>
                <SectionIconCircle>
                  <SectionIconImg
                    src={images.playerProfileIcon || images.teamMembersIcon || images.logo}
                    alt="선수 프로필"
                  />
                </SectionIconCircle>
                <SectionTitleText>선수 프로필</SectionTitleText>
              </SectionHeaderLeft>
            </SectionHeaderRow>

            <MetaGrid>
              <MetaItem>
                <MetaLabel>포지션</MetaLabel>
                <MetaValue>{positionLabel}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>실력</MetaLabel>
                <MetaValue>{skillLabel}</MetaValue>
              </MetaItem>
              {player.heightCm && (
                <MetaItem>
                  <MetaLabel>키</MetaLabel>
                  <MetaValue>{player.heightCm}cm</MetaValue>
                </MetaItem>
              )}
              {player.weightKg && (
                <MetaItem>
                  <MetaLabel>체중</MetaLabel>
                  <MetaValue>{player.weightKg}kg</MetaValue>
                </MetaItem>
              )}
            </MetaGrid>

            {player.intro && <AboutText>{player.intro}</AboutText>}
          </Section>

          {player.clubId ? (
            <Section>
              <SectionHeaderRow>
                <SectionHeaderLeft>
                  <SectionIconCircle>
                    <SectionIconImg src={images.teamIntroIcon || images.logo} alt="소속 팀" />
                  </SectionIconCircle>
                  <SectionTitleText>소속 팀</SectionTitleText>
                </SectionHeaderLeft>
                <SectionMeta style={{ cursor: "pointer" }} onClick={onViewTeam}>
                  팀 보기
                </SectionMeta>
              </SectionHeaderRow>

              <TeamInfoRow>
                <TeamBasicRow>
                  <TeamLogoCircle>
                    <TeamLogoImg src={teamLogoSrc} alt={player.clubName || "소속 팀"} />
                  </TeamLogoCircle>
                  <div>
                    <TeamNameText>{player.clubName || "팀"}</TeamNameText>
                    <TeamMetaText>
                      <FiMapPin size={12} />
                      {player.clubRegion || "생활체육 팀"}
                    </TeamMetaText>
                  </div>
                </TeamBasicRow>
              </TeamInfoRow>
            </Section>
          ) : null}

          <Section>
            <SectionHeaderRow>
              <SectionHeaderLeft>
                <SectionIconCircle>
                  <SectionIconImg
                    src={images.teamMediaIcon || images.teamHighlightIcon || images.logo}
                    alt="경기 사진/영상"
                  />
                </SectionIconCircle>
                <SectionTitleText>경기 사진 / 영상</SectionTitleText>
              </SectionHeaderLeft>
            </SectionHeaderRow>

            {mediaList.length > 0 ? (
              <MediaList>
                {mediaList.map((m) => (
                  <MediaItem key={m.id || m.url}>
                    <MediaCard onClick={() => onMediaClick(m)}>
                      {m.thumbnailUrl ? (
                        <MediaImg src={m.thumbnailUrl} alt={m.title || "media"} />
                      ) : (
                        <MediaImg src={m.url} alt={m.title || "media"} />
                      )}
                    </MediaCard>
                    {m.title ? <MediaTitle>{m.title}</MediaTitle> : null}
                  </MediaItem>
                ))}
              </MediaList>
            ) : (
              <PlaceholderText>등록된 미디어가 없습니다.</PlaceholderText>
            )}
          </Section>
        </ContentWrap>
      </ScrollArea>

      <BottomBar>
        <BottomRow>
          <CTAButton onClick={onMatchWithPlayer} disabled={chatBusy}>
            <TbBallBasketball size={18} />
            이 선수와 채팅
          </CTAButton>
        </BottomRow>
      </BottomBar>
    </Page>
  );
}
