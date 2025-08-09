import sanitizeHtml from "sanitize-html";
import he from "he";

export function cleanWeirdChars(s: string) {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanText(s?: string) {
  if (!s) return "";
  return cleanWeirdChars(he.decode(s))
    .replace(/·/g, " ")
    .replace(/&middot;/gi, " ");
}

export function cleanHtml(html?: string) {
  if (!html) return "";
  let decoded = he.decode(html)
    .replace(/<img([^>]+)(?:data-src|data-original)=["']([^"']+)["']([^>]*)>/gi, '<img$1 src="$2"$3>');

  const sanitized = sanitizeHtml(decoded, {
    allowedTags: ["p","br","ul","ol","li","b","strong","i","em","u","blockquote","a","h3","h4","img","figure","figcaption"],
    allowedAttributes: {
      a: ["href","title","target","rel"],
      img: ["src","alt","title","loading","decoding"]
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target:"_blank", rel:"nofollow noopener noreferrer" }),
      img: sanitizeHtml.simpleTransform("img", { loading:"lazy", decoding:"async" }),
    },
    allowedSchemes: ["http","https","mailto"],
    // 너무 공격적이지 않게 최소 필터만
    exclusiveFilter(frame) {
      const cls = (frame.attribs?.class || "").toLowerCase();
      if (/(sns|share|ad|banner|related|keyword)/.test(cls)) return true;
      return false;
    }
  });
  return cleanWeirdChars(sanitized);
}

const BAD_TITLES = /^(상단영역|하단영역|전체메뉴|메뉴열기|검색|검색어입력|바로가기|본문건너뛰기)$/;
export function pickTitle(candidates: (string|undefined)[]) {
  for (const raw of candidates) {
    const t = cleanText(raw);
    if (!t) continue;
    if (t.length < 2) continue;
    if (BAD_TITLES.test(t)) continue;
    return t;
  }
  return "";
}
