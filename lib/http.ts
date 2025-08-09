import iconv from "iconv-lite";

export async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

function sniffCharsetFromHeaders(contentType?: string): string | null {
  if (!contentType) return null;
  const m = contentType.match(/charset=([^;]+)/i);
  return m ? m[1].toLowerCase() : null;
}
function sniffCharsetFromHtml(buf:Buffer): string | null {
  // meta charset, http-equiv
  const head = buf.toString("ascii"); // 헤더 부분만 가볍게
  const m1 = head.match(/<meta[^>]+charset=["']?([\w-]+)["']?/i);
  if (m1) return m1[1].toLowerCase();
  const m2 = head.match(/<meta[^>]+http-equiv=["']content-type["'][^>]+content=["'][^"']*charset=([\w-]+)[^"']*["']/i);
  return m2 ? m2[1].toLowerCase() : null;
}

export async function fetchHTML(url:string, init: RequestInit = {}, delayMs=700): Promise<string> {
  await sleep(delayMs);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    ...init,
    cache: "no-store",
  } as RequestInit);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);

  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);

  // 1) 헤더 → 2) HTML 메타 → 3) 기본 utf-8
  const hCharset = sniffCharsetFromHeaders(res.headers.get("content-type") || undefined);
  const mCharset = sniffCharsetFromHtml(buf);
  const charset = (hCharset || mCharset || "utf-8").toLowerCase();

  try {
    if (charset.includes("euc-kr") || charset.includes("ks_c_5601") || charset.includes("cp949")) {
      return iconv.decode(buf, "euc-kr");
    }
    return iconv.decode(buf, "utf-8");
  } catch {
    // 최후의 보루
    return buf.toString("utf-8");
  }
}
