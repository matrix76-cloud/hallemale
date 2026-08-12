// src/utils/passwordPolicy.js
// 비밀번호 정책 단일 출처 — 가입(EmailSignupPage)과 변경(ChangePasswordPage)이 같은 규칙을 쓴다.
// 서버가 발급하는 임시 비밀번호(functions/otp/phoneOtp.js genTempPassword)도 이 규칙을 만족한다.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 32;
export const PASSWORD_RULE_TEXT = "영문과 숫자를 포함해 8자 이상";

/**
 * 비밀번호 검사
 * @returns {string} 문제가 없으면 "" , 있으면 사용자에게 보여줄 문구
 */
export function checkPassword(pw) {
  const s = String(pw || "");
  if (s.length < PASSWORD_MIN || s.length > PASSWORD_MAX) {
    return `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해 주세요.`;
  }
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) {
    return "비밀번호에 영문과 숫자를 모두 포함해 주세요.";
  }
  return "";
}
