/* eslint-disable */
// src/pages/settings/SettingsBlockedPage.jsx
// 내가 차단한 사용자 / 숨긴 게시글 목록 + 해제
// Apple App Store Guideline 1.2 대응 — 차단 관리 UI
import React, { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { getUserPublicMeta } from "../../services/counterpartService";
import {
  getMyBlockList,
  unblockUser,
  unhidePost,
} from "../../services/userBlockService";
import Spinner from "../../components/common/Spinner";

const Wrap = styled.div`
  padding: 16px 16px 32px;
  max-width: 720px;
  margin: 0 auto;
`;

const H2 = styled.h2`
  margin: 0 0 12px;
  font-size: 18px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const SectionTitle = styled.h3`
  margin: 20px 0 8px;
  font-size: 14px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#374151"};
`;

const Empty = styled.p`
  font-size: 13px;
  color: #6b7280;
  padding: 12px 0;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 10px;
`;

const Avatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: #f3f4f6;
`;

const NameCol = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PostText = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UnblockBtn = styled.button`
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  border-radius: 8px;
  cursor: pointer;
  &:active {
    background: #f3f4f6;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Notice = styled.p`
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 12px;
  line-height: 1.5;
`;

export default function SettingsBlockedPage() {
  const { user, userDoc } = useAuth();
  const myUid = String(userDoc?.uid || user?.uid || "");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [users, setUsers] = useState([]); // [{ uid, name, avatar }]
  const [posts, setPosts] = useState([]); // [{ postId }]

  const reload = useCallback(async () => {
    if (!myUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { blockedUids, hiddenPostIds } = await getMyBlockList(myUid);
      const metaList = await Promise.all(
        blockedUids.map(async (uid) => {
          const m = await getUserPublicMeta(uid);
          return { uid, name: m?.name || "사용자", avatar: m?.avatar || "" };
        })
      );
      setUsers(metaList);
      setPosts(hiddenPostIds.map((id) => ({ postId: id })));
    } catch (e) {
      console.warn("[SettingsBlockedPage] reload failed", e?.message || e);
    } finally {
      setLoading(false);
    }
  }, [myUid]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleUnblockUser = async (targetUid) => {
    if (!myUid || !targetUid) return;
    if (!window.confirm("이 사용자의 차단을 해제하시겠습니까?")) return;
    setBusy((b) => ({ ...b, [`u_${targetUid}`]: true }));
    try {
      await unblockUser({ myUid, targetUid });
      setUsers((prev) => prev.filter((u) => u.uid !== targetUid));
    } catch (e) {
      alert(e?.message || "차단 해제에 실패했습니다.");
    } finally {
      setBusy((b) => ({ ...b, [`u_${targetUid}`]: false }));
    }
  };

  const handleUnhidePost = async (postId) => {
    if (!myUid || !postId) return;
    if (!window.confirm("이 게시글 숨김을 해제하시겠습니까?")) return;
    setBusy((b) => ({ ...b, [`p_${postId}`]: true }));
    try {
      await unhidePost({ myUid, postId });
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
    } catch (e) {
      alert(e?.message || "숨김 해제에 실패했습니다.");
    } finally {
      setBusy((b) => ({ ...b, [`p_${postId}`]: false }));
    }
  };

  if (loading) {
    return (
      <Wrap>
        <Spinner />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <H2>차단 관리</H2>
      <Notice>
        신고하거나 차단한 사용자/게시글은 회원님 피드에서 즉시 숨겨집니다.
        <br />
        아래 목록에서 언제든 해제할 수 있습니다.
      </Notice>

      <SectionTitle>차단한 사용자 ({users.length})</SectionTitle>
      {users.length === 0 ? (
        <Empty>차단한 사용자가 없습니다.</Empty>
      ) : (
        <List>
          {users.map((u) => (
            <Item key={u.uid}>
              {u.avatar ? <Avatar src={u.avatar} alt="" /> : <Avatar as="div" />}
              <NameCol>{u.name}</NameCol>
              <UnblockBtn
                type="button"
                disabled={!!busy[`u_${u.uid}`]}
                onClick={() => handleUnblockUser(u.uid)}
              >
                {busy[`u_${u.uid}`] ? "해제중…" : "차단 해제"}
              </UnblockBtn>
            </Item>
          ))}
        </List>
      )}

      <SectionTitle>숨긴 게시글 ({posts.length})</SectionTitle>
      {posts.length === 0 ? (
        <Empty>숨긴 게시글이 없습니다.</Empty>
      ) : (
        <List>
          {posts.map((p) => (
            <Item key={p.postId}>
              <PostText>게시글 ID: {p.postId}</PostText>
              <UnblockBtn
                type="button"
                disabled={!!busy[`p_${p.postId}`]}
                onClick={() => handleUnhidePost(p.postId)}
              >
                {busy[`p_${p.postId}`] ? "해제중…" : "숨김 해제"}
              </UnblockBtn>
            </Item>
          ))}
        </List>
      )}
    </Wrap>
  );
}
