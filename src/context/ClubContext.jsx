import React, { createContext, useContext, useState, useEffect } from "react";

const MOCK_CLUB = {
  id: "devClub",
  name: "청춘호랑이",
  region: "성북구",
  stats: {
    totalMatches: 18,
    wins: 12,
    losses: 6,
    draws: 0,
    winRate: 0.667
  }
};

const MOCK_MEMBERS = [
  {
    userId: "devUser",
    nickname: "개발자",
    mainPosition: "guard",
    skillLevel: "intermediate",
    role: "leader"
  },
  {
    userId: "member2",
    nickname: "문경빈",
    mainPosition: "forward",
    skillLevel: "intermediate",
    role: "member"
  },
  {
    userId: "member3",
    nickname: "한주성",
    mainPosition: "center",
    skillLevel: "advanced",
    role: "member"
  },
  {
    userId: "member4",
    nickname: "김민준",
    mainPosition: "forward",
    skillLevel: "beginner",
    role: "member"
  }
];

const ClubContext = createContext(null);

export function ClubProvider({ children }) {
  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기엔 클럽 없는 상태
    setLoading(false);
  }, []);

  const createMockClub = async () => {
    setClub(MOCK_CLUB);
    setMembers(MOCK_MEMBERS);
  };

  const value = {
    club,
    members,
    loading,
    isClubLeader:
      !!members.find((m) => m.userId === "devUser" && m.role === "leader"),
    createMockClub,
    refreshClub: async () => {},
    refreshMembers: async () => {}
  };

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClubContext() {
  return useContext(ClubContext);
}
