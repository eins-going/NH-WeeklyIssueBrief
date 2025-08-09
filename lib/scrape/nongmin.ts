import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { fetchHTML, sleep } from "../http";
import { cleanHtml, pickTitle } from "../text";
import { toISOFromKoreanDate } from "../date";
import { NewsItem } from "../types";

const BASE = "https://www.nongmin.com"\;
const SRC = "농민신문" as const;
const DEBUG = process.env.SCRAPE_DEBUG === "1";

function listUrl(p:number){ return `${BASE}/list/10?page=${p}`; }
function abs(u?:string){ if(!u) return ""; if(/^https?:\/\//i.test(u)) return u; if(u.startsWith("//")) return "https:"+u; if(u.startsWith("/")) return BASE+u; return u; }

function collectArticleLinks($:cheerio.CheerioAPI): string[] {
  const links = new Set<string>();
  const sels = [
    `a[href^="${BASE}/article/"]`,'a[href^="/article/"]',
    `a[href^="${BASE}/news/"]`,'a[href^="/news/"]',
    'a[href*="articleView.html"]','.list a[href^="/article/"]',
    '.news_list a[href^="/article/"]','.article-list a[href^="/article/"]','main a[href^="/article/"]'
  ];
  $(sels.join(",")).each((_,a)=>{
    const href = ($(a).attr("href")||"").trim(); if(!href) return;
    const url = href.startsWith("http")?href:BASE+href;
    links.add(url.replace(/[#?].*$/,""));
  });
  return [...links];
}

/** 날짜 */
function extractPublishedISO($:cheerio.CheerioAPI): string|undefined {
  let iso: string|undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).contents().text() || "{}");
      const arr = Array.isArray(j) ? j : (j && j["@graph"] ? j["@graph"] : [j]);
      for (const o of arr) {
        const cand = o?.datePublished || o?.dateCreated || o?.uploadDate;
        if (cand && !iso) {
          const d = toISOFromKoreanDate(String(cand)) || new Date(String(cand)).toISOString();
          if (!isNaN(+new Date(d))) { iso = d; break; }
        }
      }
    } catch {}
  });
  if (iso) return iso;

  const meta =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $("time[datetime]").attr("datetime");
  if (meta) {
    const d = toISOFromKoreanDate(meta) || new Date(meta).toISOString();
    if (!isNaN(+new Date(d))) return d;
  }

  const t = [
    $(".date").first().text(), $(".info .date").first().text(),
    $(".byline .date").first().text(), $("time").first().text(),
    $(".article-header .date").first().text(), $(".view_head .date").first().text(),
    $(".tit-area .date").first().text(),
  ];
  for (const s of t) { const d = toISOFromKoreanDate(s); if (d) return d; }

  const whole = $("body").text();
  const m = whole.match(/입력\s*[:：]?\s*([0-9.\-\/년월일\s:]+)(?:\s*수정|$)/) || whole.match(/(\d{4}[.\-\/년\s]+\d{1,2}[.\-\/월\s]+\d{1,2})(?:\s*[시\s:]+\d{1,2}:\d{1,2}(?::\d{1,2})?)?/);
  if (m) { const d = toISOFromKoreanDate(m[1]); if (d) return d; }
  return;
}

/** 본문 컨테이너 후보에서 가장 긴 텍스트 선택 */
function pickContainerHtml($:cheerio.CheerioAPI, selectors: string[]): string {
  let best = "", bestLen = 0;
  for (const sel of selectors) {
    const root = $(sel).first();
    if (!root.length) continue;
    root.find("script,style,noscript,header,footer,nav").remove();
    root.find(".sns,.share,.share_wrap,.tag,.keyword,.related,.related-articles,.relate,.ad,.ads,.banner,.author,.byline,.reporter,.comment,.reply").remove();
    root.find("img").each((_,img)=>{
      const $img = $(img);
      const ds = $img.attr("data-src") || $img.attr("data-original") || $img.attr("data-lazy");
      if (ds && !$img.attr("src")) $img.attr("src", ds);
    });
    const textLen = root.text().replace(/\s+/g," ").trim().length;
    if (textLen > bestLen) { bestLen = textLen; best = root.html() || ""; }
  }
  return best;
}

