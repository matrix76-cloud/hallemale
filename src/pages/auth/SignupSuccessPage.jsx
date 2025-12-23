/* eslint-disable */
// src/pages/auth/SignupSuccessPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import InfoDialog from "../../components/common/InfoDialog";

export default function SignupSuccessPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <InfoDialog
      open={open}
      tone="success"
      title="회원가입이 완료됐어요"
      message={"이제 로그인해서 팀에 가입하고\n매칭을 시작해보세요!"}
      primaryText="로그인하러 가기"
      onPrimary={() => navigate("/login", { replace: true })}
      secondaryText="닫기"
      onClose={() => {
        setOpen(false);
        navigate("/login", { replace: true });
      }}
      hideSecondary={false}
      showClose={true}
      closeOnOverlay={false}
    />
  );
}
