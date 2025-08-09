import Link from "next/link";

type Item = {
  id: string;
  source: string;
  title: string;
  url: string;
  publishedAt?: string;
  content?: string;
};

async function fetchJson(path:string){
  const r = await fetch(path, { cache: "no-store" });
  return r.json();
}

export default async function ScrapePage() {
  const data: Item[] = await fetchJson(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/scrape/all?pages=3`).catch(()=>[]);
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">언론사 스크래핑(3p)</h1>
      <p className="text-sm text-neutral-400 mb-6">NONGMIN / IKPNEWS / AGRINET</p>
      <ul className="space-y-4">
        {data.map((a)=>(
          <li key={a.id} className="border border-neutral-800 rounded-lg p-4 bg-neutral-900">
            <div className="text-xs text-neutral-400 mb-1">{a.source} {a.publishedAt ? `• ${a.publishedAt}` : ""}</div>
            <Link href={a.url} target="_blank" className="font-medium text-neutral-100 hover:underline">{a.title}</Link>
            <div className="mt-3 text-neutral-100/90 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: a.content || "" }} />
          </li>
        ))}
      </ul>
    </main>
  )
}
