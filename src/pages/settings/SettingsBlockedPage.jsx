/* eslint-disable */
// src/pages/settings/SettingsBlockedPage.jsx
// 내가 차단한 사용자 / 숨긴 게시글 목록 + 해제
// Apple App Store Guideline 1.2 대응 — 차단 관리 UI
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import { useAuth } from "../../hooks/useAuth";
import { getUserPublicMeta } from "../../services/counterpartService";
import {
  getMyBlockList,
  unblockUser,
  unhidePost,
} from "../../services/userBlockService";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

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
  color: ${({ theme }) => theme.colors.textWeak};
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
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 10px;
`;

const Avatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: ${({ theme }) => theme.colors.surface};
`;

const NameCol = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UnblockBtn = styled.button`
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  border-radius: 8px;
  cursor: pointer;
  &:active {
    background: ${({ theme }) => theme.colors.surface};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Notice = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin: 0 0 12px;
  line-height: 1.5;
`;

export default function SettingsBlockedPage() {
  // ⚠️ useAuth 는 user 가 아니라 firebaseUser 를 제공하고, normalized userDoc 은
  //    항상 id 를 세팅하지만 uid 는 없을 수 있다. 커뮤니티 차단(handleBlock)과 동일하게
  //    firebaseUser.uid → userDoc.uid → userDoc.id 순으로 계산해야 같은 user_blocks 문서를 읽는다.
  const { firebaseUser, userDoc } = useAuth();
  const myUid = String(firebaseUser?.uid || userDoc?.uid || userDoc?.id || "");

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [users, setUsers] = useState([]); // [{ uid, name, avatar }]
  const [hiddenPosts, setHiddenPosts] = useState([]); // [{ id, title }]

  const reload = useCallback(async () => {
    if (!myUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { blockedUids, hiddenPostIds } = await getMyBlockList(myUid);
      const [metaList, postList] = await Promise.all([
        Promise.all(
          blockedUids.map(async (uid) => {
            const m = await getUserPublicMeta(uid);
            return { uid, name: m?.name || "사용자", avatar: m?.avatar || "" };
          })
        ),
        Promise.all(
          (hiddenPostIds || []).map(async (pid) => {
            try {
              const s = await getDoc(doc(db, "community_posts", pid));
              const d = s.exists() ? s.data() || {} : {};
              const title = String(d.title || d.content || "").trim().slice(0, 40);
              return { id: pid, title: title || (s.exists() ? "게시글" : "삭제된 글"), exists: s.exists() };
            } catch (e) {
              return { id: pid, title: "게시글", exists: true };
            }
          })
        ),
      ]);
      setUsers(metaList);
      setHiddenPosts(postList);
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
    if (!await showConfirm("이 사용자의 차단을 해제하시겠습니까?")) return;
    setBusy((b) => ({ ...b, [`u_${targetUid}`]: true }));
    try {
      await unblockUser({ myUid, targetUid });
      setUsers((prev) => prev.filter((u) => u.uid !== targetUid));
    } catch (e) {
      showAlert(e?.message || "차단 해제에 실패했습니다.");
    } finally {
      setBusy((b) => ({ ...b, [`u_${targetUid}`]: false }));
    }
  };

  const handleUnhidePost = async (postId) => {
    if (!myUid || !postId) return;
    if (!await showConfirm("이 게시글 숨김을 해제하시겠습니까?")) return;
    setBusy((b) => ({ ...b, [`p_${postId}`]: true }));
    try {
      await unhidePost({ myUid, postId });
      setHiddenPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      showAlert(e?.message || "숨김 해제에 실패했습니다.");
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
        차단한 사용자의 게시글과 댓글은 회원님 피드에서 보이지 않습니다.
        <br />
        아래 목록에서 언제든 차단을 해제할 수 있습니다.
      </Notice>

      <SectionTitle>차단한 사용자 ({users.length})</SectionTitle>
      {users.length === 0 ? (
        <EmptyState text="차단한 사용자가 없습니다." />
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

      <SectionTitle>숨긴 게시글 ({hiddenPosts.length})</SectionTitle>
      {hiddenPosts.length === 0 ? (
        <EmptyState text="숨긴 게시글이 없습니다." compact />
      ) : (
        <List>
          {hiddenPosts.map((p) => (
            <Item key={p.id}>
              <NameCol
                as="button"
                type="button"
                onClick={() => p.exists && navigate(`/communitypost/${p.id}`)}
                style={{ textAlign: "left", border: "none", background: "transparent", cursor: p.exists ? "pointer" : "default" }}
              >
                {p.title}
              </NameCol>
              <UnblockBtn
                type="button"
                disabled={!!busy[`p_${p.id}`]}
                onClick={() => handleUnhidePost(p.id)}
              >
                {busy[`p_${p.id}`] ? "해제중…" : "숨김 해제"}
              </UnblockBtn>
            </Item>
          ))}
        </List>
      )}
    </Wrap>
  );
}
