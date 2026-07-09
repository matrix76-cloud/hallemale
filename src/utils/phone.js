// 전화번호 표시 헬퍼
// users.phoneE164 는 E.164 형식("+821012345678")으로 저장된다.
// 화면에는 국내 표기("010-1234-5678")로 보여준다.

/** E.164 → 표시용 국내 형식. 국내번호가 아니거나 형식이 다르면 원본 그대로. */
export function formatPhoneE164(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  const m = /^\+82(\d{8,10})$/.exec(s);
  if (!m) return s;

  const d = `0${m[1]}`;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
