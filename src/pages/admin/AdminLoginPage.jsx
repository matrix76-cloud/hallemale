/* eslint-disable */
// src/pages/admin/AdminLoginPage.jsx
import styled, { keyframes } from "styled-components";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_SESSION_KEY = "HALLE_ADMIN_AUTHED";

const Wrap = styled.div`
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #fff;
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.div`
  background: #141925;
  color: #cfd5e3;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 48px;
`;

const Body = styled.div`
  max-width: 420px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 40px;
  color: #101318;
`;

const Sub = styled.small`
  color: #8a93a4;
`;

const Field = styled.input`
  width: 100%;
  height: 48px;
  border-radius: 12px;
  padding: 0 14px;
  border: 1px solid #e2e6ef;
  font-size: 15px;
  &:focus {
    outline: 2px solid ${({ theme }) => theme.primarySoft || "#d6e4ff"};
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Btn = styled.button`
  height: 52px;
  border-radius: 12px;
  border: 0;
  cursor: pointer;
  width: 100%;
  background: ${({ theme }) => theme.primary || "#3655e7"};
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.2px;
  box-shadow: 0 10px 20px rgba(54, 85, 231, 0.2);
  &:hover {
    filter: brightness(0.98);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const rotate = keyframes`
  from{transform:rotate(0)}
  to{transform:rotate(360deg)}
`;

const Gear = styled.div`
  display: grid;
  gap: 18px;
  justify-items: center;
  text-align: center;
  .icon {
    width: 120px;
    height: 120px;
    border-radius: 60px;
    display: grid;
    place-items: center;
    animation: ${rotate} 8s linear infinite;
  }
  h3 {
    color: #fff;
    margin: 8px 0 0;
  }
  p {
    margin: 0;
    font-size: 13px;
    color: #9aa4b4;
    line-height: 1.6;
  }
`;

/* 비밀번호 입력 + 토글 버튼 래퍼 */
const PwRow = styled.div`
  position: relative;
  width: 100%;
`;

const PwToggle = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  padding: 4px 6px;
  font-size: 12px;
  color: #8a93a4;
  cursor: pointer;
  border-radius: 6px;
  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }
`;

export default function AdminLoginPage() {
  const nav = useNavigate();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [auto, setAuto] = useState(false);
  const [err, setErr] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const authed = localStorage.getItem(ADMIN_SESSION_KEY) === "1";
      if (authed) nav("/admin/dashboard", { replace: true });
    } catch (e) {}
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setErr("");

    const cleanId = String(id || "").trim();
    const cleanPw = String(pw || "").trim();

    if (!cleanId || !cleanPw) {
      setErr("아이디 또는 비밀번호를 입력해주세요.");
      return;
    }

    setBusy(true);
    try {
      // ✅ 개발용 관리자 로그인: id=1, pw=1
      if (cleanId === "1" && cleanPw === "1") {
        try {
          localStorage.setItem(ADMIN_SESSION_KEY, "1");
          if (auto) localStorage.setItem(`${ADMIN_SESSION_KEY}_AUTO`, "1");
          else localStorage.removeItem(`${ADMIN_SESSION_KEY}_AUTO`);
        } catch (e) {}
        nav("/admin/dashboard", { replace: true });
        return;
      }

      setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Panel>
        <Gear>
          <div className="icon">
            <svg
              width="90"
              height="90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.2l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10.4 2H10.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 22 10.5V10.5a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </div>
          <h3>할래말래 Admin</h3>
          <p>
            인증된 관리자만 로그인이 가능합니다.
            <br />
            접속 후 운영 규정을 준수해주세요.
          </p>
        </Gear>
      </Panel>

      <div
        style={{
          display: "grid",
          alignContent: "center",
          padding: "48px",
        }}
      >
        <Body as="form" onSubmit={onSubmit}>
          <div>
            <Title>HALLEMALLA</Title>
            <Sub>할래말래 통합 관리자</Sub>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#8a93a4" }}>아이디</label>
            <Field value={id} onChange={(e) => setId(e.target.value)} disabled={busy} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#8a93a4" }}>비밀번호</label>
            <PwRow>
              <Field
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                disabled={busy}
              />
              <PwToggle type="button" onClick={() => setShowPw((v) => !v)} disabled={busy}>
                {showPw ? "숨기기" : "보기"}
              </PwToggle>
            </PwRow>
          </div>

          <Row>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#666",
              }}
            >
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
                disabled={busy}
              />
              자동로그인
            </label>

            {err ? (
              <span style={{ color: "#e05757", fontSize: 13 }}>{err}</span>
            ) : (
              <span />
            )}
          </Row>

          <Btn type="submit" disabled={busy}>
            {busy ? "LOGIN..." : "LOGIN"}
          </Btn>

          <div
            style={{
              textAlign: "center",
              color: "#b0b5c0",
              fontSize: 12,
              marginTop: 6,
            }}
          >
            © HALLEMALLA ALL RIGHTS RESERVED.
          </div>
        </Body>
      </div>
    </Wrap>
  );
}
