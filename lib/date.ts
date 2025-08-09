export function toISOFromKoreanDate(text?: string): string | undefined {
  if (!text) return;
  const s = String(text).trim();

  // 통일: 한글 단위(년월일시분초)는 구분자(.)로 치환
  const norm = s
    .replace(/[년월일]/g, ".")
    .replace(/[시:]/g, ":")
    .replace(/[분]/g, ":")
    .replace(/[초]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // yyyy.mm.dd hh:mm(:ss)?
  const m1 = norm.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m1) {
    const [, y, mo, d, hh="0", mm="0", ss="0"] = m1;
    const yyyy = Number(y);
    const MM = String(Number(mo)).padStart(2,"0");
    const DD = String(Number(d)).padStart(2,"0");
    const HH = String(Number(hh)).padStart(2,"0");
    const MN = String(Number(mm)).padStart(2,"0");
    const SS = String(Number(ss)).padStart(2,"0");
    const iso = new Date(`${yyyy}-${MM}-${DD}T${HH}:${MN}:${SS}+09:00`).toISOString();
    if (!isNaN(+new Date(iso))) return iso;
  }

  // yyyyMMdd
  const digits = norm.replace(/\D/g, "");
  if (digits.length === 8) {
    const yyyy = digits.slice(0,4);
    const MM = digits.slice(4,6);
    const DD = digits.slice(6,8);
    const iso = new Date(`${yyyy}-${MM}-${DD}T00:00:00+09:00`).toISOString();
    if (!isNaN(+new Date(iso))) return iso;
  }

  return;
}
