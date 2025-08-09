import { fetchAllRSS } from "@/lib/rss";
import ClientScrape from "./components/ClientScrape";

export const revalidate = 600;

export default async function HomePage() {
  const rss = await fetchAllRSS();
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">농정 뉴스 통합 타임라인</h1>
      <p className="text-sm text-neutral-400 mb-4">먼저 RSS만 표시합니다. 버튼으로 언론사 스크랩을 불러오세요.</p>
      <ClientScrape rss={rss} />
    </main>
  );
}
