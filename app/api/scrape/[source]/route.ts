import { NextRequest, NextResponse } from "next/server";
import { scrapeAll, scrapeSource } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { source: string };

export async function GET(req: NextRequest, ctx: { params: Promise<Params> }) {
  const { source } = await ctx.params;
  const s = (source || "").toLowerCase();

  const pagesParam = req.nextUrl.searchParams.get("pages");
  const pages = Math.max(1, Math.min(5, Number(pagesParam ?? 3)));

  if (s === "all") {
    const data = await scrapeAll(pages);
    return NextResponse.json(data);
  }

  if (!["nongmin","ikpnews","agrinet","aflnews"].includes(s)) {
    return NextResponse.json(
      { error: "source must be one of: nongmin, ikpnews, agrinet, aflnews, all" },
      { status: 400 }
    );
  }

  const data = await scrapeSource(s as any, pages);
  return NextResponse.json(data);
}
