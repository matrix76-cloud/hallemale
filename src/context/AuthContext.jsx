import React, { createContext, useContext, useState, useEffect } from "react";

const MOCK_USER = {
  id: "devUser",
  nickname: "개발자",
  clubId: null,
  mainPosition: "guard",
  skillLevel: "intermediate"
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기엔 "로그인 안 된 상태"로 시작
    setLoading(false);
  }, []);

  const loginAsMock = async () => {
    setUserDoc(MOCK_USER);
  };

  const value = {
    firebaseUser: null,
    userDoc,
    loading,
    isLoggedIn: !!userDoc,
    loginAsMock,
    refreshUser: async () => {},
    signOut: async () => {
      setUserDoc(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
