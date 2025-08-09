import * as cheerio from "cheerio";
import { fetchHTML } from "../http";
import { cleanHtml, pickTitle } from "../text";
import { NewsItem } from "../types";

const BASE = "https://www.aflnews.co.kr"\;
const SRC = "농수축산신문" as const;

function listUrl(page:number){
  return `${BASE}/news/articleList.html?page=${page}&view_type=sm`;
}

function extractBody($:cheerio.CheerioAPI){
  const candidates = [
    "#articleBody", "#articleBodyContents", ".article-body", ".article-text",
    ".content", "#news_body", ".view_con", ".article_view"
  ];
  for(const sel of candidates){
    const el = $(sel);
    if (el.length) return cleanHtml(el.html() || "");
  }
  const fallback = $("#articleBody p, article p, .content p")
    .toArray().map(p=>$(p).html()).filter(Boolean).join("\n");
  return cleanHtml(fallback);
}

export async function scrapeAflnews(pages=3): Promise<NewsItem[]>{
  const items: NewsItem[] = [];
  for(let p=1; p<=pages; p++){
    const html = await fetchHTML(listUrl(p));
    const $ = cheerio.load(html);

    // 목록에서 기사 링크만 수집
    const links = new Set<string>();
    $('a[href*="news/articleView.html"]').each((_,a)=>{
      const href = $(a).attr("href") || "";
      if (!href) return;
      links.add(href.startsWith("http") ? href : BASE + href);
    });

    for(const url of links){
      try{
        const detail = await fetchHTML(url, {}, 900);
        const $$ = cheerio.load(detail);

        // 안전한 제목 추출
        const title = pickTitle([
          $$('meta[property="og:title"]').attr("content"),
          $$("h1, h2").first().text(),
          $$("title").first().text(),
        ]);
        if (!title) continue;

        const time =
          $$("time").attr("datetime") ||
          $$('meta[property="article:published_time"]').attr("content") || "";

        const body = extractBody($$) || cleanHtml($$('meta[name="description"]').attr("content") || "");
        if (!body) continue;

        items.push({ id:url, source:SRC, title, url, publishedAt: time || undefined, content: body });
      }catch(_e){}
      if(items.length >= 80) break; // 안전장치
    }
  }
  return items;
}
