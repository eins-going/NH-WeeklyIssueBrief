import { NewsItem } from "../types";
import { scrapeNongmin } from "./nongmin";
import { scrapeIkpnews } from "./ikpnews";
import { scrapeAgrinet } from "./agrinet";
import { scrapeAflnews } from "./aflnews";

export async function scrapeSource(
  source: "nongmin"|"ikpnews"|"agrinet"|"aflnews",
  pages=3
): Promise<NewsItem[]> {
  if (source === "nongmin")  return await scrapeNongmin(pages);
  if (source === "ikpnews")  return await scrapeIkpnews(pages);
  if (source === "agrinet")  return await scrapeAgrinet(pages);
  if (source === "aflnews")  return await scrapeAflnews(pages);
  return [];
}

export async function scrapeAll(pages=3){
  const settled = await Promise.allSettled([
    scrapeNongmin(pages),
    scrapeIkpnews(pages),
    scrapeAgrinet(pages),
    scrapeAflnews(pages),
  ]);
  const flat = (x:any)=> x.status==="fulfilled" ? x.value : [];
  return settled.flatMap(flat);
}
