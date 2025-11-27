import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import { useClub } from "../../hooks/useClub";

export default function ClubOnboardingPage() {
  const navigate = useNavigate();
  const { createMockClub } = useClub();

  const handleCreateClub = async () => {
    await createMockClub();
    navigate("/home", { replace: true });
  };

  return (
    <div>
      <h2>클럽팀 온보딩</h2>
      <p>첫 시작은 내 클럽팀부터 만드는 것부터 시작해볼까요?</p>
      <Button fullWidth onClick={handleCreateClub}>
        Dev용 클럽 생성 (청춘호랑이)
      </Button>
    </div>
  );
}
