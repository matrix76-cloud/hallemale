import React from "react";
import EmptyState from "../../components/common/EmptyState";

export default function GymListPage() {
  return (
    <div>
      <h2>커뮤니티</h2>
      <EmptyState text="아직 게시글이 없습니다." sub="첫 번째 경기 후기를 남겨보세요." />
    </div>
  );
}
