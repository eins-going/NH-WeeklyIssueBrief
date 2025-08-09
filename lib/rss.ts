import Parser from "rss-parser";
import sanitizeHtml from "sanitize-html";
import he from "he";

export type RSSArticle = {
  id: string;
  source: "농림축산식품부" | "통계청" | "농촌진흥청";
  title: string;
  link: string;
  publishedAt: string;
  description: string; // HTML
};

const FEEDS: { url: string; source: RSSArticle["source"] }[] = [
  { url: "https://www.korea.kr/rss/dept_mafra.xml",  source: "농림축산식품부" },
  { url: "https://www.korea.kr/rss/dept_kostat.xml", source: "통계청" },
  { url: "https://www.korea.kr/rss/dept_rda.xml",    source: "농촌진흥청" },
];

const parser = new Parser({ timeout: 10000, headers: { "User-Agent": "rss-news/1.0" } });

function toISO(dateLike?: string) {
  const d = dateLike ? new Date(dateLike) : null;
  return d && !isNaN(+d) ? d.toISOString() : new Date(0).toISOString();
}

function cleanWeirdChars(s: string) {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(s?: string) {
  if (!s) return "(제목 없음)";
  const decoded = he.decode(s);
  return cleanWeirdChars(decoded.replace(/·/g, " ").replace(/&middot;/gi, " "));
}

function cleanHtml(html?: string) {
  if (!html) return "";
  const decoded = he.decode(html);
  const sanitized = sanitizeHtml(decoded, {
    allowedTags: ["p","br","ul","ol","li","b","strong","i","em","u","blockquote","a"],
    allowedAttributes: { a: ["href","title","target","rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target:"_blank", rel:"nofollow noopener noreferrer" }),
    },
    allowedSchemes: ["http","https","mailto"],
  });
  return cleanWeirdChars(sanitized);
}

export async function fetchAllRSS(): Promise<RSSArticle[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return (feed.items || []).map((item) => {
        const rawDesc =
          (item as any).description ||
          (item as any).content ||
          (item as any).summary ||
          (item as any).contentSnippet ||
          "";

        return {
          id: (item.guid || item.link || item.title || Math.random().toString(36)).toString(),
          source: f.source,
          title: cleanTitle(item.title),
          link: item.link || "#",
          publishedAt: toISO((item as any).isoDate || (item as any).pubDate),
          description: cleanHtml(rawDesc),
        } as RSSArticle;
      });
    })
  );

  const flat = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const dedup = new Map<string, RSSArticle>();
  for (const a of flat) if (!dedup.has(a.link)) dedup.set(a.link, a);

  return [...dedup.values()].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );
}
