/* eslint-disable */
// src/constants/kakaoChannel.js
// 카카오톡 채널(챗봇) 상담 진입점.
//
// 채널 공개 ID 는 챗봇 관리자센터 > 채널 관리에서 확인할 수 있고 `_` 로 시작한다(예: _abcdEF).
// .env.production 에 REACT_APP_KAKAO_CHANNEL_ID 로 넣는다. 값이 없으면 버튼 자체를 감춘다
// — 링크가 없는 상태로 버튼만 보이면 눌러도 아무 일이 없어서 문의가 오히려 늘어난다.

const CHANNEL_ID = String(process.env.REACT_APP_KAKAO_CHANNEL_ID || "").trim();

/** 채널 채팅방(챗봇) 바로 열기. 설정 전이면 빈 문자열. */
export const KAKAO_CHANNEL_CHAT_URL = CHANNEL_ID
  ? `https://pf.kakao.com/${CHANNEL_ID}/chat`
  : "";

export const hasKakaoChannel = () => !!KAKAO_CHANNEL_CHAT_URL;

export function openKakaoChannelChat() {
  if (!KAKAO_CHANNEL_CHAT_URL) return false;
  window.open(KAKAO_CHANNEL_CHAT_URL, "_blank", "noopener,noreferrer");
  return true;
}
