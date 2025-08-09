import Link from "next/link";

type Props = {
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  description: string;
};

export default function ArticleItem({ title, source, publishedAt, link, description }: Props) {
  return (
    <li className="border rounded-lg p-4 bg-neutral-900 border-neutral-800 shadow-sm">
      <details className="group">
        <summary className="list-none cursor-pointer w-full text-left flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-neutral-400 mb-1">
              {source}{publishedAt ? ` • ${new Date(publishedAt).toLocaleString("ko-KR")}` : ""}
            </div>
            <div className="font-medium leading-snug text-neutral-100">{title}</div>
          </div>
          <span className="shrink-0 text-neutral-500 group-open:rotate-90 transition">▸</span>
        </summary>

        <div className="mt-3">
          {description ? (
            <div
              className="max-w-none text-neutral-100/90 leading-relaxed text-[0.95rem]"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          ) : (
            <p className="text-sm text-neutral-400">본문이 제공되지 않는 기사입니다.</p>
          )}
          <div className="mt-3">
            <Link href={link || "#"} target="_blank" className="inline-flex items-center gap-1 text-blue-400 hover:underline text-sm">
              원문 보기 ↗
            </Link>
          </div>
        </div>
      </details>
    </li>
  );
}
