"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ArticleItem from "./ArticleItem";

type RSSItem = { id:string; source:string; title:string; link:string; publishedAt?:string; description?:string; };
type Unified = { from:"RSS"|"SCRAPE"; sourceLabel:string; title:string; url:string; publishedAt?:string; html?:string; };

function unifyRSS(rss: RSSItem[]): Unified[] {
  return rss.map(a => ({ from:"RSS", sourceLabel:a.source, title:a.title, url:a.link, publishedAt:a.publishedAt, html:a.description }));
}

function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

type SourceStatus = "idle"|"loading"|"done"|"error";
type PerSource = { key:string; label:string; total:number; done:number; status:SourceStatus; received:number; note?:string };

const SCRAPE_SOURCES = [
  { key:"nongmin",  label:"농민신문"     },
  { key:"ikpnews",  label:"농정신문"     },
  { key:"agrinet",  label:"농어민신문"   },
  { key:"aflnews",  label:"농수축산신문" },
] as const;

export default function ClientScrape({ rss }: { rss: RSSItem[] }) {
  const rssUnified = unifyRSS(rss);
  const [items, setItems] = useState<Unified[]>(rssUnified);
  const [completed, setCompleted] = useState<number>(rssUnified.length);
  const [planned,   setPlanned]   = useState<number>(rssUnified.length);
  const [status, setStatus] = useState("RSS 준비 완료");
  const [err, setErr] = useState<string|null>(null);
  const [perSource, setPerSource] = useState<PerSource[]>(
    SCRAPE_SOURCES.map(s=>({ key:s.key, label:s.label, total:0, done:0, status:"idle", received:0 }))
  );
  const [loading, setLoading] = useState(false);

  const urlMapRef = useRef<Map<string, boolean>>(new Map(rssUnified.map(u=>[u.url,true])));
  const startedRef = useRef(false);
  const progress = useMemo(()=> planned ? Math.round((completed/planned)*100) : 0, [completed, planned]);

  async function fetchOne(sourceKey:string, pages=1){
    const res = await fetch(`/api/scrape/${sourceKey}?pages=${pages}`, { cache:"no-store" });
    if (!res.ok) throw new Error(`${sourceKey} 요청 실패`);
    return await res.json() as any[];
  }

  function updateSource(key:string, patch: Partial<PerSource>){
    setPerSource(prev => prev.map(s => s.key===key ? {...s, ...patch} : s));
  }

  async function appendArticlesOneByOne(sourceKey:string, sourceLabel:string, data:any[]){
    updateSource(sourceKey, { received:data.length, total:data.length, note: data.length===0 ? "수신 0건" : undefined });
    setPlanned(prev => prev + data.length);

    let showedOne = false; // 디버그: 최소 1건은 화면에 나오게 보장

    for (const a of data) {
      const u: Unified = {
        from:"SCRAPE",
        sourceLabel: a.source || sourceLabel,
        title: (a.title || "").trim(),
        url: (a.url || a.link || "").trim(),
        publishedAt: a.publishedAt,
        html: a.content || a.description || "",
      };

      if (!u.url) continue; // url 없으면 스킵

      if (!urlMapRef.current.has(u.url)) {
        urlMapRef.current.set(u.url, true);
        setItems(prev => {
          const next = [...prev, u].sort((x,y)=>{
            const tx = x.publishedAt ? +new Date(x.publishedAt) : 0;
            const ty = y.publishedAt ? +new Date(y.publishedAt) : 0;
            return ty - tx;
          });
          return next;
        });
        setCompleted(prev => prev + 1);
        updateSource(sourceKey, { done: (perSource.find(s=>s.key===sourceKey)?.done ?? 0) + 1 });
        showedOne = true;
      }
      setStatus(`${sourceLabel} 수집 중… ${u.title.slice(0,40)}`);
      await sleep(5);
    }

    // 디버그 안전장치: 수신>0 이었는데 모두 중복 처리되어 화면에 0건이라면 맨 앞 1건은 강제로 보여줌
    if (data.length > 0 && !showedOne) {
      const a = data[0];
      const fallbackUrl = (a.url || a.link || "").trim();
      if (fallbackUrl && !urlMapRef.current.has(fallbackUrl)) {
        const u: Unified = {
          from:"SCRAPE",
          sourceLabel: a.source || sourceLabel,
          title: (a.title || "").trim() || `${sourceLabel} 기사`,
          url: fallbackUrl,
          publishedAt: a.publishedAt,
          html: a.content || a.description || "",
        };
        urlMapRef.current.set(u.url, true);
        setItems(prev => [u, ...prev]);
        setCompleted(prev => prev + 1);
        updateSource(sourceKey, { done: (perSource.find(s=>s.key===sourceKey)?.done ?? 0) + 1, note:"중복으로 숨김 → 1건 강표" });
      }
    }
  }

  async function loadAll(){
    try{
      setLoading(true); setErr(null); setStatus("자동 시작…");
      for (const s of SCRAPE_SOURCES){
        updateSource(s.key, { status:"loading", total:0, done:0, received:0, note:undefined });
        setStatus(`${s.label} 링크 불러오는 중…`);
        const data = await fetchOne(s.key, 1).catch(e=>{
          console.error(e);
          setErr(prev => prev ? `${prev}, ${s.label} 실패` : `${s.label} 실패`);
          updateSource(s.key, { status:"error", note:e.message });
          return [] as any[];
        });
        await appendArticlesOneByOne(s.key, s.label, data);
        updateSource(s.key, { status:"done" });
      }
      setStatus("완료");
    }catch(e:any){
      setErr(e.message || "불러오기 실패");
      setStatus("오류");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    if (startedRef.current) return;
    startedRef.current = true;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button onClick={loadAll} disabled={loading} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
            {loading ? "불러오는 중…" : "다시 불러오기"}
          </button>
          <span className="text-sm text-neutral-300">{status}</span>
        </div>

        {/* 전체 진행률 */}
        <div className="h-2 w-full bg-neutral-800 rounded">
          <div className="h-2 bg-blue-500 rounded transition-all" style={{ width: `${Math.max(0,Math.min(100,progress))}%` }} />
        </div>
        <div className="flex gap-3 text-xs text-neutral-400">
          <span>진행: {completed} / {planned}건</span>
          {err && <span className="text-red-400">{err}</span>}
        </div>

        {/* 매체별 상태 + 수신건수 디버그 표시 */}
        <div className="flex flex-wrap gap-4 text-xs">
          {perSource.map(s=>{
            const icon = s.status==="done" ? "✔" : s.status==="loading" ? "●" : s.status==="error" ? "✖" : "○";
            const color = s.status==="done" ? "text-green-400" : s.status==="loading" ? "text-blue-400" : s.status==="error" ? "text-red-400" : "text-neutral-400";
            const extra = ` 수신:${s.received}건 표시:${s.done}/${s.total}${s.note?` • ${s.note}`:""}`;
            return <span key={s.key} className={color}>{icon} {s.label}{extra}</span>;
          })}
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((a, idx)=>(
          <ArticleItem
            key={`${a.from}-${a.url || idx}`}
            title={a.title}
            source={a.sourceLabel}
            publishedAt={a.publishedAt ?? ""}
            link={a.url}
            description={a.html ?? ""}
          />
        ))}
      </ul>
    </>
  );
}
