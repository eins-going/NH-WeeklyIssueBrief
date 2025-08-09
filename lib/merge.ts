import { RSSArticle } from "./rss";
import { NewsItem } from "./types";

export type UnifiedItem = {
  id: string;
  from: "RSS" | "SCRAPE";
  sourceKey: string;   // 내부 표기 (한글)
  sourceLabel: string; // 화면 표시용 (한글)
  title: string;
  url: string;
  publishedAt?: string;
  html?: string;
};

export function mapRSS(list: RSSArticle[]): UnifiedItem[] {
  return list.map(a => ({
    id: a.id,
    from: "RSS",
    sourceKey: a.source,
    sourceLabel: a.source,
    title: a.title,
    url: a.link,
    publishedAt: a.publishedAt,
    html: a.description,
  }));
}

export function mapSCRAPE(list: NewsItem[]): UnifiedItem[] {
  return list.map(a => ({
    id: a.id,
    from: "SCRAPE",
    sourceKey: a.source,
    sourceLabel: a.source,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    html: a.content || a.description || "",
  }));
}