/** 프린트 뷰 폴백: /article/ID → /article/ID/print 또는 ?output=print 시도 */
async function fetchPrintBody(url:string): Promise<string> {
  const trials = [
    url.replace(/\/article\/(\d+)(?:.*)$/, "/article/$1/print"),
    url + (url.includes("?") ? "&" : "?") + "output=print"
  ];
  for (const u of trials) {
    try {
      const html = await fetchHTML(u, {}, 0);
      const $$ = cheerio.load(html);
      const picked = pickContainerHtml($$, [
        ".print-area",".print_content",".article-body",".content","#content","article",".news_body","#news_body"
      ]);
      if (picked) return cleanHtml(picked);
    } catch {}
  }
  return "";
}

/** Readability 폴백 */
function readabilityExtract(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article) return { content: "", images: [] as string[] };
  const $ = cheerio.load(article.content);
  const imgs: string[] = [];
  $("img").each((_,img)=>{ const s = $(img).attr("src"); if (s && !imgs.includes(s)) imgs.push(s); });
  return { content: article.content, images: imgs.slice(0,6) };
}

function extractImages($:cheerio.CheerioAPI, scope?: cheerio.Cheerio<any>): string[] {
  const ctx = scope && scope.length ? scope : $.root();
  const out: string[] = [];
  ctx.find("img").each((_, img) => {
    const $img = $(img);
    const src = abs($img.attr("src") || $img.attr("data-src") || $img.attr("data-original") || "");
    if (src && !out.includes(src)) out.push(src);
  });
  return out.slice(0,6);
}

export async function scrapeNongmin(pages=1): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  for (let p=1; p<=pages; p++) {
    const html = await fetchHTML(listUrl(p));
    const $ = cheerio.load(html);
    const list = collectArticleLinks($);
    if (DEBUG) console.log(`[NONGMIN] page=${p} listLinks=${list.length}`);

    let ok=0, fail=0;
    for (const url of list) {
      try {
        await sleep(900);
        const detail = await fetchHTML(url, {}, 0);
        const $$ = cheerio.load(detail);

        const title = pickTitle([
          $$('meta[property="og:title"]').attr("content"),
          $$('meta[name="twitter:title"]').attr("content"),
          $$("h1, .title h1, .article-title h1, .view_head h1, .tit-area h1").first().text(),
          $$("title").first().text(),
        ]);
        if (!title) { fail++; if (DEBUG) console.log(`[NONGMIN] no title: ${url}`); continue; }

        // 1) 도메인 전용 컨테이너
        let htmlBody = pickContainerHtml($$, [
          ".article-body","#articleBody",".article_view",".view_con",".view-body",
          ".article-detail",".article-content",".post-content",".content-body",
          ".news_body","#news_body",".art_txt",".ct_article",
          "article .article-body","article .content","article .view_body"
        ]);
        let images: string[] = [];
        if (htmlBody) { const $$$ = cheerio.load(htmlBody); images = extractImages($$$); }

        // 2) 프린트 뷰 폴백
        if (!htmlBody) {
          if (DEBUG) console.log(`[NONGMIN] try PRINT body: ${url}`);
          htmlBody = await fetchPrintBody(url);
        }

        // 3) Readability 폴백
        if (!htmlBody) {
          const { content, images: imgs } = readabilityExtract(detail, url);
          htmlBody = content; images = imgs;
        }

        if (!htmlBody) { fail++; if (DEBUG) console.log(`[NONGMIN] no body: ${url}`); continue; }

        const publishedAt = extractPublishedISO($$);
        const ogImage = abs($$('meta[property="og:image"]').attr("content") || "");
        const thumbnail = ogImage || images[0] || "";

        items.push({ id:url, source:SRC, title, url, publishedAt, content: cleanHtml(htmlBody), images, thumbnail });
        ok++;
      } catch (e:any) {
        fail++;
        if (DEBUG) console.log(`[NONGMIN] error: ${url} -> ${e.message}`);
      }
      if (items.length >= 120) break;
    }
    if (DEBUG) console.log(`[NONGMIN] page=${p} done ok=${ok} fail=${fail}`);
  }
  return items;
}
